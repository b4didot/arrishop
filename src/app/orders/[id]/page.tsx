import { OrderDelivery } from "@/components/order-delivery";
import { OrderConversation } from "@/components/order-conversation";
import { deliveryAvailability } from "@/lib/order-workflows";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOrder, publicImage } from "@/lib/data";
import { money } from "@/lib/format";
import { ReceiptUploadForm } from "@/components/receipt-upload-form";
import { OrderPlaced } from "@/components/checkout-form";
import { BackLink, Notice, PageHeading } from "@/components/ui";
import { OrderSummary, OrderTimeline, PaymentHistory } from "@/components/order-details";

export const metadata = { title: "Order details" };
export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser(`/orders/${id}`);
  const [detail, query, days] = await Promise.all([getOrder(id), searchParams, deliveryAvailability()]);
  // Admins also have broad RLS read access, but the customer route only displays their own orders.
  if (!detail || detail.order.customer_id !== user.id) notFound();
  const { order, items, payments, history, settings } = detail;
  const acceptsPayment = order.status === "pending_payment" || order.status === "payment_rejected";
  const canPay = acceptsPayment && (Boolean(order.slot_reserved_at) || days.some(day => day.delivery_date === order.delivery_date && day.available));
  const qr = publicImage(settings?.qr_path ?? null);
  return <div className="container page-container"><BackLink href="/orders">My orders</BackLink><PageHeading eyebrow="A LITTLE JOY IN THE MAKING" title={order.order_number} description="Payment instructions and every update, all in one place." />{query.placed === "1" && <OrderPlaced userId={user.id} />}<div className="two-column" style={{ marginTop: query.placed ? 24 : 0 }}><div><OrderDelivery order={order} days={days} /><OrderSummary order={order} items={items} /><PaymentHistory payments={payments} /></div><div>{acceptsPayment && !canPay && <Notice>Your selected delivery date is unavailable. Choose another available date before making a payment.</Notice>}{canPay && <section className="panel"><h2>{order.status === "payment_rejected" ? "Let's try that receipt again" : "Complete your payment"}</h2>{order.status === "payment_rejected" && <p className="message error-message" style={{ marginBottom: 18 }}>{payments.find((p) => p.decision === "rejected")?.rejection_reason ?? "Please upload a new receipt."}</p>}<p className="small muted">Pay the exact total: <strong>{money(order.total_centavos)}</strong></p>{qr ? <img src={qr} className="qr-image" alt="Shop payment QR code" /> : <Notice>The payment QR is temporarily unavailable. Please check back before paying.</Notice>}<p className="payment-instructions">{settings?.instructions}</p><ReceiptUploadForm orderId={order.id} replacement={order.status === "payment_rejected"} submissionKey={crypto.randomUUID()} /></section>}{order.status === "verifying_payment" && <Notice>Thanks! Your receipt is awaiting review. We'll update this page when your payment has been checked.</Notice>}{order.status === "payment_confirmed" && <Notice>Your payment is confirmed. We'll start preparing your order soon.</Notice>}{order.status === "processing" && <Notice>We're preparing your lovely finds. Check back here for the next update.</Notice>}{order.status === "completed" && <Notice>Your order is completed. Thank you for shopping with Arrie Store!</Notice>}{order.status === "cancelled" && <Notice>This order has been cancelled. See the order updates for the reason.</Notice>}<OrderTimeline history={history} /></div></div><OrderConversation order={order} items={items} /></div>;
}

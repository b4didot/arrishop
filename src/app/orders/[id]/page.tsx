import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOrder, publicImage } from "@/lib/data";
import { money } from "@/lib/format";
import { uploadReceipt } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { OrderPlaced } from "@/components/checkout-form";
import { BackLink, Field, Notice, PageHeading } from "@/components/ui";
import { OrderSummary, OrderTimeline, PaymentHistory } from "@/components/order-details";

export const metadata = { title: "Order details" };
export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser(`/orders/${id}`);
  const [detail, query] = await Promise.all([getOrder(id), searchParams]);
  // Admins also have broad RLS read access, but the customer route only displays their own orders.
  if (!detail || detail.order.customer_id !== user.id) notFound();
  const { order, items, payments, history, settings } = detail;
  const canPay = order.status === "pending_payment" || order.status === "payment_rejected";
  const qr = publicImage(settings?.qr_path ?? null);
  return <div className="container page-container"><BackLink href="/orders">My orders</BackLink><PageHeading eyebrow="A LITTLE JOY IN THE MAKING" title={order.order_number} description="Payment instructions and every update, all in one place." />{query.placed === "1" && <OrderPlaced userId={user.id} />}<div className="two-column" style={{ marginTop: query.placed ? 24 : 0 }}><div><OrderSummary order={order} items={items} /><PaymentHistory payments={payments} /></div><div>{canPay && <section className="panel"><h2>{order.status === "payment_rejected" ? "Let's try that receipt again" : "Complete your payment"}</h2>{order.status === "payment_rejected" && <p className="message error-message" style={{ marginBottom: 18 }}>{payments.find((p) => p.decision === "rejected")?.rejection_reason ?? "Please upload a new receipt."}</p>}<p className="small muted">Pay the exact total: <strong>{money(order.total_centavos)}</strong></p>{qr ? <img src={qr} className="qr-image" alt="Shop payment QR code" /> : <Notice>The payment QR is temporarily unavailable. Please check back before paying.</Notice>}<p className="payment-instructions">{settings?.instructions}</p><ActionForm action={uploadReceipt} submitLabel={order.status === "payment_rejected" ? "Submit replacement receipt" : "Submit payment receipt"} confirm="Submit this payment receipt for manual verification?"><input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="submission_key" value={crypto.randomUUID()} /><Field label="Payment receipt"><input type="file" name="receipt" accept="image/jpeg,image/png,image/webp" required /></Field><p className="field-hint">JPG, PNG, or WebP · Up to 5 MB · Only you and shop administrators can view it.</p></ActionForm></section>}{order.status === "verifying_payment" && <Notice>Thanks! Your receipt is awaiting review. We'll update this page when your payment has been checked.</Notice>}{order.status === "payment_confirmed" && <Notice>Your payment is confirmed. We'll start preparing your order soon.</Notice>}{order.status === "processing" && <Notice>We're preparing your lovely finds. Check back here for the next update.</Notice>}{order.status === "completed" && <Notice>Your order is completed. Thank you for shopping with Arrie Store!</Notice>}{order.status === "cancelled" && <Notice>This order has been cancelled. See the order updates for the reason.</Notice>}<OrderTimeline history={history} /></div></div></div>;
}

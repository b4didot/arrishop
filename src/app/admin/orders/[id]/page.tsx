import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOrder } from "@/lib/data";
import { PaymentReview } from "@/components/payment-review";
import { advanceOrder, saveNotes } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { BackLink, Field, Notice, PageHeading } from "@/components/ui";
import { OrderSummary, PaymentHistory, OrderTimeline } from "@/components/order-details";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getOrder(id);
  if (!detail) notFound();
  const client = await createClient();
  const { data: notes, error } = await client.from("order_admin_details").select("notes").eq("order_id", id).maybeSingle();
  if (error) throw new Error("We couldn't load internal notes.");
  const { order, items, payments, history } = detail;
  const pending = payments.find((payment) => payment.decision === "pending");
  const next = order.status === "payment_confirmed" ? "processing" : order.status === "processing" ? "completed" : null;
  const canCancel = !["completed", "cancelled", "verifying_payment"].includes(order.status);
  return <><BackLink href="/admin/orders">All orders</BackLink><PageHeading eyebrow="ORDER WORKSPACE" title={order.order_number} description="Review payment, prepare the order, and keep a clear history." /><div className="two-column"><div><OrderSummary order={order} items={items} /><PaymentHistory payments={payments} /></div><div><section className="panel"><h2>Payment &amp; fulfillment</h2>{order.status === "verifying_payment" && pending && <PaymentReview orderId={id} submissionId={pending.id} total={order.total_centavos} />}{order.status === "verifying_payment" ? null : next ? <ActionForm action={advanceOrder} submitLabel={next === "processing" ? "Start processing" : "Mark completed"} confirm={next === "processing" ? "Start preparing this order?" : "Mark this order as fulfilled and completed?"}><input type="hidden" name="order_id" value={id} /><input type="hidden" name="next_status" value={next} /></ActionForm> : <p className="small muted">{order.status === "completed" ? "This order has been fulfilled." : order.status === "cancelled" ? "This order has been cancelled." : "Confirm payment before starting fulfillment."}</p>}{canCancel && <><hr className="divider" /><details><summary className="details-toggle">Cancel this order</summary><ActionForm action={advanceOrder} submitLabel="Cancel order" confirm="Cancel this order? This is permanent and does not issue a refund."><input type="hidden" name="order_id" value={id} /><input type="hidden" name="next_status" value="cancelled" /><Field label="Cancellation reason (visible to customer)"><textarea name="reason" required maxLength={1000} /></Field></ActionForm></details></>}{order.status === "verifying_payment" && <p className="small muted">Review the pending receipt before cancelling this order.</p>}</section><section className="panel"><h2>Internal notes</h2><p className="muted small">Only administrators can see these notes.</p><ActionForm action={saveNotes} submitLabel="Save notes"><input type="hidden" name="order_id" value={id} /><Field label="Administrator notes"><textarea name="notes" maxLength={5000} defaultValue={notes?.notes ?? ""} placeholder="Delivery reminders, concerns, or other details" /></Field></ActionForm></section>{order.status === "payment_rejected" && <Notice>The customer can now upload a replacement receipt. Previous submissions remain in the history.</Notice>}<OrderTimeline history={history} /></div></div></>;
}

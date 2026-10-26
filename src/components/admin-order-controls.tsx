"use client";
import { useEffect,useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui";
import { adminUpdateOrder } from "@/app/workflow-actions";
import { statusLabels } from "@/lib/format";
import { deliveryDate } from "@/lib/calendar";
import type { Order,OrderStatus } from "@/types";
export function AdminOrderControls({order}:{order:Order}){
 const [status,setStatus]=useState<OrderStatus>(order.status),[date,setDate]=useState(order.delivery_date??"");
 useEffect(()=>{setStatus(order.status);setDate(order.delivery_date??"");},[order.status,order.delivery_date,order.updated_at]);
 // Remount the status select per saved version so form reset uses the new initial option.
 const common=<><input type="hidden" name="order_id" value={order.id}/><input type="hidden" name="expected_updated_at" value={order.updated_at}/></>;
 return <section className="panel admin-order-controls"><h2>Administrator controls</h2>
 {order.archived_at&&<p className="message">Archived: hidden from active admin lists and reports. Customer history remains available.</p>}
 <details><summary className="details-toggle">Change order status</summary>
 <p className="small muted">Choose any status, including reopening completed or cancelled orders. Manual fulfillment/payment statuses reserve a slot. Use payment review to record the actual amount received. Chat retention continues from the original completion date.</p>
 <ActionForm action={adminUpdateOrder} submitLabel="Confirm status change" confirm={`Change ${order.order_number} from ${statusLabels[order.status]} to ${statusLabels[status]}? This administrator override may reserve or release a delivery slot and supersede a pending receipt review.`}>
 {common}<input type="hidden" name="change_kind" value="status"/>
 <Field label="New order status"><select key={order.updated_at} aria-label="New order status" name="new_status" value={status} onChange={event=>setStatus(event.target.value as OrderStatus)}>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
 <Field label="Status change reason (visible to customer)"><textarea name="reason" required maxLength={1000}/></Field>
 </ActionForm></details>
 <details><summary className="details-toggle">Change delivery date</summary>
 <p className="small muted">Administrators can choose closed, full, past, or short-notice dates. This explicitly approves the date for this order; existing reservations move with it.</p>
 <ActionForm action={adminUpdateOrder} submitLabel="Confirm delivery date" confirm={`Move ${order.order_number} from ${deliveryDate(order.delivery_date)} to ${date?deliveryDate(date):"the selected date"}? Calendar limits can be exceeded by this override.`}>
 {common}<input type="hidden" name="change_kind" value="delivery_date"/>
 <Field label="New delivery date"><input type="date" name="new_delivery_date" required value={date} onChange={event=>setDate(event.target.value)}/></Field>
 <Field label="Delivery change reason (visible to customer)"><textarea name="reason" required maxLength={1000}/></Field>
 </ActionForm></details>
 <details><summary className="details-toggle">{order.archived_at?"Restore archived order":"Archive order"}</summary>
 <p className="small muted">Archiving changes the admin view only. Reservations remain until cancellation, and customers retain their order history.</p>
 <ActionForm action={adminUpdateOrder} submitLabel={order.archived_at?"Restore order":"Archive order"} confirm={`${order.archived_at?"Restore":"Archive"} ${order.order_number}?`}>
 {common}<input type="hidden" name="change_kind" value="archive"/><input type="hidden" name="archive_order" value={order.archived_at?"false":"true"}/>
 <Field label="Archive note (optional, administrator only)"><textarea name="reason" maxLength={1000}/></Field>
 </ActionForm></details>
 </section>;
}

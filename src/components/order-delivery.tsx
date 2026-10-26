"use client";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { DeliveryCalendar } from "@/components/delivery-calendar";
import { changeDeliveryDate } from "@/app/workflow-actions";
import { deliveryDate } from "@/lib/calendar";
import type { DeliveryDay, Order } from "@/types";
export function OrderDelivery({order,days,admin=false}:{order:Order;days:DeliveryDay[];admin?:boolean}) {
 const [date,setDate]=useState("");
 const canChange=!admin && !["completed","cancelled"].includes(order.status) && !order.slot_reserved_at;
 return <section className="panel"><h2>Delivery day</h2><p><strong>{deliveryDate(order.delivery_date)}</strong></p>
 <p className="small muted">{order.status==="cancelled"?"This order is cancelled. Its slot has been released.":order.slot_reserved_at?"Your delivery slot is reserved.":"Your slot is reserved when you submit payment evidence. Check availability before paying."}</p>
 {canChange && <details open={!order.delivery_date}><summary className="details-toggle">Choose another delivery day</summary><ActionForm action={changeDeliveryDate}>
 <input type="hidden" name="order_id" value={order.id}/><input type="hidden" name="delivery_date" value={date}/>
 <DeliveryCalendar days={days} value={date} onChange={setDate}/><SubmitButton disabled={!date}>Save delivery day</SubmitButton>
 </ActionForm></details>}
 </section>;
}

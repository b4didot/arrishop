"use client";
import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui";
import { saveDeliveryDay, saveDeliverySettings } from "@/app/workflow-actions";
import type { DeliveryDay } from "@/types";
import { deliveryDate } from "@/lib/calendar";
export function AdminCalendar({days,settings,configured}:{days:DeliveryDay[];settings:{lead_days:number;default_capacity:number};configured:{delivery_date:string;is_open:boolean;capacity:number}[]}) {
 const today=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Manila"});
 const [chosen,setChosen]=useState(today);
 const [month,setMonth]=useState(today.slice(0,7));
 const [year,number]=month.split("-").map(Number);
 const first=new Date(Date.UTC(year,number-1,1));const length=new Date(Date.UTC(year,number,0)).getUTCDate();
 const selected=configured.find(d=>d.delivery_date===chosen);
 const reserved=days.find(d=>d.delivery_date===chosen)?.reserved??0;
 function move(offset:number){setMonth(new Date(Date.UTC(year,number-1+offset,1)).toISOString().slice(0,7));}
 return <><section className="panel"><h2>Delivery rules</h2><ActionForm action={saveDeliverySettings} submitLabel="Save delivery rules">
 <Field label="Minimum lead time (calendar days)"><input type="number" name="lead_days" min="0" max="365" required defaultValue={settings.lead_days}/></Field>
 <Field label="Default maximum orders per open date"><input type="number" name="default_capacity" min="1" max="10000" required defaultValue={settings.default_capacity}/></Field>
 <p className="field-hint">A lead time of 2 means Monday customers can choose Wednesday onward. Dates stay closed until you open them. Changing the default does not change dates already configured.</p>
 </ActionForm></section>
 <section className="panel"><h2>Delivery calendar</h2><div className="calendar-heading"><button type="button" className="button button-small button-outline" onClick={()=>move(-1)} aria-label="Previous month">‹</button><strong>{first.toLocaleDateString("en-PH",{month:"long",year:"numeric",timeZone:"UTC"})}</strong><button type="button" className="button button-small button-outline" onClick={()=>move(1)} aria-label="Next month">›</button></div>
 <div className="calendar-grid admin-calendar-grid">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day=><span key={day}>{day}</span>)}{Array.from({length:first.getUTCDay()},(_,i)=><span key={`blank${i}`}/>)}
 {Array.from({length},(_,i)=>{const date=`${month}-${String(i+1).padStart(2,"0")}`;const config=configured.find(d=>d.delivery_date===date);const used=days.find(d=>d.delivery_date===date)?.reserved??0;return <button type="button" key={date} className={`calendar-day ${chosen===date?"selected":""} ${config?.is_open?"open-day":""}`} aria-pressed={chosen===date} onClick={()=>setChosen(date)}>{i+1}<small>{config?.is_open?`${used}/${config.capacity}`:"Closed"}</small></button>;})}
 </div>
 <hr className="divider"/><h3>{deliveryDate(chosen)}</h3><p className="small muted">{reserved} reserved orders. Closing a date keeps existing reservations.</p>
 <ActionForm key={chosen+JSON.stringify(selected)} action={saveDeliveryDay} submitLabel="Save this date">
 <Field label="Delivery date"><input type="date" name="delivery_date" required value={chosen} onChange={e=>{if(e.target.value){setChosen(e.target.value);setMonth(e.target.value.slice(0,7));}}}/></Field>
 <label className="checkbox-field"><input type="checkbox" name="is_open" defaultChecked={selected?.is_open??false}/>Open for delivery</label>
 <Field label="Maximum orders"><input type="number" name="capacity" required min={Math.max(1,reserved)} max="10000" defaultValue={selected?.capacity??settings.default_capacity}/></Field>
 </ActionForm></section></>;
}

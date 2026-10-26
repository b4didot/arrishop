"use client";
import { useState } from "react";
import type { DeliveryDay } from "@/types";
import { deliveryDate } from "@/lib/calendar";
export function DeliveryCalendar({ days, value, onChange }: {days:DeliveryDay[];value:string;onChange:(date:string)=>void}) {
 const first=days.find(d=>d.available)?.delivery_date ?? new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Manila"});
 const [month,setMonth]=useState(first.slice(0,7));
 const [year,number]=month.split("-").map(Number);
 const start=new Date(Date.UTC(year,number-1,1));
 const count=new Date(Date.UTC(year,number,0)).getUTCDate();
 const byDate=new Map(days.map(d=>[d.delivery_date,d]));
 function move(offset:number) { setMonth(new Date(Date.UTC(year,number-1+offset,1)).toISOString().slice(0,7)); }
 return <fieldset className="delivery-calendar"><legend>Delivery day</legend><p className="calendar-hint field-hint">Choose an available delivery day. Grey dates are unavailable.</p>
 <div className="calendar-heading"><button type="button" className="button button-small button-outline" aria-label="Previous month" onClick={()=>move(-1)}>‹</button><strong aria-live="polite">{start.toLocaleDateString("en-PH",{month:"long",year:"numeric",timeZone:"UTC"})}</strong><button type="button" className="button button-small button-outline" aria-label="Next month" onClick={()=>move(1)}>›</button></div>
 <div className="calendar-grid">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><span key={d} className="small muted">{d}</span>)}
 {Array.from({length:start.getUTCDay()},(_,i)=><span key={`blank-${i}`} />)}
 {Array.from({length:count},(_,i)=>{
  const date=`${month}-${String(i+1).padStart(2,"0")}`; const day=byDate.get(date);
  return <button type="button" key={date} disabled={!day?.available} className={`calendar-day ${value===date?"selected":""}`} aria-pressed={value===date} aria-label={`${deliveryDate(date)}: ${day?.available?`${day.capacity-day.reserved} slots left`:"unavailable"}`} onClick={()=>onChange(date)}>{i+1}</button>;
 })}
 </div>{value && <p className="calendar-selection field-hint" aria-live="polite">Selected: {deliveryDate(value)}</p>}
 </fieldset>;
}

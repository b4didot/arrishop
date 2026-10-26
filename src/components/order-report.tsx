"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "@/components/app-link";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui";
import { saveReportCount } from "@/app/workflow-actions";
import { deliveryDate } from "@/lib/calendar";
import { money, statusLabels } from "@/lib/format";
import type { ActionState, OrderItem, Product, ReportOrder } from "@/types";
type Column={id:string;label:string};
type Prefs={order:string[];hidden:string[];zoom:number;widths:Record<string,number>};

export function OrderReport({orders,products,userId}:{orders:ReportOrder[];products:Pick<Product,"id"|"title">[];userId:string}) {
 const columns:Column[]=useMemo(()=>[
  {id:"date",label:"Day & Date"},{id:"name",label:"Name"},{id:"social",label:"Social"},{id:"status",label:"Status"},
  ...products.flatMap(p=>[{id:p.id+":qty",label:p.title},{id:p.id+":count",label:p.title+" Count"}]),
  {id:"address",label:"Address"},{id:"phone",label:"Number"},{id:"total",label:"Total"},
 ],[products]);
 const [prefs,setPrefs]=useState<Prefs>({order:[],hidden:[],zoom:100,widths:{}});
 const [loaded,setLoaded]=useState(false);
 const [search,setSearch]=useState("");const [from,setFrom]=useState("");const [to,setTo]=useState("");
 const [weekday,setWeekday]=useState("");const [scope,setScope]=useState("reserved");
 const [archive,setArchive]=useState("active");
 const [sort,setSort]=useState({id:"date",descending:false});
 const [target,setTarget]=useState<ReportOrder|null>(null);
 const [editing,setEditing]=useState<{item:OrderItem;order:ReportOrder}|null>(null);
 const navigation=useRef<HTMLDialogElement>(null);const countDialog=useRef<HTMLDialogElement>(null);
 const storageKey=`arrie-report:${userId}`;
 useEffect(()=>{
  try { const value=JSON.parse(localStorage.getItem(storageKey)??"null") as Prefs|null;
   if(value && Array.isArray(value.order) && value.order.every(x=>typeof x==="string") && Array.isArray(value.hidden) && value.hidden.every(x=>typeof x==="string")) setPrefs({order:[...new Set(value.order)],hidden:value.hidden,zoom:Number.isFinite(value.zoom)?Math.max(55,Math.min(125,value.zoom)):100,widths:Object.fromEntries(Object.entries(value.widths??{}).filter(([,width])=>typeof width==="number"&&Number.isFinite(width)).map(([id,width])=>[id,Math.max(72,Math.min(800,width as number))]))});
  } catch { /* Use defaults when local storage is unavailable. */ }
  setLoaded(true);
 },[storageKey]);
 useEffect(()=>{if(loaded)try{localStorage.setItem(storageKey,JSON.stringify(prefs));}catch{/* Preferences are optional. */}},[prefs,loaded,storageKey]);
 const ordered=[...prefs.order.map(id=>columns.find(c=>c.id===id)).filter((c):c is Column=>Boolean(c)),...columns.filter(c=>!prefs.order.includes(c.id))];
 const visible=ordered.filter(c=>!prefs.hidden.includes(c.id));
 function defaultWidth(id:string){return id==="address"?260:id==="date"?190:id==="name"?170:id==="status"?180:id==="social"?150:id==="phone"?150:id==="total"?150:130;}
 function baseWidth(id:string){return Math.max(72,Math.min(800,prefs.widths[id]??defaultWidth(id)));}
 function columnWidth(id:string){return Math.round(baseWidth(id)*prefs.zoom/100);}
 function numeric(id:string){return id.endsWith(":qty")||id.endsWith(":count")||id==="phone"||id==="total";}
 function resize(id:string,width:number){setPrefs(current=>({...current,widths:{...current.widths,[id]:Math.max(72,Math.min(800,Math.round(width)))}}));}
 const resizing=useRef<{id:string;x:number;width:number}|null>(null);

 function move(id:string,direction:number) {
  const ids=ordered.map(c=>c.id);const index=ids.indexOf(id);const next=index+direction;
  if(next<0||next>=ids.length)return;[ids[index],ids[next]]=[ids[next],ids[index]];
  setPrefs(current=>({...current,order:ids}));
 }
 function itemFor(order:ReportOrder,column:string){return order.order_items.find(i=>i.product_id===column.split(":")[0]);}
 function value(order:ReportOrder,column:string):string|number {
  if(column.endsWith(":qty"))return itemFor(order,column)?.quantity??0;
  if(column.endsWith(":count")) {const item=itemFor(order,column);return item?(item.report_count??item.quantity*item.item_count):0;}
  switch(column) {case"date":return order.delivery_date??"";case"name":return order.customer_name;case"social":return order.customer_social_name;case"status":return statusLabels[order.status];case"address":return order.delivery_address;case"phone":return order.customer_phone;case"total":return order.total_centavos;default:return"";}
 }
 const filtered=orders.filter(order=>{
  if(archive==="active" && order.archived_at)return false;
  if(archive==="archived" && !order.archived_at)return false;
  if(scope==="reserved" && (!order.slot_reserved_at||order.status==="cancelled"))return false;
  const match=(order.customer_name+" "+order.customer_social_name+" "+order.order_number).toLowerCase();
  return match.includes(search.toLowerCase()) && (!from||!!order.delivery_date&&order.delivery_date>=from) && (!to||!!order.delivery_date&&order.delivery_date<=to)
   && (!weekday||!!order.delivery_date&&String(new Date(order.delivery_date+"T00:00:00Z").getUTCDay())===weekday);
 }).sort((a,b)=>{
  const left=value(a,sort.id),right=value(b,sort.id);
  const result=typeof left==="number"&&typeof right==="number"?left-right:String(left).localeCompare(String(right),undefined,{numeric:true,sensitivity:"base"});
  return (sort.descending?-result:result)||a.id.localeCompare(b.id);
 });
 const rows=filtered;
 function cell(order:ReportOrder,column:Column) {
  if(column.id==="status")return <button type="button" className="report-status" onClick={()=>{setTarget(order);navigation.current?.showModal();}}>{statusLabels[order.status]}</button>;
  if(column.id==="date")return deliveryDate(order.delivery_date);
  if(column.id==="total")return money(order.total_centavos);
  if(column.id.endsWith(":count")) {
   const item=itemFor(order,column.id);if(!item)return "";
   return <button type="button" className={`report-count ${item.report_count!==null?"overridden":""}`} aria-label={`Edit ${item.title} count for ${order.customer_name}, currently ${value(order,column.id)}`} onClick={()=>{setEditing({item,order});countDialog.current?.showModal();}}>{value(order,column.id)}{item.report_count!==null?" *":""}</button>;
  }
  if(column.id.endsWith(":qty"))return itemFor(order,column.id)?value(order,column.id):"";
  return value(order,column.id);
 }
 async function saveCount(state:ActionState,form:FormData) {const result=await saveReportCount(state,form);if(result.success)countDialog.current?.close();return result;}
 return <>
 <section className="panel"><div className="report-filters">
 <Field label="Name, social or order number"><input value={search} onChange={e=>setSearch(e.target.value)} maxLength={120}/></Field>
 <Field label="Delivery from"><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field>
 <Field label="Delivery through"><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
 <Field label="Day"><select value={weekday} onChange={e=>setWeekday(e.target.value)}><option value="">Every day</option>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((day,i)=><option key={day} value={i}>{day}</option>)}</select></Field>
 <Field label="Orders"><select value={scope} onChange={e=>setScope(e.target.value)}><option value="reserved">Reserved slots</option><option value="all">All orders</option></select></Field>
 <Field label="Order archive"><select aria-label="Order archive" value={archive} onChange={e=>setArchive(e.target.value)}><option value="active">Active orders</option><option value="archived">Archived orders</option><option value="all">Active and archived</option></select></Field>
 </div>
 <details><summary className="details-toggle">Customize columns</summary><p className="small muted">Move or hide columns below. Drag a header edge or use its width slider to resize. Preferences are saved on this device.</p><div className="column-controls">{ordered.map((column,index)=><div key={column.id}><label className="checkbox-field"><input type="checkbox" checked={!prefs.hidden.includes(column.id)} onChange={e=>setPrefs(current=>({...current,hidden:e.target.checked?current.hidden.filter(id=>id!==column.id):[...current.hidden,column.id]}))}/>{column.label}</label><button type="button" disabled={index===0} aria-label={`Move ${column.label} left`} onClick={()=>move(column.id,-1)}>←</button><button type="button" disabled={index===ordered.length-1} aria-label={`Move ${column.label} right`} onClick={()=>move(column.id,1)}>→</button><label className="column-width">Width<input type="range" min="72" max="800" step="8" aria-label={`Width of ${column.label}`} value={baseWidth(column.id)} onChange={event=>resize(column.id,Number(event.target.value))}/><output>{baseWidth(column.id)}px</output></label></div>)}</div><button type="button" className="button button-small button-outline" onClick={()=>setPrefs({order:[],hidden:[],zoom:100,widths:{}})}>Reset columns and size</button></details>
 </section>
 <section className="panel report-panel"><div className="panel-header"><strong>{filtered.length} {filtered.length===1?"order":"orders"}</strong><div className="report-zoom"><button type="button" className="button button-small button-outline" aria-label="Zoom report out" disabled={prefs.zoom<=55} onClick={()=>setPrefs(p=>({...p,zoom:Math.max(55,p.zoom-10)}))}>−</button><span aria-live="polite">{prefs.zoom}%</span><button type="button" className="button button-small button-outline" aria-label="Zoom report in" disabled={prefs.zoom>=125} onClick={()=>setPrefs(p=>({...p,zoom:Math.min(125,p.zoom+10)}))}>+</button></div></div>
 <p className="small muted">Scroll to browse every matching order. Tap a heading to sort; drag its edge to resize. Tap a count to adjust it; * means an override. Name stays visible while scrolling.</p>
 {visible.length?<div className="report-scroll" role="region" aria-label="Order Report, scroll horizontally" tabIndex={0}><table className="order-report" style={{width:visible.reduce((sum,column)=>sum+columnWidth(column.id),0),fontSize:`${prefs.zoom}%`,"--report-padding":`${Math.max(3,prefs.zoom/12)}px`} as CSSProperties}><colgroup>{visible.map(column=><col key={column.id} style={{width:columnWidth(column.id)}}/>)}</colgroup><thead><tr>{visible.map(column=><th key={column.id} className={`${column.id==="name"?"pinned-name":""} ${numeric(column.id)?"numeric":""}`} aria-sort={sort.id===column.id?(sort.descending?"descending":"ascending"):"none"}><button type="button" onClick={()=>setSort(current=>({id:column.id,descending:current.id===column.id?!current.descending:false}))}>{column.label}{sort.id===column.id?(sort.descending?" ↓":" ↑"):""}</button><span className="column-resizer" role="separator" aria-orientation="vertical" aria-label={`Resize ${column.label}`} aria-valuemin={72} aria-valuemax={800} aria-valuenow={baseWidth(column.id)} tabIndex={0} onPointerDown={event=>{event.preventDefault();event.stopPropagation();resizing.current={id:column.id,x:event.clientX,width:baseWidth(column.id)};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{const active=resizing.current;if(active?.id===column.id)resize(column.id,active.width+(event.clientX-active.x)*100/prefs.zoom);}} onPointerUp={()=>{resizing.current=null;}} onPointerCancel={()=>{resizing.current=null;}} onLostPointerCapture={()=>{resizing.current=null;}} onKeyDown={event=>{if(event.key==="ArrowLeft"||event.key==="ArrowRight"){event.preventDefault();resize(column.id,baseWidth(column.id)+(event.key==="ArrowLeft"?-10:10));}}}/></th>)}</tr></thead><tbody>{rows.map(order=><tr key={order.id}>{visible.map(column=><td key={column.id} className={`${column.id==="name"?"pinned-name":""} ${numeric(column.id)?"numeric":""}`}>{cell(order,column)}</td>)}</tr>)}</tbody></table></div>:<p>No columns selected. Open Customize columns to show them.</p>}
 {!rows.length&&<p className="muted">No orders match these filters.</p>}
 </section>
 <dialog ref={navigation} className="report-dialog" aria-labelledby="open-order-title"><h2 id="open-order-title">Open this order?</h2><p>{target?.order_number} — {target?.customer_name}</p><div className="media-picker"><button type="button" className="button button-outline" onClick={()=>navigation.current?.close()}>Stay on report</button>{target&&<Link className="button" href={`/admin/orders/${target.id}`} onClick={()=>navigation.current?.close()}>Open order</Link>}</div></dialog>
 <dialog ref={countDialog} className="report-dialog" aria-labelledby="report-count-title"><h2 id="report-count-title">Change this order's count?</h2>{editing&&<ActionForm key={editing.item.id+String(editing.item.report_count)} action={saveCount} submitLabel="Confirm count change"><p>{editing.order.customer_name}: {editing.item.title}. Suggested count: {editing.item.quantity} × {editing.item.item_count} = {editing.item.quantity*editing.item.item_count}. This changes only the report count for this order.</p><input type="hidden" name="item_id" value={editing.item.id}/><Field label="Report count"><input type="number" name="report_count" required min="0" max="10000000" step="1" defaultValue={editing.item.report_count??editing.item.quantity*editing.item.item_count}/></Field><label className="checkbox-field"><input type="checkbox" name="reset_count" value="yes"/>Restore suggested count instead</label><button type="button" className="button button-outline" onClick={()=>countDialog.current?.close()}>Cancel</button></ActionForm>}</dialog>
 </>;
}

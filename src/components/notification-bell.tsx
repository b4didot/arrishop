"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { Bell } from "lucide-react";
import { usePathname,useRouter } from "next/navigation";
import Link from "@/components/app-link";
import { dateTime,statusLabels } from "@/lib/format";
import type { OrderStatus } from "@/types";
type Notification={id:string;order_id:string;order_number:string;kind:"message"|"order_update";status:OrderStatus|null;created_at:string;read_at:string|null};
type Inbox={items:Notification[];unread_count:number};
export function NotificationBell({admin}:{admin:boolean}){
 const [inbox,setInbox]=useState<Inbox>({items:[],unread_count:0}),[open,setOpen]=useState(false),[error,setError]=useState(false),[announcement,setAnnouncement]=useState("");
 const newest=useRef<string|null>(null),busy=useRef(false),container=useRef<HTMLDivElement>(null);
 const pathname=usePathname(),router=useRouter();
 const load=useCallback(async()=>{
  if(busy.current||document.visibilityState!=="visible")return;busy.current=true;
  try{
   const response=await fetch("/api/notifications",{cache:"no-store"});
   if(!response.ok)throw new Error("Notifications unavailable");
   const data=await response.json() as Inbox;
   const latest=data.items[0]?.id??"";
   if(newest.current!==null&&latest&&latest!==newest.current){
    const message=data.items[0].kind==="message"?"New order message":"Order updated";
    setAnnouncement(message);
    if(pathname.endsWith("/"+data.items[0].order_id))router.refresh();
   }
   newest.current=latest;setInbox(data);setError(false);
  }catch{setError(true);}finally{busy.current=false;}
 },[pathname,router]);
 useEffect(()=>{void load();const timer=setInterval(()=>{void load();},30000);const refresh=()=>{void load();};window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);return()=>{clearInterval(timer);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};},[load]);
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(container.current&&!container.current.contains(event.target as Node))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
  document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape);
  return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
 },[]);
 async function read(id?:string){
  try{
   const response=await fetch("/api/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(id?{id}:{throughTime:inbox.items[0]?.created_at??new Date().toISOString()})});
   if(!response.ok)throw new Error("Could not mark read");await load();
  }catch{setError(true);}
 }
 return <div className="notification-center" ref={container}><button type="button" className="icon-link notification-toggle" aria-label={`Notifications, ${inbox.unread_count} unread`} aria-expanded={open} aria-controls="order-notifications" onClick={()=>{setOpen(!open);void load();}}><Bell size={20}/>{inbox.unread_count>0&&<span className="notification-count">{inbox.unread_count>99?"99+":inbox.unread_count}</span>}</button>
 <span className="visually-hidden" role="status" aria-live="polite">{announcement}</span>
 {open&&<section className="notification-popover" id="order-notifications" aria-label="Order notifications"><div className="panel-header"><h2>Notifications</h2>{inbox.unread_count>0&&<button type="button" className="text-link" onClick={()=>{void read();}}>Mark all read</button>}</div>{error&&<p role="alert">Couldn't refresh notifications. <button type="button" className="text-link" onClick={()=>{void load();}}>Retry</button></p>}
 {inbox.items.length?<ul>{inbox.items.map(item=><li key={item.id} className={!item.read_at?"unread":""}><Link href={`${admin?"/admin":""}/orders/${item.order_id}`} onClick={()=>{setOpen(false);void read(item.id);}}><strong>{item.order_number}</strong><span>{item.kind==="message"?"New message":item.status?`Order update: ${statusLabels[item.status]}`:"Delivery day updated"}</span><time dateTime={item.created_at}>{dateTime(item.created_at)}</time></Link></li>)}</ul>:<p className="muted small">No order updates yet.</p>}<p className="field-hint">Updates refresh automatically while this app is open.</p></section>}
 </div>;
}

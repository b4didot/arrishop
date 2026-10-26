import { orderContent } from "@/lib/order-workflows";
import { dateTime } from "@/lib/format";
import { OrderContentForm } from "@/components/order-content-form";
import { RefreshMessages } from "@/components/refresh-messages";
import type { Order, OrderItem, SignedPhoto } from "@/types";
function Photos({photos}:{photos:SignedPhoto[]}) {
 return <div className="content-photo-grid">{photos.map((photo,index)=><div key={photo.path}>{photo.url?<a href={photo.url} target="_blank" rel="noopener noreferrer"><img src={photo.url} alt={`Attached photo ${index+1}`} loading="lazy" referrerPolicy="no-referrer"/></a>:<span className="small muted">Photo unavailable. Refresh to try again.</span>}</div>)}</div>;
}
export async function OrderConversation({order,items,admin=false}:{order:Order;items:OrderItem[];admin?:boolean}) {
 const {messages,review}=await orderContent(order.id);
 const completed=order.completed_at?Date.parse(order.completed_at):null;
 const archived=completed!==null && Date.now()>=completed+10*86400000;
 const expired=completed!==null && Date.now()>=completed+70*86400000;
 return <>
 <section className="panel order-conversation"><div className="panel-header"><h2>Order messages</h2>{!expired && <RefreshMessages/>}</div>
 {expired?<p className="muted">This conversation has reached its deletion date.</p>:archived&&!admin?<p className="muted">This conversation was archived 10 days after completion.</p>:<>
 <p className="small muted">{archived?"Read-only archive. Messages and photos are deleted 60 days after archiving.":"Private messages between you and the shop for this order. Archived 10 days after completion, then deleted 60 days later. Refresh to see new replies."}</p>
 <div className="order-messages">{messages.length?messages.map(message=><article className={`order-message ${message.sender_is_admin?"from-shop":""}`} key={message.id}><div className="panel-header"><strong>{message.sender_is_admin?"Shop":"Customer"}</strong><time className="small muted" dateTime={message.created_at}>{dateTime(message.created_at)}</time></div><p className="message-body">{message.body}</p><Photos photos={message.photos}/></article>):<p className="muted small">No messages yet.</p>}</div>
 {!archived && <OrderContentForm orderId={order.id} kind="message" entryKey={crypto.randomUUID()}/>}
 </>}
 </section>
 {(review || (order.status==="completed"&&!admin)) && <section className="panel"><h2>Private order review</h2><p className="small muted">Only you and shop administrators can see this feedback. All fields and photos are optional. Up to five photos for the whole order.</p>
 {review?<><p className="small muted">Submitted {dateTime(review.created_at)}</p>{review.overall && <p className="message-body">{review.overall}</p>}{[...new Map(items.map(i=>[i.product_id,i])).values()].map(item=>review.item_reviews[item.product_id]?<div key={item.product_id}><h3>{item.title}</h3><p className="message-body">{review.item_reviews[item.product_id]}</p></div>:null)}<Photos photos={review.photos}/></>:<OrderContentForm orderId={order.id} kind="review" items={items} entryKey={crypto.randomUUID()}/>}
 </section>}
 </>;
}

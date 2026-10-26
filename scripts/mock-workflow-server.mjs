// Local-only Supabase API fixture for authenticated browser interaction checks.
import { createServer } from "node:http";
import sharp from "sharp";
const customer="11111111-1111-4111-8111-111111111111",admin="33333333-3333-4333-8333-333333333333",product="44444444-4444-4444-8444-444444444444";
const orderId="55555555-5555-4555-8555-555555555555",itemId="66666666-6666-4666-8666-666666666666";
const date=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
const item={id:itemId,order_id:orderId,product_id:product,title:"Cookies",quantity:2,unit_price_centavos:10000,item_count:3,report_count:null};
const order={id:orderId,order_number:"ARRI-00000001",customer_id:customer,archived_at:null,delivery_date_override:false,status:"completed",total_centavos:20000,customer_name:"Jamie Baker",customer_social_name:"CookieFan",customer_phone:"09123456789",delivery_address:"12 Main Street, Manila",delivery_address_parts:{},delivery_carrier:"lalamove",shipping_fee_centavos:0,delivery_date:date,slot_reserved_at:new Date().toISOString(),completed_at:new Date().toISOString(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
const messages=[],reviews=[],objects=new Map(),notifications=[],adminEvents=[];let reportCopies=1;let storefrontIds=[product];
const png=await sharp({create:{width:2,height:2,channels:3,background:"#f6b69d"}}).png().toBuffer();
function who(req){try{return JSON.parse(Buffer.from((req.headers.authorization??"").split(" ")[1].split(".")[1],"base64url")).sub;}catch{return customer;}}
function user(id){return{id,aud:"authenticated",role:"authenticated",email:id===admin?"admin@example.test":"customer@example.test",app_metadata:{provider:"email"},user_metadata:{},created_at:new Date().toISOString()};}
const server=createServer(async(req,res)=>{
 res.setHeader("Access-Control-Allow-Origin","http://localhost:3107");res.setHeader("Access-Control-Allow-Headers",req.headers["access-control-request-headers"]??"*");res.setHeader("Access-Control-Allow-Methods","GET,POST,PATCH,DELETE,OPTIONS");
 if(req.method==="OPTIONS"){res.writeHead(204);res.end();return;}
 const url=new URL(req.url,"http://localhost");const id=who(req);
 const chunks=[];for await(const chunk of req)chunks.push(chunk);const bytes=Buffer.concat(chunks);
 let body;try{body=JSON.parse(bytes.toString());}catch{body={};}
 const send=(data,status=200)=>{res.writeHead(status,{"Content-Type":"application/json"});res.end(JSON.stringify(data));};
 if(url.pathname==="/__reset"){messages.length=0;reviews.length=0;notifications.length=0;reportCopies=1;storefrontIds=[product];item.report_count=null;adminEvents.length=0;Object.assign(order,{status:"completed",delivery_date:date,archived_at:null,delivery_date_override:false,updated_at:new Date().toISOString()});return send({ok:true});}
 if(url.pathname==="/__product-lineup"){storefrontIds=[product,"77777777-7777-4777-8777-777777777777","88888888-8888-4888-8888-888888888888"];return send({ok:true});}
 if(url.pathname==="/__report-many"){reportCopies=60;return send({ok:true});}
 if(url.pathname==="/__notify"){notifications.push({id:crypto.randomUUID(),recipient_id:body.recipient_id??customer,order_id:orderId,order_number:order.order_number,kind:body.kind??"message",status:body.status??null,created_at:new Date().toISOString(),read_at:null});return send({ok:true});}
 if(url.pathname==="/health")return send({ok:true});
 if(url.pathname==="/auth/v1/user")return send(user(id));
 if(url.pathname.startsWith("/storage/v1/")){
  if(url.pathname.includes("/object/sign/")&&req.method==="POST"&&Array.isArray(body.paths))return send(body.paths.map(path=>({path,signedURL:`/object/sign/order-media/${path}?token=fixture`,error:null})));
  if(url.pathname.includes("/object/sign/")&&req.method==="POST")return send({signedURL:url.pathname.replace("/storage/v1","")+"?token=fixture"});
  if(req.method==="GET"){res.writeHead(200,{"Content-Type":"image/png"});res.end(png);return;}
  objects.set(url.pathname,bytes);return send({Key:url.pathname,Id:crypto.randomUUID()});
 }
 if(url.pathname.startsWith("/rest/v1/rpc/")){
  const name=url.pathname.split("/").at(-1);
  if(name==="is_admin")return send(id===admin);
  if(["notification_inbox","read_order_notifications","change_cart_item"].includes(name)&&(req.headers.authorization??"").split(".").length!==3)return send({code:"42501",message:"Please log in first."},403);
  if(name==="viewer_context")return send({admin:id===admin,cart_count:2});
  if(name==="change_cart_item")return send(3);
  if(name==="notification_inbox"){const mine=notifications.filter(n=>n.recipient_id===id);return send({items:mine.toReversed(),unread_count:mine.filter(n=>!n.read_at).length});}
  if(name==="read_order_notifications"){notifications.filter(n=>n.recipient_id===id&&(!body.target_notification||n.id===body.target_notification)).forEach(n=>n.read_at=new Date().toISOString());return send(null);}
  if(name==="delivery_availability")return send([{delivery_date:date,capacity:10,reserved:1,available:true}]);
  if(name==="admin_update_order"){
   if(id!==admin)return send({code:"P0001",message:"Administrator access required."},403);
   if(body.expected_updated_at!==order.updated_at)return send({code:"P0001",message:"This order changed. Refresh it and try again."},400);
   if(body.change_kind==="status")order.status=body.new_status;
   if(body.change_kind==="delivery_date"){order.delivery_date=body.new_delivery_date;order.delivery_date_override=true;}
   if(body.change_kind==="archive")order.archived_at=body.archive_order?new Date().toISOString():null;
   order.updated_at=new Date().toISOString();adminEvents.unshift({id:crypto.randomUUID(),order_id:orderId,action:body.change_kind,reason:body.reason||"Restored by administrator",created_at:new Date().toISOString()});
   return send(null);
  }
  if(name==="move_storefront_product"){
   if(id!==admin)return send({code:"P0001",message:"Administrator access required."},403);
   const index=storefrontIds.indexOf(body.target_product),next=index+(body.move_direction==="up"?-1:1);
   if(!storefrontIds[next]||storefrontIds[next]!==body.expected_neighbor)return send({code:"P0001",message:"Product order changed. Refresh and try again."},400);
   [storefrontIds[index],storefrontIds[next]]=[storefrontIds[next],storefrontIds[index]];return send(null);
  }
  if(name==="set_report_count"){item.report_count=body.desired_count;return send(null);}
  if(name==="submit_order_content"){
   if(body.content_kind==="message")messages.push({id:body.entry_id,order_id:body.target_order,sender_id:id,sender_is_admin:id===admin,body:body.content,photo_paths:body.photos,created_at:new Date().toISOString()});
   else reviews.push({id:body.entry_id,order_id:body.target_order,customer_id:id,overall:body.content,item_reviews:body.item_comments,photo_paths:body.photos,created_at:new Date().toISOString()});
   return send(null);
  }
  return send(null);
 }
 const name=url.pathname.split("/").at(-1);
 const tables={
  orders:Array.from({length:reportCopies},(_,i)=>({...order,id:i===0?order.id:`00000000-0000-4000-8000-${String(i).padStart(12,"0")}`,order_number:`ARRI-${String(i+1).padStart(8,"0")}`,order_items:[item]})),order_items:[item],order_messages:messages,order_reviews:reviews,
  payment_submissions:[],order_status_history:[],order_admin_events:id===admin?adminEvents:[],order_admin_details:[{order_id:orderId,notes:""}],
  payment_settings:[{id:1,qr_path:"payment/qr.png",instructions:"Scan to pay"}],
  products:[{id:product,title:"Cookies",description:"Cookies",price_centavos:10000,item_count:3,image_path:"products/cookies.png",image_paths:["products/cookies.png","products/cookies2.png"],out_of_stock:false,archived_at:null,created_at:new Date().toISOString()}],
  cart_items:[{product_id:product,quantity:2,products:{id:product,title:"Cookies",price_centavos:10000,image_path:"products/cookies.png",image_paths:["products/cookies.png"],item_count:3,out_of_stock:false,archived_at:null}}],profiles:[{id,full_name:"Jamie Baker",social_name:"",phone:"09123456789",delivery_address:"Manila",delivery_address_parts:{street_address:"12 Main",subdivision:"",barangay:"San Jose",city:"Manila",province:"Metro Manila",zip_code:"0123"}}],
  delivery_settings:[{id:1,lead_days:2,default_capacity:10}],delivery_days:[{delivery_date:date,is_open:true,capacity:10}],
 };
 let rows=tables[name]??[];
 if(name==="products")rows=storefrontIds.map((id,index)=>({...tables.products[0],id,title:id===product?"Cookies":id.startsWith("777")?"Brownies":"Muffins",display_order:index+1}));
 if(name==="orders"){
  const archive=url.searchParams.get("archived_at");
  if(archive==="is.null")rows=rows.filter(row=>!row.archived_at);
  if(archive==="not.is.null")rows=rows.filter(row=>row.archived_at);
 }
 if(req.method==="PATCH"||req.method==="POST"){if(rows[0])Object.assign(rows[0],body);return send(req.headers.accept?.includes("vnd.pgrst.object")?rows[0]??body:[body]);}
 res.setHeader("Content-Range",`0-${Math.max(0,rows.length-1)}/${rows.length}`);
 return send(req.headers.accept?.includes("vnd.pgrst.object")?rows[0]??null:rows);
});
server.listen(54329,"127.0.0.1");

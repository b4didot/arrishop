import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
export const runtime="nodejs";
export const maxDuration=60;
export async function GET(request:Request) {
 const secret=process.env.CRON_SECRET;
 if(!secret)return Response.json({error:"Cleanup is not configured."},{status:503});
 const received=Buffer.from(request.headers.get("authorization")??"");
 const expected=Buffer.from(`Bearer ${secret}`);
 if(received.length!==expected.length||!timingSafeEqual(received,expected))return Response.json({error:"Unauthorized"},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return Response.json({error:"Cleanup storage access is not configured."},{status:503});
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 let photosRemoved=0;const started=Date.now();
 try {
  while(Date.now()-started<45000) {
   const {data,error}=await client.rpc("expired_order_chat_photos");
   if(error)throw error;
   const paths=(data??[]).map((row:{object_name:string})=>row.object_name);
   if(!paths.length)break;
   const removal=await client.storage.from("order-media").remove(paths);
   if(removal.error)throw removal.error;
   photosRemoved+=paths.length;
  }
  const {data,error}=await client.rpc("purge_expired_order_messages");
  if(error)throw error;
  return Response.json({photosRemoved,messagesRemoved:data});
 }catch(error) {
  console.error("Order chat cleanup failed",error instanceof Error?error.name:"Storage/database error");
  return Response.json({error:"Cleanup failed; the next scheduled run will retry."},{status:500});
 }
}

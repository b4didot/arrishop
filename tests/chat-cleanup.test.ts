import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../src/app/api/cron/order-chat-cleanup/route.ts";
test("chat cleanup requires its secret, removes photos before messages, and retries failures safely",async t=>{
 const previous={secret:process.env.CRON_SECRET,url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,fetch:globalThis.fetch};
 t.after(()=>{
  for(const [key,value] of [["CRON_SECRET",previous.secret],["NEXT_PUBLIC_SUPABASE_URL",previous.url],["SUPABASE_SERVICE_ROLE_KEY",previous.key]] as const){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  globalThis.fetch=previous.fetch;
 });
 delete process.env.CRON_SECRET;
 assert.equal((await GET(new Request("https://example.test/api/cron/order-chat-cleanup"))).status,503);
 process.env.CRON_SECRET="test-cleanup-secret";
 assert.equal((await GET(new Request("https://example.test/api/cron/order-chat-cleanup"))).status,401);
 process.env.NEXT_PUBLIC_SUPABASE_URL="https://supabase.example.test";process.env.SUPABASE_SERVICE_ROLE_KEY="fixture-service-key";
 const calls:string[]=[];let listed=false;
 globalThis.fetch=async(input,init)=>{
  const url=String(input);calls.push(url);
  if(url.endsWith("/rpc/expired_order_chat_photos")){const data=listed?[]:[{object_name:"customer/order/message/photo.png"}];listed=true;return Response.json(data);}
  if(url.includes("/storage/v1/object/order-media")){
   assert.equal(init?.method,"DELETE");
   return Response.json([{name:"customer/order/message/photo.png"}]);
  }
  if(url.endsWith("/rpc/purge_expired_order_messages"))return Response.json(2);
  throw new Error("Unexpected request "+url);
 };
 const request=()=>new Request("https://example.test/api/cron/order-chat-cleanup",{headers:{authorization:"Bearer test-cleanup-secret"}});
 const response=await GET(request());assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{photosRemoved:1,messagesRemoved:2});
 assert.ok(calls.findIndex(url=>url.includes("/storage/"))<calls.findIndex(url=>url.includes("/purge_expired")));
 const errors:string[]=[];globalThis.fetch=async(input)=>{
  const url=String(input);errors.push(url);
  if(url.endsWith("/rpc/expired_order_chat_photos"))return Response.json([{object_name:"photo.png"}]);
  return Response.json({message:"Storage temporarily unavailable"},{status:500});
 };
 assert.equal((await GET(request())).status,500);
 assert.equal(errors.some(url=>url.endsWith("/rpc/purge_expired_order_messages")),false);
});

import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation";
export async function GET(){
 const client=await createClient();const {data,error}=await client.rpc("notification_inbox");
 if(error)return Response.json({error:"Could not load notifications."},{status:["42501","28000","P0001","PGRST301","PGRST302"].includes(error.code)?401:503});
 return Response.json(data,{headers:{"Cache-Control":"private, no-store"}});
}
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Invalid request."},{status:403});
 try{
  const body=await request.json();const client=await createClient();
  const until=typeof body.throughTime==="string"?body.throughTime:null;
  if(until&&!Number.isFinite(Date.parse(until)))throw new Error("Invalid date");
  const {error}=await client.rpc("read_order_notifications",{target_notification:body.id?uuid(body.id):null,through_time:until});
  if(error)return Response.json({error:"Could not mark notifications as read."},{status:400});
  return Response.json({success:true},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return Response.json({error:"Invalid request."},{status:400});}
}

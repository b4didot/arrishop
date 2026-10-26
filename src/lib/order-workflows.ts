import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DeliveryDay, OrderMessage, OrderReview } from "@/types";
export async function deliveryAvailability():Promise<DeliveryDay[]>{
 const client=await createClient();const days:DeliveryDay[]=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await client.rpc("delivery_availability").order("delivery_date").range(offset,offset+499);
  if(error)throw new Error("We couldn't load delivery dates. Please try again.");
  days.push(...(data??[]) as DeliveryDay[]);if((data?.length??0)<500)break;
 }
 return days;
}
export async function orderContent(orderId:string){
 const client=await createClient();
 const [messages,review]=await Promise.all([
  client.from("order_messages").select("*").eq("order_id",orderId).order("created_at").order("id"),
  client.from("order_reviews").select("*").eq("order_id",orderId).maybeSingle(),
 ]);
 if(messages.error||review.error)throw new Error("We couldn't load messages and feedback.");
 const entries=(messages.data??[]) as OrderMessage[];const feedback=review.data as OrderReview|null;
 const paths=[...new Set([...entries.flatMap(m=>m.photo_paths),...(feedback?.photo_paths??[])])];
 const signed=paths.length?await client.storage.from("order-media").createSignedUrls(paths,300):{data:[]};
 const urls=new Map((signed.data??[]).map(photo=>[photo.path,photo.signedUrl]));
 const photos=(paths:string[])=>paths.map(path=>({path,url:urls.get(path)??null}));
 return {messages:entries.map(m=>({...m,photos:photos(m.photo_paths)})),review:feedback?{...feedback,photos:photos(feedback.photo_paths)}:null};
}

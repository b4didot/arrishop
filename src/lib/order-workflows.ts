import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DeliveryDay, OrderMessage, OrderReview } from "@/types";

export async function deliveryAvailability(): Promise<DeliveryDay[]> {
 const client = await createClient();
 const { data, error } = await client.rpc("delivery_availability");
 if (error) throw new Error("We couldn't load delivery dates. Please try again.");
 return (data ?? []).sort((a: DeliveryDay, b: DeliveryDay) => a.delivery_date.localeCompare(b.delivery_date));
}
export async function orderContent(orderId: string) {
 const client = await createClient();
 const [messages, review] = await Promise.all([
  client.from("order_messages").select("*").eq("order_id", orderId).order("created_at").order("id"),
  client.from("order_reviews").select("*").eq("order_id", orderId).maybeSingle(),
 ]);
 if (messages.error || review.error) throw new Error("We couldn't load messages and feedback.");
 async function sign(paths: string[]) {
  return Promise.all(paths.map(async path => {
   const { data } = await client.storage.from("order-media").createSignedUrl(path, 300);
   return { path, url: data?.signedUrl ?? null };
  }));
 }
 return {
  messages: await Promise.all(((messages.data ?? []) as OrderMessage[]).map(async m => ({ ...m, photos: await sign(m.photo_paths) }))),
  review: review.data ? { ...review.data as OrderReview, photos: await sign(review.data.photo_paths) } : null,
 };
}

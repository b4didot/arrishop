import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CartItem, Order, OrderItem, PaymentSettings, PaymentSubmission, Profile, StatusEntry } from "@/types";

export function publicImage(path: string | null, bucket = "shop-images") {
  return path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}` : null;
}
export async function getCart(userId: string) {
  const client = await createClient();
  const { data, error } = await client.from("cart_items").select("product_id,quantity,products(*)").eq("customer_id", userId).order("created_at");
  if (error) throw new Error("We couldn't load your cart. Please try again after the shop setup is complete.");
  return (data ?? []) as unknown as CartItem[];
}
export async function getProfile(userId: string) {
  const client = await createClient();
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error("We couldn't load your details. Please try again.");
  return data as Profile | null;
}
export async function getOrder(id: string) {
  const client = await createClient();
  const { data: order, error } = await client.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("We couldn't load this order. Please try again.");
  if (!order) return null;
  const results = await Promise.all([
    client.from("order_items").select("id,product_id,title,unit_price_centavos,quantity,item_count,report_count").eq("order_id", id).order("id"),
    client.from("payment_submissions").select("id,receipt_path,receipt_paths,submitted_at,decision,amount_received_centavos,rejection_reason,reviewed_at").eq("order_id", id).order("submitted_at", { ascending: false }),
    client.from("order_status_history").select("id,previous_status,next_status,reason,created_at").eq("order_id", id).order("created_at", { ascending: false }),
    client.from("payment_settings").select("id,qr_path,instructions").eq("id", 1).maybeSingle(),
  ]);
  if (results.some((r) => r.error)) throw new Error("We couldn't load all order details. Please try again.");
  const payments = (results[1].data ?? []) as PaymentSubmission[];
  const receipts = await Promise.all(payments.map(async (p) => {
    const photos = await Promise.all(p.receipt_paths.map(async (path) => {
      const { data } = await client.storage.from("receipts").createSignedUrl(path, 300);
      return { path, url: data?.signedUrl ?? null };
    }));
    return { ...p, photos };
  }));
  return { order: order as Order, items: (results[0].data ?? []) as OrderItem[], payments: receipts, history: (results[2].data ?? []) as StatusEntry[], settings: results[3].data as PaymentSettings | null };
}

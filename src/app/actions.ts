"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { centavos, imageFile, password, quantity, safeNext, text, uuid } from "@/lib/validation";
import type { ActionState } from "@/types";

function failure(error: unknown): ActionState {
  return { error: error instanceof Error ? error.message : "Something went wrong. Please try again." };
}
function dbCheck(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === "P0001") throw new Error(error.message);
  console.error("Database operation failed:", error.code ?? "unknown");
  throw new Error("We couldn't save this change. Please try again. If the shop is new, its database setup may still be pending.");
}
function refreshOrder(id: string) {
  revalidatePath(`/orders/${id}`); revalidatePath("/orders");
  revalidatePath(`/admin/orders/${id}`); revalidatePath("/admin/orders"); revalidatePath("/admin");
}
export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  let next: string;
  try {
    const client = await createClient();
    const { error } = await client.auth.signInWithPassword({ email: text(form, "email", "your email address", 254), password: password(form, 1) });
    if (error) return { error: "We couldn't log you in. Check your email and password and try again." };
    next = safeNext(form.get("next"));
  } catch (error) { return failure(error); }
  redirect(next);
}
export async function register(_: ActionState, form: FormData): Promise<ActionState> {
  let signedIn = false;
  try {
    const client = await createClient();
    const email = text(form, "email", "your email address", 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please enter a valid email address.");
    const newPassword = password(form);
    const { data, error } = await client.auth.signUp({ email, password: newPassword, options: {
      data: { full_name: text(form, "full_name", "your full name", 120), phone: text(form, "phone", "your phone number", 30), delivery_address: text(form, "delivery_address", "your delivery address", 1000) },
    } });
    if (error) return { error: "We couldn't create your account. Try again, or log in if you already have an account." };
    signedIn = Boolean(data.session);
  } catch (error) { return failure(error); }
  if (signedIn) redirect("/");
  return { success: "Your account is ready. Log in to start shopping." };
}
export async function signOut() {
  const client = await createClient();
  const { error } = await client.auth.signOut();
  if (error) throw new Error("We couldn't sign you out. Please try again.");
  revalidatePath("/", "layout"); redirect("/");
}
export async function forgotPassword(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const client = await createClient();
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { error } = await client.auth.resetPasswordForEmail(text(form, "email", "your email address", 254), { redirectTo: `${origin}/auth/callback?next=/reset-password` });
    if (error) return { error: "We couldn't send a recovery email. Please try again in a moment." };
    return { success: "If an account exists for that email, you'll receive a password reset link." };
  } catch (error) { return failure(error); }
}
export async function resetPassword(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser("/reset-password");
  try {
    const client = await createClient();
    const { error } = await client.auth.updateUser({ password: password(form) });
    if (error) return { error: "We couldn't update your password. Request a fresh reset link and try again." };
    return { success: "Your password has been updated. You can keep shopping." };
  } catch (error) { return failure(error); }
}
export async function saveProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser("/account");
  try {
    const client = await createClient();
    const { error } = await client.from("profiles").update({ full_name: text(form, "full_name", "your full name", 120), phone: text(form, "phone", "your phone number", 30), delivery_address: text(form, "delivery_address", "your delivery address", 1000) }).eq("id", user.id).select("id").single();
    dbCheck(error); revalidatePath("/account"); revalidatePath("/checkout");
    return { success: "Your details are saved." };
  } catch (error) { return failure(error); }
}
export async function addToCart(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser("/");
  try {
    const client = await createClient();
    const { error } = await client.rpc("set_cart_item", { target_product: uuid(form.get("product_id")), desired_quantity: 1, add_to_existing: true });
    dbCheck(error); revalidatePath("/", "layout");
    return { success: "Added to your cart!" };
  } catch (error) { return failure(error); }
}
export async function updateCart(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser("/cart");
  try {
    const client = await createClient();
    const { error } = await client.rpc("set_cart_item", { target_product: uuid(form.get("product_id")), desired_quantity: quantity(form.get("quantity"), true) });
    dbCheck(error); revalidatePath("/", "layout");
    return { success: "Your cart is updated." };
  } catch (error) { return failure(error); }
}
export async function placeOrder(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser("/checkout");
  let orderId: string;
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("checkout", { request_key: uuid(form.get("checkout_key")) });
    dbCheck(error); orderId = uuid(data); revalidatePath("/", "layout");
  } catch (error) { return failure(error); }
  redirect(`/orders/${orderId}?placed=1`);
}
export async function uploadReceipt(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser("/orders");
  try {
    const id = uuid(form.get("order_id"));
    const submission = uuid(form.get("submission_key"));
    const image = (await imageFile(form, "receipt"))!;
    const path = `${user.id}/${id}/${submission}.${image.extension}`;
    const client = await createClient();
    const { error: uploadError } = await client.storage.from("receipts").upload(path, image.bytes, { contentType: image.type, upsert: false });
    if (uploadError && !["409", "400"].includes(String((uploadError as { statusCode?: string }).statusCode))) throw new Error("We couldn't upload your receipt. Please try again.");
    if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw new Error("We couldn't upload your receipt. Please refresh the order and try again.");
    const { error } = await client.rpc("submit_receipt", { target_order: id, object_name: path });
    // Retain uploads on failure. Customers cannot delete evidence during or after finalization.
    dbCheck(error); refreshOrder(id);
    return { success: "Receipt submitted! We'll check your payment and update your order." };
  } catch (error) { return failure(error); }
}
export async function saveProduct(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const client = await createClient();
  try {
    const id = uuid(form.get("product_id"));
    if (form.get("id") && uuid(form.get("id")) !== id) throw new Error("Please refresh the page and try again.");
    const title = text(form, "title", "a product name", 120);
    const description = text(form, "description", "a description", 2000);
    const price = centavos(form.get("price"));
    const paths: unknown = JSON.parse(text(form, "image_paths", "product photos", 2000));
    const primary = text(form, "image_path", "a primary photo", 500);
    if (!Array.isArray(paths) || paths.length < 1 || paths.length > 3 || new Set(paths).size !== paths.length || !paths.includes(primary) || paths.some((path) => typeof path !== "string")) throw new Error("Add one to three photos and choose a primary photo.");
    const { data: existing, error: readError } = await client.from("products").select("*").eq("id", id).maybeSingle();
    dbCheck(readError);
    if (Boolean(form.get("id")) !== Boolean(existing)) throw new Error("This product changed. Please refresh the page and try again.");
    const saved: string[] = existing?.image_paths ?? (existing?.image_path ? [existing.image_path] : []);
    for (const path of paths as string[]) {
      if (saved.includes(path)) continue;
      if (!new RegExp(`^products/${id}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path)) throw new Error("Please upload photos for this product.");
      const { data: blob, error } = await client.storage.from("shop-images").download(path);
      if (error || !blob) throw new Error("We couldn't find your photo. Please upload it again.");
      const image = new FormData(); image.set("photo", new File([blob], "photo", { type: blob.type }));
      await imageFile(image, "photo");
    }
    const values = { title, description, price_centavos: price, out_of_stock: form.get("out_of_stock") === "on", image_path: primary, image_paths: paths };
    const result = form.get("id") ? await client.from("products").update(values).eq("id", id).select("id").single() : await client.from("products").insert({ id, ...values }).select("id").single();
    dbCheck(result.error); revalidatePath("/"); revalidatePath("/admin/products");
    return { success: "Product saved." };
  } catch (error) {
    // Retain staged images on uncertain outcomes; never delete an image a save may have committed.
    return failure(error);
  }
}

export async function toggleArchive(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const client = await createClient();
    const { error } = await client.from("products").update({ archived_at: form.get("archive") === "yes" ? new Date().toISOString() : null }).eq("id", uuid(form.get("id"))).select("id").single();
    dbCheck(error); revalidatePath("/"); revalidatePath("/admin/products");
    return { success: "Product availability updated." };
  } catch (error) { return failure(error); }
}
export async function savePaymentSettings(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const client = await createClient();
  let uploadedPath: string | null = null;
  try {
    const instructions = text(form, "instructions", "payment instructions", 2000);
    const image = await imageFile(form, "qr", false);
    if (image) {
      uploadedPath = `payment/${crypto.randomUUID()}.${image.extension}`;
      const { error } = await client.storage.from("shop-images").upload(uploadedPath, image.bytes, { contentType: image.type, upsert: false });
      if (error) throw new Error("We couldn't upload your QR image. Please try again.");
    }
    const { error } = await client.from("payment_settings").update({ instructions, updated_by: user.id, ...(uploadedPath ? { qr_path: uploadedPath } : {}) }).eq("id", 1).select("id").single();
    dbCheck(error); revalidatePath("/admin/settings"); revalidatePath("/orders", "layout"); revalidatePath("/checkout");
    return { success: "Payment settings saved. Customers will see the current QR code." };
  } catch (error) {
    if (uploadedPath) await client.storage.from("shop-images").remove([uploadedPath]);
    return failure(error);
  }
}
export async function reviewPayment(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const id = uuid(form.get("order_id"));
    const approve = form.get("decision") === "confirm";
    if (!approve && form.get("decision") !== "reject") throw new Error("Choose confirm or reject.");
    const client = await createClient();
    const { error } = await client.rpc("review_payment", { target_order: id, target_submission: uuid(form.get("submission_id")), approve, received_centavos: approve ? centavos(form.get("amount"), 1_000_000_000_000) : null, reason: approve ? null : text(form, "reason", "a rejection reason", 1000) });
    dbCheck(error); refreshOrder(id);
    return { success: approve ? "Payment confirmed." : "Payment rejected. The customer can submit another receipt." };
  } catch (error) { return failure(error); }
}
export async function advanceOrder(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const id = uuid(form.get("order_id"));
    const next = text(form, "next_status", "a status", 30);
    const client = await createClient();
    const { error } = await client.rpc("advance_order", { target_order: id, next_status: next, reason: next === "cancelled" ? text(form, "reason", "a cancellation reason", 1000) : null });
    dbCheck(error); refreshOrder(id);
    return { success: "Order status updated." };
  } catch (error) { return failure(error); }
}
export async function saveNotes(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const id = uuid(form.get("order_id"));
    const client = await createClient();
    const { error } = await client.from("order_admin_details").upsert({ order_id: id, notes: text(form, "notes", "notes", 5000, 0) });
    dbCheck(error); revalidatePath(`/admin/orders/${id}`);
    return { success: "Internal notes saved." };
  } catch (error) { return failure(error); }
}

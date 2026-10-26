"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { text, uuid } from "@/lib/validation";
import { receiptImageFile } from "@/lib/receipt-validation";
import type { ActionState } from "@/types";

function fail(error: unknown): ActionState { return { error: error instanceof Error ? error.message : "We couldn't save this change." }; }
function check(error: { code?: string; message: string } | null) {
 if (error) throw new Error(error.code === "P0001" ? error.message : "We couldn't save this change. Please try again.");
}
function refresh(id?: string) {
 revalidatePath("/checkout"); revalidatePath("/admin/calendar"); revalidatePath("/admin/report");
 revalidatePath("/orders"); revalidatePath("/admin/orders"); revalidatePath("/admin");
 if (id) { revalidatePath(`/orders/${id}`); revalidatePath(`/admin/orders/${id}`); }
}
function integer(value: FormDataEntryValue | null, minimum: number, maximum: number) {
 if (typeof value !== "string" || !/^\d+$/.test(value) || Number(value)<minimum || Number(value)>maximum) throw new Error(`Enter a whole number from ${minimum} to ${maximum}.`);
 return Number(value);
}
function date(value: FormDataEntryValue | null) {
 if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value) throw new Error("Choose a valid delivery date.");
 return value;
}
export async function saveDeliverySettings(_: ActionState, form: FormData): Promise<ActionState> {
 await requireAdmin();
 try {
  const client = await createClient();
  const { error } = await client.from("delivery_settings").update({ lead_days: integer(form.get("lead_days"),0,365), default_capacity: integer(form.get("default_capacity"),1,10000) }).eq("id",1).select("id").single();
  check(error); refresh(); return { success: "Delivery settings saved." };
 } catch(error) { return fail(error); }
}
export async function saveDeliveryDay(_: ActionState, form: FormData): Promise<ActionState> {
 await requireAdmin();
 try {
  const client = await createClient();
  const { error } = await client.from("delivery_days").upsert({ delivery_date: date(form.get("delivery_date")), is_open: form.get("is_open")==="on", capacity: integer(form.get("capacity"),1,10000) }).select("delivery_date").single();
  check(error); refresh(); return { success: "Delivery date saved. Existing reservations are kept." };
 } catch(error) { return fail(error); }
}
export async function changeDeliveryDate(_: ActionState, form: FormData): Promise<ActionState> {
 await requireUser("/orders");
 try {
  const id=uuid(form.get("order_id")); const client=await createClient();
  const { error } = await client.rpc("set_order_delivery",{ target_order:id, chosen_date:date(form.get("delivery_date")) });
  check(error); refresh(id); return { success:"Delivery date updated." };
 } catch(error) { return fail(error); }
}
export async function saveReportCount(_: ActionState, form: FormData): Promise<ActionState> {
 await requireAdmin();
 try {
  const client=await createClient();
  const {error}=await client.rpc("set_report_count",{target_item:uuid(form.get("item_id")),desired_count:form.get("reset_count")==="yes"?null:integer(form.get("report_count"),0,10000000)});
  check(error); refresh(); return { success:"Report count saved." };
 } catch(error) { return fail(error); }
}
export async function submitOrderContent(_: ActionState, form: FormData): Promise<ActionState> {
 const user=await requireUser("/orders");
 try {
  const id=uuid(form.get("order_id")); const entry=uuid(form.get("entry_id"));
  const kind=form.get("kind"); if(kind!=="message" && kind!=="review") throw new Error("Invalid submission.");
  const raw=JSON.parse(String(form.get("photo_paths") ?? "[]")) as unknown;
  if(!Array.isArray(raw) || raw.length>(kind==="review"?5:3) || new Set(raw).size!==raw.length) throw new Error("Too many photos.");
  const paths=raw as string[]; const client=await createClient();
  for(const [index,path] of paths.entries()) {
   const prefix=`${user.id}/${id}/${kind}/${entry}-${index+1}.`;
   if(typeof path!=="string" || !path.startsWith(prefix) || !/^(jpg|png|webp)$/.test(path.slice(prefix.length))) throw new Error("Invalid photo.");
   const {data,error}=await client.storage.from("order-media").download(path);
   if(error || !data) throw new Error("We couldn't read a photo. Please try again.");
   const image=new FormData(); image.set("receipt",new File([data],"photo",{type:path.endsWith(".jpg")?"image/jpeg":path.endsWith(".png")?"image/png":"image/webp"}));
   await receiptImageFile(image);
  }
  const comments:Record<string,string>={};
  if(kind==="review") for(const [key,value] of form) {
   if(key.startsWith("item:")) { const product=uuid(key.slice(5)); if(typeof value!=="string" || value.trim().length>3000) throw new Error("Keep each product comment under 3000 characters."); comments[product]=value.trim(); }
  }
  const {error}=await client.rpc("submit_order_content", {target_order:id,entry_id:entry,content_kind:kind,content:text(form,"body","your comment",kind==="review"?5000:3000,0),item_comments:comments,photos:paths});
  check(error); refresh(id); return {success:kind==="review"?"Thank you! Your private review has been saved.":"Message sent."};
 } catch(error) {return fail(error);}
}

export async function adminUpdateOrder(_:ActionState,form:FormData):Promise<ActionState>{
 await requireAdmin();
 try{
  const id=uuid(form.get("order_id"));
  const kind=form.get("change_kind");
  if(kind!=="status"&&kind!=="delivery_date"&&kind!=="archive")throw new Error("Choose a valid order change.");
  const expected=text(form,"expected_updated_at","the current order version",60);
  if(!Number.isFinite(Date.parse(expected)))throw new Error("Refresh the order and try again.");
  const status=kind==="status"?text(form,"new_status","an order status",30):null;
  const archive=kind==="archive"?form.get("archive_order"):null;
  if(kind==="archive"&&archive!=="true"&&archive!=="false")throw new Error("Choose archive or restore.");
  const client=await createClient();
  const {error}=await client.rpc("admin_update_order",{
   target_order:id,expected_updated_at:expected,change_kind:kind,
   reason:text(form,"reason","a change reason",1000,kind==="archive"?0:1),
   new_status:status,new_delivery_date:kind==="delivery_date"?date(form.get("new_delivery_date")):null,
   archive_order:kind==="archive"?archive==="true":null,
  });
  check(error);refresh(id);
  return {success:kind==="archive"?(archive==="true"?"Order archived.":"Order restored."):"Order updated. The change is recorded in its history."};
 }catch(error){return fail(error);}
}

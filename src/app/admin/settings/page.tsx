import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicImage } from "@/lib/data";
import { savePaymentSettings } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Field, Notice, PageHeading } from "@/components/ui";

export default async function Settings() {
  await requireAdmin();
  const client = await createClient();
  const { data, error } = await client.from("payment_settings").select("qr_path,instructions").eq("id", 1).single();
  if (error) throw new Error("We couldn't load payment settings.");
  const qr = publicImage(data.qr_path);
  return <><PageHeading eyebrow="SCAN. PAY. A LITTLE JOY." title="Payment settings" description="One permanent QR code for every customer order." /><Notice>Use your real payment QR. Replacing it updates payment pages for existing and future orders without changing order totals or snapshots.</Notice><section className="panel narrow"><h2>Shop payment QR</h2>{qr ? <img className="qr-image" src={qr} alt="Current shop payment QR" /> : <p className="small muted">No payment QR yet. Upload one to enable checkout.</p>}<ActionForm action={savePaymentSettings} submitLabel="Save payment settings" confirm="Update payment settings? Customers will see this QR and these instructions on their payment pages."><Field label={qr ? "Replace QR image (optional)" : "Payment QR image"}><input type="file" name="qr" accept="image/jpeg,image/png,image/webp" required={!qr} /></Field><p className="field-hint">JPG, PNG, or WebP · Up to 5 MB</p><Field label="Payment instructions"><textarea name="instructions" required maxLength={2000} defaultValue={data.instructions} rows={6} /></Field></ActionForm></section></>;
}

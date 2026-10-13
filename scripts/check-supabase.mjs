import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Load .env.local first: node --env-file=.env.local scripts/check-supabase.mjs");
  process.exitCode = 1;
} else {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { count, error } = await client.from("products").select("id,title,description,price_centavos,image_path,out_of_stock,archived_at,created_at", { count: "exact" }).limit(1);
  if (error) {
    console.log(`Supabase database check: ${error.code ?? "connection error"}. ${error.code === "PGRST205" ? "Run the initial migration in the SQL Editor." : "Check project configuration and access policies."}`);
    process.exitCode = 1;
  } else console.log(`Supabase catalog access is working. Visible products: ${count ?? 0}.`);
  const [settings, role] = await Promise.all([
    client.from("payment_settings").select("id,qr_path,instructions").eq("id", 1).maybeSingle(),
    client.rpc("is_admin"),
  ]);
  console.log(`Payment settings: ${settings.error ? settings.error.code : settings.data ? "available" : "not initialized"}.`);
  console.log(`Administrator role function: ${role.error ? role.error.code : "available"}.`);
  if (settings.error || !settings.data || role.error) process.exitCode = 1;
}

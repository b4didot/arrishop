import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { configured, createClient } from "@/lib/supabase/server";

export const getViewer = cache(async () => {
  if (!configured()) return { user: null, admin: false };
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { user: null, admin: false };
  const { data } = await client.rpc("is_admin");
  return { user, admin: data === true };
});
export async function requireUser(next = "/") {
  const viewer = await getViewer();
  if (!viewer.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return viewer.user;
}
export async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer.user) redirect("/login?next=/admin");
  if (!viewer.admin) redirect("/account?notice=admin-only");
  return viewer.user;
}

import Link from "@/components/app-link";
import { Package, Clock, PackageCheck, ClipboardCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui";
import { AdminOrderTable } from "@/components/admin-order-table";
import type { Order } from "@/types";

export default async function Admin() {
  await requireAdmin();
  const client = await createClient();
  const results = await Promise.all([
    client.from("orders").select("id", { count: "exact", head: true }),
    client.from("orders").select("id", { count: "exact", head: true }).eq("status", "verifying_payment"),
    client.from("orders").select("id", { count: "exact", head: true }).eq("status", "processing"),
    client.from("orders").select("id", { count: "exact", head: true }).eq("status", "completed"),
    client.from("orders").select("*").eq("status", "verifying_payment").order("created_at", { ascending: true }).limit(10),
  ]);
  if (results.some((r) => r.error)) throw new Error("We couldn't load the dashboard.");
  const cards = [{ label: "Total orders", icon: Package, href: "/admin/orders" }, { label: "Awaiting verification", icon: Clock, href: "/admin/orders?status=verifying_payment" }, { label: "Processing", icon: ClipboardCheck, href: "/admin/orders?status=processing" }, { label: "Completed", icon: PackageCheck, href: "/admin/orders?status=completed" }];
  return <><PageHeading eyebrow="HELLO, SHOPKEEPER" title="A little overview" description="Your shop at a glance. Let's take care of those lovely orders." /><div className="stat-grid">{cards.map((card, index) => <Link key={card.label} href={card.href} className="stat-card"><card.icon size={23} /><strong>{results[index].count ?? 0}</strong><span>{card.label}</span></Link>)}</div><section className="panel"><div className="panel-header"><h2>Payments to review</h2><Link href="/admin/orders?status=verifying_payment" className="text-link">View all</Link></div><AdminOrderTable orders={(results[4].data ?? []) as Order[]} /></section><section className="panel"><h2>Keep the shop looking lovely</h2><p className="muted small">Add new finds, update availability, or check your payment QR.</p><div className="flex flex-wrap gap-3"><Link href="/admin/products" className="button button-soft">Manage products</Link><Link href="/admin/settings" className="button button-soft">Payment settings</Link></div></section></>;
}

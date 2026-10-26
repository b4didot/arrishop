import Link from "@/components/app-link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { statusLabels } from "@/lib/format";
import { AdminOrderTable } from "@/components/admin-order-table";
import { Field, PageHeading } from "@/components/ui";
import type { Order, OrderStatus } from "@/types";
import { NavigationForm } from "@/components/pending-form";

export default async function Orders({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; date?: string; page?: string; archive?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page ?? "1", 10) || 1));
  const search = (params.q ?? "").replace(/[%,()\\"*]/g, " ").trim().slice(0, 100);
  const status = params.status && params.status in statusLabels ? params.status as OrderStatus : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : "";
  const client = await createClient();
  const archive = params.archive === "archived" || params.archive === "all" ? params.archive : "active";
  let query = client.from("orders").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (archive === "active") query = query.is("archived_at", null);
  if (archive === "archived") query = query.not("archived_at", "is", null);
  if (search) query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_social_name.ilike.%${search}%`);
  if (status) query = query.eq("status", status);
  if (date && Number.isFinite(new Date(`${date}T00:00:00+08:00`).getTime())) {
    const start = new Date(`${date}T00:00:00+08:00`);
    query = query.gte("created_at", start.toISOString()).lt("created_at", new Date(start.getTime() + 86400000).toISOString());
  }
  const { data, count, error } = await query.range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error("We couldn't load orders.");
  const pageUrl = (value: number) => `/admin/orders?${new URLSearchParams({ q: search, status, date, archive, page: String(value) })}`;
  return <><PageHeading eyebrow="EVERY LITTLE ORDER" title="Orders" description="Find an order, review a payment, or move fulfillment along." /><NavigationForm className="filter-form" action="/admin/orders"><Field label="Search order or customer"><input name="q" defaultValue={params.q} maxLength={100} placeholder="Order number, full name, or Social/Nickname" /></Field><Field label="Order archive"><select aria-label="Order archive" name="archive" defaultValue={archive}><option value="active">Active orders</option><option value="archived">Archived orders</option><option value="all">Active and archived</option></select></Field><Field label="Status"><select name="status" defaultValue={status}><option value="">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Date placed (Philippine time)"><input name="date" type="date" defaultValue={date} /></Field><button className="button">Filter orders</button></NavigationForm><section className="panel"><div className="panel-header"><h2>{count ?? 0} {(count ?? 0) === 1 ? "order" : "orders"}</h2><Link className="text-link" href="/admin/orders">Clear filters</Link></div><AdminOrderTable orders={(data ?? []) as Order[]} />{(page > 1 || (count ?? 0) > page * 20) && <nav className="pagination" aria-label="Order pages"><Link href={pageUrl(Math.max(1, page - 1))}>Previous</Link><span>Page {page}</span>{(count ?? 0) > page * 20 && <Link href={pageUrl(page + 1)}>Next</Link>}</nav>}</section></>;
}

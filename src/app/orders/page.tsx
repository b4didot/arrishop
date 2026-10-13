import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money, dateTime } from "@/lib/format";
import { EmptyState, PageHeading, StatusBadge } from "@/components/ui";
import type { Order } from "@/types";

export const metadata = { title: "My orders" };
export default async function Orders({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser("/orders");
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page ?? "1", 10) || 1));
  const client = await createClient();
  const { data, error, count } = await client.from("orders").select("*,order_items(title,quantity)", { count: "exact" }).eq("customer_id", user.id).order("created_at", { ascending: false }).range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error("We couldn't load your orders.");
  const orders = (data ?? []) as (Order & { order_items: { title: string; quantity: number }[] })[];
  return <div className="container page-container"><PageHeading eyebrow="FOLLOW THE LITTLE JOY" title="My orders" description="Your favorites, from checkout to your doorstep." />{orders.length ? <div className="order-list">{orders.map((order) => <article key={order.id} className="order-list-card"><div><h3>{order.order_number}</h3><p className="muted">{dateTime(order.created_at)}</p><p style={{ marginTop: 8 }}>{order.order_items.map((item) => `${item.title} × ${item.quantity}`).join(" · ")}</p></div><div className="order-list-right"><div><strong>{money(order.total_centavos)}</strong><div style={{ marginTop: 8 }}><StatusBadge status={order.status} /></div></div><Link className="button button-small button-soft" href={`/orders/${order.id}`}>View order <ArrowUpRight size={15} /></Link></div></article>)}</div> : <EmptyState title={page > 1 ? "No more orders here" : "Your story starts here"} description="When you place an order, you'll find its payment instructions and updates here." href="/#shop" />}{(page > 1 || (count ?? 0) > page * 20) && <nav className="pagination" aria-label="Order pages"><Link href={`/orders?page=${Math.max(1, page - 1)}`}>Previous</Link><span>Page {page}</span>{(count ?? 0) > page * 20 && <Link href={`/orders?page=${page + 1}`}>Next</Link>}</nav>}</div>;
}

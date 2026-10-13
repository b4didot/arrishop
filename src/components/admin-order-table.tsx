import Link from "next/link";
import { dateTime, money } from "@/lib/format";
import type { Order } from "@/types";
import { StatusBadge } from "@/components/ui";

export function AdminOrderTable({ orders }: { orders: Order[] }) {
  return <div className="table-scroll"><table className="order-table"><thead><tr><th>Order</th><th>Placed</th><th>Customer</th><th>Total</th><th>Status</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{order.order_number}</td><td>{dateTime(order.created_at)}</td><td>{order.customer_name}</td><td>{money(order.total_centavos)}</td><td><StatusBadge status={order.status} /></td><td><Link href={`/admin/orders/${order.id}`}>Open order</Link></td></tr>)}</tbody></table>{!orders.length && <p className="muted small" style={{ padding: 20 }}>No orders match this view.</p>}</div>;
}

import Link from "@/components/app-link";
import { dateTime, money, statusLabels } from "@/lib/format";
import type { Order } from "@/types";
import { StatusBadge } from "@/components/ui";

export function AdminOrderTable({ orders }: { orders: Order[] }) {
  return <div className="table-scroll"><table className="order-table"><thead><tr><th>Status</th><th>Customer</th><th>Total</th><th>Order Number</th><th>Placed</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><Link className="status-link" href={`/admin/orders/${order.id}`} aria-label={`Open ${order.order_number}: ${statusLabels[order.status]}`}><StatusBadge status={order.status} /></Link></td><td>{order.customer_name}</td><td>{money(order.total_centavos)}</td><td>{order.order_number}</td><td>{dateTime(order.created_at)}</td></tr>)}</tbody></table>{!orders.length && <p className="muted small" style={{ padding: 20 }}>No orders match this view.</p>}</div>;
}

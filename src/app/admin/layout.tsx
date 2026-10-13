import Link from "next/link";
import { LayoutDashboard, ShoppingBag, Package, QrCode } from "lucide-react";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Admin" };
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <div className="container page-container admin-shell"><nav className="admin-nav" aria-label="Administrator navigation"><h2>Shop workspace</h2><Link href="/admin"><LayoutDashboard size={17} />Overview</Link><Link href="/admin/products"><ShoppingBag size={17} />Products</Link><Link href="/admin/orders"><Package size={17} />Orders</Link><Link href="/admin/settings"><QrCode size={17} />Payment settings</Link></nav><div className="admin-content">{children}</div></div>;
}

import Link from "next/link";
import { Croissant, ShoppingBasket, UserRound, LayoutDashboard, LogOut } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";

export async function Header() {
  const { user, admin } = await getViewer();
  let count = 0;
  if (user) {
    const client = await createClient();
    const { data } = await client.from("cart_items").select("quantity").eq("customer_id", user.id);
    count = (data ?? []).reduce((sum, item) => sum + item.quantity, 0);
  }
  return <>
    <div className="announcement"><span>A little something sweet, just for you</span><Croissant size={13} /><span>Baked with love</span></div>
    <header className="site-header"><div className="header-inner">
      <Link href="/" className="brand" aria-label="Arrie Store home"><span className="brand-flower"><Croissant size={31} strokeWidth={1.6} /></span><span>arrie<span className="brand-dot">.</span><small>STORE</small></span></Link>
      <nav className="main-nav" aria-label="Main navigation"><Link href="/#shop">Shop</Link>{user && <Link href="/orders">My Orders</Link>}</nav>
      <div className="header-actions">{admin && <Link href="/admin" className="icon-link" aria-label="Admin dashboard"><LayoutDashboard size={20} /><span className="desktop-label">Admin</span></Link>}
        <Link href={user ? "/account" : "/login"} className="icon-link"><UserRound size={20} /><span className="desktop-label">{user ? "Account" : "Log in"}</span></Link>
        {user && <form action={signOut}><button className="icon-link" type="submit" aria-label="Log out"><LogOut size={18} /></button></form>}
      </div>
    </div></header>
    <Link href="/cart" className="floating-cart" aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}><ShoppingBasket size={27} strokeWidth={1.8} /><span className="floating-cart-count" aria-hidden="true">{count}</span></Link>
  </>;
}

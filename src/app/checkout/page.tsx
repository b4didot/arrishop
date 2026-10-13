import { completeAddress } from "@/lib/validation";
import { DeliveryAddressDetails } from "@/components/delivery-address";
import Link from "@/components/app-link";
import { createHash } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { getCart, getProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import { CheckoutForm } from "@/components/checkout-form";
import { BackLink, EmptyState, Notice, PageHeading } from "@/components/ui";

export const metadata = { title: "Checkout" };
export default async function Checkout() {
  const user = await requireUser("/checkout");
  const [items, profile] = await Promise.all([getCart(user.id), getProfile(user.id)]);
  if (!items.length) return <div className="container page-container"><EmptyState title="Your cart is empty" description="Add a few favorites before placing an order." href="/#shop" /></div>;
  const client = await createClient();
  const { data: settings, error } = await client.from("payment_settings").select("qr_path").eq("id", 1).maybeSingle();
  const complete = Boolean(profile?.full_name.trim() && profile.phone.trim() && completeAddress(profile.delivery_address_parts));
  const unavailable = items.some((item) => item.products.out_of_stock || item.products.archived_at);
  const ready = complete && !unavailable && !error && Boolean(settings?.qr_path);
  const subtotal = items.reduce((sum, item) => sum + item.products.price_centavos * item.quantity, 0);
  const fingerprint = createHash("sha256").update(JSON.stringify(items.map((i) => [i.product_id, i.quantity, i.products.price_centavos]).sort())).digest("hex").slice(0, 24);
  return <div className="container page-container"><BackLink href="/cart">Back to cart</BackLink><PageHeading eyebrow="JUST ONE MORE STEP" title="Review your order" description="Check your favorites and delivery details before confirming." /><div className="two-column"><div><section className="panel"><div className="panel-header"><h2>Delivery details</h2><Link className="text-link" href="/account">Edit details</Link></div>{complete ? <p className="address"><strong>{profile!.full_name}</strong><br />{profile!.phone}<br /><DeliveryAddressDetails address={profile!.delivery_address_parts} fallback={profile!.delivery_address} /></p> : <Notice>Please add your name, phone number, and delivery address in <Link href="/account" className="text-link">My account</Link>.</Notice>}</section><section className="panel"><h2>Your lovely finds</h2>{items.map((item) => <div key={item.product_id} className="order-line"><div>{item.products.title}<small>{money(item.products.price_centavos)} × {item.quantity}</small></div><strong>{money(item.products.price_centavos * item.quantity)}</strong></div>)}</section></div><aside className="panel sticky-summary"><h2>Order summary</h2>{unavailable && <Notice>An item is no longer available. Return to your cart to remove it.</Notice>}{(!settings?.qr_path || error) && <Notice>The shop is still setting up payments. Checkout will be available soon.</Notice>}<CheckoutForm userId={user.id} fingerprint={fingerprint} subtotal={subtotal} ready={ready} /><p className="small muted" style={{ marginTop: 18 }}>No payment is taken here. After confirming, scan our QR code and upload your receipt. We'll verify your payment manually.</p><p className="small muted" style={{ marginBottom: 0 }}>Prices and availability are checked again when your order is placed.</p></aside></div></div>;
}

import Image from "next/image";
import Link from "@/components/app-link";
import { ArrowRight, Croissant, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCart, publicImage } from "@/lib/data";
import { money } from "@/lib/format";
import { updateCart } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { BackLink, EmptyState, Notice, PageHeading } from "@/components/ui";

export const metadata = { title: "My cart" };
export default async function Cart() {
  const user = await requireUser("/cart");
  const items = await getCart(user.id);
  const total = items.reduce((sum, item) => sum + item.products.price_centavos * item.quantity, 0);
  const unavailable = items.some((item) => item.products.out_of_stock || item.products.archived_at);
  return <div className="container page-container"><BackLink href="/#shop">Keep shopping</BackLink><PageHeading eyebrow="YOUR LOVELY LITTLE FINDS" title="My cart" description={`${items.length} ${items.length === 1 ? "favorite" : "favorites"}, ready for a little joy.`} />{!items.length ? <EmptyState title="Your cart is feeling a little empty" description="Find something lovely and add it here. Your next favorite is waiting." href="/#shop" /> : <>{unavailable && <Notice>Some items are no longer available. Please remove them before checkout.</Notice>}<div className="two-column"><section className="panel">{items.map((item) => {
    const product = item.products; const image = publicImage(product.image_path);
    return <article key={product.id} className="cart-item"><div className="cart-thumb">{image ? <Image src={image} alt={product.title} fill sizes="90px" /> : <Croissant size={28} />}</div><div><h3>{product.title}</h3><p className="small muted">{money(product.price_centavos)} each {(product.out_of_stock || product.archived_at) && <span className="badge status-payment_rejected">Unavailable</span>}</p><ActionForm action={updateCart} className="form-stack"><input type="hidden" name="product_id" value={product.id} /><div className="cart-controls"><label className="small" htmlFor={`qty-${product.id}`}>Qty</label><input className="input" type="number" id={`qty-${product.id}`} name="quantity" defaultValue={item.quantity} min={1} max={99} required /><SubmitButton className="button button-small button-soft">Update</SubmitButton></div></ActionForm><ActionForm action={updateCart} className="product-add"><input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="quantity" value="0" /><SubmitButton className="icon-link small"><Trash2 size={13} />Remove</SubmitButton></ActionForm></div><strong className="cart-price">{money(product.price_centavos * item.quantity)}</strong></article>;
  })}</section><aside className="panel sticky-summary"><h2>A little recap</h2><div className="summary-line"><span>Items</span><span>{items.reduce((sum, item) => sum + item.quantity, 0)}</span></div><div className="summary-line summary-total"><span>Total</span><strong>{money(total)}</strong></div>{unavailable ? <button className="button full-width" disabled>Remove unavailable items first</button> : <Link href="/checkout" className="button full-width">Review & checkout <ArrowRight size={18} /></Link>}<p className="small muted" style={{ marginTop: 18, marginBottom: 0 }}>You'll review your delivery details before placing your order. Pay with our QR code after confirmation.</p></aside></div></>}</div>;
}

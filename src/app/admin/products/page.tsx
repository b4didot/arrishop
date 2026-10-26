import { StorefrontProductOrder } from "@/components/storefront-product-order";
import Image from "next/image";
import { Croissant, Archive, ArchiveRestore } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicImage } from "@/lib/data";
import { money } from "@/lib/format";
import { toggleArchive } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageHeading } from "@/components/ui";
import { ProductEditor } from "@/components/product-editor";
import type { Product } from "@/types";

export default async function Products() {
  await requireAdmin();
  const client = await createClient();
  const { data, error } = await client.from("products").select("*").order("display_order").order("created_at", { ascending: false }).order("id");
  if (error) throw new Error("We couldn't load products.");
  const products = (data ?? []) as Product[];
  return <><PageHeading eyebrow="THE LOVELY LINEUP" title="Products" description="Add a new favorite or give your current collection a little update." /><section className="panel" style={{ marginBottom: 25 }}><details><summary className="details-toggle">+ Add a new product</summary><ProductEditor /></details></section><StorefrontProductOrder products={products} /><div className="product-admin-grid">{products.map((product) => {
    const image = publicImage(product.image_path);
    return <section key={product.id} className="panel"><div className="admin-product-head"><div className="cart-thumb">{image ? <Image src={image} alt={product.title} fill sizes="66px" /> : <Croissant size={25} />}</div><div><h3>{product.title}</h3><span className="small">{money(product.price_centavos)}</span><div style={{ marginTop: 7 }}><span className="badge">{product.archived_at ? "Archived" : product.out_of_stock ? "Out of Stock" : "Available"}</span></div></div></div><details><summary className="details-toggle">Edit product</summary><ProductEditor product={product} /></details><hr className="divider" /><ActionForm action={toggleArchive} confirm={product.archived_at ? "Restore this product to the storefront?" : "Archive this product? It will be hidden from the storefront. Existing orders will be preserved."} className="product-add"><input type="hidden" name="id" value={product.id} /><input type="hidden" name="archive" value={product.archived_at ? "no" : "yes"} /><SubmitButton className="button button-small button-soft">{product.archived_at ? <><ArchiveRestore size={15} />Restore product</> : <><Archive size={15} />Archive product</>}</SubmitButton></ActionForm></section>;
  })}</div>{!products.length && <p className="muted small">Your collection starts here. Add your first product above.</p>}</>;
}

import Image from "next/image";
import { Croissant, Archive, ArchiveRestore } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicImage } from "@/lib/data";
import { money } from "@/lib/format";
import { saveProduct, toggleArchive } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, PageHeading } from "@/components/ui";
import type { Product } from "@/types";

function ProductFields({ product }: { product?: Product }) {
  return <>{product && <input type="hidden" name="id" value={product.id} />}<Field label="Product name"><input name="title" required maxLength={120} defaultValue={product?.title} placeholder="A lovely little name" /></Field><Field label="Description"><textarea name="description" required maxLength={2000} defaultValue={product?.description} placeholder="Tell customers what makes it special" /></Field><Field label="Price (PHP)"><input name="price" type="text" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" required defaultValue={product ? (product.price_centavos / 100).toFixed(2) : undefined} placeholder="0.00" /></Field><Field label={product ? "Replace photo (optional)" : "Product photo"}><input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required={!product} /></Field><p className="field-hint">JPG, PNG, or WebP · Up to 5 MB</p><label className="checkbox-field"><input name="out_of_stock" type="checkbox" defaultChecked={product?.out_of_stock} />Out of stock (visible, but can't be purchased)</label></>;
}
export default async function Products() {
  await requireAdmin();
  const client = await createClient();
  const { data, error } = await client.from("products").select("*").order("created_at", { ascending: false });
  if (error) throw new Error("We couldn't load products.");
  const products = (data ?? []) as Product[];
  return <><PageHeading eyebrow="THE LOVELY LINEUP" title="Products" description="Add a new favorite or give your current collection a little update." /><section className="panel" style={{ marginBottom: 25 }}><details><summary className="details-toggle">+ Add a new product</summary><ActionForm action={saveProduct} submitLabel="Create product"><ProductFields /></ActionForm></details></section><div className="product-admin-grid">{products.map((product) => {
    const image = publicImage(product.image_path);
    return <section key={product.id} className="panel"><div className="admin-product-head"><div className="cart-thumb">{image ? <Image src={image} alt={product.title} fill sizes="66px" /> : <Croissant size={25} />}</div><div><h3>{product.title}</h3><span className="small">{money(product.price_centavos)}</span><div style={{ marginTop: 7 }}><span className="badge">{product.archived_at ? "Archived" : product.out_of_stock ? "Out of Stock" : "Available"}</span></div></div></div><details><summary className="details-toggle">Edit product</summary><ActionForm action={saveProduct} submitLabel="Save product"><ProductFields product={product} /></ActionForm></details><hr className="divider" /><ActionForm action={toggleArchive} confirm={product.archived_at ? "Restore this product to the storefront?" : "Archive this product? It will be hidden from the storefront. Existing orders will be preserved."} className="product-add"><input type="hidden" name="id" value={product.id} /><input type="hidden" name="archive" value={product.archived_at ? "no" : "yes"} /><SubmitButton className="button button-small button-soft">{product.archived_at ? <><ArchiveRestore size={15} />Restore product</> : <><Archive size={15} />Archive product</>}</SubmitButton></ActionForm></section>;
  })}</div>{!products.length && <p className="muted small">Your collection starts here. Add your first product above.</p>}</>;
}

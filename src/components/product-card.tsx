import Image from "next/image";
import { Plus, Croissant } from "lucide-react";
import type { Product } from "@/types";
import { money } from "@/lib/format";
import { publicImage } from "@/lib/data";
import { addToCart } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";

export function ProductCard({ product }: { product: Product }) {
  const image = publicImage(product.image_path);
  return <article className="product-card"><div className="product-image">{image ? <Image src={image} alt={product.title} fill sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 25vw" /> : <Croissant size={75} strokeWidth={1} />}{product.out_of_stock && <span className="badge stock-badge">Out of Stock</span>}</div>
    <div className="product-body"><h3>{product.title}</h3><p>{product.description}</p><div className="product-bottom"><strong>{money(product.price_centavos)}</strong>{product.out_of_stock ? <button className="button button-small button-soft" disabled>Out of Stock</button> : <ActionForm action={addToCart} className="product-add"><input type="hidden" name="product_id" value={product.id} /><SubmitButton className="button button-small"><Plus size={16} /> Add to cart</SubmitButton></ActionForm>}</div></div>
  </article>;
}

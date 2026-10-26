import { ProductGallery } from "@/components/product-gallery";
import { productPhotos } from "@/lib/product-photos";
import { Croissant } from "lucide-react";
import type { Product } from "@/types";
import { money } from "@/lib/format";
import { publicImage } from "@/lib/data";
import { AddToCart } from "@/components/add-to-cart";


export function ProductCard({ product }: { product: Product }) {
  const image = publicImage(product.image_path);
  return <article className="product-card"><div className="product-image">{image ? <ProductGallery title={product.title} primary={image} photos={productPhotos(product).map((path) => publicImage(path)!)} /> : <Croissant size={75} strokeWidth={1} />}{product.out_of_stock && <span className="badge stock-badge">Out of Stock</span>}</div>
    <div className="product-body"><h3>{product.title}</h3><p>{product.description}</p><div className="product-bottom"><strong>{money(product.price_centavos)}</strong>{product.out_of_stock ? <button className="button button-small button-soft" disabled>Out of Stock</button> : <AddToCart productId={product.id} />}</div></div>
  </article>;
}

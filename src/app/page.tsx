import { configured, createClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/ui";
import type { Product } from "@/types";

export default async function Home() {
  let products: Product[] = [];
  let unavailable = !configured();
  if (!unavailable) {
    try {
      const client = await createClient();
      const { data, error } = await client.from("products").select("*").is("archived_at", null).order("created_at", { ascending: false });
      unavailable = Boolean(error); products = (data ?? []) as Product[];
    } catch { unavailable = true; }
  }
  return <>
    <section id="shop" className="container shop-section"><div className="section-heading"><div><p className="eyebrow">BAKED WITH LOVE</p><h1>Meet your new favorites<span className="pink-dot">.</span></h1><p className="muted">Something sweet for you, or someone you love.</p></div><span className="collection-label">All products <span>{products.length}</span></span></div>
      {products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyState title={unavailable ? "Lovely things are on their way" : "Our shelves are getting ready"} description={unavailable ? "We're getting the shop ready. Please check back soon for our first little finds." : "Our first collection is coming soon. Come back to discover something lovely."} />}
    </section>
  </>;
}

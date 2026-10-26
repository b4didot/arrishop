import { ArrowDown, ArrowUp } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { moveStorefrontProduct } from "@/app/actions";
import type { Product } from "@/types";

export function StorefrontProductOrder({ products }: { products: Product[] }) {
  const visible = products.filter(product => !product.archived_at);
  return <section className="panel storefront-order"><h2>Storefront order</h2>
    <p className="small muted">Use the arrows to move products up or down. Each move saves immediately. New products appear at the end.</p>
    {visible.length ? <ol className="storefront-order-list">{visible.map((product, index) => <li key={product.id} className="storefront-order-row">
      <span className="small muted">{index + 1}.</span><strong>{product.title}</strong>
      {(["up", "down"] as const).map(direction => {
        const neighbor = visible[index + (direction === "up" ? -1 : 1)];
        return <ActionForm key={`${direction}:${product.display_order}:${neighbor?.id ?? "edge"}`} action={moveStorefrontProduct} className="storefront-move">
          <input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="direction" value={direction} /><input type="hidden" name="neighbor_id" value={neighbor?.id ?? ""} />
          <SubmitButton className="button button-outline" disabled={!neighbor}>{direction === "up" ? <ArrowUp size={18} aria-hidden="true" /> : <ArrowDown size={18} aria-hidden="true" />}<span className="sr-only">Move {product.title} {direction}</span></SubmitButton>
        </ActionForm>;
      })}
    </li>)}</ol> : <p className="small muted">Add or restore a product to arrange the storefront.</p>}
  </section>;
}

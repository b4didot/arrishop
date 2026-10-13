import type { Product } from "@/types";

export function productPhotos(product: Pick<Product, "image_path" | "image_paths">): string[] {
  return product.image_paths?.length ? product.image_paths : product.image_path ? [product.image_path] : [];
}

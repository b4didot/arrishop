"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Check } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui";
import { saveProduct } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { imageFile } from "@/lib/validation";
import { productPhotos } from "@/lib/product-photos";
import type { ActionState, Product } from "@/types";

type Photo = { path?: string; file?: File; preview: string };
function PhotoPreview({ photo }: { photo: Photo }) {
  const [url, setUrl] = useState(photo.preview);
  useEffect(() => {
    if (!photo.file) { setUrl(photo.preview); return; }
    const blob = URL.createObjectURL(photo.file); setUrl(blob);
    return () => URL.revokeObjectURL(blob);
  }, [photo]);
  // Local file previews cannot use the Next.js image optimizer.
  return <img src={url} alt="Selected product photo" />;
}
export function ProductEditor({ product }: { product?: Product }) {
  const initial = () => product ? productPhotos(product).map((path) => ({ path, preview: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/shop-images/${path}` })) : [];
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [primary, setPrimary] = useState(Math.max(0, photos.findIndex((photo) => photo.path === product?.image_path)));
  const [photoError, setPhotoError] = useState("");
  useEffect(() => { setPhotos(initial()); setPrimary(Math.max(0, product ? productPhotos(product).indexOf(product.image_path ?? "") : 0)); }, [product]); // Reset drafts after server revalidation.
  async function save(state: ActionState, form: FormData): Promise<ActionState> {
    try {
      if (!photos.length) throw new Error("Please add at least one photo.");
      const id = product?.id ?? crypto.randomUUID();
      const client = createClient();
      const paths: string[] = [];
      // Upload directly to Storage so three full-size photos never cross Vercel's request limit.
      for (const photo of photos) {
        if (!photo.file) { paths.push(photo.path!); continue; }
        const upload = new FormData(); upload.set("photo", photo.file);
        const image = (await imageFile(upload, "photo"))!;
        const path = `products/${id}/${crypto.randomUUID()}.${image.extension}`;
        const { error } = await client.storage.from("shop-images").upload(path, photo.file, { contentType: image.type, upsert: false });
        if (error) throw new Error("We couldn't upload your photo. Please try again.");
        paths.push(path);
      }
      form.set("product_id", id);
      form.set("image_paths", JSON.stringify(paths));
      form.set("image_path", paths[primary] ?? paths[0]);
      const result = await saveProduct(state, form);
      if (result.success && !product) { setPhotos([]); setPrimary(0); }
      return result;
    } catch (error) { return { error: error instanceof Error ? error.message : "We couldn't save the product. Please try again." }; }
  }
  return <ActionForm action={save} submitLabel={product ? "Save product" : "Create product"}>
    {product && <input type="hidden" name="id" value={product.id} />}
    <Field label="Product name"><input name="title" required maxLength={120} defaultValue={product?.title} placeholder="A lovely little name" /></Field>
    <Field label="Description"><textarea name="description" required maxLength={2000} defaultValue={product?.description} placeholder="Tell customers what makes it special" /></Field>
    <Field label="Price (PHP)"><input name="price" type="text" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" required defaultValue={product ? (product.price_centavos / 100).toFixed(2) : undefined} placeholder="0.00" /></Field>
    <div><p className="photo-label">Product photos</p><p className="field-hint">Add up to 3 photos. Choose the primary photo for the shop. JPG, PNG or WebP, up to 5 MB each.</p></div>
    <div className="photo-slots">{Array.from({ length: 3 }, (_, slot) => {
      const photo = photos[slot];
      return <div key={slot} className="photo-slot">{photo ? <PhotoPreview photo={photo} /> : <div className="photo-empty"><ImagePlus size={26} /><span>Photo {slot + 1}</span></div>}
        <label className="button button-small button-soft photo-pick">{photo ? "Replace photo" : "Add photo"}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`${photo ? "Replace" : "Add"} photo ${slot + 1}`} onChange={async (event) => {
          const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
          try { const form = new FormData(); form.set("photo", file); await imageFile(form, "photo"); setPhotoError(""); setPhotos((current) => { const next = [...current]; next[Math.min(slot, next.length)] = { file, preview: "" }; return next; }); }
          catch (error) { setPhotoError((error as Error).message); }
        }} /></label>
        {photo && <><button type="button" className={`button button-small ${primary === slot ? "button-soft" : "button-outline"}`} aria-pressed={primary === slot} onClick={() => setPrimary(slot)}>{primary === slot ? <><Check size={14} />Primary photo</> : "Make primary"}</button><button type="button" className="photo-remove" onClick={() => { setPhotos((current) => current.filter((_, index) => index !== slot)); setPrimary((current) => current === slot ? 0 : current > slot ? current - 1 : current); }}>Remove photo</button></>}
      </div>;
    })}</div>
    {photoError && <p role="alert" className="message error-message">{photoError}</p>}
    <label className="checkbox-field"><input name="out_of_stock" type="checkbox" defaultChecked={product?.out_of_stock} />Out of stock (visible, but can't be purchased)</label>
  </ActionForm>;
}

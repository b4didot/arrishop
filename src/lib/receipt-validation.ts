import sharp from "sharp";
import { imageFile } from "./validation.ts";

export async function receiptImageFile(form: FormData) {
  const image = await imageFile(form, "receipt");
  if (!image) throw new Error("Please choose a payment receipt image.");
  try {
    const decoder = sharp(image.bytes, { failOn: "warning", limitInputPixels: 50_000_000 });
    const metadata = await decoder.metadata();
    if (metadata.mediaType !== image.type || !metadata.width || !metadata.height) throw new Error("Invalid receipt image.");
    await decoder.stats(); // Read the pixels; a matching file header alone is not enough.
  } catch {
    throw new Error("This receipt image could not be opened. Please choose a valid JPG, PNG, or WebP image.");
  }
  return image;
}

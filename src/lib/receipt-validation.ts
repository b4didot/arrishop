import sharp from "sharp";
import { imageFile } from "./validation.ts";

export function receiptUploadPaths(value: unknown, userId: string, orderId: string, submissionId: string): string[] {
  let paths: unknown;
  try { paths = typeof value === "string" ? JSON.parse(value) : null; } catch { paths = null; }
  if (!Array.isArray(paths) || paths.length < 1 || paths.length > 2) throw new Error("Please upload one or two receipt photos.");
  const prefix = `${userId}/${orderId}/`;
  for (const [index, path] of paths.entries()) {
    if (typeof path !== "string" || !path.startsWith(prefix)) throw new Error("Invalid receipt photo. Please try again.");
    const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-([12])\.(jpg|png|webp)$/.exec(path.slice(prefix.length));
    if (!match || match[1] !== submissionId || match[2] !== String(index + 1)) throw new Error("Invalid receipt photo. Please try again.");
  }
  return paths;
}

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

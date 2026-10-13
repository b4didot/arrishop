export function text(form: FormData, key: string, label: string, max = 200, min = 1): string {
  const value = form.get(key);
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw new Error(`Please enter ${label}${min > 1 ? ` (at least ${min} characters)` : ""}, up to ${max} characters.`);
  }
  return value.trim();
}
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error("Please refresh the page and try again.");
  return value;
}
export function password(form: FormData, min = 8): string {
  const value = form.get("password");
  if (typeof value !== "string" || value.length < min || value.length > 128) throw new Error(`Enter a password between ${min} and 128 characters.`);
  return value;
}
export function centavos(value: unknown, max = 100_000_000): number {
  if (typeof value !== "string" || !/^\d{1,11}(\.\d{1,2})?$/.test(value.trim())) throw new Error("Enter a valid peso amount with up to two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > max) throw new Error("This amount exceeds the allowed limit.");
  return amount;
}
export function quantity(value: unknown, allowZero = false): number {
  if (typeof value !== "string" || !/^\d{1,2}$/.test(value)) throw new Error("Choose a quantity from 1 to 99.");
  const amount = Number(value);
  if (amount < (allowZero ? 0 : 1) || amount > 99) throw new Error("Choose a quantity from 1 to 99.");
  return amount;
}
export function safeNext(value: unknown, fallback = "/"): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/[\u0000-\u001f]/.test(value) ? value : fallback;
}
export async function imageFile(form: FormData, key: string, required = true) {
  const file = form.get(key);
  if (!(file instanceof File) || file.size === 0) {
    if (required) throw new Error("Please choose a JPG, PNG, or WebP image.");
    return null;
  }
  if (file.size > 5 * 1024 * 1024) throw new Error("Please choose an image smaller than 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  const webp = new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  const detected = jpeg ? "image/jpeg" : png ? "image/png" : webp ? "image/webp" : null;
  if (!detected || detected !== file.type) throw new Error("That file isn't a supported image. Please upload a JPG, PNG, or WebP.");
  return { file, bytes, type: detected, extension: jpeg ? "jpg" : png ? "png" : "webp" };
}

export function deliveryAddress(form: FormData) {
  const address = {
    street_address: text(form, "street_address", "your street address", 300),
    subdivision: text(form, "subdivision", "your subdivision, district, or landmark", 200, 0),
    barangay: text(form, "barangay", "your barangay", 100),
    city: text(form, "city", "your city or municipality", 100),
    province: text(form, "province", "your province or region", 100),
    zip_code: text(form, "zip_code", "your ZIP code", 4),
  };
  if (!/^[0-9]{4}$/.test(address.zip_code)) throw new Error("Enter a 4-digit ZIP code.");
  return { delivery_address_parts: address, delivery_address: [address.street_address, address.subdivision, address.barangay, address.city, address.province, address.zip_code].filter(Boolean).join(", ") };
}
export function completeAddress(address: { street_address?: string; barangay?: string; city?: string; province?: string; zip_code?: string } | undefined): boolean {
  return Boolean(address?.street_address?.trim() && address.barangay?.trim() && address.city?.trim() && address.province?.trim() && /^[0-9]{4}$/.test(address.zip_code ?? ""));
}

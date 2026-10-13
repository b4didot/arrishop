import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { receiptImageFile } from "../src/lib/receipt-validation.ts";

test("receipt submission requires a decodable supported image", async () => {
  await assert.rejects(receiptImageFile(new FormData()), /choose a JPG/);

  for (const [format, mime] of [["png", "image/png"], ["jpeg", "image/jpeg"], ["webp", "image/webp"]] as const) {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).toFormat(format).toBuffer();
    const form = new FormData();
    form.set("receipt", new File([bytes], `receipt.${format}`, { type: mime }));
    assert.equal((await receiptImageFile(form)).type, mime);
    form.set("receipt", new File([bytes.subarray(0, 12)], `broken.${format}`, { type: mime }));
    await assert.rejects(receiptImageFile(form));
  }

  const forged = new FormData();
  forged.set("receipt", new File(["not a photo"], "receipt.png", { type: "image/png" }));
  await assert.rejects(receiptImageFile(forged), /supported image/);
});

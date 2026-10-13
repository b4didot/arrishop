import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { receiptImageFile, receiptUploadPaths } from "../src/lib/receipt-validation.ts";

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

test("receipt path submission accepts only one or two photos from the same order", () => {
  const user = "11111111-1111-4111-8111-111111111111";
  const order = "22222222-2222-4222-8222-222222222222";
  const submission = "33333333-3333-4333-8333-333333333333";
  const first = `${user}/${order}/${submission}-1.png`;
  const second = `${user}/${order}/${submission}-2.jpg`;
  assert.deepEqual(receiptUploadPaths(JSON.stringify([first]), user, order, submission), [first]);
  assert.deepEqual(receiptUploadPaths(JSON.stringify([first, second]), user, order, submission), [first, second]);
  for (const paths of [[], [first, second, second], [second], [first, first], [first, `${user}/${order}/44444444-4444-4444-8444-444444444444-2.jpg`]]) {
    assert.throws(() => receiptUploadPaths(JSON.stringify(paths), user, order, submission));
  }
});

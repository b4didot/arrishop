import assert from "node:assert/strict";
import { test } from "node:test";
import { centavos, imageFile, password, quantity, safeNext, text, uuid } from "../src/lib/validation.ts";

test("money parsing preserves exact centavos and rejects tampered amounts", () => {
  assert.equal(centavos("19.99"), 1999);
  assert.equal(centavos("0.1"), 10);
  assert.equal(centavos("1000000.00"), 100000000);
  assert.equal(centavos("9999999999.99", 1_000_000_000_000), 999999999999);
  for (const invalid of ["-1", "1e3", "Infinity", "0.009", "NaN", "1000001", "", "2,000", "0x10"]) assert.throws(() => centavos(invalid));
});
test("quantity and identifiers reject invalid values", () => {
  assert.equal(quantity("99"), 99); assert.equal(quantity("0", true), 0);
  for (const invalid of ["-1", "100", "1.5", "0", "1e1", "abc"]) assert.throws(() => quantity(invalid));
  assert.throws(() => uuid("anything")); assert.equal(uuid("11111111-1111-4111-8111-111111111111"), "11111111-1111-4111-8111-111111111111");
});
test("auth return paths cannot redirect to another origin", () => {
  for (const path of ["https://evil.test", "//evil.test", "/\\evil.test", "/\nevil", null]) assert.equal(safeNext(path), "/");
  assert.equal(safeNext("/orders?view=recent"), "/orders?view=recent");
});
test("profile inputs trim text, enforce bounds, and permit empty notes", () => {
  const data = new FormData(); data.set("name", "  Arri  "); data.set("notes", "");
  assert.equal(text(data, "name", "a name", 120), "Arri");
  assert.equal(text(data, "notes", "notes", 5000, 0), "");
  assert.throws(() => text(data, "missing", "a name")); assert.throws(() => text(data, "name", "a name", 3));
});
test("password validation preserves significant spaces", () => {
  const data = new FormData(); data.set("password", "  valid password  ");
  assert.equal(password(data), "  valid password  ");
  data.set("password", "short"); assert.throws(() => password(data));
  data.set("password", "a".repeat(129)); assert.throws(() => password(data));
});
test("upload validation checks bytes as well as MIME labels", async () => {
  const data = new FormData();
  data.set("image", new File(["<script>bad()</script>"], "fake.png", { type: "image/png" }));
  await assert.rejects(imageFile(data, "image"), /supported image/);
  data.set("image", new File([new Uint8Array([137,80,78,71,13,10,26,10,0])], "real.png", { type: "image/png" }));
  assert.equal((await imageFile(data, "image"))?.extension, "png");
  data.set("image", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "huge.jpg", { type: "image/jpeg" }));
  await assert.rejects(imageFile(data, "image"), /5 MB/);
  assert.equal(await imageFile(new FormData(), "image", false), null);
});

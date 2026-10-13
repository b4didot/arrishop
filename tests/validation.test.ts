import assert from "node:assert/strict";
import { test } from "node:test";
import { centavos, deliveryAddress, imageFile, password, quantity, safeNext, text, uuid } from "../src/lib/validation.ts";

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

test("delivery fields are required, optional landmark is preserved, and ZIP keeps leading zeros", () => {
  const values = {street_address:" 12 Main Street ", subdivision:"", barangay:"San Jose", city:"Quezon City", province:"Metro Manila", zip_code:"0123"};
  const form = new FormData(); Object.entries(values).forEach(([key,value]) => form.set(key,value));
  const result = deliveryAddress(form);
  assert.equal(result.delivery_address_parts.zip_code, "0123");
  assert.equal(result.delivery_address, "12 Main Street, San Jose, Quezon City, Metro Manila, 0123");
  for (const field of ["street_address","barangay","city","province","zip_code"]) {
    form.set(field, ""); assert.throws(() => deliveryAddress(form)); form.set(field, values[field as keyof typeof values]);
  }
  for (const zip of ["123","12345","12a4","1e03"]) { form.set("zip_code",zip); assert.throws(() => deliveryAddress(form)); }
  form.set("zip_code","0123"); form.set("subdivision","Near the church");
  assert.equal(deliveryAddress(form).delivery_address_parts.subdivision,"Near the church");
});

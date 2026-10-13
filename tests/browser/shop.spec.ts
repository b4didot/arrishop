import { test, expect } from "@playwright/test";

test("storefront opens with products and keeps the cart visible while scrolling", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Meet your new favorites");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Shop", exact: true }).click();
  await expect(page).toHaveURL(/#shop$/);
  await expect(page.getByRole("heading", { name: /Meet your new favorites/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const cart = page.getByRole("link", { name: "Cart, 0 items", exact: true });
  await expect(cart).toBeVisible();
  await expect(cart).toHaveAttribute("href", "/cart");
  expect(await cart.evaluate((element) => getComputedStyle(element).position)).toBe("fixed");
  const before = await cart.boundingBox();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(cart).toBeVisible();
  const after = await cart.boundingBox();
  expect(after?.x).toBe(before?.x); expect(after?.y).toBe(before?.y);
  await page.screenshot({ path: `test-results/storefront-${info.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
  await cart.click();
  await expect(page).toHaveURL(/\/login\?next=%2Fcart/, { timeout: 15000 });
});
test("guests are redirected from customer and administrator routes", async ({ page }) => {
  for (const route of ["/cart", "/checkout", "/orders", "/account", "/admin", "/admin/products", "/admin/orders", "/admin/settings"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page.getByRole("heading", { name: "Welcome back!" })).toBeVisible();
  }
});
test("registration and recovery forms have visible labels and native validation", async ({ page }, info) => {
  await page.goto("/register");
  for (const label of ["Full name", "Social/Nickname", "Email address", "Password", "Phone number", "Street Address", "Subdivision / District / Landmark", "Barangay", "City / Municipality", "Province / Region", "ZIP Code"]) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  expect(await page.getByLabel("Social/Nickname", { exact: true }).evaluate((element: HTMLInputElement) => element.required)).toBe(true);
  await expect(page.getByLabel("Street Address", { exact: true })).toHaveAttribute("placeholder", "House No., Unit, Block/Lot, Street");
  expect(await page.getByLabel("Subdivision / District / Landmark", { exact: true }).evaluate((element: HTMLInputElement) => element.required)).toBe(false);
  for (const label of ["Street Address", "Barangay", "City / Municipality", "Province / Region", "ZIP Code"]) expect(await page.getByLabel(label, {exact:true}).evaluate((element: HTMLInputElement) => element.required)).toBe(true);
  const zip = page.getByLabel("ZIP Code", {exact:true});
  await zip.fill("12a4"); expect(await zip.evaluate((element: HTMLInputElement) => element.validity.patternMismatch)).toBe(true);
  await zip.fill("0123"); expect(await zip.evaluate((element: HTMLInputElement) => element.validity.valid)).toBe(true);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/register-${info.project.name}.png`, fullPage: true });
  await page.getByRole("link", { name: "Log in", exact: true }).last().click();
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page.getByRole("heading", { name: "Let's get you back in." })).toBeVisible();
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
});
test("invalid order paths and expired auth callbacks fail safely", async ({ page }) => {
  await page.goto("/orders/not-an-id");
  await expect(page.getByRole("heading", { name: "Nothing here just yet" })).toBeVisible();
  await page.goto("/auth/callback?next=https://example.com");
  await expect(page).toHaveURL(/\/login\?notice=expired-link/);
  await expect(page.getByText("That link has expired", { exact: false })).toBeVisible();
});

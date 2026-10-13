import { test, expect } from "@playwright/test";

test("slow navigation blocks page interactions and unlocks after arrival", async ({ page }, info) => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/register**", async (route) => { await waiting; await route.continue(); });
  try {
    await page.goto("/login");
    const shopBox = await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Shop", exact: true }).boundingBox();
    const navigation = page.getByRole("link", { name: "Create an account", exact: true }).click();
    const overlay = page.getByRole("dialog", { name: "Please wait" });
    await expect(overlay).toBeVisible();
    await expect(page.locator("[data-app-shell]")).toHaveAttribute("inert", "");
    await expect(overlay).toContainText("Please wait");
    await page.keyboard.press("Escape");
    await expect(overlay).toBeVisible();
    const url = page.url();
    await page.mouse.click(shopBox!.x + shopBox!.width / 2, shopBox!.y + shopBox!.height / 2);
    expect(page.url()).toBe(url);
    await page.screenshot({ path: `test-results/loading-${info.project.name}.png` });
    release();
    await navigation;
    await expect(page.getByRole("heading", { name: "Join our little shop." })).toBeVisible();
    await expect(overlay).not.toBeVisible();
    await expect(page.locator("[data-app-shell]")).not.toHaveAttribute("inert");
  } finally { release(); }
});

test("server-action loading blocks interaction and clears on validation error", async ({ page }) => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  await page.goto("/login");
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST") await waiting;
    await route.continue();
  });
  try {
    await page.getByLabel("Email address", { exact: true }).fill("loading-check@example.invalid");
    // Trigger server validation only: an empty password fails before any Supabase login request.
    await page.locator("main form").evaluate((form: HTMLFormElement) => { form.noValidate = true; form.requestSubmit(); });
    const overlay = page.getByRole("dialog", { name: "Please wait" });
    await expect(overlay).toBeVisible();
    await expect(page.locator("[data-app-shell]")).toHaveAttribute("inert", "");
    await expect(page.locator('main input[name="email"]')).toBeDisabled();
    release();
    await expect(page.locator("main").getByRole("alert")).toContainText("Enter a password", { timeout: 15000 });
    await expect(overlay).not.toBeVisible();
    await expect(page.getByLabel("Email address", { exact: true })).toBeEnabled();
    await expect(page.locator("[data-app-shell]")).not.toHaveAttribute("inert");
  } finally { release(); }
});

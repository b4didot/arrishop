import { test, expect } from "@playwright/test";

test("product photos open a mobile-safe modal and restore focus on close", async ({ page }, info) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /^View photos of / }).first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  const viewer = page.getByRole("dialog", { name: / photos$/ });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("img")).toBeVisible();
  const box = await viewer.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  const next = viewer.getByRole("button", { name: "Next photo" });
  if (await next.count()) {
    const before = await viewer.getByRole("img").getAttribute("alt");
    await next.click();
    await expect(viewer.getByRole("img")).not.toHaveAttribute("alt", before!);
    await viewer.getByRole("button", { name: "Previous photo" }).click();
    await expect(viewer.getByRole("img")).toHaveAttribute("alt", before!);
  }
  await page.screenshot({ path: `test-results/gallery-${info.project.name}.png` });
  await viewer.getByRole("button", { name: "Close photos" }).click();
  await expect(viewer).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(viewer).not.toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

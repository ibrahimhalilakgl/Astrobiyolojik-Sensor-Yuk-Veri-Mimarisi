import { expect, test } from "@playwright/test";

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

/**
 * Çok segmentli yollar → `App.jsx` içindeki `*` rotası ile `/` (landing).
 * Tam URL regex yerine pathname kullan (daha güvenilir).
 */
for (let i = 0; i < 50; i++) {
  test(`catch-all iki segment ${i}`, async ({ page }) => {
    await page.goto(`/z${i}depth2/y${i}`);
    await expect
      .poll(() => pathnameOf(page.url()), { timeout: 15_000 })
      .toBe("/");
    await expect(page.getByText("SENTİNEL", { exact: true })).toBeVisible();
  });
}

for (let i = 0; i < 50; i++) {
  test(`catch-all üç segment ${i}`, async ({ page }) => {
    await page.goto(`/z${i}d3/y${i}d3/x${i}d3`);
    await expect
      .poll(() => pathnameOf(page.url()), { timeout: 15_000 })
      .toBe("/");
    await expect(page.getByText("SENTİNEL", { exact: true })).toBeVisible();
  });
}

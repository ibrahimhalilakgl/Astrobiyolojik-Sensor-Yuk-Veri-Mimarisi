import { expect, test } from "@playwright/test";
import { SentinelDashboardPage } from "../page-objects/sentinel-dashboard.page";

test.describe("Yönlendirme", () => {
  test("bilinmeyen sayfa parametresi gösterge paneline düşer", async ({
    page,
  }) => {
    await page.goto("/tamamen_gecersiz_rota_xyz");
    await expect(page).toHaveURL(/\/gosterge_paneli/);
  });

  test("dashboard üstünden ana sayfaya dönüş (logo link, Page Object)", async ({
    page,
  }) => {
    const dash = new SentinelDashboardPage(page);
    await dash.goto("/telemetri");
    await dash.logoLink.click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 10_000 })
      .toBe("/");
    await expect(page).not.toHaveURL(/telemetri/);
  });

  test("catch-all * → ana sayfa", async ({ page }) => {
    await page.goto("/bu/yol/yok");
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe("/");
    await expect(page.getByText("SENTİNEL", { exact: true })).toBeVisible();
  });
});

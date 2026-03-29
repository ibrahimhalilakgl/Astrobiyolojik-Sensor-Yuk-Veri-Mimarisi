import { expect, test } from "@playwright/test";
import { DASHBOARD_ROUTES } from "./constants";

/**
 * Her gösterge sayfasından her diğer sekmeye yan menü ile geçiş — 12×11 = 132 test.
 */
for (const from of DASHBOARD_ROUTES) {
  for (const to of DASHBOARD_ROUTES) {
    if (from.path === to.path) continue;

    test(`${from.path} → ${to.path} (yan menü)`, async ({ page }) => {
      await page.goto(`/${from.path}`);
      await page.getByRole("button", { name: to.label }).click();
      await expect(page).toHaveURL(new RegExp(`/${to.path}$`));
      await expect(page.locator("main").getByText(to.label).first()).toBeVisible();
    });
  }
}

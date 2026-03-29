import { expect, test } from "@playwright/test";
import { DASHBOARD_ROUTES } from "./constants";

test.describe("Dashboard doğrudan URL", () => {
  for (const { path, label } of DASHBOARD_ROUTES) {
    test(`/${path} — başlık: ${label}`, async ({ page }) => {
      await page.goto(`/${path}`);
      await expect(page).toHaveURL(new RegExp(`/${path}$`));
      await expect(page.locator("main").getByText(label).first()).toBeVisible();
    });
  }
});

test.describe("Yan menü tıklama", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gosterge_paneli");
  });

  for (const { path, label } of DASHBOARD_ROUTES) {
    test(`buton → /${path}`, async ({ page }) => {
      await page.getByRole("button", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`/${path}$`));
      await expect(page.locator("main").getByText(label).first()).toBeVisible();
    });
  }
});

import { expect, test } from "@playwright/test";
import { SentinelDashboardPage } from "../page-objects/sentinel-dashboard.page";
import { SentinelLandingPage } from "../page-objects/sentinel-landing.page";

test("smoke: / yüklenir", async ({ page }) => {
  const landing = new SentinelLandingPage(page);
  await landing.open();
});

test("smoke: gösterge paneli kabuğu (BasePage → SentinelDashboardPage)", async ({
  page,
}) => {
  const dash = new SentinelDashboardPage(page);
  await dash.goto("/gosterge_paneli");
  await expect(page.getByText("GÖSTERGE_PANELİ").first()).toBeVisible();
  await dash.expectShellVisible();
});

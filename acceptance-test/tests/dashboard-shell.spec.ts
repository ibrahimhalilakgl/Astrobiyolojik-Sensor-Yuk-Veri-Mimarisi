import { expect, test } from "@playwright/test";
import { SentinelDashboardPage } from "../page-objects/sentinel-dashboard.page";

test.describe("Dashboard kabuk (Page Object)", () => {
  let dash: SentinelDashboardPage;

  test.beforeEach(async ({ page }) => {
    dash = new SentinelDashboardPage(page);
    await dash.goto("/gosterge_paneli");
  });

  test("üst çubuk ve WebSocket durumu alanı", async () => {
    await expect(dash.page.getByText(/v1\.0\.4/)).toBeVisible();
    await expect(dash.logoLink).toBeVisible();
  });

  test("yan panel birim etiketi", async () => {
    await expect(dash.page.getByText("ASTROBİYOLOJİ_BİRİMİ")).toBeVisible();
    await expect(dash.page.getByText(/GALE KRATERİ/)).toBeVisible();
  });

  test("ROVER_KONUM bloğu", async () => {
    await dash.expectRoverSidebar();
  });

  test("üst metrik şeridi ANOMALİ / TASARRUF / PAKET", async () => {
    await dash.expectHeaderMetrics();
  });

  test("alt footer VERİ_AKIŞI ve SİNYAL", async () => {
    await dash.expectFooterStrip();
  });

  test("GERÇEK ZAMANLI ANALİZ şeridi", async () => {
    await expect(dash.page.getByText(/GERÇEK ZAMANLI ANALİZ/)).toBeVisible();
  });
});

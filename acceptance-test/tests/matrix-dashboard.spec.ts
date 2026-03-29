import { expect, test } from "@playwright/test";
import { DASHBOARD_ROUTES } from "./constants";

/**
 * Her gösterge rotası için tekrarlayan sağlamlık kontrolleri (12 × 17 = 204 test).
 */
for (const { path, label } of DASHBOARD_ROUTES) {
  test.describe(`Matris /${path}`, () => {
    const url = `/${path}`;

    test("GET yanıtı başarılı", async ({ page }) => {
      const res = await page.goto(url);
      expect(res?.ok(), `Yanıt: ${res?.status()}`).toBeTruthy();
    });

    test("#root görünür", async ({ page }) => {
      await page.goto(url);
      await expect(page.locator("#root")).toBeVisible();
    });

    test("html lang=tr", async ({ page }) => {
      await page.goto(url);
      await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    });

    test("document.title SENTİNEL içerir", async ({ page }) => {
      await page.goto(url);
      await expect(page).toHaveTitle(/SENTİNEL/i);
    });

    test("main landmark görünür", async ({ page }) => {
      await page.goto(url);
      await expect(page.locator("main")).toBeVisible();
    });

    test("üst marka SENTİNEL_OS", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText("SENTİNEL_OS")).toBeVisible();
    });

    test("sürüm v1.0.4 gösterimi", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText(/v1\.0\.4/)).toBeVisible();
    });

    test("yan panel ASTROBİYOLOJİ_BİRİMİ", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText("ASTROBİYOLOJİ_BİRİMİ")).toBeVisible();
    });

    test("sekme başlığı ana içerikte", async ({ page }) => {
      await page.goto(url);
      await expect(page.locator("main").getByText(label).first()).toBeVisible();
    });

    test("GERÇEK ZAMANLI ANALİZ şeridi", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText(/GERÇEK ZAMANLI ANALİZ/)).toBeVisible();
    });

    test("üst ANOMALİ metrik etiketi", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText("ANOMALİ", { exact: true })).toBeVisible();
    });

    test("üst TASARRUF metrik etiketi", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText("TASARRUF", { exact: true })).toBeVisible();
    });

    test("üst PAKET metrik etiketi", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText("PAKET", { exact: true })).toBeVisible();
    });

    test("footer VERİ_AKIŞI satırı", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText(/VERİ_AKIŞI:/)).toBeVisible();
    });

    test("footer SİNYAL satırı", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText(/SİNYAL:/)).toBeVisible();
    });

    test("ROVER_KONUM yan panel", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText("ROVER_KONUM")).toBeVisible();
    });

    test("URL son segmenti eşleşir", async ({ page }) => {
      await page.goto(url);
      await expect(page).toHaveURL(new RegExp(`/${path}$`));
    });
  });
}

import { expect, test } from "@playwright/test";
import { DASHBOARD_ROUTES } from "./constants";

/**
 * Kabuk / footer / yan panel ek kontrolleri — 12 × 15 = 180 test (~500 toplam hedefine katkı).
 */
for (const { path, label } of DASHBOARD_ROUTES) {
  test.describe(`Kabuk+ /${path}`, () => {
    const url = `/${path}`;

    test("yan aside görünür", async ({ page }) => {
      await page.goto(url);
      await expect(page.locator("aside")).toBeVisible();
    });

    test("yan nav tam 12 düğme", async ({ page }) => {
      await page.goto(url);
      await expect(page.locator("aside nav button")).toHaveCount(12);
    });

    test("footer AZIMUT etiketi", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText("AZIMUT:", { exact: false })).toBeVisible();
    });

    test("footer KRİTİK etiketi", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText(/KRİTİK:/)).toBeVisible();
    });

    test("footer TAMPON etiketi", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText(/TAMPON:/)).toBeVisible();
    });

    test("footer IŞIK_GECİKMESİ etiketi", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText(/IŞIK_GECİKMESİ/)).toBeVisible();
    });

    test("logo linki ana sayfaya", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByRole("link", { name: /SENTİNEL_OS/i })).toBeVisible();
    });

    test("ana içerik kaydırma alanı", async ({ page }) => {
      await page.goto(url);
      await expect(
        page.locator("main > div.flex-1.overflow-y-auto.p-5"),
      ).toBeVisible();
    });

    test("üst şerit MARS-2026", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText(/MARS-2026/)).toBeVisible();
    });

    test("ışık gecikmesi açıklama metni", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText(/MARS→DÜNYA IŞIK GECİKMESİ/)).toBeVisible();
    });

    test("sektör Gale krateri", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText(/GALE KRATERİ/)).toBeVisible();
    });

    test("yan panel ENL etiketi", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText("ENL:", { exact: false })).toBeVisible();
    });

    test("yan panel BOY etiketi", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText("BOY:", { exact: false })).toBeVisible();
    });

    test("yan panel SOL etiketi", async ({ page }) => {
      await page.goto(url);
      await expect(page.getByText("SOL:", { exact: false })).toBeVisible();
    });

    test("aktif sekme etiketi üst barda yine görünür", async ({ page }) => {
      await page.goto(url);
      await expect(
        page.locator("main").locator("> div").first().getByText(label),
      ).toBeVisible();
    });
  });
}

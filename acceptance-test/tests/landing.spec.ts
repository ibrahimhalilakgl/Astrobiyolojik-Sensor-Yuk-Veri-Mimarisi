import { expect, test } from "@playwright/test";
import { SentinelDashboardPage } from "../page-objects/sentinel-dashboard.page";
import { SentinelLandingPage } from "../page-objects/sentinel-landing.page";

test.describe("Landing /", () => {
  test("sayfa yüklenir ve 200 benzeri içerik döner", async ({ page }) => {
    const landing = new SentinelLandingPage(page);
    await landing.open();
  });

  test("kahraman başlık ve alt satır görünür", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("gecikmeli bağlantıda güvenle iletim"),
    ).toBeVisible();
    await expect(
      page.getByText("Astrobiyolojik sensör · uç işlem · yer istasyonu"),
    ).toBeVisible();
  });

  test("marka SENTİNEL metni var (Landing Page Object)", async ({ page }) => {
    const landing = new SentinelLandingPage(page);
    await landing.open();
    await landing.expectBrandVisible();
  });

  test("Panele gir gösterge paneline gider (BasePage → PO)", async ({
    page,
  }) => {
    const landing = new SentinelLandingPage(page);
    await landing.open();
    await landing.goToDashboardViaCta();
    const dash = new SentinelDashboardPage(page);
    await expect(dash.logoLink).toBeVisible();
  });

  test("Canlı panele geç gösterge paneline gider", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Canlı panele geç" }).click();
    await expect(page).toHaveURL(/\/gosterge_paneli$/);
  });

  test("Veri akışı linki veri_akisi rotasına gider", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Ana gezinme" }).getByRole("link", { name: "Veri akışı" }).click();
    await expect(page).toHaveURL(/\/veri_akisi$/);
    await expect(page.locator("main").getByText("VERİ_AKIŞI").first()).toBeVisible();
  });

  test("footer prototip notu", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText(/eğitim ve simülasyon prototipi/i),
    ).toBeVisible();
  });

  test("NASA 3D Resources harici linki", async ({ page }) => {
    await page.goto("/");
    const nasa = page.getByRole("link", { name: "NASA 3D Resources" });
    await expect(nasa).toHaveAttribute("href", /science\.nasa\.gov/);
    await expect(nasa).toHaveAttribute("target", "_blank");
  });

  test("Operasyon paneline geç footer CTA", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Operasyon paneline geç" }).click();
    await expect(page).toHaveURL(/\/gosterge_paneli$/);
  });

  test("Hikâyeyi kaydır #mars-story hedefine gider", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Hikâyeyi kaydır" }).click();
    await expect(page).toHaveURL(/#mars-story$/);
  });
});

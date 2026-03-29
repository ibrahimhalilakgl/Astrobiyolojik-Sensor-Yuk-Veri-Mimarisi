import { expect, test } from "@playwright/test";

/** `LandingPage.jsx` MARQUEE_SEGMENTS ile uyumlu */
const MARQUEE_SEGMENTS = [
  "EDGE İŞLEM",
  "MSL 12 KANAL",
  "SSR TAMPON",
  "LSTM + Z-SCORE",
  "UPLINK KUYRUĞU",
  "DELTA + DEFLATE",
  "DSN MODELİ",
  "WEBSOCKET",
  "POSTGRES",
  "VERİ_AKIŞI",
] as const;

test.describe("Matris landing /", () => {
  test("GET yanıtı başarılı", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.ok()).toBeTruthy();
  });

  test("#root görünür", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();
  });

  test("html lang=tr", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  });

  test("document.title SENTİNEL", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/SENTİNEL/i);
  });

  test("kahraman alt satırı", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("gecikmeli bağlantıda güvenle iletim"),
    ).toBeVisible();
  });

  test("üst mono açıklama satırı", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("Astrobiyolojik sensör · uç işlem · yer istasyonu"),
    ).toBeVisible();
  });

  test("hero gövde paragrafı", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText(/gösterge panelindeki sekiz adımı/i),
    ).toBeVisible();
  });

  test("nav aria-label Ana gezinme", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("navigation", { name: "Ana gezinme" }),
    ).toBeVisible();
  });

  test("Operasyon özeti markası", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Operasyon özeti")).toBeVisible();
  });

  test("Perseverance 3B atfı", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Perseverance 3B/i)).toBeVisible();
  });

  for (const seg of MARQUEE_SEGMENTS) {
    test(`marquee / bant metni: ${seg}`, async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText(seg, { exact: true }).first()).toBeVisible();
    });
  }

  test("SENTİNEL veri hattı alıntısı — cite", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("SENTİNEL veri hattı özeti"),
    ).toBeVisible();
  });

  test("footer eğitim prototipi notu", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText(/Canlı Mars bağlantısı içermez/),
    ).toBeVisible();
  });
});

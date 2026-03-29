import { expect, test } from "@playwright/test";

/**
 * Her sekmede `main` içinde görünen ayırt edici metin (üst başlık veya gövde).
 */
const PANEL_SNIPPETS: { path: string; snippet: RegExp | string }[] = [
  { path: "gosterge_paneli", snippet: /HAM_VERİ_AKIŞI/ },
  { path: "veri_akisi", snippet: /CANLI PAKET AKIŞI|ADIM \d{2}/ },
  { path: "anomali_tespit", snippet: /KRİTİK/ },
  { path: "sensor_detay", snippet: "SENSÖR_DETAY" },
  { path: "telemetri", snippet: "TELEMETRİ_PANOSU" },
  { path: "rover_harita", snippet: "ROVER HARİTASI" },
  { path: "iletim_analizi", snippet: "İLETİM_ANALİZİ" },
  { path: "uplink_kuyrugu", snippet: /UPLINK_KUYRUĞU|UPLINK_KUYRUĞU_YÜKLENİYOR/ },
  { path: "veri_seti", snippet: "VERİ_SETİ_BİLGİSİ" },
  { path: "orbiter_role", snippet: /Yörünge Aktarım Katmanı|ORBITER · UÇ2 RÖLESİ/ },
  { path: "yer_istasyonu_bulut", snippet: "YER İSTASYONU · FEDERATİF BULUT" },
  { path: "rover_zekasi", snippet: "SENTİNEL Düşünce Modu" },
];

test.describe("Panel gövde / başlık metinleri", () => {
  for (const { path, snippet } of PANEL_SNIPPETS) {
    test(`/${path}`, async ({ page }) => {
      await page.goto(`/${path}`);
      const main = page.locator("main");
      await expect(main).toContainText(snippet);
    });
  }
});

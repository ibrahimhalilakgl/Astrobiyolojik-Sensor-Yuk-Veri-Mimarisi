import { expect, test } from "@playwright/test";

/**
 * `/:sayfa` ile eşleşen ama NAV’da olmayan tek segmentler → gösterge paneline yönlendirme.
 * 200 farklı ad.
 */
for (let i = 0; i < 200; i++) {
  const seg = `_junk_seg_${i}_x`;

  test(`geçersiz tek segment yönlendirir: ${seg}`, async ({ page }) => {
    await page.goto(`/${seg}`);
    await expect(page).toHaveURL(/\/gosterge_paneli/);
  });
}

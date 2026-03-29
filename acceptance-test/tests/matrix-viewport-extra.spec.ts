import { expect, test } from "@playwright/test";
import { DASHBOARD_ROUTES } from "./constants";

const EXTRA_VIEWPORTS = [
  { name: "xs-telefon", width: 320, height: 568 },
  { name: "iphone-14", width: 390, height: 844 },
  { name: "ipad-mini", width: 768, height: 1024 },
  { name: "fhd", width: 1920, height: 1080 },
  { name: "wqhd", width: 2560, height: 1440 },
] as const;

const LANDING_PATHS = ["/", ...DASHBOARD_ROUTES.map((r) => `/${r.path}`)] as const;

/** 5 × 13 = 65 ek viewport kombinasyonu */
for (const vp of EXTRA_VIEWPORTS) {
  test.describe(`Ek viewport ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const p of LANDING_PATHS) {
      test(`yüklenir ${p}`, async ({ page }) => {
        const res = await page.goto(p);
        expect(res?.ok()).toBeTruthy();
        await expect(page.locator("#root")).toBeVisible();
        if (p === "/") {
          await expect(page.getByText("SENTİNEL", { exact: true })).toBeVisible();
        } else {
          await expect(page.getByText("SENTİNEL_OS")).toBeVisible();
        }
      });
    }
  });
}

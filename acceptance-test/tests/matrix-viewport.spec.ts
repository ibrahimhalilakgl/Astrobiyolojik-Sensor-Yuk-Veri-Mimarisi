import { expect, test } from "@playwright/test";
import { DASHBOARD_ROUTES } from "./constants";

const VIEWPORTS = [
  { name: "mobil", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "geniş", width: 1440, height: 900 },
] as const;

const LANDING_PATHS = ["/", ...DASHBOARD_ROUTES.map((r) => `/${r.path}`)] as const;

/**
 * 4 × 13 = 52 test — küçük ekranda da kabuk ayakta.
 */
for (const vp of VIEWPORTS) {
  test.describe(`Viewport ${vp.name} ${vp.width}×${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const p of LANDING_PATHS) {
      test(`yüklenir: ${p}`, async ({ page }) => {
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

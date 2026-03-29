import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base-page";

/** Ana sayfa (`LandingPage.jsx`) */
export class SentinelLandingPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open(): Promise<void> {
    const res = await this.page.goto("/");
    expect(res?.ok()).toBeTruthy();
  }

  get paneleGir(): Locator {
    return this.page.getByRole("link", { name: "Panele gir" });
  }

  get mainNav(): Locator {
    return this.page.getByRole("navigation", { name: "Ana gezinme" });
  }

  async goToDashboardViaCta(): Promise<void> {
    await this.paneleGir.click();
    await expect(this.page).toHaveURL(/\/gosterge_paneli$/);
  }

  async expectBrandVisible(): Promise<void> {
    await expect(this.page.getByText("SENTİNEL", { exact: true })).toBeVisible();
  }
}

import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base-page";

/**
 * SENTİNEL_OS gösterge kabuğu (`Dashboard.jsx`) — UI testleri buradan sürsün.
 */
export class SentinelDashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path.startsWith("/") ? path : `/${path}`);
  }

  get main(): Locator {
    return this.page.locator("main");
  }

  get aside(): Locator {
    return this.page.locator("aside");
  }

  get logoLink(): Locator {
    return this.page.getByRole("link", { name: /SENTİNEL_OS/i });
  }

  get navButtons(): Locator {
    return this.aside.locator("nav button");
  }

  get scrollableContent(): Locator {
    return this.page.locator("main > div.flex-1.overflow-y-auto.p-5");
  }

  navButton(label: string): Locator {
    return this.page.getByRole("button", { name: label });
  }

  async expectHttpOk(path: string): Promise<void> {
    const res = await this.page.goto(path.startsWith("/") ? path : `/${path}`);
    expect(res?.ok(), `HTTP ${res?.status()}`).toBeTruthy();
  }

  async expectShellVisible(): Promise<void> {
    await expect(this.logoLink).toBeVisible();
    await expect(this.page.getByText("ASTROBİYOLOJİ_BİRİMİ")).toBeVisible();
    await expect(this.scrollableContent).toBeVisible();
  }

  async expectHeaderMetrics(): Promise<void> {
    await expect(this.page.getByText("ANOMALİ", { exact: true })).toBeVisible();
    await expect(this.page.getByText("TASARRUF", { exact: true })).toBeVisible();
    await expect(this.page.getByText("PAKET", { exact: true })).toBeVisible();
  }

  async expectFooterStrip(): Promise<void> {
    await expect(this.page.getByText(/VERİ_AKIŞI:/)).toBeVisible();
    await expect(this.page.getByText(/SİNYAL:/)).toBeVisible();
  }

  async expectRoverSidebar(): Promise<void> {
    await expect(this.page.getByText("ROVER_KONUM")).toBeVisible();
    await expect(this.page.getByText("ENL:", { exact: false })).toBeVisible();
    await expect(this.page.getByText("BOY:", { exact: false })).toBeVisible();
    await expect(this.page.getByText("SOL:", { exact: false })).toBeVisible();
  }
}

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser, Page } from "puppeteer";
import { launchBrowserWithExtension } from "./helpers/extension.js";
import { openPopup } from "./helpers/popup.js";
import { startFixtureServer } from "./helpers/fixtures.js";
import type { Server } from "http";

describe("CSS variable scanning", () => {
  let browser: Browser;
  let extensionId: string;
  let popup: Page;
  let contentPage: Page;
  let server: Server;
  let port: number;

  beforeAll(async () => {
    ({ server, port } = await startFixtureServer());
    ({ browser, extensionId } = await launchBrowserWithExtension());

    // Navigate a tab to the fixture test page
    contentPage = await browser.newPage();
    await contentPage.goto(`http://localhost:${port}/test-page.html`, {
      waitUntil: "domcontentloaded",
    });

    // Open popup
    popup = await openPopup(browser, extensionId);
    await popup.waitForSelector("#scan-btn", { timeout: 5000 });

    // Make content page the active tab so getActiveTab() finds it
    await contentPage.bringToFront();

    // Use DOM click since popup tab is in background
    await popup.evaluate(() => {
      (document.getElementById("scan-btn") as HTMLButtonElement).click();
    });

    // Wait for scan to complete — poll storage since the popup tab may be
    // throttled in the background and waitForFunction won't poll reliably
    await waitForStoredVars(popup, 15_000);
  });

  afterAll(async () => {
    await browser?.close();
    server?.close();
  });

  it("scans :root CSS variables from a real page", async () => {
    const vars = await getStoredVars(popup);
    expect(vars["--color-brand"]).toBeDefined();
    expect(vars["--color-bg"]).toBeDefined();
    expect(vars["--color-text"]).toBeDefined();
  });

  it("finds variables inside @layer blocks", async () => {
    const vars = await getStoredVars(popup);
    expect(vars["--color-accent"]).toBeDefined();
    expect(vars["--color-muted"]).toBeDefined();
  });

  it("picks up inline-style CSS custom properties", async () => {
    const vars = await getStoredVars(popup);
    expect(vars["--color-inline"]).toBeDefined();
  });

  it("collects non-color variables too", async () => {
    const vars = await getStoredVars(popup);
    // Scanner collects all custom properties; filtering happens at display time
    expect(vars["--spacing-sm"]).toBeDefined();
    expect(vars["--font-body"]).toBeDefined();
  });

  it("resolves computed values rather than returning var() references", async () => {
    const vars = await getStoredVars(popup);
    for (const value of Object.values(vars)) {
      expect(value).not.toMatch(/^var\(/);
    }
  });

  it("updates the popup variables summary after scanning", async () => {
    // Bring popup to front so DOM is up to date
    await popup.bringToFront();
    // Allow the storage change listener to fire and re-render
    await new Promise((r) => setTimeout(r, 500));
    const summaryText = await popup.$eval("#vars-summary", (el) => el.textContent);
    expect(summaryText).toMatch(/Color Variables/);
    expect(summaryText).toMatch(/\d+/);
  });
});

async function getStoredVars(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    return new Promise<Record<string, string>>((resolve) => {
      chrome.storage.local.get("colorVariables", (data) => {
        resolve((data as { colorVariables?: Record<string, string> }).colorVariables ?? {});
      });
    });
  });
}

async function waitForStoredVars(page: Page, timeout: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const vars = await getStoredVars(page);
    if (Object.keys(vars).length > 0) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for stored variables after ${timeout}ms`);
}

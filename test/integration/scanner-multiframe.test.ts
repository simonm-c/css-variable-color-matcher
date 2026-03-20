import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser, Page } from "puppeteer";
import { launchBrowserWithExtension } from "./helpers/extension.js";
import { openPopup } from "./helpers/popup.js";
import { startFixtureServer } from "./helpers/fixtures.js";
import type { Server } from "http";

describe("multi-frame scanning", () => {
  let browser: Browser;
  let extensionId: string;
  let popup: Page;
  let contentPage: Page;
  let server: Server;
  let port: number;

  beforeAll(async () => {
    ({ server, port } = await startFixtureServer());
    ({ browser, extensionId } = await launchBrowserWithExtension());

    // Navigate a tab to the iframe test page
    contentPage = await browser.newPage();
    await contentPage.goto(`http://localhost:${port}/test-page-iframe.html`, {
      waitUntil: "networkidle0",
    });

    // Open popup and scan
    popup = await openPopup(browser, extensionId);
    await popup.waitForSelector("#scan-btn", { timeout: 5000 });

    // Make content page active so getActiveTab() finds it
    await contentPage.bringToFront();

    // Use DOM click since popup tab is in background
    await popup.evaluate(() => {
      (document.getElementById("scan-btn") as HTMLButtonElement).click();
    });

    // Poll storage until scan results appear
    await waitForStoredVars(popup, 15_000);
  });

  afterAll(async () => {
    await browser?.close();
    server?.close();
  });

  it("collects CSS variables from the parent frame", async () => {
    const vars = await getStoredVars(popup);
    expect(vars["--color-parent"]).toBeDefined();
  });

  it("collects CSS variables from child iframes", async () => {
    const vars = await getStoredVars(popup);
    expect(vars["--color-iframe-bg"]).toBeDefined();
    expect(vars["--color-iframe-text"]).toBeDefined();
  });

  it("merges variables from all frames", async () => {
    const vars = await getStoredVars(popup);
    const keys = Object.keys(vars);
    expect(keys.length).toBeGreaterThanOrEqual(3);
    expect(keys).toContain("--color-parent");
    expect(keys).toContain("--color-iframe-bg");
    expect(keys).toContain("--color-iframe-text");
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

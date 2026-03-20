import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser, Page } from "puppeteer";
import { launchBrowserWithExtension } from "./helpers/extension.js";
import { openPopup } from "./helpers/popup.js";
import { startFixtureServer } from "./helpers/fixtures.js";
import type { Server } from "http";

describe("storage persistence", () => {
  let browser: Browser;
  let extensionId: string;
  let server: Server;
  let port: number;

  beforeAll(async () => {
    ({ server, port } = await startFixtureServer());
    ({ browser, extensionId } = await launchBrowserWithExtension());

    // Navigate a tab to the fixture page and scan
    const contentPage = await browser.newPage();
    await contentPage.goto(`http://localhost:${port}/test-page.html`, {
      waitUntil: "domcontentloaded",
    });

    const popup = await openPopup(browser, extensionId);
    await popup.waitForSelector("#scan-btn", { timeout: 5000 });

    // Make content page active so getActiveTab() finds it
    await contentPage.bringToFront();

    // Use DOM click since popup tab is in background
    await popup.evaluate(() => {
      (document.getElementById("scan-btn") as HTMLButtonElement).click();
    });

    // Poll storage until scan results appear
    await waitForStoredVars(popup, 15_000);
    await popup.close();
  });

  afterAll(async () => {
    await browser?.close();
    server?.close();
  });

  it("retains scanned variables after closing and reopening popup", async () => {
    const popup = await openPopup(browser, extensionId);

    // Wait for storage to load — the summary shows a count when variables exist
    await popup.bringToFront();
    await popup.waitForFunction(
      () => {
        const summary = document.getElementById("vars-summary")?.textContent ?? "";
        return /\(\d+\)/.test(summary) && !summary.includes("(0)");
      },
      { timeout: 10_000 },
    );

    const vars = await getStoredVars(popup);
    expect(Object.keys(vars).length).toBeGreaterThan(0);
    expect(vars["--color-brand"]).toBeDefined();
    await popup.close();
  });

  it("persists saved lists across popup close/reopen cycles", async () => {
    // Open popup and save a list
    let popup = await openPopup(browser, extensionId);
    await popup.bringToFront();
    await popup.waitForSelector("#list-name", { timeout: 5000 });

    // Wait for variables to load first (save requires variables)
    await popup.waitForFunction(
      () => {
        const summary = document.getElementById("vars-summary")?.textContent ?? "";
        return /\(\d+\)/.test(summary) && !summary.includes("(0)");
      },
      { timeout: 10_000 },
    );

    await popup.type("#list-name", "My Test List");
    await popup.click("#save-btn");

    // Wait for the saved list to appear in the DOM
    await popup.waitForFunction(
      () => {
        const el = document.getElementById("saved-lists");
        return el && el.textContent?.includes("My Test List");
      },
      { timeout: 5000 },
    );
    await popup.close();

    // Reopen and verify the saved list persists
    popup = await openPopup(browser, extensionId);
    await popup.bringToFront();
    await popup.waitForFunction(
      () => {
        const el = document.getElementById("saved-lists");
        return el && el.textContent?.includes("My Test List");
      },
      { timeout: 10_000 },
    );

    const savedListsText = await popup.$eval("#saved-lists", (el) => el.textContent);
    expect(savedListsText).toContain("My Test List");
    await popup.close();
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

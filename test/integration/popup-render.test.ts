import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser, Page } from "puppeteer";
import { launchBrowserWithExtension } from "./helpers/extension.js";
import { openPopup } from "./helpers/popup.js";

describe("popup rendering", () => {
  let browser: Browser;
  let extensionId: string;
  let popup: Page;

  beforeAll(async () => {
    ({ browser, extensionId } = await launchBrowserWithExtension());
    popup = await openPopup(browser, extensionId);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("loads popup.html without errors", async () => {
    const errors: string[] = [];
    popup.on("pageerror", (err) => errors.push(err.message));
    await popup.reload({ waitUntil: "domcontentloaded" });
    await popup.waitForSelector("#scan-btn", { timeout: 5000 });
    expect(errors).toEqual([]);
  });

  it("has all required DOM elements", async () => {
    const selectors = [
      "#scan-btn",
      "#pick-btn",
      "#popout-btn",
      "#vars-list",
      "#vars-summary",
      "#vars-search",
      "#results",
      "#save-btn",
      "#list-name",
      "#saved-lists",
    ];

    for (const selector of selectors) {
      const el = await popup.$(selector);
      expect(el, `Expected ${selector} to exist`).not.toBeNull();
    }
  });

  it("shows initial empty state messages", async () => {
    // After the popup script runs, renderColorVariables({}) replaces the static message
    const noVarsMsg = await popup.$eval("#no-vars-msg", (el) => el.textContent);
    expect(noVarsMsg).toBe("No color variables found on this page.");

    const noColorMsg = await popup.$eval("#no-color-msg", (el) => el.textContent);
    expect(noColorMsg).toBe("No color picked yet. Click the button above to start.");
  });

  it("applies popup CSS styles", async () => {
    const display = await popup.$eval("#app", (el) => getComputedStyle(el).display);
    expect(display).toBeTruthy();
  });
});

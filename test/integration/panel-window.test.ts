import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "puppeteer";
import { launchBrowserWithExtension } from "./helpers/extension.js";
import { openPopup } from "./helpers/popup.js";

describe("panel window management", () => {
  let browser: Browser;
  let extensionId: string;

  beforeAll(async () => {
    ({ browser, extensionId } = await launchBrowserWithExtension());
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("opens a standalone panel window from popout button", async () => {
    const popup = await openPopup(browser, extensionId);
    await popup.waitForSelector("#popout-btn", { timeout: 5000 });

    // Listen for a new popup.html target before clicking
    const newTargetPromise = browser.waitForTarget(
      (t) => {
        return (
          t.type() === "page" &&
          t.url().includes("popup.html") &&
          t.url().includes(extensionId)
        );
      },
      { timeout: 15_000 },
    );

    await popup.click("#popout-btn");

    const panelTarget = await newTargetPromise;
    expect(panelTarget).toBeDefined();
    expect(panelTarget.url()).toContain("popup.html");
  });

  it("re-focuses existing panel window on second popout click", async () => {
    // The panel window from the previous test should still exist
    const popupPagesBefore = (await browser.pages()).filter(
      (p) => p.url().includes("popup.html") && p.url().includes(extensionId),
    );

    // Open a fresh popup to click popout again
    const popup2 = await openPopup(browser, extensionId);
    await popup2.waitForSelector("#popout-btn", { timeout: 5000 });
    await popup2.click("#popout-btn");

    // Wait a moment for the service worker to process the message
    await new Promise((r) => setTimeout(r, 1500));

    const popupPagesAfter = (await browser.pages()).filter(
      (p) => p.url().includes("popup.html") && p.url().includes(extensionId),
    );

    // Should not have created an additional panel window
    expect(popupPagesAfter.length).toBeLessThanOrEqual(popupPagesBefore.length + 1);
  });
});

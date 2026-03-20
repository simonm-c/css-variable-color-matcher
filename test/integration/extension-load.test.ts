import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser } from "puppeteer";
import { launchBrowserWithExtension } from "./helpers/extension.js";

describe("extension loading", () => {
  let browser: Browser;
  let extensionId: string;

  beforeAll(async () => {
    ({ browser, extensionId } = await launchBrowserWithExtension());
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("loads the extension and produces a valid extension ID", () => {
    expect(extensionId).toBeTruthy();
    expect(extensionId).toMatch(/^[a-z]{32}$/);
  });

  it("has an active service worker", async () => {
    const targets = browser.targets();
    const sw = targets.find(
      (t) => t.type() === "service_worker" && t.url().includes(extensionId),
    );
    expect(sw).toBeDefined();
  });
});

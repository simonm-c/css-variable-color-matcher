import type { Browser, Page } from "puppeteer";

export async function openPopup(browser: Browser, extensionId: string): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: "domcontentloaded",
  });
  return page;
}

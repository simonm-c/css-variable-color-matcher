import puppeteer, { type Browser } from "puppeteer";
import path from "path";

const EXTENSION_PATH = path.resolve(__dirname, "../../..");

export async function launchBrowserWithExtension(): Promise<{
  browser: Browser;
  extensionId: string;
}> {
  const args = [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    "--no-first-run",
    "--no-default-browser-check",
  ];
  if (process.env.CI) {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  const browser = await puppeteer.launch({
    headless: "new" as never,
    args,
  });

  // Wait for the extension's service worker target to appear
  const serviceWorkerTarget = await browser.waitForTarget(
    (t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"),
    { timeout: 10_000 },
  );
  const extensionId = new URL(serviceWorkerTarget.url()).hostname;

  return { browser, extensionId };
}

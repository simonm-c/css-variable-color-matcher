// Content script — must be self-contained (no imports).
// Chrome loads content scripts as classic scripts, not ES modules.

declare class EyeDropper {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
}

// Sync toolbar icon with system dark/light theme on every page load
const darkMq = matchMedia("(prefers-color-scheme: dark)");
function syncIconTheme(isDark: boolean): void {
  chrome.runtime.sendMessage({ action: "update-icon", isDark });
}
syncIconTheme(darkMq.matches);
darkMq.addEventListener("change", (e) => syncIconTheme(e.matches));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msg = message as { action?: string; append?: boolean };
  if (msg.action === "start-eyedropper") {
    const dropper = new EyeDropper();
    dropper
      .open()
      .then(async (result) => {
        const hex = result.sRGBHex;
        if (msg.append) {
          const data = await chrome.storage.local.get("pickedColors");
          const colors: string[] = data.pickedColors ?? [];
          colors.push(hex);
          await chrome.storage.local.set({ pickedColors: colors });
        } else {
          await chrome.storage.local.set({ pickedColors: [hex] });
        }
        sendResponse({ color: hex });
      })
      .catch(() => {
        sendResponse({ color: null });
      });
    return true;
  }
});

// Content script — must be self-contained (no imports).
// Chrome loads content scripts as classic scripts, not ES modules.

declare class EyeDropper {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msg = message as { action?: string };
  if (msg.action === "start-eyedropper") {
    const dropper = new EyeDropper();
    dropper
      .open()
      .then(async (result) => {
        const hex = result.sRGBHex;
        await chrome.storage.local.set({ pickedColors: [hex] });
        sendResponse({ color: hex });
      })
      .catch(() => {
        sendResponse({ color: null });
      });
    return true;
  }
});

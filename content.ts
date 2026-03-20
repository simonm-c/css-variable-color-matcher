declare class EyeDropper {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "start-eyedropper") {
    const dropper = new EyeDropper();
    dropper
      .open()
      .then(async (result) => {
        const hex = result.sRGBHex;
        if (message.append) {
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

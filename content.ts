declare class EyeDropper {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "start-eyedropper") {
    const dropper = new EyeDropper();
    dropper
      .open()
      .then((result) => {
        const hex = result.sRGBHex;
        if (message.append) {
          chrome.storage.local.get("pickedColors", (data) => {
            const colors: string[] = data.pickedColors ?? [];
            colors.push(hex);
            chrome.storage.local.set({ pickedColors: colors });
            sendResponse({ color: hex });
          });
        } else {
          chrome.storage.local.set({ pickedColors: [hex] });
          sendResponse({ color: hex });
        }
      })
      .catch(() => {
        sendResponse({ color: null });
      });
    return true;
  }
});

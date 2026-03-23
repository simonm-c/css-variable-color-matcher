// Service worker — must be self-contained (no imports).
// The manifest does not specify "type": "module", so imports are not available.

let panelWindowId: number | undefined;

chrome.runtime.onMessage.addListener((message) => {
  const msg = message as { action?: string };
  if (msg.action === "open-panel") {
    openPanel();
  }
  return undefined;
});

async function openPanel(): Promise<void> {
  // If panel already open, focus it
  if (panelWindowId !== undefined) {
    try {
      await chrome.windows.update(panelWindowId, { focused: true });
      return;
    } catch {
      panelWindowId = undefined;
    }
  }

  const win = await chrome.windows.create({
    url: "popup.html",
    type: "popup",
    width: 400,
    height: 600,
  });
  if (win?.id !== undefined) panelWindowId = win.id;
}

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === panelWindowId) {
    panelWindowId = undefined;
  }
});

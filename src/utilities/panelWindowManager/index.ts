// Service worker — must be self-contained (no imports).
// The manifest does not specify "type": "module", so imports are not available.

let panelWindowId: number | undefined;

// Switch toolbar icon based on browser theme (dark/light).
// Service workers lack matchMedia, so the popup sends "update-icon" messages.
function updateIcon(isDark: boolean): void {
  const suffix = isDark ? "-dark" : "";
  chrome.action.setIcon({
    path: {
      "16": `icons/icon16${suffix}.png`,
      "48": `icons/icon48${suffix}.png`,
      "128": `icons/icon128${suffix}.png`,
    },
  });
}

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  const msg = message as { action?: string; isDark?: boolean };
  if (msg.action === "open-panel") {
    openPanel();
  } else if (msg.action === "update-icon" && typeof msg.isDark === "boolean") {
    updateIcon(msg.isDark);
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

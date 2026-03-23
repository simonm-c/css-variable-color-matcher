import { deduplicateVariables } from "../../utilities/cssParser/index.js";
import type { ColorVariable } from "../../utilities/cssParser/index.js";

export type { ColorVariable };

export interface ChromeStorageData {
  colorVariables?: ColorVariable[];
  pickedColors?: string[];
  savedLists?: Record<string, ColorVariable[]>;
  activeList?: string | null;
  selectedTheme?: string;
}

type StorageKeys = keyof ChromeStorageData;

function getStorage<K extends StorageKeys>(keys: K | K[]): Promise<Pick<ChromeStorageData, K>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys as string | string[], (data) => {
      resolve(data as Pick<ChromeStorageData, K>);
    });
  });
}

function setStorage(items: Partial<ChromeStorageData>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => {
      resolve();
    });
  });
}

function onStorageChanged(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void,
): void {
  chrome.storage.onChanged.addListener(callback);
}

// Find the active tab in the last focused normal browser window
// (works both from the popup and from the standalone panel window)
async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab && tab.url && !tab.url.startsWith("chrome-extension://")) return tab;
  // Fallback: find the active tab across all normal windows
  const tabs = await chrome.tabs.query({ active: true, windowType: "normal" });
  return tabs[0];
}

function executeScriptInFrames(
  tabId: number,
  func: () => unknown,
): Promise<chrome.scripting.InjectionResult[]> {
  return chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func,
  });
}

function executeFileInFrames(
  tabId: number,
  file: string,
): Promise<chrome.scripting.InjectionResult[]> {
  return chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: [file],
  });
}

function injectContentScript(
  tabId: number,
  file: string,
): Promise<chrome.scripting.InjectionResult[]> {
  return chrome.scripting.executeScript({
    target: { tabId },
    files: [file],
  });
}

function sendTabMessage(tabId: number, message: unknown): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, message);
}

function sendRuntimeMessage(message: unknown): void {
  chrome.runtime.sendMessage(message);
}

function onRuntimeMessage(
  callback: (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => boolean | undefined | void,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chrome.runtime.onMessage.addListener(callback as any);
}

function createWindow(
  options: Parameters<typeof chrome.windows.create>[0],
): Promise<chrome.windows.Window | undefined> {
  return chrome.windows.create(options);
}

function updateWindow(
  windowId: number,
  updateInfo: Parameters<typeof chrome.windows.update>[1],
): Promise<chrome.windows.Window> {
  return chrome.windows.update(windowId, updateInfo);
}

function onWindowRemoved(callback: (windowId: number) => void): void {
  chrome.windows.onRemoved.addListener(callback);
}

async function scanTabColorVariables(tabId: number): Promise<ColorVariable[]> {
  await executeFileInFrames(tabId, "dist/utilities/scanner/inject.js");
  const results = await executeScriptInFrames(tabId, () => {
    const r = (globalThis as Record<string, unknown>).__cssVarScanResult;
    delete (globalThis as Record<string, unknown>).__cssVarScanResult;
    return r;
  });
  const allVars: ColorVariable[] = [];
  for (const result of results) {
    if (result.result && Array.isArray(result.result)) {
      allVars.push(...(result.result as ColorVariable[]));
    }
  }
  return deduplicateVariables(allVars);
}

export function useChrome() {
  return {
    getStorage,
    setStorage,
    onStorageChanged,
    getActiveTab,
    executeScriptInFrames,
    executeFileInFrames,
    injectContentScript,
    sendTabMessage,
    sendRuntimeMessage,
    onRuntimeMessage,
    createWindow,
    updateWindow,
    onWindowRemoved,
    scanTabColorVariables,
  };
}

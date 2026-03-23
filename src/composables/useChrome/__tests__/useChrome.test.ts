import { describe, it, expect, beforeEach } from "vitest";
import { createChromeMock } from "../../../../test/chrome-mock.ts";
import { useChrome } from "../index.ts";

describe("useChrome", () => {
  let chromeMock: ReturnType<typeof createChromeMock>;

  beforeEach(() => {
    chromeMock = createChromeMock();
    (globalThis as Record<string, unknown>).chrome = chromeMock;
  });

  const {
    getStorage,
    setStorage,
    onStorageChanged,
    getActiveTab,
    sendRuntimeMessage,
    onRuntimeMessage,
    onWindowRemoved,
  } = useChrome();

  describe("getStorage", () => {
    it("resolves with requested keys from storage", async () => {
      chromeMock._setStorage({ colorVariables: { "--a": "#fff" } });
      const data = await getStorage("colorVariables");
      expect(data.colorVariables).toEqual({ "--a": "#fff" });
    });

    it("resolves with empty object for missing keys", async () => {
      const data = await getStorage("pickedColors");
      expect(data.pickedColors).toBeUndefined();
    });
  });

  describe("setStorage", () => {
    it("stores items in chrome storage", async () => {
      await setStorage({ pickedColors: ["#ff0000"] });
      expect(chromeMock.storage.local.set).toHaveBeenCalled();
      const data = await getStorage("pickedColors");
      expect(data.pickedColors).toEqual(["#ff0000"]);
    });
  });

  describe("onStorageChanged", () => {
    it("registers a change listener", () => {
      const cb = () => {};
      onStorageChanged(cb);
      expect(chromeMock.storage.onChanged.addListener).toHaveBeenCalledWith(cb);
    });
  });

  describe("getActiveTab", () => {
    it("returns the active tab from last focused window", async () => {
      chromeMock.tabs.query.mockResolvedValueOnce([{ id: 1, url: "https://example.com" }]);
      const tab = await getActiveTab();
      expect(tab).toEqual({ id: 1, url: "https://example.com" });
      expect(chromeMock.tabs.query).toHaveBeenCalledWith({
        active: true,
        lastFocusedWindow: true,
      });
    });

    it("falls back when first query returns extension URL", async () => {
      chromeMock.tabs.query
        .mockResolvedValueOnce([{ id: 1, url: "chrome-extension://abc/popup.html" }])
        .mockResolvedValueOnce([{ id: 2, url: "https://example.com" }]);
      const tab = await getActiveTab();
      expect(tab).toEqual({ id: 2, url: "https://example.com" });
      expect(chromeMock.tabs.query).toHaveBeenCalledWith({
        active: true,
        windowType: "normal",
      });
    });

    it("returns undefined when no tabs found", async () => {
      chromeMock.tabs.query.mockResolvedValueOnce([]);
      const tab = await getActiveTab();
      expect(tab).toBeUndefined();
    });
  });

  describe("sendRuntimeMessage", () => {
    it("delegates to chrome.runtime.sendMessage", () => {
      sendRuntimeMessage({ action: "open-panel" });
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({ action: "open-panel" });
    });
  });

  describe("onRuntimeMessage", () => {
    it("registers a message listener", () => {
      const cb = () => {};
      onRuntimeMessage(cb);
      expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledWith(cb);
    });
  });

  describe("onWindowRemoved", () => {
    it("registers a window removal listener", () => {
      const cb = () => {};
      onWindowRemoved(cb);
      expect(chromeMock.windows.onRemoved.addListener).toHaveBeenCalledWith(cb);
    });
  });

  describe("scanTabColorVariables", () => {
    const { scanTabColorVariables } = useChrome();

    it("retrieval function cleans up __cssVarScanResult from globalThis", async () => {
      chromeMock.scripting.executeScript
        .mockResolvedValueOnce([{ result: undefined }]) // file injection
        .mockResolvedValueOnce([{ result: [] }]); // func retrieval

      await scanTabColorVariables(1);

      // The second call is the func retrieval — extract and run it to verify cleanup
      const funcCall = chromeMock.scripting.executeScript.mock.calls[1][0];
      expect(funcCall).toHaveProperty("func");

      // Simulate what the func does: set the global, then run the func
      (globalThis as Record<string, unknown>).__cssVarScanResult = [
        { name: "--test", value: "red" },
      ];
      funcCall.func();
      expect((globalThis as Record<string, unknown>).__cssVarScanResult).toBeUndefined();
    });

    it("deduplicates results across frames", async () => {
      chromeMock.scripting.executeScript
        .mockResolvedValueOnce([{ result: undefined }])
        .mockResolvedValueOnce([
          { result: [{ name: "--a", value: "red" }, { name: "--b", value: "blue" }] },
          { result: [{ name: "--a", value: "red" }, { name: "--c", value: "green" }] },
        ]);

      const result = await scanTabColorVariables(1);
      expect(result).toEqual([
        { name: "--a", value: "red" },
        { name: "--b", value: "blue" },
        { name: "--c", value: "green" },
      ]);
    });
  });
});

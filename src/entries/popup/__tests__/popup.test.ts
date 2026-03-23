// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChromeMock } from "../../../../test/chrome-mock.ts";

function setupDOM() {
  document.body.innerHTML = `
    <div id="header">
      <h1>CSS Variable Color Matcher</h1>
      <div id="header-actions">
        <button id="theme-btn"></button>
        <button id="popout-btn"></button>
      </div>
    </div>
    <div id="theme-dropdown" class="hidden">
      <div id="theme-grid"></div>
    </div>
    <div id="controls">
      <button id="scan-btn"><span id="scan-btn-text">Scan Variables</span></button>
      <button id="pick-btn">Pick Color</button>
    </div>
    <div id="save-controls">
      <input id="list-name" type="text">
      <button id="save-btn">Save</button>
    </div>
    <div id="saved-lists"></div>
    <details id="variables">
      <summary id="vars-summary">Color Variables</summary>
      <div id="vars-search-wrapper">
        <input id="vars-search" type="text">
      </div>
      <div id="vars-list">
        <p id="no-vars-msg">No variables scanned yet.</p>
      </div>
    </details>
    <div id="results">
      <p id="no-color-msg">No color picked yet.</p>
    </div>
  `;
}

describe("popup entry point", () => {
  let chromeMock: ReturnType<typeof createChromeMock>;

  beforeEach(async () => {
    chromeMock = createChromeMock();
    (globalThis as Record<string, unknown>).chrome = chromeMock;

    // Stub window.close (jsdom doesn't implement it)
    vi.stubGlobal("close", vi.fn());

    setupDOM();
    vi.resetModules();
    await import("../index.ts");
  });

  describe("initialization", () => {
    it("reads cached color variables on load", () => {
      expect(chromeMock.storage.local.get).toHaveBeenCalled();
    });

    it("registers storage change listener", () => {
      expect(chromeMock.storage.onChanged.addListener).toHaveBeenCalled();
    });
  });

  describe("displayColorVariables", () => {
    it("shows 'Color Variables (0)' for empty vars", () => {
      const summary = document.getElementById("vars-summary")!;
      expect(summary.textContent).toBe("Color Variables (0)");
    });

    it("renders color vars and hides non-color vars", () => {
      const changeListener = chromeMock.storage.onChanged.addListener.mock.calls[0][0];
      changeListener({
        colorVariables: {
          newValue: {
            "--color-brand": "#ff0000",
            "--spacing": "16px",
            "--color-bg": "#000000",
          },
        },
      });

      const varsList = document.getElementById("vars-list")!;
      const entries = varsList.querySelectorAll(".var-entry");
      expect(entries.length).toBe(2);

      const summary = document.getElementById("vars-summary")!;
      expect(summary.textContent).toBe("Color Variables (2)");
    });

    it("filters by search query", () => {
      const changeListener = chromeMock.storage.onChanged.addListener.mock.calls[0][0];
      changeListener({
        colorVariables: {
          newValue: {
            "--color-brand": "#ff0000",
            "--color-bg": "#000000",
            "--color-accent": "#00ff00",
          },
        },
      });

      const searchEl = document.getElementById("vars-search") as HTMLInputElement;
      searchEl.value = "brand";
      searchEl.dispatchEvent(new Event("input"));

      const varsList = document.getElementById("vars-list")!;
      const entries = varsList.querySelectorAll(".var-entry");
      expect(entries.length).toBe(1);

      const summary = document.getElementById("vars-summary")!;
      expect(summary.textContent).toBe("Color Variables (1 / 3)");
    });
  });

  describe("renderSavedLists", () => {
    it("renders empty for no saved lists", () => {
      const savedLists = document.getElementById("saved-lists")!;
      expect(savedLists.children.length).toBe(0);
    });
  });

  describe("displayPickedColors", () => {
    it("shows 'No variables to compare' when no vars stored", async () => {
      const changeListener = chromeMock.storage.onChanged.addListener.mock.calls[0][0];
      changeListener({
        pickedColors: { newValue: ["#ff0000"] },
      });

      const results = document.getElementById("results")!;
      await vi.waitFor(() => {
        expect(results.querySelector(".picked-header")).not.toBeNull();
        expect(results.querySelector(".no-matches-msg")!.textContent).toBe(
          "No variables to compare. Scan the page first.",
        );
      });
    });

    it("renders exact matches with .match-exact class", async () => {
      chromeMock._setStorage({
        colorVariables: { "--color-red": "#ff0000" },
      });

      const changeListener = chromeMock.storage.onChanged.addListener.mock.calls[0][0];
      changeListener({
        pickedColors: { newValue: ["#ff0000"] },
      });

      const results = document.getElementById("results")!;
      await vi.waitFor(() => {
        const exact = results.querySelectorAll(".match-exact");
        expect(exact.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("sorts matches by distance (closest first)", async () => {
      chromeMock._setStorage({
        colorVariables: {
          "--far": "#0000ff",
          "--close": "#fe0101",
          "--exact": "#ff0000",
        },
      });

      const changeListener = chromeMock.storage.onChanged.addListener.mock.calls[0][0];
      changeListener({
        pickedColors: { newValue: ["#ff0000"] },
      });

      const results = document.getElementById("results")!;
      await vi.waitFor(() => {
        const names = results.querySelectorAll(".match-name");
        const nameTexts = Array.from(names).map((el) => el.textContent);
        expect(nameTexts[0]).toBe("--exact");
      });
    });
  });

  describe("getActiveTab (tested via scan button)", () => {
    it("queries active tab on scan click", async () => {
      chromeMock.tabs.query.mockResolvedValueOnce([{ id: 1, url: "https://example.com" }]);
      chromeMock.scripting.executeScript.mockResolvedValueOnce([{ result: {} }]);

      const scanBtn = document.getElementById("scan-btn") as HTMLButtonElement;
      scanBtn.click();

      await vi.waitFor(() => expect(chromeMock.tabs.query).toHaveBeenCalled());
      expect(chromeMock.tabs.query).toHaveBeenCalledWith({
        active: true,
        lastFocusedWindow: true,
      });
    });

    it("falls back when first query returns extension URL", async () => {
      chromeMock.tabs.query
        .mockResolvedValueOnce([{ id: 1, url: "chrome-extension://abc/popup.html" }])
        .mockResolvedValueOnce([{ id: 2, url: "https://example.com" }]);
      chromeMock.scripting.executeScript.mockResolvedValueOnce([{ result: {} }]);

      const scanBtn = document.getElementById("scan-btn") as HTMLButtonElement;
      scanBtn.click();

      await vi.waitFor(() =>
        expect(chromeMock.tabs.query).toHaveBeenCalledWith({
          active: true,
          windowType: "normal",
        }),
      );
    });
  });

  describe("pick button", () => {
    it("sends start-eyedropper message to active tab", async () => {
      chromeMock.tabs.query.mockResolvedValueOnce([{ id: 42, url: "https://example.com" }]);

      const pickBtn = document.getElementById("pick-btn") as HTMLButtonElement;
      pickBtn.click();

      await vi.waitFor(() => expect(chromeMock.tabs.sendMessage).toHaveBeenCalled());
      expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(42, {
        action: "start-eyedropper",
        append: false,
      });
    });

    it("injects content script when sendMessage fails", async () => {
      chromeMock.tabs.query.mockResolvedValueOnce([{ id: 42, url: "https://example.com" }]);
      chromeMock.tabs.sendMessage
        .mockRejectedValueOnce(new Error("No listener"))
        .mockResolvedValueOnce(undefined);

      const pickBtn = document.getElementById("pick-btn") as HTMLButtonElement;
      pickBtn.click();

      await vi.waitFor(() => expect(chromeMock.scripting.executeScript).toHaveBeenCalled());
      expect(chromeMock.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 42 },
        files: ["content.js"],
      });
    });
  });

  describe("popout button", () => {
    it("sends open-panel message and closes window", () => {
      const popoutBtn = document.getElementById("popout-btn") as HTMLButtonElement;
      popoutBtn.click();

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({ action: "open-panel" });
    });
  });

  describe("save button", () => {
    it("saves current variables as a named list", () => {
      chromeMock._setStorage({
        colorVariables: { "--brand": "#ff0000" },
        savedLists: {},
      });

      const listNameInput = document.getElementById("list-name") as HTMLInputElement;
      listNameInput.value = "Test List";

      const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
      saveBtn.click();

      expect(chromeMock.storage.local.get).toHaveBeenCalled();
    });

    it("does nothing when list name is empty", () => {
      const callsBefore = chromeMock.storage.local.get.mock.calls.length;

      const listNameInput = document.getElementById("list-name") as HTMLInputElement;
      listNameInput.value = "";

      const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
      saveBtn.click();

      // No new storage.get calls beyond initialization
      expect(chromeMock.storage.local.get.mock.calls.length).toBe(callsBefore);
    });
  });
});

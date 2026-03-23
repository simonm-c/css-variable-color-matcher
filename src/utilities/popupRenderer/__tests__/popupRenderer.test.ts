// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  renderColorVariables,
  renderPickedColors,
  renderSavedLists,
  createMatchEntry,
} from "../index.ts";
import type { TieredMatches } from "../../../composables/useColorMatcher/index.ts";
import type { ColorVariable } from "../../../utilities/cssParser/index.ts";
import { createChromeMock } from "../../../../test/chrome-mock.ts";

beforeEach(() => {
  (globalThis as Record<string, unknown>).chrome = createChromeMock();
});

function makeElements() {
  document.body.innerHTML = `
    <div id="vars-summary"></div>
    <div id="vars-search-wrapper"><input id="vars-search" type="text"></div>
    <div id="vars-list"></div>
    <div id="saved-lists"></div>
    <div id="results"></div>
  `;
  return {
    varsSummaryEl: document.getElementById("vars-summary") as HTMLElement,
    varsListEl: document.getElementById("vars-list") as HTMLDivElement,
    varsSearchEl: document.getElementById("vars-search") as HTMLInputElement,
    savedListsEl: document.getElementById("saved-lists") as HTMLDivElement,
    resultsEl: document.getElementById("results") as HTMLDivElement,
  };
}

const isColor = (v: string) => /^#[0-9a-f]{3,8}$/i.test(v);

describe("renderColorVariables", () => {
  it("shows (0) and message for empty vars", () => {
    const els = makeElements();
    renderColorVariables([], els, isColor);
    expect(els.varsSummaryEl.textContent).toBe("Color Variables (0)");
    expect(els.varsListEl.querySelector("#no-vars-msg")).not.toBeNull();
  });

  it("renders only color values", () => {
    const els = makeElements();
    renderColorVariables(
      [
        { name: "--color-brand", value: "#ff0000" },
        { name: "--spacing", value: "16px" },
        { name: "--color-bg", value: "#000" },
      ],
      els,
      isColor,
    );
    expect(els.varsListEl.querySelectorAll(".var-entry").length).toBe(2);
    expect(els.varsSummaryEl.textContent).toBe("Color Variables (2)");
  });

  it("filters by search query", () => {
    const els = makeElements();
    els.varsSearchEl.value = "brand";
    renderColorVariables(
      [
        { name: "--color-brand", value: "#ff0000" },
        { name: "--color-bg", value: "#000" },
        { name: "--color-accent", value: "#0f0" },
      ],
      els,
      isColor,
    );
    expect(els.varsListEl.querySelectorAll(".var-entry").length).toBe(1);
    expect(els.varsSummaryEl.textContent).toBe("Color Variables (1 / 3)");
  });
});

describe("renderPickedColors", () => {
  it("shows no-matches message when findMatches returns empty", () => {
    const els = makeElements();
    const emptyMatches: TieredMatches = { exact: [], close: [], far: [] };
    renderPickedColors(["#ff0000"], [], els.resultsEl, () => emptyMatches);
    expect(els.resultsEl.querySelector(".picked-header")).not.toBeNull();
    expect(els.resultsEl.querySelector(".no-matches-msg")!.textContent).toBe(
      "No variables to compare. Scan the page first.",
    );
  });

  it("renders match entries by tier", () => {
    const els = makeElements();
    const tiered: TieredMatches = {
      exact: [{ name: "--red", value: "#ff0000", distance: 0 }],
      close: [{ name: "--close", value: "#fe0101", distance: 3 }],
      far: [{ name: "--far", value: "#0000ff", distance: 100 }],
    };
    renderPickedColors(
      ["#ff0000"],
      [{ name: "--red", value: "#ff0000" }],
      els.resultsEl,
      () => tiered,
    );
    expect(els.resultsEl.querySelectorAll(".match-exact").length).toBe(1);
    expect(els.resultsEl.querySelectorAll(".match-close").length).toBe(1);
    expect(els.resultsEl.querySelectorAll(".match-far").length).toBe(1);
  });
});

describe("renderSavedLists", () => {
  it("renders nothing for empty lists", () => {
    const els = makeElements();
    const cbs = {
      onToggleList: vi.fn(),
      onDeleteList: vi.fn(),
      onExportList: vi.fn(),
      onRenameList: vi.fn(),
    };
    renderSavedLists({}, null, els.savedListsEl, cbs, isColor);
    expect(els.savedListsEl.children.length).toBe(0);
  });

  it("renders list entries with color count", () => {
    const els = makeElements();
    const cbs = {
      onToggleList: vi.fn(),
      onDeleteList: vi.fn(),
      onExportList: vi.fn(),
      onRenameList: vi.fn(),
    };
    const vars: ColorVariable[] = [
      { name: "--brand", value: "#ff0000" },
      { name: "--spacing", value: "16px" },
    ];
    renderSavedLists({ "My List": vars }, null, els.savedListsEl, cbs, isColor);
    expect(els.savedListsEl.querySelectorAll(".saved-list-entry").length).toBe(1);
    expect(els.savedListsEl.querySelector(".saved-list-count")!.textContent).toBe("(1)");
  });

  it("marks active list", () => {
    const els = makeElements();
    const cbs = {
      onToggleList: vi.fn(),
      onDeleteList: vi.fn(),
      onExportList: vi.fn(),
      onRenameList: vi.fn(),
    };
    renderSavedLists(
      { "My List": [{ name: "--brand", value: "#ff0000" }] },
      "My List",
      els.savedListsEl,
      cbs,
      isColor,
    );
    expect(els.savedListsEl.querySelector(".saved-list-entry")!.classList.contains("active")).toBe(
      true,
    );
  });

  it("calls onToggleList callback on entry click", () => {
    const els = makeElements();
    const cbs = {
      onToggleList: vi.fn(),
      onDeleteList: vi.fn(),
      onExportList: vi.fn(),
      onRenameList: vi.fn(),
    };
    const vars: ColorVariable[] = [{ name: "--brand", value: "#ff0000" }];
    renderSavedLists({ "My List": vars }, null, els.savedListsEl, cbs, isColor);
    const entry = els.savedListsEl.querySelector(".saved-list-entry") as HTMLElement;
    entry.click();
    expect(cbs.onToggleList).toHaveBeenCalledWith("My List", false, vars);
  });

  it("calls onDeleteList callback on delete click", () => {
    const els = makeElements();
    const cbs = {
      onToggleList: vi.fn(),
      onDeleteList: vi.fn(),
      onExportList: vi.fn(),
      onRenameList: vi.fn(),
    };
    renderSavedLists(
      { "My List": [{ name: "--brand", value: "#ff0000" }] },
      null,
      els.savedListsEl,
      cbs,
      isColor,
    );
    const deleteBtn = els.savedListsEl.querySelector(".saved-list-delete") as HTMLElement;
    deleteBtn.click();
    expect(cbs.onDeleteList).toHaveBeenCalledWith("My List", false);
  });

  it("renders export button for each list", () => {
    const els = makeElements();
    const cbs = {
      onToggleList: vi.fn(),
      onDeleteList: vi.fn(),
      onExportList: vi.fn(),
      onRenameList: vi.fn(),
    };
    renderSavedLists(
      { "My List": [{ name: "--brand", value: "#ff0000" }] },
      null,
      els.savedListsEl,
      cbs,
      isColor,
    );
    const exportBtn = els.savedListsEl.querySelector(".saved-list-export") as HTMLElement;
    expect(exportBtn).not.toBeNull();
  });

  it("calls onExportList callback on export click", () => {
    const els = makeElements();
    const cbs = {
      onToggleList: vi.fn(),
      onDeleteList: vi.fn(),
      onExportList: vi.fn(),
      onRenameList: vi.fn(),
    };
    const vars: ColorVariable[] = [{ name: "--brand", value: "#ff0000" }];
    renderSavedLists({ "My List": vars }, null, els.savedListsEl, cbs, isColor);
    const exportBtn = els.savedListsEl.querySelector(".saved-list-export") as HTMLElement;
    exportBtn.click();
    expect(cbs.onExportList).toHaveBeenCalledWith("My List", vars);
    expect(cbs.onToggleList).not.toHaveBeenCalled();
  });
});

describe("createMatchEntry", () => {
  it("creates entry with correct tier class", () => {
    const el = createMatchEntry({ name: "--red", value: "#ff0000", distance: 0 }, "match-exact");
    expect(el.classList.contains("match-exact")).toBe(true);
    expect(el.querySelector(".match-name")!.textContent).toBe("--red");
  });

  it("handles light-dark matches", () => {
    const el = createMatchEntry(
      {
        name: "--ld",
        value: "light-dark(#fff, #000)",
        distance: 5,
        lightDark: { light: "#fff", dark: "#000", lightDist: 5, darkDist: 100 },
      },
      "match-close",
    );
    expect(el.querySelector(".ld-match")).not.toBeNull();
  });
});

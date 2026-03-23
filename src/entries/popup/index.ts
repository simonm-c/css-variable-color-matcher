import { useChrome } from "../../composables/useChrome/index.js";
import type { ColorVariable } from "../../composables/useChrome/index.js";
import { useColorMatcher } from "../../composables/useColorMatcher/index.js";
import {
  renderColorVariables,
  renderPickedColors,
  renderSavedLists,
} from "../../utilities/popupRenderer/index.js";
import { themePresets, defaultThemeId, applyTheme } from "../../utilities/themes/index.js";
import { exportListAsCss, triggerCssFileImport } from "../../utilities/cssImportExport/index.js";

const {
  getStorage,
  setStorage,
  onStorageChanged,
  getActiveTab,
  executeScriptInFrames,
  executeFileInFrames,
  injectContentScript,
  sendTabMessage,
  sendRuntimeMessage,
} = useChrome();
const { findMatches, isColorValue } = useColorMatcher();

const scanBtn = document.getElementById("scan-btn") as HTMLButtonElement;
const pickBtn = document.getElementById("pick-btn") as HTMLButtonElement;
const resultsEl = document.getElementById("results") as HTMLDivElement;
const varsSummaryEl = document.getElementById("vars-summary") as HTMLElement;
const varsListEl = document.getElementById("vars-list") as HTMLDivElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const importBtn = document.getElementById("import-btn") as HTMLButtonElement;
const listNameInput = document.getElementById("list-name") as HTMLInputElement;
const savedListsEl = document.getElementById("saved-lists") as HTMLDivElement;
const varsSearchEl = document.getElementById("vars-search") as HTMLInputElement;
const popoutBtn = document.getElementById("popout-btn") as HTMLButtonElement;

const elements = { varsSummaryEl, varsListEl, varsSearchEl };

// Hydrate static i18n strings from data-i18n attributes
for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
  const msg = chrome.i18n.getMessage(el.dataset.i18n!);
  if (msg) el.textContent = msg;
}
for (const el of document.querySelectorAll<HTMLElement>("[data-i18n-title]")) {
  const msg = chrome.i18n.getMessage(el.dataset.i18nTitle!);
  if (msg) el.title = msg;
}
for (const el of document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]")) {
  const msg = chrome.i18n.getMessage(el.dataset.i18nAriaLabel!);
  if (msg) el.setAttribute("aria-label", msg);
}
for (const el of document.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]")) {
  const msg = chrome.i18n.getMessage(el.dataset.i18nPlaceholder!);
  if (msg) el.placeholder = msg;
}

let currentVars: ColorVariable[] = [];

// Migrate old Record<string, string> format to ColorVariable[]
function normalizeVars(raw: unknown): ColorVariable[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    // Old format: { "--name": "value" }
    return Object.entries(raw as Record<string, string>).map(([name, value]) => ({
      name,
      value,
    }));
  }
  return [];
}

function normalizeSavedLists(
  raw: unknown,
): Record<string, ColorVariable[]> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, ColorVariable[]> = {};
  for (const [name, vars] of Object.entries(raw as Record<string, unknown>)) {
    result[name] = normalizeVars(vars);
  }
  return result;
}

function displayVars(vars: ColorVariable[]): void {
  currentVars = vars;
  renderColorVariables(vars, elements, isColorValue);
}

function displayPicked(colors: string[]): void {
  getStorage("colorVariables").then((data) => {
    const vars = normalizeVars(data.colorVariables);
    renderPickedColors(colors, vars, resultsEl, findMatches);
  });
}

function displaySavedLists(
  lists: Record<string, ColorVariable[]>,
  activeList: string | null,
): void {
  renderSavedLists(
    lists,
    activeList,
    savedListsEl,
    {
      onToggleList(name, isActive, vars) {
        const newActive = isActive ? null : name;
        const newVars: ColorVariable[] = isActive ? [] : vars;
        setStorage({ colorVariables: newVars, activeList: newActive }).then(() => {
          displayVars(newVars);
          displaySavedLists(lists, newActive);
          getStorage("pickedColors").then((data) => {
            const colors: string[] = data.pickedColors ?? [];
            if (colors.length > 0) displayPicked(colors);
          });
        });
      },
      onDeleteList(name, isActive) {
        delete lists[name];
        const newActive = isActive ? null : activeList;
        setStorage({ savedLists: lists, activeList: newActive }).then(() => {
          displaySavedLists(lists, newActive);
        });
      },
      onExportList(name, vars) {
        exportListAsCss(name, vars);
      },
      onRenameList(oldName, newName) {
        if (newName in lists) return; // Don't overwrite existing list
        lists[newName] = lists[oldName];
        delete lists[oldName];
        const newActive = activeList === oldName ? newName : activeList;
        setStorage({ savedLists: lists, activeList: newActive }).then(() => {
          displaySavedLists(lists, newActive);
        });
      },
    },
    isColorValue,
  );
}

// Pop out into a standalone window
popoutBtn.addEventListener("click", () => {
  sendRuntimeMessage({ action: "open-panel" });
  window.close();
});

// Theme picker
const themeBtn = document.getElementById("theme-btn") as HTMLButtonElement;
const themeDropdown = document.getElementById("theme-dropdown") as HTMLDivElement;
const themeGrid = document.getElementById("theme-grid") as HTMLDivElement;
let activeThemeId = defaultThemeId;

function closeThemeDropdown(): void {
  themeDropdown.classList.add("hidden");
  themeBtn.classList.remove("active");
}

themeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const wasHidden = themeDropdown.classList.toggle("hidden");
  themeBtn.classList.toggle("active", !wasHidden);
});

document.addEventListener("click", (e) => {
  if (!themeDropdown.classList.contains("hidden") && !themeDropdown.contains(e.target as Node)) {
    closeThemeDropdown();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !themeDropdown.classList.contains("hidden")) {
    closeThemeDropdown();
    themeBtn.focus();
  }
});

function renderThemeGrid(selectedId: string): void {
  themeGrid.innerHTML = "";
  for (const [id, preset] of Object.entries(themePresets)) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = `theme-swatch${id === selectedId ? " active" : ""}`;
    swatch.title = preset.name;
    swatch.ariaLabel = preset.name;
    swatch.dataset.themeId = id;

    const lightHalf = document.createElement("div");
    lightHalf.className = "theme-swatch-light";
    lightHalf.style.backgroundColor = preset.swatchLight;

    const darkHalf = document.createElement("div");
    darkHalf.className = "theme-swatch-dark";
    darkHalf.style.backgroundColor = preset.swatchDark;

    const check = document.createElement("div");
    check.className = "check-mark";
    check.innerHTML =
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

    swatch.appendChild(lightHalf);
    swatch.appendChild(darkHalf);
    swatch.appendChild(check);

    swatch.addEventListener("click", () => {
      if (id === activeThemeId) return;
      const prev = themeGrid.querySelector(".theme-swatch.active");
      if (prev) prev.classList.remove("active");
      swatch.classList.add("active");
      activeThemeId = id;
      applyTheme(id);
      setStorage({ selectedTheme: id });
    });

    themeGrid.appendChild(swatch);
  }
}

// Search filter
varsSearchEl.addEventListener("input", () => {
  displayVars(currentVars);
});

// Hydrate all cached data in a single storage read
getStorage(["selectedTheme", "colorVariables", "savedLists", "activeList", "pickedColors"]).then(
  (data) => {
    activeThemeId = data.selectedTheme ?? defaultThemeId;
    applyTheme(activeThemeId);
    renderThemeGrid(activeThemeId);

    displayVars(normalizeVars(data.colorVariables));
    displaySavedLists(normalizeSavedLists(data.savedLists), data.activeList ?? null);

    const colors: string[] = data.pickedColors ?? [];
    if (colors.length > 0) displayPicked(colors);
  },
);

// Scan button
scanBtn.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  const scanBtnText = document.getElementById("scan-btn-text") as HTMLSpanElement;
  scanBtn.disabled = true;
  scanBtnText.textContent = chrome.i18n.getMessage("scanning");

  try {
    // Step 1: inject bundled scanner (stores result on globalThis)
    await executeFileInFrames(tab.id, "dist/utilities/scanner/inject.js");
    // Step 2: retrieve results via func mode (reliably captures return values)
    const results = await executeScriptInFrames(tab.id, () => {
      return (globalThis as Record<string, unknown>).__cssVarScanResult;
    });

    const merged: ColorVariable[] = [];
    const seen = new Set<string>();
    for (const result of results) {
      if (result.result && Array.isArray(result.result)) {
        for (const v of result.result as ColorVariable[]) {
          const key = `${v.name}\0${v.value}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(v);
          }
        }
      }
    }

    await setStorage({ colorVariables: merged });
    displayVars(merged);
  } finally {
    scanBtn.disabled = false;
    scanBtnText.textContent = chrome.i18n.getMessage("scanVariables");
  }
});

// Pick button
pickBtn.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  const msg = { action: "start-eyedropper" };

  try {
    await sendTabMessage(tab.id, msg);
  } catch {
    try {
      await injectContentScript(tab.id, "dist/utilities/eyedropperHandler/index.js");
      await sendTabMessage(tab.id, msg);
    } catch {
      // Injection failed (chrome:// pages, PDF viewers, etc.)
    }
  }
});

// Save button
saveBtn.addEventListener("click", () => {
  const name = listNameInput.value.trim();
  if (!name) return;

  getStorage(["colorVariables", "savedLists"]).then((data) => {
    const vars = normalizeVars(data.colorVariables);
    if (vars.length === 0) return;

    const lists = normalizeSavedLists(data.savedLists);
    lists[name] = vars;

    setStorage({ savedLists: lists, activeList: name }).then(() => {
      listNameInput.value = "";
      displaySavedLists(lists, name);
    });
  });
});

// Import button
importBtn.addEventListener("click", () => {
  triggerCssFileImport((filename, vars) => {
    if (vars.length === 0) return;

    getStorage(["savedLists"]).then((data) => {
      const lists = normalizeSavedLists(data.savedLists);

      // Deduplicate name
      let name = filename;
      let counter = 2;
      while (name in lists) {
        name = `${filename} (${counter++})`;
      }

      lists[name] = vars;

      setStorage({ savedLists: lists, activeList: name, colorVariables: vars }).then(() => {
        displayVars(vars);
        displaySavedLists(lists, name);
      });
    });
  });
});

// Update display if data changes while popup is still open
onStorageChanged((changes) => {
  if (changes.colorVariables?.newValue) {
    displayVars(normalizeVars(changes.colorVariables.newValue));
  }
  if (changes.pickedColors?.newValue) {
    displayPicked(changes.pickedColors.newValue);
  }
  if (changes.savedLists || changes.activeList) {
    getStorage(["savedLists", "activeList"]).then((data) => {
      displaySavedLists(normalizeSavedLists(data.savedLists), data.activeList ?? null);
    });
  }
});

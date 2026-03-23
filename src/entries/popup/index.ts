import { useChrome } from "../../composables/useChrome/index.js";
import { useColorMatcher } from "../../composables/useColorMatcher/index.js";
import { scanFrameColorVariables } from "../../utilities/scanner/index.js";
import {
  renderColorVariables,
  renderPickedColors,
  renderSavedLists,
} from "../../utilities/popupRenderer/index.js";
import { themePresets, defaultThemeId, applyTheme } from "../../utilities/themes/index.js";

const {
  getStorage,
  setStorage,
  onStorageChanged,
  getActiveTab,
  executeScriptInFrames,
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

let currentVars: Record<string, string> = {};

function displayVars(vars: Record<string, string>): void {
  currentVars = vars;
  renderColorVariables(vars, elements, isColorValue);
}

function displayPicked(colors: string[]): void {
  getStorage("colorVariables").then((data) => {
    const vars = data.colorVariables ?? {};
    renderPickedColors(colors, vars, resultsEl, findMatches);
  });
}

function displaySavedLists(
  lists: Record<string, Record<string, string>>,
  activeList: string | null,
): void {
  renderSavedLists(
    lists,
    activeList,
    savedListsEl,
    {
      onToggleList(name, isActive, vars) {
        const newActive = isActive ? null : name;
        const newVars = isActive ? {} : vars;
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

    displayVars(data.colorVariables ?? {});
    displaySavedLists(data.savedLists ?? {}, data.activeList ?? null);

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
    const results = await executeScriptInFrames(tab.id, scanFrameColorVariables);

    const merged: Record<string, string> = {};
    for (const result of results) {
      if (result.result) {
        Object.assign(merged, result.result);
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
pickBtn.addEventListener("click", async (event) => {
  const append = event.shiftKey;
  const tab = await getActiveTab();
  if (!tab?.id) return;

  const msg = { action: "start-eyedropper", append };

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
    const vars: Record<string, string> = data.colorVariables ?? {};
    if (Object.keys(vars).length === 0) return;

    const lists: Record<string, Record<string, string>> = data.savedLists ?? {};
    lists[name] = vars;

    setStorage({ savedLists: lists, activeList: name }).then(() => {
      listNameInput.value = "";
      displaySavedLists(lists, name);
    });
  });
});

// Update display if data changes while popup is still open
onStorageChanged((changes) => {
  if (changes.colorVariables?.newValue) {
    displayVars(changes.colorVariables.newValue);
  }
  if (changes.pickedColors?.newValue) {
    displayPicked(changes.pickedColors.newValue);
  }
  if (changes.savedLists || changes.activeList) {
    getStorage(["savedLists", "activeList"]).then((data) => {
      displaySavedLists(data.savedLists ?? {}, data.activeList ?? null);
    });
  }
});

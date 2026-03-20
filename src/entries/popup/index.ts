import { useChrome } from "../../composables/useChrome/index.js";
import { useColorMatcher } from "../../composables/useColorMatcher/index.js";
import { scanFrameColorVariables } from "../../utilities/scanner/index.js";
import {
  renderColorVariables,
  renderPickedColors,
  renderSavedLists,
} from "../../utilities/popupRenderer/index.js";

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

// Search filter
varsSearchEl.addEventListener("input", () => {
  displayVars(currentVars);
});

// Display cached data on popup open
getStorage(["colorVariables", "savedLists", "activeList"]).then((data) => {
  displayVars(data.colorVariables ?? {});
  displaySavedLists(data.savedLists ?? {}, data.activeList ?? null);
});

// Display previously picked colors on popup open
getStorage("pickedColors").then((data) => {
  const colors: string[] = data.pickedColors ?? [];
  if (colors.length > 0) displayPicked(colors);
});

// Scan button
scanBtn.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  const scanBtnText = document.getElementById("scan-btn-text") as HTMLSpanElement;
  scanBtn.disabled = true;
  scanBtnText.textContent = "Scanning...";

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
    scanBtnText.textContent = "Scan Page Variables";
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
      await injectContentScript(tab.id, "content.js");
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

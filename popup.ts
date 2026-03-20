import { parseColor, parseLightDark, colorDistanceOklab } from "./useColor.js";

const EXACT_DISTANCE_THRESHOLD = 2;
const CLOSE_MATCHES_COUNT = 5;

function isColorValue(value: string): boolean {
  return parseColor(value) !== null || parseLightDark(value) !== null;
}

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

// Pop out into a standalone window
popoutBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "open-panel" });
  window.close();
});

let currentVars: Record<string, string> = {};
varsSearchEl.addEventListener("input", () => {
  displayColorVariables(currentVars);
});

// Find the active tab in the last focused normal browser window
// (works both from the popup and from the standalone panel window)
async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab && tab.url && !tab.url.startsWith("chrome-extension://")) return tab;
  // Fallback: find the active tab across all normal windows
  const tabs = await chrome.tabs.query({ active: true, windowType: "normal" });
  return tabs[0];
}

// Display cached color variables and saved lists on popup open
chrome.storage.local.get(["colorVariables", "savedLists", "activeList"], (data) => {
  const vars: Record<string, string> = data.colorVariables ?? {};
  displayColorVariables(vars);
  renderSavedLists(data.savedLists ?? {}, data.activeList ?? null);
});

scanBtn.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  const scanBtnText = document.getElementById("scan-btn-text") as HTMLSpanElement;
  scanBtn.disabled = true;
  scanBtnText.textContent = "Scanning...";

  try {
    // Execute in ALL frames so each frame scans its own stylesheets directly
    // (avoids cross-frame DOM access issues with iframe.contentDocument)
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: scanFrameColorVariables,
    });

    const merged: Record<string, string> = {};
    for (const result of results) {
      if (result.result) {
        Object.assign(merged, result.result);
      }
    }

    chrome.storage.local.set({ colorVariables: merged });
    displayColorVariables(merged);
  } finally {
    scanBtn.disabled = false;
    scanBtnText.textContent = "Scan Page Variables";
  }
});

// Self-contained scanning function injected into each frame via executeScript.
// Cannot reference external functions — must be fully standalone.
function scanFrameColorVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!document.documentElement) return vars;

  // Collect custom property names and their declaring selectors from stylesheets
  const propSelectors = new Map<string, Set<string>>();

  function collectFromRules(rules: CSSRuleList, parentSelector?: string): void {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        for (let i = 0; i < rule.style.length; i++) {
          const prop = rule.style[i];
          if (prop.startsWith("--")) {
            let selectors = propSelectors.get(prop);
            if (!selectors) {
              selectors = new Set();
              propSelectors.set(prop, selectors);
            }
            selectors.add(rule.selectorText);
          }
        }
        // Recurse into CSS-nested rules, passing selector for CSSNestedDeclarations
        if ("cssRules" in rule) {
          try {
            collectFromRules(rule.cssRules, rule.selectorText);
          } catch {
            // Skip inaccessible nested rules
          }
        }
      } else {
        // CSSNestedDeclarations — declarations split by nested rules inherit parent selector
        if ("style" in rule && parentSelector) {
          const style = (rule as unknown as CSSStyleRule).style;
          for (let i = 0; i < style.length; i++) {
            const prop = style[i];
            if (prop.startsWith("--")) {
              let selectors = propSelectors.get(prop);
              if (!selectors) {
                selectors = new Set();
                propSelectors.set(prop, selectors);
              }
              selectors.add(parentSelector);
            }
          }
        }
        // Recurse into grouping rules (@layer, @media, @supports, etc.)
        if ("cssRules" in rule) {
          try {
            collectFromRules((rule as CSSGroupingRule).cssRules, parentSelector);
          } catch {
            // Skip inaccessible nested rules
          }
        }
      }
    }
  }

  for (const sheet of document.styleSheets) {
    try {
      collectFromRules(sheet.cssRules);
    } catch {
      // Skip cross-origin stylesheets
    }
  }
  // Scan adopted/constructed stylesheets (used by web components, CSS-in-JS, etc.)
  if (document.adoptedStyleSheets) {
    for (const sheet of document.adoptedStyleSheets) {
      try {
        collectFromRules(sheet.cssRules);
      } catch {
        // Skip inaccessible adopted stylesheets
      }
    }
  }

  // Resolve each property against a matching element
  for (const [prop, selectors] of propSelectors) {
    for (const selector of selectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          const value = getComputedStyle(el).getPropertyValue(prop).trim();
          if (value) {
            vars[prop] = value;
            break;
          }
        }
      } catch {
        // Invalid selector
      }
    }
    // Fallback: resolve against documentElement
    if (!vars[prop]) {
      const value = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
      if (value) vars[prop] = value;
    }
  }

  // Walk all elements once for two purposes:
  // 1. Find computed values for stylesheet properties that selectors couldn't resolve
  // 2. Pick up inline-style custom properties (JS-injected variables)
  const unresolved = [...propSelectors.keys()].filter((p) => !vars[p]);

  for (const el of document.querySelectorAll("*")) {
    // Check computed style for unresolved stylesheet properties
    if (unresolved.length > 0) {
      const computed = getComputedStyle(el);
      for (let i = unresolved.length - 1; i >= 0; i--) {
        const value = computed.getPropertyValue(unresolved[i]).trim();
        if (value) {
          vars[unresolved[i]] = value;
          unresolved.splice(i, 1);
        }
      }
    }

    // Check inline styles for JS-injected custom properties
    const style = (el as HTMLElement).style;
    if (!style) continue;
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      if (prop.startsWith("--") && !vars[prop]) {
        const value = style.getPropertyValue(prop).trim();
        if (value) vars[prop] = value;
      }
    }
  }

  return vars;
}

// Display previously picked colors on popup open
chrome.storage.local.get("pickedColors", (data) => {
  const colors: string[] = data.pickedColors ?? [];
  if (colors.length > 0) {
    displayPickedColors(colors);
  }
});

// Save current variables as a named list
saveBtn.addEventListener("click", () => {
  const name = listNameInput.value.trim();
  if (!name) return;

  chrome.storage.local.get(["colorVariables", "savedLists"], (data) => {
    const vars: Record<string, string> = data.colorVariables ?? {};
    if (Object.keys(vars).length === 0) return;

    const lists: Record<string, Record<string, string>> = data.savedLists ?? {};
    lists[name] = vars;

    chrome.storage.local.set({ savedLists: lists, activeList: name }, () => {
      listNameInput.value = "";
      renderSavedLists(lists, name);
    });
  });
});

function renderSavedLists(
  lists: Record<string, Record<string, string>>,
  activeList: string | null,
): void {
  savedListsEl.innerHTML = "";
  const names = Object.keys(lists);
  if (names.length === 0) return;

  for (const name of names) {
    const vars = lists[name];
    const count = Object.values(vars).filter(isColorValue).length;

    const isActive = name === activeList;

    const entry = document.createElement("div");
    entry.className = `saved-list-entry${isActive ? " active" : ""}`;
    entry.style.cursor = "pointer";

    // Click entry to toggle active list
    entry.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest(".saved-list-delete")) return;
      const newActive = isActive ? null : name;
      const newVars = isActive ? {} : vars;
      chrome.storage.local.set({ colorVariables: newVars, activeList: newActive }, () => {
        displayColorVariables(newVars);
        renderSavedLists(lists, newActive);
        chrome.storage.local.get("pickedColors", (data) => {
          const colors: string[] = data.pickedColors ?? [];
          if (colors.length > 0) displayPickedColors(colors);
        });
      });
    });

    const nameEl = document.createElement("span");
    nameEl.className = "saved-list-name";
    nameEl.textContent = name;

    const countEl = document.createElement("span");
    countEl.className = "saved-list-count";
    countEl.textContent = `(${count})`;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "saved-list-delete";
    deleteBtn.ariaLabel = `Delete list "${name}"`;
    deleteBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M7 21q-.825 0-1.412-.587T5 19V6H4V4h5V3h6v1h5v2h-1v13q0 .825-.587 1.413T17 21zM17 6H7v13h10zM9 17h2V8H9zm4 0h2V8h-2zM7 6v13z"/></svg>';
    deleteBtn.addEventListener("click", () => {
      delete lists[name];
      const newActive = isActive ? null : activeList;
      chrome.storage.local.set({ savedLists: lists, activeList: newActive }, () => {
        renderSavedLists(lists, newActive);
      });
    });

    entry.appendChild(nameEl);
    entry.appendChild(countEl);
    entry.appendChild(deleteBtn);
    savedListsEl.appendChild(entry);
  }
}

// Update display if colors change while popup is still open
chrome.storage.onChanged.addListener((changes) => {
  if (changes.colorVariables?.newValue) {
    displayColorVariables(changes.colorVariables.newValue);
  }
  if (changes.pickedColors?.newValue) {
    displayPickedColors(changes.pickedColors.newValue);
  }
  if (changes.savedLists || changes.activeList) {
    chrome.storage.local.get(["savedLists", "activeList"], (data) => {
      renderSavedLists(data.savedLists ?? {}, data.activeList ?? null);
    });
  }
});

pickBtn.addEventListener("click", async (event) => {
  const append = event.shiftKey;

  const tab = await getActiveTab();
  if (!tab?.id) return;

  const msg = { action: "start-eyedropper", append };

  try {
    await chrome.tabs.sendMessage(tab.id, msg);
  } catch {
    // Content script not yet injected (e.g. tab was open before extension installed)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      await chrome.tabs.sendMessage(tab.id, msg);
    } catch {
      // Injection failed (chrome:// pages, PDF viewers, etc.)
    }
  }
});

function displayColorVariables(vars: Record<string, string>): void {
  currentVars = vars;
  varsListEl.innerHTML = "";

  const allEntries = Object.entries(vars).filter(([, value]) => isColorValue(value));
  if (allEntries.length === 0) {
    varsSummaryEl.textContent = "Color Variables (0)";
    varsSearchEl.parentElement!.style.display = "none";
    const msg = document.createElement("p");
    msg.id = "no-vars-msg";
    msg.textContent = "No color variables found on this page.";
    varsListEl.appendChild(msg);
    return;
  }

  varsSearchEl.parentElement!.style.display = "";
  const query = varsSearchEl.value.toLowerCase();
  const entries = query
    ? allEntries.filter(
        ([name, value]) =>
          name.toLowerCase().includes(query) || value.toLowerCase().includes(query),
      )
    : allEntries;

  varsSummaryEl.textContent = query
    ? `Color Variables (${entries.length} / ${allEntries.length})`
    : `Color Variables (${allEntries.length})`;

  for (const [name, value] of entries) {
    const entry = document.createElement("div");
    entry.className = "var-entry";

    const swatch = document.createElement("div");
    swatch.className = "var-swatch";
    swatch.style.backgroundColor = value;

    const info = document.createElement("div");
    info.className = "var-info";

    const nameEl = document.createElement("div");
    nameEl.className = "var-name";
    nameEl.textContent = name;

    const valueEl = document.createElement("div");
    valueEl.className = "var-value";
    valueEl.textContent = value;

    info.appendChild(nameEl);
    info.appendChild(valueEl);
    entry.appendChild(swatch);
    entry.appendChild(info);
    varsListEl.appendChild(entry);
  }
}

function displayPickedColors(colors: string[]): void {
  resultsEl.innerHTML = "";

  chrome.storage.local.get("colorVariables", (data) => {
    const vars: Record<string, string> = data.colorVariables ?? {};

    for (const hex of colors) {
      const pickedColor = parseColor(hex);
      if (!pickedColor) continue;

      // Picked color header
      const header = document.createElement("div");
      header.className = "color-entry picked-header";

      const swatch = document.createElement("div");
      swatch.className = "color-swatch";
      swatch.style.backgroundColor = hex;

      const info = document.createElement("div");
      info.className = "color-info";

      const valueEl = document.createElement("div");
      valueEl.className = "color-value";
      valueEl.textContent = hex;

      info.appendChild(valueEl);
      header.appendChild(swatch);
      header.appendChild(info);
      resultsEl.appendChild(header);

      // Compare against all stored variables
      const matches: ColorMatch[] = [];

      for (const [name, value] of Object.entries(vars)) {
        const varColor = parseColor(value);
        if (varColor) {
          const distance = colorDistanceOklab(pickedColor, varColor);
          matches.push({ name, value, distance });
          continue;
        }

        // Try light-dark()
        const ld = parseLightDark(value);
        if (!ld) continue;
        const lightColor = parseColor(ld.light);
        const darkColor = parseColor(ld.dark);
        if (!lightColor && !darkColor) continue;

        const lightDist = lightColor ? colorDistanceOklab(pickedColor, lightColor) : Infinity;
        const darkDist = darkColor ? colorDistanceOklab(pickedColor, darkColor) : Infinity;

        matches.push({
          name,
          value,
          distance: Math.min(lightDist, darkDist),
          lightDark: { light: ld.light, dark: ld.dark, lightDist, darkDist },
        });
      }

      matches.sort((a, b) => a.distance - b.distance);

      if (matches.length === 0) {
        const msg = document.createElement("p");
        msg.className = "no-matches-msg";
        msg.textContent = "No variables to compare. Scan the page first.";
        resultsEl.appendChild(msg);
        continue;
      }

      // Split into tiers: exact, close, far
      const exact = matches.filter((m) => Math.round(m.distance) <= EXACT_DISTANCE_THRESHOLD);
      const rest = matches.filter((m) => Math.round(m.distance) > EXACT_DISTANCE_THRESHOLD);

      // Show all exact matches, then ~5 close, then ~5 far
      const closeCount = Math.max(
        CLOSE_MATCHES_COUNT,
        exact.length > CLOSE_MATCHES_COUNT ? 0 : CLOSE_MATCHES_COUNT,
      );
      const close = rest.slice(0, closeCount);
      const far = rest.slice(closeCount, closeCount + CLOSE_MATCHES_COUNT);

      for (const match of exact) {
        resultsEl.appendChild(createMatchEntry(match, "match-exact"));
      }
      for (const match of close) {
        resultsEl.appendChild(createMatchEntry(match, "match-close"));
      }
      for (const match of far) {
        resultsEl.appendChild(createMatchEntry(match, "match-far"));
      }
    }
  });
}

interface ColorMatch {
  name: string;
  value: string;
  distance: number;
  lightDark?: { light: string; dark: string; lightDist: number; darkDist: number };
}

function createMatchEntry(match: ColorMatch, tier: string): HTMLDivElement {
  const entry = document.createElement("div");
  entry.className = `match-entry ${tier}`;

  const swatch = document.createElement("div");
  swatch.className = "match-swatch";

  const info = document.createElement("div");
  info.className = "match-info";

  const nameEl = document.createElement("div");
  nameEl.className = "match-name";
  nameEl.textContent = match.name;

  const valueEl = document.createElement("div");
  valueEl.className = "match-value";

  if (match.lightDark) {
    const { light, dark, lightDist, darkDist } = match.lightDark;
    const bothExact =
      Math.round(lightDist) <= EXACT_DISTANCE_THRESHOLD &&
      Math.round(darkDist) <= EXACT_DISTANCE_THRESHOLD;

    // Swatch shows the closer-matching color
    swatch.style.backgroundColor = lightDist <= darkDist ? light : dark;

    if (bothExact) {
      // Both sides match exactly — show as normal text
      valueEl.textContent = `${match.value} — distance: ${Math.round(match.distance)}`;
    } else {
      // Highlight the matching side(s)
      const lightClass =
        Math.round(lightDist) <= EXACT_DISTANCE_THRESHOLD
          ? "ld-match"
          : lightDist < Infinity
            ? lightDist <= darkDist
              ? "ld-match"
              : "ld-dim"
            : "ld-dim";
      const darkClass =
        Math.round(darkDist) <= EXACT_DISTANCE_THRESHOLD
          ? "ld-match"
          : darkDist < Infinity
            ? darkDist <= lightDist
              ? "ld-match"
              : "ld-dim"
            : "ld-dim";

      valueEl.append("light-dark(");
      const lightSpan = document.createElement("span");
      lightSpan.className = lightClass;
      lightSpan.textContent = light;
      valueEl.appendChild(lightSpan);
      valueEl.append(", ");
      const darkSpan = document.createElement("span");
      darkSpan.className = darkClass;
      darkSpan.textContent = dark;
      valueEl.appendChild(darkSpan);
      valueEl.append(`) — distance: ${Math.round(match.distance)}`);
    }
  } else {
    swatch.style.backgroundColor = match.value;
    valueEl.textContent = `${match.value} — distance: ${Math.round(match.distance)}`;
  }

  info.appendChild(nameEl);
  info.appendChild(valueEl);
  entry.appendChild(swatch);
  entry.appendChild(info);
  return entry;
}

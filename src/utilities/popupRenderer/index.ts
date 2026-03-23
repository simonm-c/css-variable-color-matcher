import type { ColorMatch, TieredMatches } from "../../composables/useColorMatcher/index.js";
import { EXACT_DISTANCE_THRESHOLD } from "../../composables/useColorMatcher/index.js";

export interface PopupElements {
  resultsEl: HTMLDivElement;
  varsSummaryEl: HTMLElement;
  varsListEl: HTMLDivElement;
  savedListsEl: HTMLDivElement;
  varsSearchEl: HTMLInputElement;
}

export interface SavedListCallbacks {
  onToggleList: (name: string, isActive: boolean, vars: Record<string, string>) => void;
  onDeleteList: (name: string, isActive: boolean) => void;
}

export function renderColorVariables(
  vars: Record<string, string>,
  elements: Pick<PopupElements, "varsSummaryEl" | "varsListEl" | "varsSearchEl">,
  isColorValue: (value: string) => boolean,
): void {
  const { varsSummaryEl, varsListEl, varsSearchEl } = elements;
  varsListEl.innerHTML = "";

  const allEntries = Object.entries(vars).filter(([, value]) => isColorValue(value));
  if (allEntries.length === 0) {
    varsSummaryEl.textContent = chrome.i18n.getMessage("colorVariablesCount", ["0"]);
    varsSearchEl.parentElement!.style.display = "none";
    const msg = document.createElement("p");
    msg.id = "no-vars-msg";
    msg.textContent = chrome.i18n.getMessage("noColorVariablesFound");
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
    ? chrome.i18n.getMessage("colorVariablesFiltered", [
        String(entries.length),
        String(allEntries.length),
      ])
    : chrome.i18n.getMessage("colorVariablesCount", [String(allEntries.length)]);

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

export function renderPickedColors(
  colors: string[],
  vars: Record<string, string>,
  resultsEl: HTMLDivElement,
  findMatches: (pickedHex: string, vars: Record<string, string>) => TieredMatches,
): void {
  resultsEl.innerHTML = "";

  for (const hex of colors) {
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

    const { exact, close, far } = findMatches(hex, vars);

    if (exact.length === 0 && close.length === 0 && far.length === 0) {
      const msg = document.createElement("p");
      msg.className = "no-matches-msg";
      msg.textContent = chrome.i18n.getMessage("noVariablesToCompare");
      resultsEl.appendChild(msg);
      continue;
    }

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
}

export function renderSavedLists(
  lists: Record<string, Record<string, string>>,
  activeList: string | null,
  savedListsEl: HTMLDivElement,
  callbacks: SavedListCallbacks,
  isColorValue: (value: string) => boolean,
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

    entry.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest(".saved-list-delete")) return;
      callbacks.onToggleList(name, isActive, vars);
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
    deleteBtn.ariaLabel = chrome.i18n.getMessage("deleteList", [name]);
    deleteBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M7 21q-.825 0-1.412-.587T5 19V6H4V4h5V3h6v1h5v2h-1v13q0 .825-.587 1.413T17 21zM17 6H7v13h10zM9 17h2V8H9zm4 0h2V8h-2zM7 6v13z"/></svg>';
    deleteBtn.addEventListener("click", () => {
      callbacks.onDeleteList(name, isActive);
    });

    entry.appendChild(nameEl);
    entry.appendChild(countEl);
    entry.appendChild(deleteBtn);
    savedListsEl.appendChild(entry);
  }
}

export function createMatchEntry(match: ColorMatch, tier: string): HTMLDivElement {
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

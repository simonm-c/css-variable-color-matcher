declare class EyeDropper {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
}

function scanDocument(doc: Document, vars: Record<string, string>): void {
  if (!doc.documentElement) return;

  // Map each --color-* property to the selectors that declare it
  const propSelectors = new Map<string, Set<string>>();

  for (const sheet of doc.styleSheets) {
    try {
      collectColorProps(sheet.cssRules, propSelectors);
    } catch {
      // Skip cross-origin stylesheets
    }
  }

  for (const [prop, selectors] of propSelectors) {
    if (vars[prop]) continue;

    // Try each selector that declares this property — resolve computed value
    // from an actual matching element so we get the right value regardless
    // of where it's set (root, body, wrapper div, theme class, etc.)
    for (const selector of selectors) {
      try {
        const el = doc.querySelector(selector);
        if (el) {
          const value = getComputedStyle(el).getPropertyValue(prop).trim();
          if (value) {
            vars[prop] = value;
            break;
          }
        }
      } catch {
        // Invalid selector — skip
      }
    }

    // Fallback: resolve against documentElement (catches inherited values)
    if (!vars[prop]) {
      const value = getComputedStyle(doc.documentElement).getPropertyValue(prop).trim();
      if (value) vars[prop] = value;
    }
  }

  // Scan inline styles on all elements — catches JS-injected variables
  // (e.g. theme providers that call element.style.setProperty)
  for (const el of doc.querySelectorAll("*")) {
    const style = (el as HTMLElement).style;
    if (!style) continue;
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      if (prop.startsWith("--color-") && !vars[prop]) {
        const value = style.getPropertyValue(prop).trim();
        if (value) vars[prop] = value;
      }
    }
  }
}

function scanDocumentWithIframes(doc: Document, vars: Record<string, string>): void {
  scanDocument(doc, vars);

  for (const iframe of doc.querySelectorAll("iframe")) {
    try {
      const iframeDoc = iframe.contentDocument;
      if (iframeDoc) scanDocumentWithIframes(iframeDoc, vars);
    } catch {
      // Cross-origin iframe — skip
    }
  }
}

function getColorVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  scanDocumentWithIframes(document, vars);
  return vars;
}

function collectColorProps(rules: CSSRuleList, out: Map<string, Set<string>>): void {
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      for (let i = 0; i < rule.style.length; i++) {
        const prop = rule.style[i];
        if (prop.startsWith("--color-")) {
          let selectors = out.get(prop);
          if (!selectors) {
            selectors = new Set();
            out.set(prop, selectors);
          }
          selectors.add(rule.selectorText);
        }
      }
    }
    // Recurse into nested rules (@media, @supports, @layer, etc.)
    if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules) {
      collectColorProps((rule as CSSGroupingRule).cssRules, out);
    }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "get-color-variables") {
    const vars = getColorVariables();
    chrome.storage.local.set({ colorVariables: vars });
    sendResponse({ colorVariables: vars });
    return;
  }

  if (message.action === "start-eyedropper") {
    const dropper = new EyeDropper();
    dropper
      .open()
      .then((result) => {
        const hex = result.sRGBHex;
        if (message.append) {
          chrome.storage.local.get("pickedColors", (data) => {
            const colors: string[] = data.pickedColors ?? [];
            colors.push(hex);
            chrome.storage.local.set({ pickedColors: colors });
            sendResponse({ color: hex });
          });
        } else {
          chrome.storage.local.set({ pickedColors: [hex] });
          sendResponse({ color: hex });
        }
      })
      .catch(() => {
        sendResponse({ color: null });
      });
    return true;
  }
});

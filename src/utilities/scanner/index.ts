// Self-contained scanning function injected into each frame via executeScript.
// Cannot reference external functions — must be fully standalone.
export function scanFrameColorVariables(): Record<string, string> {
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

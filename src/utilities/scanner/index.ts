import { parseCssCustomProperties, deduplicateVariables } from "../cssParser/index.js";
import type { ColorVariable } from "../cssParser/index.js";

export type { ColorVariable };

/**
 * Scan the current frame for CSS custom properties using two complementary approaches:
 * 1. CSS text parsing — reads <style> textContent and <link> stylesheet text,
 *    parsed via the shared parseCssCustomProperties() utility
 * 2. CSSOM walking + getComputedStyle — resolves var() references and picks up
 *    adopted stylesheets and inline styles
 *
 * Results are merged and deduplicated: same name + same value = one entry,
 * same name + different values = multiple entries.
 */
export function scanFrameColorVariables(): ColorVariable[] {
  if (!document.documentElement) return [];

  const textParsed = collectFromCssText();
  const cssomResolved = collectFromCssom();

  return deduplicateVariables([...textParsed, ...cssomResolved]);
}

// ── CSS text parsing (shared with import) ─────────────────────────

function collectFromCssText(): ColorVariable[] {
  const results: ColorVariable[] = [];

  // Parse <style> elements
  for (const style of document.querySelectorAll("style")) {
    if (style.textContent) {
      results.push(...parseCssCustomProperties(style.textContent));
    }
  }

  // Extract custom properties directly from <link> stylesheet rules
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
    if (link.sheet) {
      try {
        extractCustomPropsFromRules(link.sheet.cssRules, results);
      } catch {
        // Skip cross-origin stylesheets (cssRules access throws SecurityError)
      }
    }
  }

  return results;
}

function extractCustomPropsFromRules(rules: CSSRuleList, out: ColorVariable[]): void {
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      for (let i = 0; i < rule.style.length; i++) {
        const prop = rule.style[i];
        if (prop.startsWith("--")) {
          out.push({ name: prop, value: rule.style.getPropertyValue(prop).trim() });
        }
      }
    }
    if ("cssRules" in rule) {
      try {
        extractCustomPropsFromRules((rule as CSSGroupingRule).cssRules, out);
      } catch {
        // Skip inaccessible rules
      }
    }
  }
}

// ── CSSOM walking + getComputedStyle ──────────────────────────────

function collectFromCssom(): ColorVariable[] {
  const vars: Record<string, string> = {};
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
        if ("cssRules" in rule) {
          try {
            collectFromRules(rule.cssRules, rule.selectorText);
          } catch {
            // Skip inaccessible nested rules
          }
        }
      } else {
        // CSSNestedDeclarations — inherit parent selector
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
    if (!vars[prop]) {
      const value = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
      if (value) vars[prop] = value;
    }
  }

  // Walk all elements for unresolved stylesheet properties and inline custom properties
  const unresolved = new Set([...propSelectors.keys()].filter((p) => !vars[p]));

  for (const el of document.querySelectorAll("*")) {
    if (unresolved.size > 0) {
      const computed = getComputedStyle(el);
      for (const prop of unresolved) {
        const value = computed.getPropertyValue(prop).trim();
        if (value) {
          vars[prop] = value;
          unresolved.delete(prop);
        }
      }
    }

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

  return Object.entries(vars).map(([name, value]) => ({ name, value }));
}

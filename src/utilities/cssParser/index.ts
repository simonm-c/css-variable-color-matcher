export interface ColorVariable {
  name: string;
  value: string;
}

export function deduplicateVariables(vars: ColorVariable[]): ColorVariable[] {
  const seen = new Set<string>();
  const result: ColorVariable[] = [];
  for (const v of vars) {
    const key = `${v.name}\0${v.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(v);
    }
  }
  return result;
}

/**
 * Parse CSS text and extract all custom property declarations (--*).
 * Handles nested @-rules (@layer, @media, @supports, etc.) and strips comments.
 */
export function parseCssCustomProperties(cssText: string): ColorVariable[] {
  const result: ColorVariable[] = [];
  const text = stripComments(cssText);

  let i = 0;
  while (i < text.length) {
    // Skip whitespace
    if (isWhitespace(text[i])) {
      i++;
      continue;
    }

    // Skip @-rules keywords (but enter their blocks)
    if (text[i] === "@") {
      i = skipToBlockOrSemicolon(text, i);
      continue;
    }

    // Skip selector blocks — advance to opening brace
    if (text[i] === "{") {
      i++;
      continue;
    }

    // Closing brace
    if (text[i] === "}") {
      i++;
      continue;
    }

    // Try to read a declaration
    const decl = readDeclaration(text, i);
    if (decl) {
      if (decl.name.startsWith("--")) {
        result.push({ name: decl.name, value: decl.value });
      }
      i = decl.end;
      continue;
    }

    // Skip unrecognized characters (e.g. selectors)
    i = skipToNextDeclarationOrBlock(text, i);
  }

  return result;
}

function stripComments(text: string): string {
  const segments: string[] = [];
  let segStart = 0;
  let i = 0;
  while (i < text.length) {
    if (text[i] === "/" && text[i + 1] === "*") {
      segments.push(text.slice(segStart, i));
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        i++;
      }
      i += 2; // skip */
      segStart = i;
      continue;
    }
    // Skip string literals (don't strip "/*" inside strings)
    if (text[i] === '"' || text[i] === "'") {
      const quote = text[i];
      i++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === "\\") i++; // skip escaped char
        i++;
      }
      if (i < text.length) i++; // closing quote
      continue;
    }
    i++;
  }
  segments.push(text.slice(segStart, i));
  return segments.join("");
}

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function skipToBlockOrSemicolon(text: string, i: number): number {
  // Skip @-rule keyword and params until { or ;
  while (i < text.length) {
    if (text[i] === "{") {
      return i + 1; // enter the block
    }
    if (text[i] === ";") {
      return i + 1; // skip @import etc.
    }
    if (text[i] === '"' || text[i] === "'") {
      i = skipString(text, i);
      continue;
    }
    i++;
  }
  return i;
}

/**
 * Try to read a CSS declaration (property: value;) starting at position i.
 * Returns null if not positioned at a valid declaration start.
 */
function readDeclaration(
  text: string,
  start: number,
): { name: string; value: string; end: number } | null {
  // A declaration starts with a property name (letters, digits, hyphens)
  let i = start;

  // Read property name
  const nameStart = i;
  while (i < text.length && isPropertyChar(text[i])) {
    i++;
  }
  if (i === nameStart) return null;

  const name = text.slice(nameStart, i).trim();
  if (!name) return null;

  // Skip whitespace
  while (i < text.length && isWhitespace(text[i])) i++;

  // Expect colon
  if (text[i] !== ":") return null;
  i++; // skip :

  // Skip whitespace after colon
  while (i < text.length && isWhitespace(text[i])) i++;

  // Read value until ; or } (respecting strings and parens)
  const valueStart = i;
  let parenDepth = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      i = skipString(text, i);
      continue;
    }
    if (ch === "(") {
      parenDepth++;
      i++;
      continue;
    }
    if (ch === ")") {
      parenDepth--;
      i++;
      continue;
    }
    if (parenDepth === 0 && (ch === ";" || ch === "}")) {
      break;
    }
    i++;
  }

  const value = text.slice(valueStart, i).trim();
  if (!value) return null;

  // Skip the terminator
  if (i < text.length && text[i] === ";") i++;
  // Don't consume } — it's a block boundary

  return { name, value, end: i };
}

function isPropertyChar(ch: string): boolean {
  return (
    (ch >= "a" && ch <= "z") ||
    (ch >= "A" && ch <= "Z") ||
    (ch >= "0" && ch <= "9") ||
    ch === "-" ||
    ch === "_"
  );
}

function skipString(text: string, i: number): number {
  const quote = text[i];
  i++; // skip opening quote
  while (i < text.length && text[i] !== quote) {
    if (text[i] === "\\") i++; // skip escaped char
    i++;
  }
  if (i < text.length) i++; // skip closing quote
  return i;
}

function skipToNextDeclarationOrBlock(text: string, i: number): number {
  // Skip forward until we hit something meaningful: ; { } or a property-like start
  while (i < text.length) {
    const ch = text[i];
    if (ch === ";" || ch === "{" || ch === "}") {
      if (ch === ";") return i + 1;
      return i; // let the main loop handle { and }
    }
    if (ch === ":") {
      // We might be in a selector with pseudo-class. Skip to { or ;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      i = skipString(text, i);
      continue;
    }
    i++;
  }
  return i;
}

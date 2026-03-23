// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportListAsCss, triggerCssFileImport } from "../index.ts";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("exportListAsCss", () => {
  it("generates correct CSS and triggers download", () => {
    const clickSpy = vi.fn();
    const createElementOrig = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = createElementOrig(tag);
      if (tag === "a") {
        el.click = clickSpy;
      }
      return el;
    });

    const revokeUrl = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: revokeUrl,
    });

    exportListAsCss("my-tokens", [
      { name: "--color-red", value: "#ff0000" },
      { name: "--color-blue", value: "#0000ff" },
    ]);

    expect(clickSpy).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith("blob:mock-url");
  });
});

describe("triggerCssFileImport", () => {
  it("creates a file input and calls onLoaded with parsed vars", async () => {
    const onLoaded = vi.fn();
    const cssText = `:root { --brand: #1a73e8; }`;

    // Mock FileReader as a class
    const mockReader = {
      readAsText: vi.fn(),
      result: cssText,
      onload: null as (() => void) | null,
    };
    vi.stubGlobal(
      "FileReader",
      class {
        result = mockReader.result;
        onload: (() => void) | null = null;
        readAsText = vi.fn(function (this: { onload: (() => void) | null }) {
          mockReader.readAsText(...arguments);
          // Store onload reference for later triggering
          mockReader.onload = this.onload;
        });
        constructor() {
          // Capture reference so test can trigger onload
          setTimeout(() => {
            mockReader.onload = this.onload;
          }, 0);
          return Object.assign(this, { result: mockReader.result });
        }
      },
    );

    triggerCssFileImport(onLoaded);

    // Find the injected input
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.accept).toBe(".css,text/css");

    // Simulate file selection
    const file = new File([cssText], "tokens.css", { type: "text/css" });
    Object.defineProperty(input, "files", { value: [file] });
    input.dispatchEvent(new Event("change"));

    // Trigger FileReader onload
    expect(mockReader.readAsText).toHaveBeenCalledWith(file);
    mockReader.onload!();

    expect(onLoaded).toHaveBeenCalledWith("tokens", [{ name: "--brand", value: "#1a73e8" }]);
  });
});

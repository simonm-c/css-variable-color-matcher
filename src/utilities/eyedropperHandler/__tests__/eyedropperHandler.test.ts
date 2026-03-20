import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChromeMock } from "../../../../test/chrome-mock.ts";

describe("eyedropperHandler — eyedropper message listener", () => {
  let chromeMock: ReturnType<typeof createChromeMock>;
  let messageListener: (
    message: Record<string, unknown>,
    sender: unknown,
    sendResponse: (response: unknown) => void,
  ) => boolean | undefined;

  beforeEach(async () => {
    chromeMock = createChromeMock();
    (globalThis as Record<string, unknown>).chrome = chromeMock;

    // Mock EyeDropper
    (globalThis as Record<string, unknown>).EyeDropper = class {
      open() {
        return Promise.resolve({ sRGBHex: "#abcdef" });
      }
    };

    // Reset modules so content.ts re-registers its listener
    vi.resetModules();
    await import("../index.ts");

    // Capture the registered listener
    messageListener = chromeMock.runtime.onMessage.addListener.mock.calls[0][0];
  });

  it("registers a message listener", () => {
    expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledOnce();
  });

  it("returns true for start-eyedropper to keep channel open", () => {
    const sendResponse = vi.fn();
    const result = messageListener({ action: "start-eyedropper", append: false }, {}, sendResponse);
    expect(result).toBe(true);
  });

  it("sets pickedColors to [hex] in replace mode", async () => {
    const sendResponse = vi.fn();
    messageListener({ action: "start-eyedropper", append: false }, {}, sendResponse);

    // Wait for async resolution
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    expect(sendResponse).toHaveBeenCalledWith({ color: "#abcdef" });
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ pickedColors: ["#abcdef"] });
  });

  it("appends hex in append mode", async () => {
    chromeMock._setStorage({ pickedColors: ["#111111"] });
    const sendResponse = vi.fn();
    messageListener({ action: "start-eyedropper", append: true }, {}, sendResponse);

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());

    expect(sendResponse).toHaveBeenCalledWith({ color: "#abcdef" });
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      pickedColors: ["#111111", "#abcdef"],
    });
  });

  it("sends null color when EyeDropper rejects", async () => {
    (globalThis as Record<string, unknown>).EyeDropper = class {
      open() {
        return Promise.reject(new Error("User cancelled"));
      }
    };

    vi.resetModules();
    await import("../index.ts");
    const listener = chromeMock.runtime.onMessage.addListener.mock.calls[1][0];

    const sendResponse = vi.fn();
    listener({ action: "start-eyedropper", append: false }, {}, sendResponse);

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(sendResponse).toHaveBeenCalledWith({ color: null });
  });

  it("does nothing for unrelated message actions", () => {
    const sendResponse = vi.fn();
    const result = messageListener({ action: "something-else" }, {}, sendResponse);
    expect(result).toBeUndefined();
    expect(sendResponse).not.toHaveBeenCalled();
  });
});

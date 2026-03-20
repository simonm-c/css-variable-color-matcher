import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChromeMock } from "../../../../test/chrome-mock.ts";

describe("panelWindowManager — panel window management", () => {
  let chromeMock: ReturnType<typeof createChromeMock>;
  let messageListener: (
    message: Record<string, unknown>,
    sender: unknown,
    sendResponse: (response: unknown) => void,
  ) => unknown;
  let windowRemovedListener: (windowId: number) => void;

  beforeEach(async () => {
    chromeMock = createChromeMock();
    (globalThis as Record<string, unknown>).chrome = chromeMock;

    vi.resetModules();
    await import("../index.ts");

    messageListener = chromeMock.runtime.onMessage.addListener.mock.calls[0][0];
    windowRemovedListener = chromeMock.windows.onRemoved.addListener.mock.calls[0][0];
  });

  it("registers message and window-removed listeners", () => {
    expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledOnce();
    expect(chromeMock.windows.onRemoved.addListener).toHaveBeenCalledOnce();
  });

  it("creates a popup window on open-panel message", async () => {
    messageListener({ action: "open-panel" }, {}, vi.fn());

    // Wait for async openPanel()
    await vi.waitFor(() => expect(chromeMock.windows.create).toHaveBeenCalled());

    expect(chromeMock.windows.create).toHaveBeenCalledWith({
      url: "popup.html",
      type: "popup",
      width: 400,
      height: 600,
    });
  });

  it("focuses existing window on second open-panel", async () => {
    // First open
    messageListener({ action: "open-panel" }, {}, vi.fn());
    await vi.waitFor(() => expect(chromeMock.windows.create).toHaveBeenCalled());

    // Second open — should focus, not create
    messageListener({ action: "open-panel" }, {}, vi.fn());
    await vi.waitFor(() => expect(chromeMock.windows.update).toHaveBeenCalled());

    expect(chromeMock.windows.update).toHaveBeenCalledWith(1, { focused: true });
    expect(chromeMock.windows.create).toHaveBeenCalledTimes(1);
  });

  it("creates new window when focus fails (window was closed externally)", async () => {
    // First open
    messageListener({ action: "open-panel" }, {}, vi.fn());
    await vi.waitFor(() => expect(chromeMock.windows.create).toHaveBeenCalled());

    // Make update throw (simulating externally closed window)
    chromeMock.windows.update.mockRejectedValueOnce(new Error("No window"));

    messageListener({ action: "open-panel" }, {}, vi.fn());
    await vi.waitFor(() => expect(chromeMock.windows.create).toHaveBeenCalledTimes(2));
  });

  it("clears panelWindowId when matching window is removed", async () => {
    // Open panel (gets window ID 1)
    messageListener({ action: "open-panel" }, {}, vi.fn());
    await vi.waitFor(() => expect(chromeMock.windows.create).toHaveBeenCalled());

    // Simulate window removal
    windowRemovedListener(1);

    // Next open should create, not update
    messageListener({ action: "open-panel" }, {}, vi.fn());
    await vi.waitFor(() => expect(chromeMock.windows.create).toHaveBeenCalledTimes(2));
    expect(chromeMock.windows.update).not.toHaveBeenCalled();
  });

  it("ignores removal of non-matching window ID", async () => {
    // Open panel (gets window ID 1)
    messageListener({ action: "open-panel" }, {}, vi.fn());
    await vi.waitFor(() => expect(chromeMock.windows.create).toHaveBeenCalled());

    // Remove a different window
    windowRemovedListener(999);

    // Next open should focus existing, not create new
    messageListener({ action: "open-panel" }, {}, vi.fn());
    await vi.waitFor(() => expect(chromeMock.windows.update).toHaveBeenCalled());
    expect(chromeMock.windows.create).toHaveBeenCalledTimes(1);
  });

  it("does nothing for non-open-panel messages", () => {
    const result = messageListener({ action: "something-else" }, {}, vi.fn());
    expect(result).toBeUndefined();
    expect(chromeMock.windows.create).not.toHaveBeenCalled();
  });
});

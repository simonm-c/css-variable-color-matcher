import { vi } from "vitest";

export function createChromeMock() {
  let storage: Record<string, unknown> = {};

  const mock = {
    storage: {
      local: {
        get: vi.fn((keys: string | string[], cb?: (data: Record<string, unknown>) => void) => {
          const result: Record<string, unknown> = {};
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const k of keyList) {
            if (k in storage) result[k] = storage[k];
          }
          if (cb) {
            cb(result);
            return undefined;
          }
          return Promise.resolve(result);
        }),
        set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
          Object.assign(storage, items);
          if (cb) {
            cb();
            return undefined;
          }
          return Promise.resolve();
        }),
      },
      onChanged: {
        addListener: vi.fn(),
      },
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue([]),
    },
    runtime: {
      onMessage: {
        addListener: vi.fn(),
      },
      sendMessage: vi.fn(),
    },
    windows: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({}),
      onRemoved: {
        addListener: vi.fn(),
      },
    },
    _resetStorage() {
      storage = {};
    },
    _setStorage(data: Record<string, unknown>) {
      storage = { ...data };
    },
  };

  return mock;
}

export type ChromeMock = ReturnType<typeof createChromeMock>;

import { afterEach, describe, expect, it } from "vitest"

import { MemoryStorage, ReactNativeStorage, WebStorage, type AsyncStorageLike } from "./storage"

/** Minimal localStorage stand-in whose write behavior we can flip per test. */
class FakeLocalStorage {
  private store = new Map<string, string>()
  constructor(private readonly mode: "ok" | "throw" | "silent-drop") {}
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    if (this.mode === "throw") throw new DOMExceptionLike("QuotaExceededError")
    if (this.mode === "silent-drop") return // accepts the call but never persists
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
}

class DOMExceptionLike extends Error {}

function withLocalStorage(value: FakeLocalStorage | undefined, run: () => void): void {
  const holder = globalThis as { localStorage?: unknown }
  const had = "localStorage" in holder
  const prev = holder.localStorage
  if (value === undefined) delete holder.localStorage
  else holder.localStorage = value
  try {
    run()
  } finally {
    if (had) holder.localStorage = prev
    else delete holder.localStorage
  }
}

describe("MemoryStorage", () => {
  it("is never persistent", () => {
    expect(new MemoryStorage().isPersistent).toBe(false)
  })
})

describe("WebStorage persistence probe", () => {
  afterEach(() => {
    const holder = globalThis as { localStorage?: unknown }
    delete holder.localStorage
  })

  it("isPersistent=true when localStorage round-trips a sentinel", () => {
    withLocalStorage(new FakeLocalStorage("ok"), () => {
      expect(new WebStorage().isPersistent).toBe(true)
    })
  })

  it("isPersistent=false when localStorage throws (private mode / quota)", () => {
    withLocalStorage(new FakeLocalStorage("throw"), () => {
      const storage = new WebStorage()
      expect(storage.isPersistent).toBe(false)
      // Writes still succeed via the in-memory fallback, so the SDK keeps working —
      // it just won't auto-fire installs from a volatile store.
      storage.set("k", "v")
      expect(storage.get("k")).toBe("v")
    })
  })

  it("isPersistent=false when localStorage silently drops writes", () => {
    withLocalStorage(new FakeLocalStorage("silent-drop"), () => {
      expect(new WebStorage().isPersistent).toBe(false)
    })
  })

  it("isPersistent=false when localStorage is absent (SSR / Node)", () => {
    withLocalStorage(undefined, () => {
      expect(new WebStorage().isPersistent).toBe(false)
    })
  })
})

describe("ReactNativeStorage persistence probe", () => {
  const makeAsync = (mode: "ok" | "throw" | "silent-drop"): AsyncStorageLike => {
    const store = new Map<string, string>()
    return {
      async getItem(key) { return store.get(key) ?? null },
      async setItem(key, value) {
        if (mode === "throw") throw new Error("AsyncStorage unavailable")
        if (mode === "silent-drop") return
        store.set(key, value)
      },
    }
  }

  it("probePersistence true when AsyncStorage round-trips a sentinel", async () => {
    expect(await new ReactNativeStorage(makeAsync("ok")).probePersistence()).toBe(true)
  })

  it("probePersistence false when AsyncStorage rejects writes", async () => {
    expect(await new ReactNativeStorage(makeAsync("throw")).probePersistence()).toBe(false)
  })

  it("probePersistence false when AsyncStorage silently drops writes", async () => {
    expect(await new ReactNativeStorage(makeAsync("silent-drop")).probePersistence()).toBe(false)
  })
})

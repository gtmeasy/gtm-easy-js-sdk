import type { GrowthStorage } from "./types"

/** In-memory storage. Only sensible for short-lived processes (cron, edge functions). */
export class MemoryStorage implements GrowthStorage {
  // Volatile: the SDK must not auto-fire `app.first_open` from a store that resets every
  // cold start (would spam installs on every server/serverless restart).
  readonly isPersistent = false
  private store = new Map<string, string>()
  get(key: string): string | null { return this.store.get(key) ?? null }
  set(key: string, value: string): void { this.store.set(key, value) }
}

/** Wrap browser localStorage. Falls back to in-memory if quota/private mode blocks writes. */
export class WebStorage implements GrowthStorage {
  /**
   * Whether durable storage actually works in this context — probed once at construction.
   * Crucially NOT hardcoded `true`: Safari Private Browsing, exhausted quota, and strict
   * privacy modes make every `localStorage` write throw, silently demoting us to the
   * in-memory fallback. If we still advertised `true`, the install gate in
   * `resolveLaunch` would be defeated and `app.first_open` would re-fire on every cold
   * page load. Probing keeps a blocked store honestly volatile.
   */
  readonly isPersistent: boolean
  private fallback = new MemoryStorage()
  constructor() {
    this.isPersistent = WebStorage.probePersistence()
  }
  /** Round-trip a sentinel through localStorage; durable only if it survives. */
  private static probePersistence(): boolean {
    try {
      const ls = globalThis.localStorage
      if (!ls) return false
      const probe = "__gtm_easy_growth_persist_probe__"
      ls.setItem(probe, "1")
      const survived = ls.getItem(probe) === "1"
      ls.removeItem(probe)
      return survived
    } catch {
      return false
    }
  }
  get(key: string): string | null {
    try { return globalThis.localStorage?.getItem(key) ?? this.fallback.get(key) }
    catch { return this.fallback.get(key) }
  }
  set(key: string, value: string): void {
    try { globalThis.localStorage?.setItem(key, value) }
    catch { this.fallback.set(key, value) }
  }
}

export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

/** Wrap React Native AsyncStorage. */
export class ReactNativeStorage implements GrowthStorage {
  // Optimistic default; the authoritative answer comes from the async `probePersistence`
  // round-trip below, since AsyncStorage can't be probed synchronously at construction.
  readonly isPersistent = true
  constructor(private readonly asyncStorage: AsyncStorageLike) {}
  async get(key: string): Promise<string | null> {
    try { return await this.asyncStorage.getItem(key) } catch { return null }
  }
  async set(key: string, value: string): Promise<void> {
    try { await this.asyncStorage.setItem(key, value) } catch { /* ignore */ }
  }
  /**
   * Round-trip a sentinel through AsyncStorage; durable only if it survives. A store that
   * rejects writes (or drops them) returns `false`, so the install gate stays honestly
   * volatile instead of re-firing `app.first_open` on every cold start. Mirrors
   * `WebStorage.probePersistence`, but async because AsyncStorage is.
   */
  async probePersistence(): Promise<boolean> {
    const probe = "__gtm_easy_growth_persist_probe__"
    try {
      await this.asyncStorage.setItem(probe, "1")
      return (await this.asyncStorage.getItem(probe)) === "1"
    } catch {
      return false
    }
  }
}

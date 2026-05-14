import type { GrowthStorage } from "./types"

/** In-memory storage. Only sensible for short-lived processes (cron, edge functions). */
export class MemoryStorage implements GrowthStorage {
  private store = new Map<string, string>()
  get(key: string): string | null { return this.store.get(key) ?? null }
  set(key: string, value: string): void { this.store.set(key, value) }
}

/** Wrap browser localStorage. Falls back to in-memory if quota/private mode blocks writes. */
export class WebStorage implements GrowthStorage {
  private fallback = new MemoryStorage()
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
  constructor(private readonly asyncStorage: AsyncStorageLike) {}
  async get(key: string): Promise<string | null> {
    try { return await this.asyncStorage.getItem(key) } catch { return null }
  }
  async set(key: string, value: string): Promise<void> {
    try { await this.asyncStorage.setItem(key, value) } catch { /* ignore */ }
  }
}

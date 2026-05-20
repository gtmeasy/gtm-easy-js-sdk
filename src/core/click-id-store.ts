import type { GrowthStorage } from "./types"

/**
 * Persisted click identifiers captured from inbound URLs, deep links, or
 * native bridge SDKs. Same TTL as Meta `_fbc` / TikTok `ttclid` (90 days).
 *
 * Storage is pluggable so web uses localStorage, RN uses AsyncStorage, and
 * tests can pass an in-memory implementation.
 */

export const CLICK_PROVIDERS = [
  "fbc",
  "fbp",
  "fbclid",
  "gclid",
  "wbraid",
  "gbraid",
  "ttclid",
  "igshid",
  "msclkid",
  "twclid",
] as const

export type ClickProvider = (typeof CLICK_PROVIDERS)[number]

const PREFIX = "gtm_easy_growth_click_"
const DEFAULT_TTL_MS = 90 * 24 * 60 * 60 * 1000

export interface ClickRecord {
  value: string
  ts: number
}

export class GrowthClickIdStore {
  private readonly storage: GrowthStorage
  // Concurrent first-call writes for `_fbp` would generate distinct values,
  // splitting Meta's identity match. The in-flight promise serialises them so
  // every caller observes the same persisted value.
  private fbpInFlight: Promise<string> | null = null

  constructor(storage: GrowthStorage) {
    this.storage = storage
  }

  async record(provider: ClickProvider, value: string, at: number = Date.now()): Promise<void> {
    const trimmed = value.trim()
    if (!trimmed) return
    const payload = JSON.stringify({ value: trimmed, ts: at })
    await Promise.resolve(this.storage.set(key(provider), payload))
  }

  async current(provider: ClickProvider, ttlMs: number = DEFAULT_TTL_MS, now: number = Date.now()): Promise<string | null> {
    const raw = await Promise.resolve(this.storage.get(key(provider)))
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as ClickRecord
      if (!parsed.value) return null
      if (ttlMs !== Number.POSITIVE_INFINITY && now - parsed.ts > ttlMs) return null
      return parsed.value
    } catch {
      return null
    }
  }

  async clear(provider: ClickProvider): Promise<void> {
    await Promise.resolve(this.storage.set(key(provider), ""))
  }

  /** Build Meta's `_fbc` value from an inbound fbclid. Spec: `fb.1.{ts_ms}.{fbclid}`. */
  async ensureFbc(fbclid: string, at: number = Date.now()): Promise<string | null> {
    if (!fbclid) return null
    const fbc = `fb.1.${at}.${fbclid}`
    await this.record("fbc", fbc, at)
    return fbc
  }

  /** Meta's persistent `_fbp` per install. `fb.1.{ts_ms}.{rand}` — set once, never rotates. */
  async ensureFbp(now: number = Date.now()): Promise<string> {
    if (this.fbpInFlight) return this.fbpInFlight
    this.fbpInFlight = (async () => {
      const existing = await this.current("fbp", Number.POSITIVE_INFINITY, now)
      if (existing) return existing
      const rand = Math.floor(Math.random() * (Number.MAX_SAFE_INTEGER - 1_000_000_000)) + 1_000_000_000
      const value = `fb.1.${now}.${rand}`
      await this.record("fbp", value, now)
      return value
    })()
    try {
      return await this.fbpInFlight
    } finally {
      this.fbpInFlight = null
    }
  }

  /** Walk a URL search string, persist any known click ids. Returns the count captured. */
  async captureFromQuery(query: string | URLSearchParams, at: number = Date.now()): Promise<number> {
    const params = query instanceof URLSearchParams ? query : new URLSearchParams(query)
    let count = 0
    for (const [name, value] of params.entries()) {
      if (!value) continue
      const lc = name.toLowerCase()
      if (lc === "fbclid") {
        await this.record("fbclid", value, at)
        await this.ensureFbc(value, at)
        count++
      } else if ((CLICK_PROVIDERS as readonly string[]).includes(lc) && lc !== "fbc" && lc !== "fbp") {
        await this.record(lc as ClickProvider, value, at)
        count++
      }
    }
    return count
  }

  async snapshot(now: number = Date.now()): Promise<Record<string, string>> {
    const out: Record<string, string> = {}
    for (const provider of CLICK_PROVIDERS) {
      const v = await this.current(provider, DEFAULT_TTL_MS, now)
      if (v) out[provider] = v
    }
    // Always synthesize fbp — once set, never rotates.
    out.fbp = await this.ensureFbp(now)
    return out
  }
}

function key(provider: ClickProvider): string {
  return `${PREFIX}${provider}`
}

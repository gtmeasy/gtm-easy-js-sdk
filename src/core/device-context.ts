import type { JsonValue } from "./types"

/** Alias kept for readability — the JS SDK uses `JsonValue` for any structured property. */
type GrowthJSONValue = JsonValue

/**
 * Pluggable device-context provider. On Web this returns navigator info; on
 * React Native the host app supplies an implementation that bridges to
 * platform-native APIs (IDFA via `react-native-tracking-transparency`, GAID
 * via `react-native-google-mobile-ads-identifier`, etc.).
 *
 * The SDK calls `current()` on every event — keep it cheap.
 */
export interface DeviceContextProvider {
  current(): Promise<Record<string, GrowthJSONValue>> | Record<string, GrowthJSONValue>
}

/** Empty provider — used when the platform has nothing useful (Node ingest worker). */
export const emptyDeviceContextProvider: DeviceContextProvider = {
  current: () => ({}),
}

/**
 * Device language / timezone snapshot (Foundation-equivalent for JS).
 * First-class ingest fields use `locale` (BCP-47) + `timezone` (IANA); a denser
 * copy is mirrored under `properties._ctx`.
 */
export interface SystemContext {
  locale: string | null
  timezone: string | null
  region: string | null
  language: string | null
  utcOffsetMinutes: number | null
  preferredLanguages: string[]
}

export function captureSystemContext(): SystemContext {
  const locale = resolveLocale()
  const timezone = resolveTimezone()
  const preferredLanguages = resolvePreferredLanguages()
  const language = locale ? locale.split("-")[0] ?? null : null
  const region = locale ? locale.split("-").slice(1).find((p) => p.length === 2 && p === p.toUpperCase()) ?? null : null
  return {
    locale,
    timezone,
    region,
    language,
    utcOffsetMinutes: resolveUtcOffsetMinutes(),
    preferredLanguages,
  }
}

/** Flatten into `_ctx` keys (snake_case, stable contract across SDKs). */
export function systemContextAsProperties(sys: SystemContext = captureSystemContext()): Record<string, GrowthJSONValue> {
  const out: Record<string, GrowthJSONValue> = {}
  if (sys.locale) out.locale = sys.locale
  if (sys.timezone) out.timezone = sys.timezone
  if (sys.region) out.region = sys.region
  if (sys.language) out.language = sys.language
  if (sys.utcOffsetMinutes != null) out.utc_offset_min = sys.utcOffsetMinutes
  if (sys.preferredLanguages.length > 0) out.preferred_languages = sys.preferredLanguages
  return out
}

function resolveLocale(): string | null {
  try {
    const lang = (globalThis as { navigator?: { language?: string } }).navigator?.language
    if (lang) return lang.replace(/_/g, "-")
  } catch { /* ignore */ }
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().locale
    return resolved ? resolved.replace(/_/g, "-") : null
  } catch {
    return null
  }
}

function resolveTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  } catch {
    return null
  }
}

function resolvePreferredLanguages(): string[] {
  try {
    const langs = (globalThis as { navigator?: { languages?: readonly string[] } }).navigator?.languages
    if (langs && langs.length > 0) return langs.slice(0, 5).map((l) => l.replace(/_/g, "-"))
  } catch { /* ignore */ }
  const single = resolveLocale()
  return single ? [single] : []
}

function resolveUtcOffsetMinutes(): number | null {
  try {
    // getTimezoneOffset is minutes *behind* UTC; invert for offset *from* UTC.
    return -new Date().getTimezoneOffset()
  } catch {
    return null
  }
}

/** Browser provider — collects UA-ish bits that are NOT click ids. */
export const webDeviceContextProvider: DeviceContextProvider = {
  current() {
    const out: Record<string, GrowthJSONValue> = {}
    if (typeof navigator !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ua = (navigator as any).userAgentData
      if (ua && Array.isArray(ua.brands)) {
        out.ua_brands = ua.brands.map((b: { brand: string }) => b.brand).join(",")
      }
      if (navigator.userAgent) out.user_agent = navigator.userAgent
      if (navigator.language) out.browser_language = navigator.language
      if (typeof navigator.hardwareConcurrency === "number") {
        out.hw_concurrency = navigator.hardwareConcurrency
      }
    }
    if (typeof screen !== "undefined") {
      out.screen_w = screen.width
      out.screen_h = screen.height
    }
    if (typeof window !== "undefined") {
      out.viewport_w = window.innerWidth
      out.viewport_h = window.innerHeight
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dpr = (window as any).devicePixelRatio
      if (typeof dpr === "number") out.dpr = dpr
    }
    // System locale/tz also live under _ctx (shared with native SDKs).
    Object.assign(out, systemContextAsProperties())
    return out
  },
}

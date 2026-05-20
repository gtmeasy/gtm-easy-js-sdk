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
    return out
  },
}

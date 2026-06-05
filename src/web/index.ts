import { createGrowthAnalyticsCore } from "../core/analytics"
import { GrowthClickIdStore } from "../core/click-id-store"
import { webDeviceContextProvider } from "../core/device-context"
import { WebStorage } from "../core/storage"
import type { GrowthAnalytics, GrowthAnalyticsConfiguration } from "../core/types"

// Survey capture is runtime-neutral — re-export the helpers + types so a web
// consumer imports them from this one subpath (the skills forbid bare-root imports).
export { surveyAnswer, trackSurveyShown, trackSurveyStarted } from "../core/survey-events"
export type { SurveyLifecycleArgs } from "../core/survey-events"
export type { SurveyAnswer, SubmitSurveyArgs, SurveySubmitResponse, SurveyResponseStatus } from "../core/types"

export type WebGrowthAnalyticsConfiguration = Omit<GrowthAnalyticsConfiguration, "platform" | "storage"> & {
  platform?: GrowthAnalyticsConfiguration["platform"]
  storage?: GrowthAnalyticsConfiguration["storage"]
}

/**
 * Create a GrowthAnalytics instance for browsers. Persists the anonymous id
 * in localStorage (with an in-memory fallback for private mode / quota).
 */
export function createGrowthAnalytics(config: WebGrowthAnalyticsConfiguration): GrowthAnalytics {
  const storage = config.storage ?? new WebStorage()
  return createGrowthAnalyticsCore({
    ...config,
    platform: config.platform ?? "web",
    storage,
    deviceContext: config.deviceContext ?? webDeviceContextProvider,
    clickIdStore: config.clickIdStore ?? new GrowthClickIdStore(storage),
  })
}

export interface AutoInstrumentationOptions {
  /** Fire `page.viewed` on initial load and on every History API navigation. */
  trackPageViews?: boolean
  /** Fire `button.clicked` on clicks targeting elements with `data-gtm-event`. */
  trackClicks?: boolean
  /** Capture utm_* + gclid / fbclid params on initial load and call submitWebReferrer. */
  trackReferrer?: boolean
  /**
   * Call `trackFirstOpenIfNeeded()` on load. **Default false** — browsers have no real
   * "install"; when enabled this counts the first localStorage write per browser profile
   * as an install (and private-mode sessions can repeat). Leave off for normal web apps.
   */
  trackInstall?: boolean
}

/**
 * Lightweight auto-instrumentation for SPAs. Safe to call on the client only —
 * silently no-ops when window is undefined (SSR).
 */
export function installAutoInstrumentation(
  analytics: GrowthAnalytics,
  options: AutoInstrumentationOptions = {},
): () => void {
  if (typeof window === "undefined") return () => {}
  const cleanup: Array<() => void> = []
  const referrerEnabled = options.trackReferrer ?? true
  const params = new URLSearchParams(window.location.search)

  // Persist inbound click IDs (gclid/fbclid/…) FIRST so an opt-in install event — the
  // event that most needs acquisition context — carries them in its _ctx, even on a
  // fresh browser profile where they aren't in storage yet. The submitWebReferrer call
  // below reuses this same capture rather than re-reading the params.
  const clickIdsCaptured: Promise<void> = referrerEnabled
    ? analytics.captureClickIds(params).then(() => {}, () => {})
    : Promise.resolve()

  if (options.trackInstall ?? false) {
    clickIdsCaptured.then(() => analytics.trackFirstOpenIfNeeded()).catch(() => { /* swallow */ })
  }

  if (options.trackPageViews ?? true) {
    const fire = () => {
      analytics.track("page.viewed", {
        path: window.location.pathname,
        search: window.location.search || null,
        title: typeof document !== "undefined" ? document.title : null,
      }).catch(() => { /* swallow */ })
    }
    fire()
    const wrap = (key: "pushState" | "replaceState") => {
      const original = history[key]
      history[key] = function (this: History, ...args: Parameters<typeof original>) {
        const result = original.apply(this, args)
        fire()
        return result
      } as typeof original
      return () => { history[key] = original }
    }
    cleanup.push(wrap("pushState"))
    cleanup.push(wrap("replaceState"))
    const onPop = () => fire()
    window.addEventListener("popstate", onPop)
    cleanup.push(() => window.removeEventListener("popstate", onPop))
  }

  if (options.trackClicks ?? false) {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-gtm-event]") : null
      if (!target) return
      const eventName = target.dataset.gtmEvent ?? "button.clicked"
      const properties: Record<string, string | null> = {}
      for (const attr of Array.from(target.attributes)) {
        if (attr.name.startsWith("data-gtm-prop-")) {
          properties[attr.name.slice("data-gtm-prop-".length)] = attr.value || null
        }
      }
      analytics.track(eventName, properties).catch(() => { /* swallow */ })
    }
    window.addEventListener("click", onClick, { capture: true })
    cleanup.push(() => window.removeEventListener("click", onClick, { capture: true }))
  }

  if (referrerEnabled) {
    try {
      // Click ids were already persisted up front (see clickIdsCaptured) so the install
      // event sees them; here we only need to fire the referrer submission for utm landings.
      const utm = Array.from(params.entries()).filter(([k]) => k.startsWith("utm_") || k === "gclid" || k === "fbclid" || k === "ttclid")
      if (utm.length) {
        const clickId = params.get("gclid") ?? params.get("fbclid") ?? params.get("ttclid")
        analytics.submitWebReferrer(window.location.href, clickId).catch(() => { /* swallow */ })
      }
    } catch { /* ignore */ }
  }

  return () => { for (const fn of cleanup) fn() }
}

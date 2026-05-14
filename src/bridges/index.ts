import type { GrowthAnalytics, GrowthBridge, GrowthEventProperties } from "../core/types"

/**
 * Structural type of the Microsoft Clarity global. We never import the package —
 * just describe what we use so TypeScript can type-check call sites.
 *
 * https://learn.microsoft.com/en-us/clarity/setup-and-installation/identify-api
 */
export interface ClarityLike {
  (method: "identify", customId: string, customSessionId?: string, customPageId?: string, friendlyName?: string): void
  (method: "set", key: string, value: string): void
  (method: "event", event: string): void
  (method: "consent"): void
  (method: "upgrade", reason: string): void
}

/**
 * Structural type of the PostHog JS / RN SDK we use.
 *
 * https://posthog.com/docs/libraries/js
 */
export interface PostHogLike {
  identify(userId: string, properties?: Record<string, unknown>): void
  capture(event: string, properties?: Record<string, unknown>): void
  reset?(): void
}

/**
 * Structural type for the Sentry JS / RN SDK.
 *
 * https://docs.sentry.io/platforms/javascript/enriching-events/identify-user/
 */
export interface SentryLike {
  setUser(user: { id?: string; username?: string; email?: string; [k: string]: unknown } | null): void
  addBreadcrumb(breadcrumb: {
    message?: string
    category?: string
    level?: "fatal" | "error" | "warning" | "log" | "info" | "debug"
    data?: Record<string, unknown>
  }): void
}

/**
 * Structural type for the Statsig JS / RN client SDK.
 *
 * https://docs.statsig.com/client/jsClientSDK
 */
export interface StatsigLike {
  updateUser(user: { userID?: string; email?: string; custom?: Record<string, unknown> }): Promise<unknown>
  logEvent(eventName: string, value?: string | number | null, metadata?: Record<string, unknown>): void
}

/**
 * Install a Microsoft Clarity bridge. Returns a function that removes the bridge.
 */
export function installClarityBridge(analytics: GrowthAnalytics, clarity: ClarityLike): () => void {
  return analytics.addBridge({
    name: "clarity",
    onIdentify({ userId, anonymousId, traits }) {
      const id = userId ?? anonymousId
      safe(() => clarity("identify", id))
      for (const [key, value] of Object.entries(traits)) {
        if (value == null) continue
        safe(() => clarity("set", key, String(value)))
      }
    },
    onTrack({ eventName }) {
      safe(() => clarity("event", eventName))
    },
  })
}

export function installPostHogBridge(analytics: GrowthAnalytics, posthog: PostHogLike): () => void {
  return analytics.addBridge({
    name: "posthog",
    onIdentify({ userId, anonymousId, traits }) {
      safe(() => posthog.identify(userId ?? anonymousId, traits))
    },
    onTrack({ eventName, properties }) {
      safe(() => posthog.capture(eventName, properties))
    },
  })
}

export function installSentryBridge(analytics: GrowthAnalytics, sentry: SentryLike): () => void {
  return analytics.addBridge({
    name: "sentry",
    onIdentify({ userId, anonymousId, traits }) {
      const id = userId ?? anonymousId
      safe(() => sentry.setUser({ id, ...flatten(traits) }))
    },
    onTrack({ eventName, properties }) {
      safe(() =>
        sentry.addBreadcrumb({
          category: "gtm-easy",
          level: "info",
          message: eventName,
          data: properties,
        }),
      )
    },
  })
}

export function installStatsigBridge(analytics: GrowthAnalytics, statsig: StatsigLike): () => void {
  return analytics.addBridge({
    name: "statsig",
    onIdentify({ userId, anonymousId, traits }) {
      safe(() => statsig.updateUser({ userID: userId ?? anonymousId, custom: flatten(traits) }))
    },
    onTrack({ eventName, properties }) {
      // Use metric value from "metricValue" property if present, else null.
      const value = typeof properties.metricValue === "number" ? properties.metricValue : null
      safe(() => statsig.logEvent(eventName, value, properties))
    },
  })
}

/**
 * Generic bridge builder for ad-hoc destinations (Segment, Amplitude, Mixpanel, …).
 * Pass closures that adapt to your provider; we wrap them in try/catch.
 */
export function createCustomBridge(
  name: string,
  options: Partial<Pick<GrowthBridge, "onIdentify" | "onTrack">>,
): GrowthBridge {
  return { name, ...options }
}

function safe(fn: () => unknown): void {
  try {
    const result = fn()
    if (result instanceof Promise) result.catch(() => { /* swallow */ })
  } catch { /* swallow — bridge errors must never poison the SDK */ }
}

function flatten(traits: GrowthEventProperties): Record<string, unknown> {
  // Statsig and Sentry both accept arbitrary string-keyed records; we shallow-flatten.
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(traits)) {
    out[key] = value
  }
  return out
}

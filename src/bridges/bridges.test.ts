import { describe, expect, it, vi } from "vitest"

import { createGrowthAnalyticsCore } from "../core/analytics"
import { MemoryStorage } from "../core/storage"
import {
  installClarityBridge,
  installPostHogBridge,
  installSentryBridge,
  installStatsigBridge,
  type ClarityLike,
  type PostHogLike,
  type SentryLike,
  type StatsigLike,
} from "./index"

function makeAnalytics() {
  return createGrowthAnalyticsCore({
    app: "t",
    endpoint: "https://example.com",
    writeKey: "k",
    storage: new MemoryStorage(),
    generateId: () => "anon_fixed",
    http: async () => ({ status: 201, body: JSON.stringify({ event: { id: "x", eventName: "y" }, warnings: [] }) }),
  })
}

describe("installClarityBridge", () => {
  it("forwards identify and event calls", async () => {
    const calls: Array<unknown[]> = []
    const clarity = ((...args: unknown[]) => calls.push(args)) as unknown as ClarityLike
    const analytics = makeAnalytics()
    installClarityBridge(analytics, clarity)
    await analytics.identify("user_123", { plan: "pro" })
    await analytics.track("paywall.opened")
    expect(calls[0]).toEqual(["identify", "user_123"])
    expect(calls[1]).toEqual(["set", "plan", "pro"])
    expect(calls[2]).toEqual(["event", "paywall.opened"])
  })

  it("falls back to anonymousId when no userId", async () => {
    const calls: Array<unknown[]> = []
    const clarity = ((...args: unknown[]) => calls.push(args)) as unknown as ClarityLike
    const analytics = makeAnalytics()
    installClarityBridge(analytics, clarity)
    await analytics.identify(null, {})
    expect(calls[0]).toEqual(["identify", "anon_fixed"])
  })
})

describe("installPostHogBridge", () => {
  it("forwards identify and capture", async () => {
    const posthog: PostHogLike = {
      identify: vi.fn(),
      capture: vi.fn(),
    }
    const analytics = makeAnalytics()
    installPostHogBridge(analytics, posthog)
    await analytics.identify("u1", { plan: "pro" })
    await analytics.track("e1", { variant: "A" })
    expect(posthog.identify).toHaveBeenCalledWith("u1", { plan: "pro" })
    expect(posthog.capture).toHaveBeenCalledWith("e1", { variant: "A" })
  })
})

describe("installSentryBridge", () => {
  it("sets user id and emits breadcrumb", async () => {
    const sentry: SentryLike = {
      setUser: vi.fn(),
      addBreadcrumb: vi.fn(),
    }
    const analytics = makeAnalytics()
    installSentryBridge(analytics, sentry)
    await analytics.identify("u1", { plan: "pro" })
    await analytics.track("e1", { x: 1 })
    expect(sentry.setUser).toHaveBeenCalledWith({ id: "u1", plan: "pro" })
    expect(sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: "gtm-easy",
      level: "info",
      message: "e1",
      data: { x: 1 },
    })
  })
})

describe("installStatsigBridge", () => {
  it("forwards updateUser and logEvent", async () => {
    const statsig: StatsigLike = {
      updateUser: vi.fn().mockResolvedValue(undefined),
      logEvent: vi.fn(),
    }
    const analytics = makeAnalytics()
    installStatsigBridge(analytics, statsig)
    await analytics.identify("u1", { plan: "pro" })
    await analytics.track("purchase.completed", { metricValue: 9.99, currency: "USD" })
    expect(statsig.updateUser).toHaveBeenCalledWith({ userID: "u1", custom: { plan: "pro" } })
    expect(statsig.logEvent).toHaveBeenCalledWith("purchase.completed", 9.99, { metricValue: 9.99, currency: "USD" })
  })
})

describe("bridge resilience", () => {
  it("does not throw when third-party SDK throws", async () => {
    const broken: ClarityLike = ((..._args: unknown[]) => { throw new Error("kaboom") }) as unknown as ClarityLike
    const analytics = makeAnalytics()
    installClarityBridge(analytics, broken)
    await analytics.track("e1")
  })
})

import { describe, expect, it, vi } from "vitest"

import { createGrowthAnalyticsCore } from "./analytics"
import { MemoryStorage } from "./storage"
import { GrowthAnalyticsError, type GrowthHttp, type GrowthHttpRequest } from "./types"

function makeAnalytics(overrides: { http?: GrowthHttp } = {}) {
  const calls: GrowthHttpRequest[] = []
  const http: GrowthHttp = overrides.http ?? (async (request) => {
    calls.push(request)
    return {
      status: 201,
      body: JSON.stringify({ event: { id: "evt_1", eventName: "app.first_open" }, warnings: [] }),
    }
  })
  const analytics = createGrowthAnalyticsCore({
    app: "test-app",
    endpoint: "https://example.gtmeasy.com",
    writeKey: "gte_test",
    environment: "staging",
    platform: "web",
    storage: new MemoryStorage(),
    http,
    generateId: () => "anon_fixed",
    now: () => "2026-05-14T00:00:00.000Z",
  })
  return { analytics, calls }
}

describe("createGrowthAnalyticsCore", () => {
  it("posts identify with anonymous id and userId", async () => {
    const { analytics, calls } = makeAnalytics()
    await analytics.identify("user_123", { plan: "pro" })
    expect(calls).toHaveLength(1)
    const call = calls[0]!
    expect(call.url).toBe("https://example.gtmeasy.com/api/v1/growth/users")
    expect(call.headers["x-gtm-growth-key"]).toBe("gte_test")
    const body = JSON.parse(call.body)
    expect(body.userId).toBe("user_123")
    expect(body.anonymousId).toBe("anon_fixed")
    expect(body.traits).toMatchObject({ plan: "pro" })
    expect(body.traits._ctx).toMatchObject({ sdk: "gtm-easy-js", sdk_version: expect.any(String) })
  })

  it("retains userId across calls", async () => {
    const { analytics, calls } = makeAnalytics()
    await analytics.identify("user_123")
    await analytics.track("paywall.opened")
    expect(JSON.parse(calls[1]!.body).userId).toBe("user_123")
  })

  it("track emits to events endpoint with iso timestamp", async () => {
    const { analytics, calls } = makeAnalytics()
    await analytics.track("paywall.opened", { variant: "A" })
    const body = JSON.parse(calls[0]!.body)
    expect(body.eventName).toBe("paywall.opened")
    expect(body.properties).toMatchObject({ variant: "A" })
    expect(body.properties._ctx).toMatchObject({ sdk: "gtm-easy-js" })
    expect(body.occurredAt).toBe("2026-05-14T00:00:00.000Z")
    expect(body.source).toBe("native")
  })

  it("trackPurchaseCompleted sets metric value and currency", async () => {
    const { analytics, calls } = makeAnalytics()
    await analytics.trackPurchaseCompleted({ amount: 9.99, currency: "USD", productId: "pro_monthly" })
    const body = JSON.parse(calls[0]!.body)
    expect(body.metricValue).toBe(9.99)
    expect(body.metricLabel).toBe("USD")
    expect(body.properties).toMatchObject({ currency: "USD", productId: "pro_monthly" })
  })

  it("throws GrowthAnalyticsError on non-2xx response", async () => {
    const { analytics } = makeAnalytics({
      http: async () => ({ status: 401, body: '{"error":"nope"}' }),
    })
    await expect(analytics.track("paywall.opened")).rejects.toBeInstanceOf(GrowthAnalyticsError)
  })

  it("bridges receive identify + track in order", async () => {
    const { analytics } = makeAnalytics()
    const identifyCalls: unknown[] = []
    const trackCalls: unknown[] = []
    analytics.addBridge({
      name: "test",
      onIdentify: (p) => { identifyCalls.push(p) },
      onTrack: (p) => { trackCalls.push(p) },
    })
    await analytics.identify("u1", { plan: "pro" })
    await analytics.track("paywall.opened", { variant: "A" })
    expect(identifyCalls).toEqual([{ userId: "u1", anonymousId: "anon_fixed", username: null, email: null, traits: { plan: "pro" } }])
    expect(trackCalls).toEqual([{ eventName: "paywall.opened", properties: { variant: "A" }, userId: "u1", anonymousId: "anon_fixed" }])
  })

  it("bridges that throw never break the SDK", async () => {
    const { analytics, calls } = makeAnalytics()
    analytics.addBridge({
      name: "broken",
      onTrack: () => { throw new Error("kaboom") },
    })
    await analytics.track("page.viewed")
    expect(calls).toHaveLength(1)
  })

  it("addBridge returns an unsubscribe function", async () => {
    const { analytics } = makeAnalytics()
    const seen: string[] = []
    const remove = analytics.addBridge({
      name: "test",
      onTrack: (p) => { seen.push(p.eventName) },
    })
    await analytics.track("a")
    remove()
    await analytics.track("b")
    expect(seen).toEqual(["a"])
  })

  it("persists the anonymous id across calls via storage", async () => {
    const store = new MemoryStorage()
    const ids: string[] = []
    const analytics = createGrowthAnalyticsCore({
      app: "t", endpoint: "https://example.com", writeKey: "k",
      storage: store,
      http: async (req) => { ids.push(JSON.parse(req.body).anonymousId); return { status: 201, body: "{}" } },
      generateId: vi.fn().mockReturnValueOnce("anon_1").mockReturnValueOnce("anon_2"),
      now: () => "2026-01-01T00:00:00.000Z",
    })
    await analytics.track("a")
    await analytics.track("b")
    expect(ids[0]).toBe(ids[1])
    expect(ids[0]).toBe("anon_1")
  })

  it("submitWebReferrer hits the attribution endpoint", async () => {
    const { analytics, calls } = makeAnalytics()
    await analytics.submitWebReferrer("https://example.com?utm_source=t&gclid=abc", "abc")
    expect(calls[0]!.url).toBe("https://example.gtmeasy.com/api/v1/growth/attribution/web-referrer")
    const body = JSON.parse(calls[0]!.body)
    expect(body.webReferrer).toContain("utm_source=t")
    expect(body.clickId).toBe("abc")
  })

  it("validates required configuration", () => {
    expect(() => createGrowthAnalyticsCore({ app: "", endpoint: "x", writeKey: "y" })).toThrow(/app is required/)
    expect(() => createGrowthAnalyticsCore({ app: "a", endpoint: "", writeKey: "y" })).toThrow(/endpoint cannot be empty/)
    expect(() => createGrowthAnalyticsCore({ app: "a", endpoint: "x", writeKey: "" })).toThrow(/writeKey is required/)
  })

  it("defaults endpoint to the production ingest host when omitted", () => {
    const analytics = createGrowthAnalyticsCore({ app: "a", writeKey: "y" })
    expect(analytics._config().endpoint).toBe("https://www.gtmeasy.com")
  })

  it("sends first-class username and email on identify", async () => {
    const { analytics, calls } = makeAnalytics()
    await analytics.identify({ userId: "u1", username: "john_wayne", email: "John@Example.com " })
    const body = JSON.parse(calls[0]!.body)
    expect(body.userId).toBe("u1")
    expect(body.username).toBe("john_wayne")
    // Client trims; server lowercases — we keep the trimmed plaintext here.
    expect(body.email).toBe("John@Example.com")
  })

  it("blank username/email collapse to null", async () => {
    const { analytics, calls } = makeAnalytics()
    await analytics.identify({ userId: "u1", username: "   ", email: "" })
    const body = JSON.parse(calls[0]!.body)
    expect(body.username).toBeNull()
    expect(body.email).toBeNull()
  })

  it("persists identity so a fresh instance still attributes tracks", async () => {
    const store = new MemoryStorage()
    const base = {
      app: "t", endpoint: "https://example.com", writeKey: "k",
      storage: store,
      http: async () => ({ status: 201, body: "{}" }),
      generateId: () => "anon_fixed",
      now: () => "2026-01-01T00:00:00.000Z",
    } as const

    const first = createGrowthAnalyticsCore(base)
    await first.identify({ userId: "u1", username: "jw", email: "jw@example.com" })

    // Simulate an app restart: brand new instance, same durable storage.
    const calls: GrowthHttpRequest[] = []
    const second = createGrowthAnalyticsCore({
      ...base,
      http: async (req) => { calls.push(req); return { status: 201, body: "{}" } },
    })
    await second.track("paywall.opened")
    const body = JSON.parse(calls[0]!.body)
    expect(body.userId).toBe("u1")
    expect(second.getUserId()).toBe("u1")
  })

  it("reset clears identity and rotates the anonymous id", async () => {
    const store = new MemoryStorage()
    const calls: GrowthHttpRequest[] = []
    let n = 0
    const analytics = createGrowthAnalyticsCore({
      app: "t", endpoint: "https://example.com", writeKey: "k",
      storage: store,
      http: async (req) => { calls.push(req); return { status: 201, body: "{}" } },
      generateId: () => `anon_${++n}`,
      now: () => "2026-01-01T00:00:00.000Z",
    })
    await analytics.identify({ userId: "u1", email: "u1@example.com" })
    const before = await analytics.getAnonymousId()
    await analytics.reset()
    expect(analytics.getUserId()).toBeNull()
    await analytics.track("app.opened")
    const body = JSON.parse(calls[calls.length - 1]!.body)
    expect(body.userId).toBeNull()
    expect(body.anonymousId).not.toBe(before)
  })
})

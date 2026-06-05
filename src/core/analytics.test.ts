import { describe, expect, it, vi } from "vitest"

import { createGrowthAnalyticsCore } from "./analytics"
import type { GrowthInstallSignal } from "./install-state"
import { MemoryStorage } from "./storage"
import { GrowthAnalyticsError, type GrowthHttp, type GrowthHttpRequest, type GrowthPlatform, type GrowthStorage } from "./types"

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

class PersistentStore implements GrowthStorage {
  readonly isPersistent = true
  private m = new Map<string, string>()
  get(key: string): string | null { return this.m.get(key) ?? null }
  set(key: string, value: string): void { this.m.set(key, value) }
}

function makeInstallAnalytics(opts: {
  storage?: GrowthStorage
  platform?: GrowthPlatform
  environment?: "production" | "staging" | "development"
  installProbe?: () => Promise<GrowthInstallSignal>
  /** When true, every ingest POST returns 5xx so the track call throws (transient failure). */
  failHttp?: boolean
} = {}) {
  const calls: GrowthHttpRequest[] = []
  const analytics = createGrowthAnalyticsCore({
    app: "t",
    endpoint: "https://e.com",
    writeKey: "k",
    environment: opts.environment ?? "production",
    platform: opts.platform ?? "ios",
    storage: opts.storage ?? new PersistentStore(),
    installProbe: opts.installProbe,
    http: async (req) => {
      calls.push(req)
      if (opts.failHttp) return { status: 503, body: "upstream unavailable" }
      return { status: 201, body: JSON.stringify({ event: { id: "e", eventName: "x" }, warnings: [] }) }
    },
    generateId: () => "anon_fixed",
    now: () => "2026-06-03T00:00:00.000Z",
  })
  return { analytics, calls }
}

const eventNames = (calls: GrowthHttpRequest[]) => calls.map((c) => JSON.parse(c.body).eventName)

describe("trackFirstOpenIfNeeded", () => {
  it("fires app.first_open once for a fresh install and is idempotent across calls", async () => {
    const store = new PersistentStore()
    const { analytics, calls } = makeInstallAnalytics({ storage: store })
    const r1 = await analytics.trackFirstOpenIfNeeded({ appVersion: "1.0.0", buildNumber: "10" })
    const r2 = await analytics.trackFirstOpenIfNeeded({ appVersion: "1.0.0", buildNumber: "10" })
    expect(eventNames(calls)).toEqual(["app.first_open"])
    expect(r1?.eventName).toBe("x")
    expect(r2).toBeNull()
    expect(store.get("gtm_easy_growth_first_open_fired")).toBe("1")
  })

  it("sends the install version as the top-level appVersion/buildNumber (feeds version breakdown)", async () => {
    const { analytics, calls } = makeInstallAnalytics()
    await analytics.trackFirstOpenIfNeeded({ appVersion: "1.4.2", buildNumber: "142" })
    const body = JSON.parse(calls[0]!.body)
    expect(body.eventName).toBe("app.first_open")
    expect(body.appVersion).toBe("1.4.2")
    expect(body.buildNumber).toBe("142")
  })

  it("app.updated also carries the landed version as top-level appVersion", async () => {
    const store = new PersistentStore()
    await makeInstallAnalytics({ storage: store }).analytics.trackFirstOpenIfNeeded({ appVersion: "0.9.0", buildNumber: "9" })
    const { analytics, calls } = makeInstallAnalytics({ storage: store })
    await analytics.trackFirstOpenIfNeeded({ appVersion: "1.0.0", buildNumber: "10" })
    const body = JSON.parse(calls[0]!.body)
    expect(body.eventName).toBe("app.updated")
    expect(body.appVersion).toBe("1.0.0")
    expect(body.buildNumber).toBe("10")
  })

  it("an arg-less relaunch after a baseline neither fires app.updated nor wipes the baseline", async () => {
    const store = new PersistentStore()
    await makeInstallAnalytics({ storage: store }).analytics.trackFirstOpenIfNeeded({ appVersion: "1.0.0", buildNumber: "10" })

    // Relaunch with NO version args (caller omitted them / native lookup failed).
    const argless = makeInstallAnalytics({ storage: store })
    const r = await argless.analytics.trackFirstOpenIfNeeded()
    expect(r).toBeNull()
    expect(argless.calls).toHaveLength(0) // no bogus app.updated

    // Baseline must be intact: a later real bump fires a correctly-attributed update.
    const next = makeInstallAnalytics({ storage: store })
    await next.analytics.trackFirstOpenIfNeeded({ appVersion: "1.1.0", buildNumber: "11" })
    expect(eventNames(next.calls)).toEqual(["app.updated"])
    expect(JSON.parse(next.calls[0]!.body).properties).toMatchObject({ from_version: "1.0.0", to_version: "1.1.0" })
  })

  it("retries app.updated after a failed send (baseline only advances on success)", async () => {
    const store = new PersistentStore()
    await makeInstallAnalytics({ storage: store }).analytics.trackFirstOpenIfNeeded({ appVersion: "1.0.0", buildNumber: "10" })

    // Launch at 1.1.0, but the ingest POST fails → the call throws and the baseline must
    // NOT advance, so the update isn't silently lost.
    const failing = makeInstallAnalytics({ storage: store, failHttp: true })
    await expect(failing.analytics.trackFirstOpenIfNeeded({ appVersion: "1.1.0", buildNumber: "11" })).rejects.toBeTruthy()

    // Next launch at 1.1.0 with a healthy backend re-fires the same update from 1.0.0.
    const retry = makeInstallAnalytics({ storage: store })
    await retry.analytics.trackFirstOpenIfNeeded({ appVersion: "1.1.0", buildNumber: "11" })
    expect(eventNames(retry.calls)).toEqual(["app.updated"])
    expect(JSON.parse(retry.calls[0]!.body).properties).toMatchObject({ from_version: "1.0.0", to_version: "1.1.0" })
  })

  it("fails closed when probePersistence reports broken storage — no repeated app.first_open", async () => {
    // A store that claims isPersistent but whose probe fails (e.g. a broken AsyncStorage).
    const brokenAsyncStore: GrowthStorage = {
      isPersistent: true,
      probePersistence: async () => false,
      get: () => null,
      set: () => {},
    }
    const a = makeInstallAnalytics({ storage: brokenAsyncStore })
    const r1 = await a.analytics.trackFirstOpenIfNeeded({ appVersion: "1.0.0", buildNumber: "10" })
    const r2 = await a.analytics.trackFirstOpenIfNeeded({ appVersion: "1.0.0", buildNumber: "10" })
    expect(r1).toBeNull()
    expect(r2).toBeNull()
    expect(a.calls).toHaveLength(0) // treated volatile → never auto-fires an install
  })

  it("fires app.updated (not app.first_open) when the version changed", async () => {
    const store = new PersistentStore()
    // Simulate a prior run at 0.9.0.
    await makeInstallAnalytics({ storage: store }).analytics.trackFirstOpenIfNeeded({ appVersion: "0.9.0", buildNumber: "9" })

    const { analytics, calls } = makeInstallAnalytics({ storage: store })
    await analytics.trackFirstOpenIfNeeded({ appVersion: "1.0.0", buildNumber: "10" })
    expect(eventNames(calls)).toEqual(["app.updated"])
    const body = JSON.parse(calls[0]!.body)
    expect(body.properties).toMatchObject({ reason: "version_change", is_real_update: true, from_version: "0.9.0", to_version: "1.0.0" })
  })

  it("existed probe suppresses app.first_open → pre_existing app.updated", async () => {
    const { analytics, calls } = makeInstallAnalytics({ installProbe: async () => "existed" })
    await analytics.trackFirstOpenIfNeeded({ appVersion: "2.3.0", buildNumber: "200" })
    expect(eventNames(calls)).toEqual(["app.updated"])
    const body = JSON.parse(calls[0]!.body)
    expect(body.properties).toMatchObject({ reason: "pre_existing_install", is_real_update: false })
    expect(body.properties.from_version).toBeUndefined()
  })

  it("never fires from a volatile store (MemoryStorage)", async () => {
    const { analytics, calls } = makeInstallAnalytics({ storage: new MemoryStorage() })
    const r = await analytics.trackFirstOpenIfNeeded({ appVersion: "1.0.0", buildNumber: "10" })
    expect(r).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it("no-ops on the server platform", async () => {
    const { analytics, calls } = makeInstallAnalytics({ platform: "server" })
    const r = await analytics.trackFirstOpenIfNeeded({ appVersion: "1.0.0", buildNumber: "10" })
    expect(r).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it("concurrent calls fire app.first_open only once (single-flight)", async () => {
    const { analytics, calls } = makeInstallAnalytics()
    await Promise.all([
      analytics.trackFirstOpenIfNeeded({ appVersion: "1.0.0", buildNumber: "10" }),
      analytics.trackFirstOpenIfNeeded({ appVersion: "1.0.0", buildNumber: "10" }),
    ])
    expect(eventNames(calls)).toEqual(["app.first_open"])
  })

  it("reset() does not clear install state — first_open never re-fires after logout", async () => {
    const store = new PersistentStore()
    const { analytics, calls } = makeInstallAnalytics({ storage: store })
    await analytics.trackFirstOpenIfNeeded({ appVersion: "1.0.0", buildNumber: "10" })
    await analytics.reset()
    const r = await analytics.trackFirstOpenIfNeeded({ appVersion: "1.0.0", buildNumber: "10" })
    expect(r).toBeNull()
    expect(eventNames(calls).filter((n) => n === "app.first_open")).toHaveLength(1)
  })

  it("markInstalledBeforeTracking suppresses the first app.first_open", async () => {
    const { analytics, calls } = makeInstallAnalytics()
    await analytics.markInstalledBeforeTracking({ appVersion: "1.0.0", buildNumber: "10" })
    const r = await analytics.trackFirstOpenIfNeeded({ appVersion: "1.0.0", buildNumber: "10" })
    expect(r).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it("markInstalledBeforeTracking() with NO version args fires neither app.first_open nor a spurious app.updated", async () => {
    const store = new PersistentStore()
    const first = makeInstallAnalytics({ storage: store })
    await first.analytics.markInstalledBeforeTracking() // no baseline recorded
    const r = await first.analytics.trackFirstOpenIfNeeded({ appVersion: "2.0.0", buildNumber: "100" })
    expect(r).toBeNull()
    expect(first.calls).toHaveLength(0) // silent: no install, and NOT a bogus version_change from null

    // The silent launch must have adopted 2.0.0 as the baseline, so a later real bump
    // fires a correctly-attributed app.updated (proves the baseline was persisted).
    const next = makeInstallAnalytics({ storage: store })
    await next.analytics.trackFirstOpenIfNeeded({ appVersion: "3.0.0", buildNumber: "200" })
    expect(eventNames(next.calls)).toEqual(["app.updated"])
    expect(JSON.parse(next.calls[0]!.body).properties).toMatchObject({
      reason: "version_change",
      from_version: "2.0.0",
      to_version: "3.0.0",
    })
  })
})

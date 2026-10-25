import { afterEach, describe, expect, it, vi } from "vitest"

import { createGrowthAnalyticsCore } from "./analytics"
import type { GrowthBuildChannel } from "./build-channel"
import { GrowthDebugSink } from "./debug"
import type { GrowthAnalyticsConfiguration, GrowthHttpRequest, GrowthStorage } from "./types"

const ANON_KEY = "gtm_easy_growth_anonymous_id"

/** Durable store that records every write. */
class RecordingStore implements GrowthStorage {
  readonly isPersistent = true
  readonly m = new Map<string, string>()
  readonly writes: string[] = []
  get(key: string): string | null { return this.m.get(key) ?? null }
  set(key: string, value: string): void { this.writes.push(key); this.m.set(key, value) }
}

function make(opts: Partial<GrowthAnalyticsConfiguration> & { storage?: GrowthStorage } = {}) {
  const calls: GrowthHttpRequest[] = []
  let n = 0
  const analytics = createGrowthAnalyticsCore({
    app: "t",
    endpoint: "https://e.com",
    writeKey: "gte_secret_key",
    environment: "production",
    platform: "ios",
    storage: opts.storage ?? new RecordingStore(),
    http: async (req) => {
      calls.push(req)
      return { status: 201, body: JSON.stringify({ event: { id: "e", eventName: "x" }, warnings: [] }) }
    },
    generateId: () => `id_${++n}`,
    now: () => "2026-10-25T00:00:00.000Z",
    ...opts,
  })
  return { analytics, calls }
}

async function exerciseEverything(a: ReturnType<typeof make>["analytics"]): Promise<void> {
  await a.markInstalledBeforeTracking({ appVersion: "1.0", buildNumber: "1" })
  await a.trackFirstOpenIfNeeded({ appVersion: "1.0", buildNumber: "1" })
  await a.trackFirstOpen()
  await a.trackAppOpen()
  await a.identify({ userId: "u1", email: "a@b.c", username: "ann" })
  a.setUserId("u2")
  await a.track("paywall.opened", { plan: "pro" })
  await a.trackPurchaseCompleted({ amount: 9.99, currency: "USD" })
  await a.trackAppUpdated({ reason: "version_change", isRealUpdate: true, toVersion: "1.1" })
  await a.submitWebReferrer("https://x.com/?gclid=1", "1")
  await a.submitSurvey({ surveyId: "s1", responses: [] })
  await a.recordClickId("gclid", "abc")
  await a.captureClickIds("https://x.com/?fbclid=f1&gclid=g1")
  await a.getAnonymousId()
  await a.reset()
}

describe("suppressTestBuilds", () => {
  afterEach(() => { vi.restoreAllMocks() })

  it("is off by default: a debug channel still sends", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {})
    const { analytics, calls } = make({ buildChannel: "debug" })
    expect(analytics.isSuppressed).toBe(false)
    expect(analytics.resolvedBuildChannel).toBe("debug")
    await analytics.track("x")
    expect(calls).toHaveLength(1)
  })

  it.each<GrowthBuildChannel>(["debug", "testflight", "internalTest"])("suppresses the %s channel", (channel) => {
    vi.spyOn(console, "info").mockImplementation(() => {})
    const { analytics } = make({ suppressTestBuilds: true, buildChannel: channel })
    expect(analytics.isSuppressed).toBe(true)
    expect(analytics.resolvedBuildChannel).toBe(channel)
  })

  it.each<GrowthBuildChannel>(["production", "unknown"])("never suppresses %s", async (channel) => {
    const { analytics, calls } = make({ suppressTestBuilds: true, buildChannel: channel })
    expect(analytics.isSuppressed).toBe(false)
    await analytics.track("x")
    expect(calls).toHaveLength(1)
  })

  it("uses the injected detector when no override is set, and the override beats it", () => {
    vi.spyOn(console, "info").mockImplementation(() => {})
    const detected = make({ suppressTestBuilds: true, detectBuildChannel: () => "debug" }).analytics
    expect(detected.resolvedBuildChannel).toBe("debug")
    expect(detected.isSuppressed).toBe(true)
    const overridden = make({ suppressTestBuilds: true, buildChannel: "production", detectBuildChannel: () => "debug" }).analytics
    expect(overridden.resolvedBuildChannel).toBe("production")
    expect(overridden.isSuppressed).toBe(false)
  })

  it("auto-detects RN __DEV__ as debug", () => {
    vi.spyOn(console, "info").mockImplementation(() => {})
    const g = globalThis as { __DEV__?: boolean }
    g.__DEV__ = true
    try {
      const { analytics } = make({ suppressTestBuilds: true })
      expect(analytics.resolvedBuildChannel).toBe("debug")
      expect(analytics.isSuppressed).toBe(true)
    } finally {
      delete g.__DEV__
    }
    expect(make({ suppressTestBuilds: true }).analytics.resolvedBuildChannel).toBe("unknown")
  })

  it("disabled exposes isSuppressed on the noop client", () => {
    vi.spyOn(console, "info").mockImplementation(() => {})
    const { analytics } = make({ disabled: true })
    expect(analytics.isSuppressed).toBe(true)
    expect(analytics.resolvedBuildChannel).toBe("unknown")
  })

  it.each([
    ["suppressTestBuilds", { suppressTestBuilds: true, buildChannel: "testflight" as const }],
    ["disabled", { disabled: true }],
  ])("%s: zero HTTP calls and zero storage writes across the whole API", async (_label, opts) => {
    vi.spyOn(console, "info").mockImplementation(() => {})
    const store = new RecordingStore()
    const { analytics, calls } = make({ ...opts, storage: store })
    await exerciseEverything(analytics)
    expect(calls).toHaveLength(0)
    expect(store.writes).toEqual([])
  })

  it("logs one info line without the write key", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    make({ suppressTestBuilds: true, buildChannel: "debug" })
    expect(info).toHaveBeenCalledTimes(1)
    const line = String(info.mock.calls[0]![0])
    expect(line).toBe("GTM Easy: suppressing events (channel=debug)")
    expect(line).not.toContain("gte_secret_key")
  })

  it("reuses a persisted anonymous id, else keeps a generated one in memory only", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {})
    const seeded = new RecordingStore()
    seeded.m.set(ANON_KEY, "anon_existing")
    const a = make({ suppressTestBuilds: true, buildChannel: "debug", storage: seeded }).analytics
    expect(await a.getAnonymousId()).toBe("anon_existing")

    const empty = new RecordingStore()
    const b = make({ suppressTestBuilds: true, buildChannel: "debug", storage: empty }).analytics
    const id = await b.getAnonymousId()
    expect(id).toMatch(/^id_/)
    expect(await b.getAnonymousId()).toBe(id)
    expect(empty.m.has(ANON_KEY)).toBe(false)
  })

  it("keeps identity setters in memory", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {})
    const { analytics } = make({ suppressTestBuilds: true, buildChannel: "debug" })
    await analytics.identify("u1")
    expect(analytics.getUserId()).toBe("u1")
    analytics.setUserId("u2")
    expect(analytics.getUserId()).toBe("u2")
    await analytics.reset()
    expect(analytics.getUserId()).toBeNull()
  })

  it("mirrors suppressed events to the debug sink with a suppressed marker", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {})
    vi.spyOn(console, "log").mockImplementation(() => {})
    const sink = new GrowthDebugSink()
    const { analytics, calls } = make({ suppressTestBuilds: true, buildChannel: "debug", debug: true, debugSink: sink })
    await analytics.identify("u1", { plan: "pro" })
    await analytics.track("paywall.opened", { plan: "pro" })
    expect(calls).toHaveLength(0)
    const events = sink.recent()
    expect(events.map((e) => [e.kind, e.label, e.suppressed])).toEqual([
      ["identify", "u1", true],
      ["track", "paywall.opened", true],
    ])
    // Built from caller properties only — no `_ctx` context collection.
    expect(events[1]!.properties).toEqual({ plan: "pro" })
  })

  it("does not mirror when debug is off", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {})
    const sink = new GrowthDebugSink()
    const { analytics } = make({ suppressTestBuilds: true, buildChannel: "debug", debugSink: sink })
    await analytics.track("x")
    expect(sink.recent()).toEqual([])
  })

  it("a suppressed launch then production launches on the same storage send app.first_open exactly once", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {})
    const store = new RecordingStore()
    const test = make({ suppressTestBuilds: true, buildChannel: "testflight", storage: store })
    await exerciseEverything(test.analytics)
    expect(test.calls).toHaveLength(0)

    const prod1 = make({ suppressTestBuilds: true, buildChannel: "production", storage: store })
    await prod1.analytics.trackFirstOpenIfNeeded({ appVersion: "1.0", buildNumber: "1" })
    const prod2 = make({ suppressTestBuilds: true, buildChannel: "production", storage: store })
    await prod2.analytics.trackFirstOpenIfNeeded({ appVersion: "1.0", buildNumber: "1" })
    const names = [...prod1.calls, ...prod2.calls].map((c) => JSON.parse(c.body).eventName)
    expect(names).toEqual(["app.first_open"])
  })
})

import { GrowthClickIdStore, CLICK_PROVIDERS, type ClickProvider } from "./click-id-store"
import { defaultDebugSink, GrowthDebugSink } from "./debug"
import { emptyDeviceContextProvider, type DeviceContextProvider } from "./device-context"
import { fetchHttp } from "./http"
import { MemoryStorage } from "./storage"
import {
  GrowthAnalyticsError,
  GROWTH_DEFAULT_ENDPOINT,
  type GrowthAnalytics,
  type GrowthAnalyticsConfiguration,
  type GrowthBridge,
  type GrowthEventProperties,
  type IdentifyArgs,
  type IngestResponse,
  type TrackArgs,
} from "./types"
import { generateUuid } from "./uuid"

export const GROWTH_JS_SDK_VERSION = "0.2.0"

const ANON_KEY = "gtm_easy_growth_anonymous_id"

interface BuiltAnalytics extends GrowthAnalytics {
  /** Internal: exposed so platform adapters (web, RN, node) can fan out auto-instrumentation. */
  _config(): GrowthAnalyticsConfiguration & { environment: "production" | "staging" | "development"; platform: string }
}

/**
 * Create a GrowthAnalytics instance. Platform packages (web/node/react-native)
 * wrap this with sensible defaults for storage + platform.
 */
export function createGrowthAnalyticsCore(input: GrowthAnalyticsConfiguration): BuiltAnalytics {
  if (!input.app?.trim()) throw new Error("app is required")
  if (!input.writeKey?.trim()) throw new Error("writeKey is required")
  // `endpoint` is optional — defaults to the production ingest host. If the
  // caller passed an explicit empty string we keep treating that as a
  // misconfiguration since it's almost certainly unintended.
  if (input.endpoint !== undefined && !input.endpoint.trim()) {
    throw new Error("endpoint cannot be empty; omit it to use the production default")
  }

  const storage = input.storage ?? new MemoryStorage()
  const config = {
    app: input.app.trim(),
    endpoint: (input.endpoint ?? GROWTH_DEFAULT_ENDPOINT).replace(/\/+$/, ""),
    writeKey: input.writeKey,
    environment: input.environment ?? "production",
    platform: input.platform ?? "web",
    userAgent: input.userAgent,
    storage,
    http: input.http ?? fetchHttp,
    generateId: input.generateId ?? generateUuid,
    now: input.now ?? (() => new Date().toISOString()),
    debug: input.debug ?? false,
    deviceContext: input.deviceContext ?? emptyDeviceContextProvider,
    clickIdStore: input.clickIdStore ?? new GrowthClickIdStore(storage),
    debugSink: input.debugSink ?? defaultDebugSink,
  }

  let userId: string | null = null
  const bridges = new Set<GrowthBridge>()

  async function commonContext(): Promise<GrowthEventProperties> {
    const ctx: GrowthEventProperties = {}
    const device = await Promise.resolve(config.deviceContext.current())
    Object.assign(ctx, device)
    const clicks = await config.clickIdStore.snapshot()
    for (const [k, v] of Object.entries(clicks)) ctx[k] = v
    ctx.sdk = "gtm-easy-js"
    ctx.sdk_version = GROWTH_JS_SDK_VERSION
    ctx.platform = config.platform
    return ctx
  }

  async function getAnonymousId(): Promise<string> {
    const existing = await Promise.resolve(config.storage.get(ANON_KEY))
    if (existing) return existing
    const fresh = config.generateId()
    await Promise.resolve(config.storage.set(ANON_KEY, fresh))
    return fresh
  }

  async function post(path: string, body: Record<string, unknown>): Promise<IngestResponse> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-gtm-growth-key": config.writeKey,
    }
    if (config.userAgent) headers["user-agent"] = config.userAgent

    const response = await config.http({
      url: `${config.endpoint}${path}`,
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
    if (response.status < 200 || response.status >= 300) {
      throw new GrowthAnalyticsError(response.status, response.body)
    }
    let parsed: { event?: { id?: string; eventName?: string }; warnings?: string[] } = {}
    try { parsed = JSON.parse(response.body) } catch { parsed = {} }
    return {
      eventId: parsed.event?.id ?? null,
      eventName: parsed.event?.eventName ?? null,
      warnings: parsed.warnings ?? [],
    }
  }

  function notifyBridges<T>(call: (b: GrowthBridge) => void | Promise<void>): void {
    for (const bridge of bridges) {
      try {
        const result = call(bridge)
        if (result instanceof Promise) result.catch(() => { /* swallow */ })
      } catch {
        /* swallow — bridge errors must never poison the SDK */
      }
    }
  }

  async function identify(userIdOrArgs?: string | IdentifyArgs | null, traits?: GrowthEventProperties): Promise<IngestResponse> {
    const args: IdentifyArgs =
      typeof userIdOrArgs === "string" || userIdOrArgs === null
        ? { userId: userIdOrArgs, traits: traits ?? {} }
        : { ...(userIdOrArgs ?? {}) }
    if (args.userId !== undefined) userId = args.userId
    const anonymousId = await getAnonymousId()
    const enrichedTraits: GrowthEventProperties = {
      ...(args.traits ?? {}),
      _ctx: await commonContext(),
    }
    const body = {
      app: config.app,
      environment: config.environment,
      userId,
      anonymousId,
      platform: config.platform,
      appVersion: args.appVersion ?? null,
      buildNumber: args.buildNumber ?? null,
      country: args.country ?? null,
      locale: args.locale ?? defaultLocale(),
      timezone: args.timezone ?? defaultTimezone(),
      traits: enrichedTraits,
    }
    if (config.debug) {
      config.debugSink.record({
        kind: "identify",
        label: userId ?? "<anonymous>",
        properties: enrichedTraits,
        occurredAt: config.now(),
      })
    }
    // Notify bridges BEFORE the network call. Third-party SDKs (Clarity,
    // PostHog, Sentry, Statsig) keep their own queues; if our ingest fails we
    // still want them to see the identify so cross-tool sessions stay joinable.
    notifyBridges((b) => b.onIdentify?.({ userId, anonymousId, traits: args.traits ?? {} }))
    return post("/api/v1/growth/users", body)
  }

  async function track(eventName: string, properties?: GrowthEventProperties, trackArgs?: TrackArgs): Promise<IngestResponse> {
    const anonymousId = await getAnonymousId()
    const enrichedProperties: GrowthEventProperties = {
      ...(properties ?? {}),
      _ctx: await commonContext(),
    }
    const body = {
      app: config.app,
      environment: config.environment,
      userId,
      anonymousId,
      eventName,
      platform: config.platform,
      source: trackArgs?.source ?? "native",
      locale: defaultLocale(),
      timezone: defaultTimezone(),
      occurredAt: trackArgs?.occurredAt ?? config.now(),
      properties: enrichedProperties,
      ...(trackArgs?.metricValue !== undefined ? { metricValue: trackArgs.metricValue } : {}),
      ...(trackArgs?.metricLabel !== undefined ? { metricLabel: trackArgs.metricLabel } : {}),
    }
    if (config.debug) {
      config.debugSink.record({
        kind: "track",
        label: eventName,
        properties: enrichedProperties,
        occurredAt: body.occurredAt as string,
      })
    }
    // See identify() — bridges fire before the network post so third-party SDK
    // queues survive ingest outages.
    notifyBridges((b) => b.onTrack?.({ eventName, properties: properties ?? {}, userId, anonymousId }))
    return post("/api/v1/growth/events", body)
  }

  async function trackFirstOpen(): Promise<IngestResponse> { return track("app.first_open") }
  async function trackAppOpen(): Promise<IngestResponse> { return track("app.opened") }

  async function trackPurchaseCompleted(args: { amount: number; currency: string; productId?: string }): Promise<IngestResponse> {
    const properties: GrowthEventProperties = { currency: args.currency }
    if (args.productId) properties.productId = args.productId
    return track("purchase.completed", properties, { metricValue: args.amount, metricLabel: args.currency })
  }

  async function submitWebReferrer(referrer: string, click_id?: string | null): Promise<IngestResponse> {
    const anonymousId = await getAnonymousId()
    return post("/api/v1/growth/attribution/web-referrer", {
      app: config.app,
      environment: config.environment,
      userId,
      anonymousId,
      platform: "web",
      // Web referrer originates in the browser; downstream analytics segment
      // by `source` so calling this `native` would mislabel attributable web
      // installs as native-app installs.
      source: "web",
      occurredAt: config.now(),
      webReferrer: referrer,
      clickId: click_id ?? null,
      properties: {},
    })
  }

  function addBridge(bridge: GrowthBridge): () => void {
    bridges.add(bridge)
    return () => { bridges.delete(bridge) }
  }

  async function recordClickId(provider: string, value: string): Promise<void> {
    if (!(CLICK_PROVIDERS as readonly string[]).includes(provider.toLowerCase())) {
      throw new Error(`Unknown click provider: ${provider}`)
    }
    await config.clickIdStore.record(provider.toLowerCase() as ClickProvider, value)
  }

  async function captureClickIds(input: string | URL | URLSearchParams): Promise<number> {
    let params: URLSearchParams
    if (input instanceof URLSearchParams) {
      params = input
    } else if (input instanceof URL) {
      params = input.searchParams
    } else if (input.startsWith("http://") || input.startsWith("https://") || input.includes("://")) {
      params = new URL(input).searchParams
    } else {
      params = new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
    }
    return config.clickIdStore.captureFromQuery(params)
  }

  return {
    identify,
    track,
    trackFirstOpen,
    trackAppOpen,
    trackPurchaseCompleted,
    submitWebReferrer,
    addBridge,
    setUserId(id) { userId = id },
    getUserId() { return userId },
    getAnonymousId,
    recordClickId,
    captureClickIds,
    _config() { return config },
  }
}

function defaultLocale(): string | null {
  try {
    const lang = (globalThis as { navigator?: { language?: string } }).navigator?.language
    if (lang) return lang
  } catch { /* ignore */ }
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale ?? null
  } catch { return null }
}

function defaultTimezone(): string | null {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null } catch { return null }
}

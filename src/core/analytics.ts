import { fetchHttp } from "./http"
import { MemoryStorage } from "./storage"
import {
  GrowthAnalyticsError,
  type GrowthAnalytics,
  type GrowthAnalyticsConfiguration,
  type GrowthBridge,
  type GrowthEventProperties,
  type IdentifyArgs,
  type IngestResponse,
  type TrackArgs,
} from "./types"
import { generateUuid } from "./uuid"

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
  if (!input.endpoint?.trim()) throw new Error("endpoint is required")
  if (!input.writeKey?.trim()) throw new Error("writeKey is required")

  const config = {
    app: input.app.trim(),
    endpoint: input.endpoint.replace(/\/+$/, ""),
    writeKey: input.writeKey,
    environment: input.environment ?? "production",
    platform: input.platform ?? "web",
    userAgent: input.userAgent,
    storage: input.storage ?? new MemoryStorage(),
    http: input.http ?? fetchHttp,
    generateId: input.generateId ?? generateUuid,
    now: input.now ?? (() => new Date().toISOString()),
  }

  let userId: string | null = null
  const bridges = new Set<GrowthBridge>()

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
      traits: args.traits ?? {},
    }
    const response = await post("/api/v1/growth/users", body)
    notifyBridges((b) => b.onIdentify?.({ userId, anonymousId, traits: args.traits ?? {} }))
    return response
  }

  async function track(eventName: string, properties?: GrowthEventProperties, trackArgs?: TrackArgs): Promise<IngestResponse> {
    const anonymousId = await getAnonymousId()
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
      properties: properties ?? {},
      ...(trackArgs?.metricValue !== undefined ? { metricValue: trackArgs.metricValue } : {}),
      ...(trackArgs?.metricLabel !== undefined ? { metricLabel: trackArgs.metricLabel } : {}),
    }
    const response = await post("/api/v1/growth/events", body)
    notifyBridges((b) => b.onTrack?.({ eventName, properties: properties ?? {}, userId, anonymousId }))
    return response
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
      source: "native",
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

export type GrowthEnvironment = "production" | "staging" | "development"
export type GrowthPlatform = "ios" | "android" | "web" | "macos" | "server"

/**
 * Production ingest host. The SDK defaults `endpoint` to this when omitted;
 * override only for self-hosted deployments or local development.
 */
export const GROWTH_DEFAULT_ENDPOINT = "https://www.gtmeasy.com"

export interface GrowthAnalyticsConfiguration {
  app: string
  writeKey: string
  /**
   * Override the ingest host. Defaults to `GROWTH_DEFAULT_ENDPOINT` — only set
   * this for self-hosted GTM Easy deployments or local development.
   */
  endpoint?: string
  environment?: GrowthEnvironment
  platform?: GrowthPlatform
  /** Override the per-call User-Agent. Web defaults to navigator.userAgent. */
  userAgent?: string
  /** Pluggable storage for the anonymous id. */
  storage?: GrowthStorage
  /** Pluggable HTTP transport. Defaults to fetch. */
  http?: GrowthHttp
  /** Pluggable identifier source. Used for tests; default returns a v4 UUID. */
  generateId?: () => string
  /** Pluggable now function. Used for tests; default returns ISO timestamp. */
  now?: () => string
  /**
   * When true, every identify/track is mirrored to the debug sink before the
   * network call. The sink emits to subscribers + `console.log`.
   */
  debug?: boolean
  /**
   * Device-level common context provider. Platform packages supply sensible
   * defaults; host apps can override to attach IDFA/GAID/IDFV from native
   * bridges.
   */
  deviceContext?: import("./device-context").DeviceContextProvider
  /**
   * Click-id store for fbc/fbp/gclid/ttclid persistence. Platform packages
   * construct one backed by their default storage; pass your own to share an
   * instance across SDK instances.
   */
  clickIdStore?: import("./click-id-store").GrowthClickIdStore
  /** Override debug sink for testing. */
  debugSink?: import("./debug").GrowthDebugSink
}

export interface GrowthStorage {
  get(key: string): Promise<string | null> | string | null
  set(key: string, value: string): Promise<void> | void
}

export interface GrowthHttpRequest {
  url: string
  method: "POST"
  headers: Record<string, string>
  body: string
  /** Abort signal so callers can cancel in-flight requests. */
  signal?: AbortSignal
}

export interface GrowthHttpResponse {
  status: number
  body: string
}

export type GrowthHttp = (request: GrowthHttpRequest) => Promise<GrowthHttpResponse>

export type GrowthEventProperties = Record<string, JsonValue>
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue }

export interface IdentifyArgs {
  userId?: string | null
  /** Human-readable display name / handle. First-class, not smuggled in traits. */
  username?: string | null
  /** User email. First-class; sent plaintext, hashed only at ad-platform egress. */
  email?: string | null
  traits?: GrowthEventProperties
  appVersion?: string | null
  buildNumber?: string | null
  locale?: string | null
  timezone?: string | null
  country?: string | null
}

export interface TrackArgs {
  properties?: GrowthEventProperties
  metricValue?: number
  metricLabel?: string
  occurredAt?: string
  /** Override the source field. Defaults to "native" for SDK-originated calls. */
  source?: string
}

export interface IngestResponse {
  eventId: string | null
  eventName: string | null
  warnings: string[]
}

export interface GrowthBridge {
  readonly name: string
  onIdentify?(payload: {
    userId: string | null
    anonymousId: string
    username: string | null
    email: string | null
    traits: GrowthEventProperties
  }): void | Promise<void>
  onTrack?(payload: {
    eventName: string
    properties: GrowthEventProperties
    userId: string | null
    anonymousId: string
  }): void | Promise<void>
  /** Called on logout/reset so third-party SDKs can clear their own identity. */
  onReset?(): void | Promise<void>
}

export interface GrowthAnalytics {
  identify(userIdOrArgs?: string | IdentifyArgs | null, traits?: GrowthEventProperties): Promise<IngestResponse>
  track(eventName: string, properties?: GrowthEventProperties, args?: TrackArgs): Promise<IngestResponse>
  trackFirstOpen(): Promise<IngestResponse>
  trackAppOpen(): Promise<IngestResponse>
  trackPurchaseCompleted(args: { amount: number; currency: string; productId?: string }): Promise<IngestResponse>
  submitWebReferrer(referrer: string, click_id?: string | null): Promise<IngestResponse>
  /** Add a bridge that mirrors identify + track into a third-party SDK. */
  addBridge(bridge: GrowthBridge): () => void
  /** Force-set the userId without sending an identify event. */
  setUserId(userId: string | null): void
  getUserId(): string | null
  getAnonymousId(): Promise<string>
  /**
   * Clear the identified user (logout). Forgets the persisted userId/username/
   * email, rotates the anonymous id so post-logout events don't attribute to
   * the previous user, and notifies bridges to reset their own identity.
   */
  reset(): Promise<void>
  /** Record a click id captured externally (e.g. from a deep-link handler). */
  recordClickId(provider: string, value: string): Promise<void>
  /** Capture all known click ids from a URL or query string. Returns count captured. */
  captureClickIds(input: string | URL | URLSearchParams): Promise<number>
}

export class GrowthAnalyticsError extends Error {
  readonly status: number
  readonly responseBody: string | null
  constructor(status: number, responseBody: string | null) {
    super(`Growth analytics ingestion failed: status=${status} body=${responseBody ?? "<empty>"}`)
    this.name = "GrowthAnalyticsError"
    this.status = status
    this.responseBody = responseBody
  }
}

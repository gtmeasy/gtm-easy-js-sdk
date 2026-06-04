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

export type SurveyResponseStatus = "completed" | "partial" | "dismissed"

/**
 * One answered survey question. Self-describing: `type` + optional `questionText`
 * and `choiceLabels` let the dashboard aggregate without a server-side survey
 * definition. Build these with the `surveyAnswer.*` helpers in `survey-events`.
 */
export interface SurveyAnswer {
  questionId: string
  /** single_choice | multi_choice | rating | scale | nps | boolean | text | link (unknown → text server-side). */
  type: string
  questionText?: string
  position?: number
  choices?: string[]
  choiceLabels?: string[]
  number?: number
  text?: string
  bool?: boolean
  skipped?: boolean
  /**
   * Optional per-answer extensibility payload (answer timing, validation flags…).
   * Merged OVER submission-level `metadata`; persisted to the `metadata` JSON
   * column for JSONExtract-on-demand reads — nothing depends on a fixed shape.
   */
  metadata?: GrowthEventProperties
}

export interface SubmitSurveyArgs {
  surveyId: string
  responses: SurveyAnswer[]
  surveyName?: string
  surveyVersion?: string
  /** Defaults to "completed". `partial` stores answers without a lifecycle event. */
  status?: SurveyResponseStatus
  /**
   * Idempotency key for retries. The SDK generates a stable UUID when omitted
   * (so a transparent retry reuses the SAME key and the server dedups it).
   */
  submissionId?: string
  appVersion?: string
  locale?: string
  country?: string
  occurredAt?: string
  /**
   * Extra structured properties merged into the lifecycle event. The SDK always
   * adds device/click common context under `_ctx`; anything here is preserved.
   */
  properties?: GrowthEventProperties
  /**
   * Submission-level extensibility payload (A/B variant, locale overrides, UI
   * context…). Echoed onto every answer row and persisted to the `metadata` JSON
   * column. A per-answer `metadata` (on `SurveyAnswer`) is merged OVER this.
   */
  metadata?: GrowthEventProperties
}

export interface SurveySubmitResponse {
  /** Idempotency key — the one you supplied or a server-generated UUID. */
  submissionId: string
  /** Number of answer rows persisted. */
  accepted: number
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
  /**
   * Submit a flexible onboarding-survey response. Answers persist to the
   * dedicated survey store (no 240-char truncation) and a
   * `survey.completed`/`survey.dismissed` lifecycle event is recorded
   * (`partial` stores answers without one). Build `responses` with the
   * `surveyAnswer.*` helpers.
   */
  submitSurvey(args: SubmitSurveyArgs): Promise<SurveySubmitResponse>
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

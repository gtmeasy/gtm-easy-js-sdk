import { GrowthClickIdStore, CLICK_PROVIDERS, type ClickProvider } from "./click-id-store"
import { defaultDebugSink, GrowthDebugSink } from "./debug"
import { emptyDeviceContextProvider, type DeviceContextProvider } from "./device-context"
import { fetchHttp } from "./http"
import {
  resolveLaunch,
  FIRST_OPEN_KEY,
  INSTALL_AT_KEY,
  LAST_VERSION_KEY,
  LAST_BUILD_KEY,
  type GrowthInstallSignal,
  type GrowthUpdateReason,
} from "./install-state"
import { MemoryStorage } from "./storage"
import {
  GrowthAnalyticsError,
  GROWTH_DEFAULT_ENDPOINT,
  type GrowthAnalytics,
  type GrowthAnalyticsConfiguration,
  type GrowthBridge,
  type GrowthEventProperties,
  type GrowthStorage,
  type IdentifyArgs,
  type IngestResponse,
  type SubmitSurveyArgs,
  type SurveySubmitResponse,
  type TrackArgs,
} from "./types"
import { generateUuid } from "./uuid"

export const GROWTH_JS_SDK_VERSION = "0.6.0"

const ANON_KEY = "gtm_easy_growth_anonymous_id"
const USER_ID_KEY = "gtm_easy_growth_user_id"
const USERNAME_KEY = "gtm_easy_growth_username"
const EMAIL_KEY = "gtm_easy_growth_email"

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
    installProbe: input.installProbe,
    trackBuildChanges: input.trackBuildChanges ?? false,
  }

  let userId: string | null = null
  let username: string | null = null
  let email: string | null = null
  // The anonymous id is cached in memory (not re-read from storage per call) so
  // that track()/identify() can snapshot (userId, anonymousId) with two plain
  // synchronous reads — no `await` between them — making the pair tear-proof
  // against a concurrent reset() on this single-threaded runtime.
  let anonymousId: string | null = null
  const bridges = new Set<GrowthBridge>()
  // Identity (userId/username/email/anonymousId) is durable: persisted to storage
  // so a track() after an app restart still carries the resolved user — matching
  // DataFast's "re-identify on session change" model. Hydrated once, lazily. The
  // in-flight promise lock also prevents two concurrent first-calls from each
  // generating a different anonymous id and splitting a session.
  let identityHydrated = false
  let identityInFlight: Promise<void> | null = null
  // Single-flight guard so two concurrent trackFirstOpenIfNeeded() calls (e.g. the
  // documented RN parallel-useEffect pattern) can't both read firstOpenFired=false and
  // double-fire app.first_open.
  let launchInFlight: Promise<IngestResponse | null> | null = null
  let firstOpenDeprecationWarned = false
  let serverNoopWarned = false

  async function ensureIdentity(): Promise<void> {
    if (identityHydrated) return
    if (!identityInFlight) {
      identityInFlight = (async () => {
        const [storedUser, storedName, storedEmail, storedAnon] = await Promise.all([
          Promise.resolve(config.storage.get(USER_ID_KEY)),
          Promise.resolve(config.storage.get(USERNAME_KEY)),
          Promise.resolve(config.storage.get(EMAIL_KEY)),
          Promise.resolve(config.storage.get(ANON_KEY)),
        ])
        // If a concurrent reset()/identify() finalized identity while these reads
        // were in flight, abort — otherwise we'd resurrect the pre-reset user from
        // a storage snapshot taken before reset() cleared it.
        if (identityHydrated) return
        // Only fill from storage when the in-memory slot is still empty, so a
        // concurrent identify() that already set the live value wins.
        if (userId === null && storedUser) userId = storedUser
        if (username === null && storedName) username = storedName
        if (email === null && storedEmail) email = storedEmail
        if (anonymousId === null) {
          if (storedAnon) {
            anonymousId = storedAnon
          } else {
            anonymousId = config.generateId()
            await Promise.resolve(config.storage.set(ANON_KEY, anonymousId))
          }
        }
        identityHydrated = true
      })()
    }
    try {
      await identityInFlight
    } finally {
      identityInFlight = null
    }
  }

  async function persistIdentity(): Promise<void> {
    // Empty string means "forgotten" — hydration treats falsy as absent.
    await Promise.resolve(config.storage.set(USER_ID_KEY, userId ?? ""))
    await Promise.resolve(config.storage.set(USERNAME_KEY, username ?? ""))
    await Promise.resolve(config.storage.set(EMAIL_KEY, email ?? ""))
  }

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
    await ensureIdentity()
    return anonymousId as string
  }

  async function postRaw(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
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
    try {
      const parsed: unknown = JSON.parse(response.body)
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }

  async function post(path: string, body: Record<string, unknown>): Promise<IngestResponse> {
    const parsed = (await postRaw(path, body)) as { event?: { id?: string; eventName?: string }; warnings?: string[] }
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
    await ensureIdentity()
    const args: IdentifyArgs =
      typeof userIdOrArgs === "string" || userIdOrArgs === null
        ? { userId: userIdOrArgs, traits: traits ?? {} }
        : { ...(userIdOrArgs ?? {}) }
    if (args.userId !== undefined) userId = args.userId
    if (args.username !== undefined) username = normalizeIdentityField(args.username)
    if (args.email !== undefined) email = normalizeIdentityField(args.email)
    await persistIdentity()
    const enrichedTraits: GrowthEventProperties = {
      ...(args.traits ?? {}),
      _ctx: await commonContext(),
    }
    // Snapshot identity + anon as plain synchronous reads (no await between) so a
    // concurrent reset() can't tear them (see track()).
    await ensureIdentity()
    const snapAnon = anonymousId as string
    const snapUserId = userId
    const snapUsername = username
    const snapEmail = email
    const body = {
      app: config.app,
      environment: config.environment,
      userId: snapUserId,
      anonymousId: snapAnon,
      username: snapUsername,
      email: snapEmail,
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
        label: snapUserId ?? snapUsername ?? snapEmail ?? "<anonymous>",
        properties: enrichedTraits,
        occurredAt: config.now(),
      })
    }
    // Notify bridges BEFORE the network call. Third-party SDKs (Clarity,
    // PostHog, Sentry, Statsig) keep their own queues; if our ingest fails we
    // still want them to see the identify so cross-tool sessions stay joinable.
    notifyBridges((b) => b.onIdentify?.({ userId: snapUserId, anonymousId: snapAnon, username: snapUsername, email: snapEmail, traits: args.traits ?? {} }))
    return post("/api/v1/growth/users", body)
  }

  async function reset(): Promise<void> {
    // Rotate the anon id and clear identity as one synchronous block (no await
    // between the in-memory writes). A concurrent track()/identify() snapshot is
    // likewise await-free, so on this single-threaded runtime it observes either
    // the full pre-reset state or the full post-reset state — never a torn pair
    // (cleared user + old anon) that would re-stitch a logout event to the prior
    // user. identityHydrated stays true so a stale in-flight ensureIdentity()
    // (see its guard) can't resurrect the prior user. Persistence follows.
    anonymousId = config.generateId()
    userId = null
    username = null
    email = null
    identityHydrated = true
    await persistIdentity()
    await Promise.resolve(config.storage.set(ANON_KEY, anonymousId))
    notifyBridges((b) => b.onReset?.())
  }

  async function track(eventName: string, properties?: GrowthEventProperties, trackArgs?: TrackArgs): Promise<IngestResponse> {
    await ensureIdentity()
    const enrichedProperties: GrowthEventProperties = {
      ...(properties ?? {}),
      _ctx: await commonContext(),
    }
    // Snapshot anon id + userId with NO await between the two reads, so a
    // concurrent reset() can't tear identity (rotate a new anon while leaving the
    // old userId, or vice-versa). The anon id is an in-memory cache, so this is a
    // plain synchronous read; single-threaded JS has no interleaving here.
    const snapAnon = anonymousId as string
    const currentUserId = userId
    const body = {
      app: config.app,
      environment: config.environment,
      userId: currentUserId,
      anonymousId: snapAnon,
      eventName,
      platform: config.platform,
      source: trackArgs?.source ?? "native",
      locale: defaultLocale(),
      timezone: defaultTimezone(),
      occurredAt: trackArgs?.occurredAt ?? config.now(),
      properties: enrichedProperties,
      ...(trackArgs?.appVersion != null ? { appVersion: trackArgs.appVersion } : {}),
      ...(trackArgs?.buildNumber != null ? { buildNumber: trackArgs.buildNumber } : {}),
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
    notifyBridges((b) => b.onTrack?.({ eventName, properties: properties ?? {}, userId: currentUserId, anonymousId: snapAnon }))
    return post("/api/v1/growth/events", body)
  }

  /** @deprecated Fires app.first_open unconditionally — counts updates as installs. Use trackFirstOpenIfNeeded(). */
  async function trackFirstOpen(): Promise<IngestResponse> {
    if (config.debug && !firstOpenDeprecationWarned) {
      firstOpenDeprecationWarned = true
      // eslint-disable-next-line no-console
      console.warn(
        "[gtm-easy] trackFirstOpen() fires app.first_open on every call and will count app updates as new installs. Use trackFirstOpenIfNeeded({ appVersion, buildNumber }) instead.",
      )
    }
    return track("app.first_open")
  }
  async function trackAppOpen(): Promise<IngestResponse> { return track("app.opened") }

  function storageIsPersistent(): boolean {
    // Omitted/true → durable; only an explicit `false` (MemoryStorage) disables gating.
    return config.storage.isPersistent !== false
  }

  async function resolveStoragePersistence(): Promise<boolean> {
    // Prefer an async runtime probe (RN AsyncStorage) so a store that rejects writes fails
    // CLOSED (volatile → never auto-fires an install) rather than open (install spam on every
    // cold start). Falls back to the static flag for stores without a probe (Web/Memory).
    const storage: GrowthStorage = config.storage
    if (storage.probePersistence) {
      try { return await storage.probePersistence() } catch { return false }
    }
    return storageIsPersistent()
  }

  async function safeProbe(probe: () => Promise<GrowthInstallSignal>): Promise<GrowthInstallSignal> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<GrowthInstallSignal>((resolve) => {
        timer = setTimeout(() => resolve("unknown"), 3000)
      })
      const result = await Promise.race([Promise.resolve(probe()), timeout])
      return result === "fresh" || result === "existed" ? result : "unknown"
    } catch {
      return "unknown"
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  async function trackAppUpdated(args: {
    fromVersion?: string | null
    fromBuild?: string | null
    toVersion?: string | null
    toBuild?: string | null
    reason: GrowthUpdateReason
    isRealUpdate: boolean
  }): Promise<IngestResponse> {
    const properties: GrowthEventProperties = { reason: args.reason, is_real_update: args.isRealUpdate }
    if (args.fromVersion != null) properties.from_version = args.fromVersion
    if (args.fromBuild != null) properties.from_build = args.fromBuild
    if (args.toVersion != null) properties.to_version = args.toVersion
    if (args.toBuild != null) properties.to_build = args.toBuild
    // Also send the new version/build as the top-level appVersion/buildNumber so the
    // server's per-version breakdown attributes the update to the version it landed on.
    return track("app.updated", properties, { appVersion: args.toVersion, buildNumber: args.toBuild })
  }

  async function markInstalledBeforeTracking(args?: { appVersion?: string | null; buildNumber?: string | null }): Promise<void> {
    if (!storageIsPersistent()) return
    const already = (await Promise.resolve(config.storage.get(FIRST_OPEN_KEY))) === "1"
    if (already) return
    await Promise.resolve(config.storage.set(FIRST_OPEN_KEY, "1"))
    await Promise.resolve(config.storage.set(LAST_VERSION_KEY, args?.appVersion ?? ""))
    await Promise.resolve(config.storage.set(LAST_BUILD_KEY, args?.buildNumber ?? ""))
  }

  async function trackFirstOpenIfNeeded(args?: { appVersion?: string | null; buildNumber?: string | null }): Promise<IngestResponse | null> {
    if (config.platform === "server") {
      if (config.debug && !serverNoopWarned) {
        serverNoopWarned = true
        // eslint-disable-next-line no-console
        console.warn("[gtm-easy] trackFirstOpenIfNeeded() is a no-op on the server platform (installs are a client concept).")
      }
      return null
    }
    if (launchInFlight) return launchInFlight
    launchInFlight = (async () => {
      const currentVersion = args?.appVersion ?? null
      const currentBuild = args?.buildNumber ?? null
      const persistent = await resolveStoragePersistence()
      const [firstOpenRaw, lastVersion, lastBuild] = await Promise.all([
        Promise.resolve(config.storage.get(FIRST_OPEN_KEY)),
        Promise.resolve(config.storage.get(LAST_VERSION_KEY)),
        Promise.resolve(config.storage.get(LAST_BUILD_KEY)),
      ])
      const firstOpenFired = firstOpenRaw === "1"
      const signal: GrowthInstallSignal =
        !firstOpenFired && persistent && config.installProbe ? await safeProbe(config.installProbe) : "unknown"

      const launch = resolveLaunch({
        firstOpenFired,
        lastVersion: lastVersion || null,
        lastBuild: lastBuild || null,
        currentVersion,
        currentBuild,
        signal,
        storageIsPersistent: persistent,
        environment: config.environment,
        trackBuildChanges: config.trackBuildChanges,
      })

      // Advance the stored baseline to the current version/build — but only when the caller
      // actually supplied one. Writing "" for a null current would wipe a good baseline and
      // make the next real launch look like an update (resolveLaunch already ignores a null
      // current), so leave the stored value untouched instead.
      const persistBaseline = async (): Promise<void> => {
        if (!persistent) return
        if (currentVersion !== null) await Promise.resolve(config.storage.set(LAST_VERSION_KEY, currentVersion))
        if (currentBuild !== null) await Promise.resolve(config.storage.set(LAST_BUILD_KEY, currentBuild))
      }

      if (launch.type === "fresh_install") {
        // At-most-once: persist the gate + baseline BEFORE sending so a fresh install is never
        // double-counted even if the post fails (we accept losing one install over inflating).
        await Promise.resolve(config.storage.set(FIRST_OPEN_KEY, "1"))
        await Promise.resolve(config.storage.set(INSTALL_AT_KEY, config.now()))
        await persistBaseline()
        // Forward the install-time version so the install row feeds the per-version breakdown.
        return track("app.first_open", undefined, { appVersion: currentVersion, buildNumber: currentBuild })
      }
      if (launch.type === "update") {
        // Advance the baseline only AFTER the update posts: if the send throws, the baseline
        // stays put so the next launch retries the same app.updated (at-least-once — a rare
        // duplicate is acceptable for a non-install signal, a silent drop is not).
        //
        // The first-open flag is the exception: for a pre_existing_install adoption we set it
        // BEFORE sending and keep it set even on failure. This is deliberate (at-most-once for
        // the adoption event): re-running would re-invoke the install probe, and a flaky probe
        // could then misclassify a pre-existing user as a brand-new install. Losing one
        // adoption event is the safe trade-off vs. risking an inflated install count.
        if (!firstOpenFired) await Promise.resolve(config.storage.set(FIRST_OPEN_KEY, "1"))
        const res = await trackAppUpdated({
          fromVersion: launch.fromVersion,
          fromBuild: launch.fromBuild,
          toVersion: currentVersion,
          toBuild: currentBuild,
          reason: launch.reason,
          isRealUpdate: launch.reason !== "pre_existing_install",
        })
        await persistBaseline()
        return res
      }
      // Silent relaunch (same version, or a null current adopting the existing baseline).
      await persistBaseline()
      return null
    })()
    try {
      return await launchInFlight
    } finally {
      launchInFlight = null
    }
  }

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

  async function submitSurvey(args: SubmitSurveyArgs): Promise<SurveySubmitResponse> {
    await ensureIdentity()
    // Snapshot identity await-free so a concurrent reset() can't tear it (see track()).
    const snapAnon = anonymousId as string
    const currentUserId = userId
    // Generate the idempotency key CLIENT-side when the caller omits it: a
    // transparent retry (network blip, app relaunch with a queued submission)
    // then reuses the SAME key so the server's ReplacingMergeTree dedups it,
    // instead of the server minting a fresh UUID per attempt and double-counting.
    const submissionId = args.submissionId ?? config.generateId()
    const enrichedProperties: GrowthEventProperties = {
      ...(args.properties ?? {}),
      _ctx: await commonContext(),
    }
    const body = {
      app: config.app,
      environment: config.environment,
      userId: currentUserId,
      anonymousId: snapAnon,
      platform: config.platform,
      surveyId: args.surveyId,
      surveyName: args.surveyName ?? null,
      surveyVersion: args.surveyVersion ?? null,
      submissionId,
      status: args.status ?? "completed",
      appVersion: args.appVersion ?? null,
      locale: args.locale ?? defaultLocale(),
      country: args.country ?? null,
      occurredAt: args.occurredAt ?? config.now(),
      responses: args.responses,
      properties: enrichedProperties,
      // Submission-level extensibility payload echoed onto every answer row.
      // Per-answer `metadata` (on each response) is merged OVER this server-side.
      metadata: args.metadata ?? {},
    }
    if (config.debug) {
      config.debugSink.record({
        kind: "track",
        label: `survey:${args.surveyId}`,
        properties: { status: body.status, responses: args.responses.length },
        occurredAt: body.occurredAt as string,
      })
    }
    const parsed = (await postRaw("/api/v1/growth/surveys", body)) as {
      submissionId?: string
      accepted?: number
      warnings?: string[]
    }
    return {
      submissionId: parsed.submissionId ?? submissionId,
      accepted: parsed.accepted ?? 0,
      warnings: parsed.warnings ?? [],
    }
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

  // Warm the persisted identity in the background so getUserId() is accurate
  // shortly after construction without forcing every caller to await.
  void ensureIdentity()

  return {
    identify,
    track,
    trackFirstOpen,
    trackFirstOpenIfNeeded,
    trackAppUpdated,
    markInstalledBeforeTracking,
    trackAppOpen,
    trackPurchaseCompleted,
    submitWebReferrer,
    submitSurvey,
    addBridge,
    setUserId(id) { userId = id; identityHydrated = true; void persistIdentity() },
    getUserId() { return userId },
    getAnonymousId,
    reset,
    recordClickId,
    captureClickIds,
    _config() { return config },
  }
}

/** Trim an identity field; collapse empty / whitespace-only input to null. */
function normalizeIdentityField(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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

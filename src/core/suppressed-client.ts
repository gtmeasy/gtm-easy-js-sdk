import type { GrowthBuildChannel } from "./build-channel"
import type { GrowthDebugSink } from "./debug"
import type {
  GrowthAnalytics,
  GrowthEventProperties,
  GrowthStorage,
  IdentifyArgs,
  IngestResponse,
} from "./types"

/**
 * The noop client used when `disabled` is set or `suppressTestBuilds` matched the
 * resolved build channel.
 *
 * Guarantees: no network, and **no storage writes** — install state, identity,
 * click ids and the anonymous id are never persisted, so a later production
 * build on the same device still sends its own `app.first_open`. The only storage
 * access is a read of an already-persisted anonymous id (so a suppressed session
 * reports the same stable id); without one, an in-memory id is generated.
 *
 * With `debug: true`, events are mirrored to the debug sink marked
 * `suppressed: true`, built from the event name + caller properties only (no
 * common-context collection — that would synthesize and persist `_fbp`).
 */
export function createSuppressedClient<C>(args: {
  config: C
  storage: GrowthStorage
  anonKey: string
  generateId: () => string
  now: () => string
  debug: boolean
  debugSink: GrowthDebugSink
  buildChannel: GrowthBuildChannel
}): GrowthAnalytics & { _config(): C } {
  const noop: IngestResponse = { eventId: null, eventName: null, warnings: [] }
  let userId: string | null = null
  let anonId: string | null = null
  let anonInFlight: Promise<string> | null = null

  function mirror(kind: "identify" | "track", label: string, properties: GrowthEventProperties): void {
    if (!args.debug) return
    args.debugSink.record({ kind, label, properties, occurredAt: args.now(), suppressed: true })
  }

  function getAnonymousId(): Promise<string> {
    if (anonId !== null) return Promise.resolve(anonId)
    if (!anonInFlight) {
      anonInFlight = (async () => {
        let stored: string | null = null
        try { stored = await Promise.resolve(args.storage.get(args.anonKey)) } catch { stored = null }
        // A concurrent reset() may have rotated the id while the read was in flight.
        if (anonId === null) anonId = stored || args.generateId()
        return anonId
      })()
    }
    return anonInFlight
  }

  function track(eventName: string, properties?: GrowthEventProperties): Promise<IngestResponse> {
    mirror("track", eventName, properties ?? {})
    return Promise.resolve(noop)
  }

  return {
    isSuppressed: true,
    resolvedBuildChannel: args.buildChannel,
    identify(userIdOrArgs?: string | IdentifyArgs | null, traits?: GrowthEventProperties) {
      const idArgs: IdentifyArgs =
        typeof userIdOrArgs === "string" || userIdOrArgs === null
          ? { userId: userIdOrArgs, traits: traits ?? {} }
          : { ...(userIdOrArgs ?? {}) }
      if (idArgs.userId !== undefined) userId = idArgs.userId
      mirror("identify", userId ?? idArgs.username ?? idArgs.email ?? "<anonymous>", idArgs.traits ?? {})
      return Promise.resolve(noop)
    },
    track,
    trackFirstOpen() { return track("app.first_open") },
    // Never reads/writes install state: the production build must see a clean slate.
    trackFirstOpenIfNeeded() { return Promise.resolve(null) },
    trackAppUpdated(u) {
      const properties: GrowthEventProperties = { reason: u.reason, is_real_update: u.isRealUpdate }
      if (u.fromVersion != null) properties.from_version = u.fromVersion
      if (u.toVersion != null) properties.to_version = u.toVersion
      return track("app.updated", properties)
    },
    trackAppOpen() { return track("app.opened") },
    trackPurchaseCompleted(p) {
      const properties: GrowthEventProperties = { currency: p.currency, amount: p.amount }
      if (p.productId) properties.productId = p.productId
      return track("purchase.completed", properties)
    },
    submitWebReferrer() { return Promise.resolve(noop) },
    submitSurvey(s) {
      mirror("track", `survey:${s.surveyId}`, { status: s.status ?? "completed", responses: s.responses.length })
      return Promise.resolve({ submissionId: s.submissionId ?? args.generateId(), accepted: 0, warnings: [] })
    },
    addBridge() { return () => {} },
    setUserId(id) { userId = id },
    getUserId() { return userId },
    getAnonymousId,
    reset() {
      userId = null
      anonId = args.generateId()
      return Promise.resolve()
    },
    recordClickId() { return Promise.resolve() },
    captureClickIds() { return Promise.resolve(0) },
    markInstalledBeforeTracking() { return Promise.resolve() },
    _config() { return args.config },
  }
}

/** One info line per suppressed client. Never includes the write key. */
export function logSuppressed(channel: GrowthBuildChannel, disabled: boolean): void {
  try {
    // eslint-disable-next-line no-console
    console.info(`GTM Easy: suppressing events (channel=${channel}${disabled ? ", disabled=true" : ""})`)
  } catch { /* ignore */ }
}

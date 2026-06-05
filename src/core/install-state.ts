/**
 * Pure install/update classification. Given the persisted state, the current app version,
 * and an OS install signal, decide what lifecycle event (if any) this launch should emit.
 * No I/O — `analytics.ts` owns the storage reads/writes around this.
 */

/** Whether the OS believes a build of this app existed before the SDK first ran.
 *  `"unknown"` is the safe default → fresh install (never under-count an acquisition). */
export type GrowthInstallSignal = "fresh" | "existed" | "unknown"

/** Why an `app.updated` event fired. Mirrors the `reason` property the server stores. */
export type GrowthUpdateReason = "version_change" | "build_change" | "pre_existing_install"

export type GrowthLaunchType =
  | { type: "fresh_install" }
  | { type: "update"; reason: GrowthUpdateReason; fromVersion: string | null; fromBuild: string | null }
  | { type: "launch" }

export const FIRST_OPEN_KEY = "gtm_easy_growth_first_open_fired"
export const INSTALL_AT_KEY = "gtm_easy_growth_install_at"
export const LAST_VERSION_KEY = "gtm_easy_growth_last_app_version"
export const LAST_BUILD_KEY = "gtm_easy_growth_last_build_number"

export interface ResolveLaunchInput {
  firstOpenFired: boolean
  lastVersion: string | null
  lastBuild: string | null
  currentVersion: string | null
  currentBuild: string | null
  signal: GrowthInstallSignal
  /** False for volatile stores (in-memory) where we can't reliably gate installs. */
  storageIsPersistent: boolean
  environment: "production" | "staging" | "development"
  trackBuildChanges: boolean
}

export function resolveLaunch(input: ResolveLaunchInput): GrowthLaunchType {
  // Volatile storage (node default, RN without AsyncStorage): every cold start looks
  // fresh, so we never auto-fire an install — it would spam `app.first_open`.
  if (!input.storageIsPersistent) return { type: "launch" }

  if (input.firstOpenFired) {
    // No recorded baseline: either an install marked pre-existing without a version, or a
    // pre-0.4.0 install that persisted `first_open_fired` before version tracking existed.
    // We have nothing to diff against, so adopt this launch's version as the baseline
    // silently — never fabricate an `app.updated(version_change, from=null)`.
    if (input.lastVersion === null && input.lastBuild === null) return { type: "launch" }
    // Only a *present* current value that differs is a real change. A null current
    // (caller omitted the arg, or a native version lookup transiently failed) carries
    // no information — never fabricate an `app.updated` from missing data, and the
    // caller likewise preserves the stored baseline rather than wiping it.
    const versionChanged = input.currentVersion !== null && input.lastVersion !== input.currentVersion
    const buildChanged = input.currentBuild !== null && input.lastBuild !== input.currentBuild
    if (!versionChanged && !buildChanged) return { type: "launch" }
    const reason: GrowthUpdateReason = versionChanged ? "version_change" : "build_change"
    // Build numbers churn every CI build; outside production a build-only bump is noise.
    if (reason === "build_change" && input.environment !== "production" && !input.trackBuildChanges) {
      return { type: "launch" }
    }
    return { type: "update", reason, fromVersion: input.lastVersion, fromBuild: input.lastBuild }
  }

  // First SDK run on persistent storage.
  if (input.signal === "existed") {
    return { type: "update", reason: "pre_existing_install", fromVersion: null, fromBuild: null }
  }
  // "fresh" or "unknown" → genuine fresh install.
  return { type: "fresh_install" }
}

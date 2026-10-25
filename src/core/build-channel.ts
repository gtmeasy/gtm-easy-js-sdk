/**
 * Build-channel detection for `suppressTestBuilds`. Offline, synchronous, and
 * resolved once per client at construction.
 *
 * Pure JS can only see React Native's `__DEV__` global, so detection yields
 * `"debug"` for Metro/dev bundles and `"unknown"` everywhere else. TestFlight,
 * Ad Hoc and Play test builds can't be told apart from JS — the host app passes
 * `buildChannel` (see the README's Expo recipe). No `NODE_ENV` sniffing:
 * bundlers inline it inconsistently.
 */

export type GrowthBuildChannel = "debug" | "testflight" | "internalTest" | "production" | "unknown"

/** Channels dropped when `suppressTestBuilds` is on. `unknown` is never suppressed (fail open). */
export const SUPPRESSED_BUILD_CHANNELS: readonly GrowthBuildChannel[] = ["debug", "testflight", "internalTest"]

/** The globals detection reads. Injectable so tests don't have to mutate `globalThis`. */
export interface BuildChannelGlobals {
  __DEV__?: boolean
}

/** Auto-detect the host's build channel: RN `__DEV__ === true` → `"debug"`, else `"unknown"`. */
export function detectBuildChannel(globals: BuildChannelGlobals = globalThis as BuildChannelGlobals): GrowthBuildChannel {
  try {
    return globals.__DEV__ === true ? "debug" : "unknown"
  } catch {
    return "unknown"
  }
}

/** A caller-supplied override always wins; `undefined` falls through to detection. */
export function resolveBuildChannel(
  override: GrowthBuildChannel | undefined,
  detect: () => GrowthBuildChannel = detectBuildChannel,
): GrowthBuildChannel {
  if (override !== undefined) return override
  try {
    return detect()
  } catch {
    return "unknown"
  }
}

/** `suppressed = disabled || (suppressTestBuilds && channel ∈ {debug, testflight, internalTest})`. */
export function isSuppressedBuild(args: {
  disabled: boolean
  suppressTestBuilds: boolean
  channel: GrowthBuildChannel
}): boolean {
  if (args.disabled) return true
  return args.suppressTestBuilds && SUPPRESSED_BUILD_CHANNELS.includes(args.channel)
}

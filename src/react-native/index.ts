import { createGrowthAnalyticsCore } from "../core/analytics"
import { MemoryStorage, ReactNativeStorage, type AsyncStorageLike } from "../core/storage"
import type { GrowthAnalytics, GrowthAnalyticsConfiguration } from "../core/types"

// Survey capture is runtime-neutral — re-export the helpers + types so an RN
// consumer imports them from this one subpath (the skills forbid bare-root imports).
export { surveyAnswer, trackSurveyShown, trackSurveyStarted } from "../core/survey-events"
export type { SurveyLifecycleArgs } from "../core/survey-events"
export type { SurveyAnswer, SubmitSurveyArgs, SurveySubmitResponse, SurveyResponseStatus } from "../core/types"

export type ReactNativeGrowthAnalyticsConfiguration = Omit<GrowthAnalyticsConfiguration, "platform"> & {
  platform?: GrowthAnalyticsConfiguration["platform"]
  asyncStorage?: AsyncStorageLike
}

/**
 * Create a GrowthAnalytics instance for React Native. By default, the SDK uses
 * the host app's `@react-native-async-storage/async-storage` via the
 * [asyncStorage] argument; without it the SDK falls back to in-memory storage
 * (per-session anonymous id, no install-id persistence).
 */
export function createGrowthAnalytics(config: ReactNativeGrowthAnalyticsConfiguration): GrowthAnalytics {
  const storage = config.storage
    ?? (config.asyncStorage ? new ReactNativeStorage(config.asyncStorage) : new MemoryStorage())
  return createGrowthAnalyticsCore({
    ...config,
    platform: config.platform ?? detectMobilePlatform(),
    storage,
  })
}

function detectMobilePlatform(): GrowthAnalyticsConfiguration["platform"] {
  // React Native exposes Platform.OS; we read it via globalThis to avoid pulling
  // react-native as a hard dep.
  const Platform = (globalThis as { Platform?: { OS?: string } }).Platform
  if (Platform?.OS === "ios") return "ios"
  if (Platform?.OS === "android") return "android"
  return "web"
}

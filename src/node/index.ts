import { createGrowthAnalyticsCore } from "../core/analytics"
import { MemoryStorage } from "../core/storage"
import type { GrowthAnalytics, GrowthAnalyticsConfiguration } from "../core/types"

export type NodeGrowthAnalyticsConfiguration = Omit<GrowthAnalyticsConfiguration, "platform"> & {
  platform?: GrowthAnalyticsConfiguration["platform"]
}

/**
 * Create a GrowthAnalytics instance for server-side use (Node, Bun, Deno, edge).
 * Anonymous id is in-memory by default; pass your own storage for durable IDs.
 */
export function createGrowthAnalytics(config: NodeGrowthAnalyticsConfiguration): GrowthAnalytics {
  return createGrowthAnalyticsCore({
    ...config,
    platform: config.platform ?? "server",
    storage: config.storage ?? new MemoryStorage(),
  })
}

// Survey capture is runtime-neutral — re-export the helpers + types so a server
// consumer imports them from this one subpath (the skills forbid bare-root imports).
export { surveyAnswer, trackSurveyShown, trackSurveyStarted } from "../core/survey-events"
export type { SurveyLifecycleArgs } from "../core/survey-events"
export type { SurveyAnswer, SubmitSurveyArgs, SurveySubmitResponse, SurveyResponseStatus } from "../core/types"

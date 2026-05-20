import type { GrowthAnalytics, IngestResponse } from "./types"

/**
 * Typed helpers for the paywall + checkout funnel. Wrap `analytics.track`
 * with canonical event names (matching the server-side whitelist) and
 * required properties so connectors (Meta CAPI / TikTok / Google Ads) get
 * consistent shapes.
 */

export interface PaywallOpenedArgs {
  placement: string
  variant?: string
  productIds?: string[]
  properties?: Record<string, string | number | boolean | null>
}

export async function trackPaywallOpened(
  analytics: GrowthAnalytics,
  args: PaywallOpenedArgs,
): Promise<IngestResponse> {
  const properties: Record<string, string | number | boolean | null | string[]> = {
    ...(args.properties ?? {}),
    placement: args.placement,
  }
  if (args.variant) properties.variant = args.variant
  if (args.productIds?.length) properties.product_ids = args.productIds
  return analytics.track("paywall.opened", properties)
}

export interface PaywallPlanSelectedArgs {
  placement: string
  productId: string
  price?: number
  currency?: string
  variant?: string
}

export async function trackPaywallPlanSelected(
  analytics: GrowthAnalytics,
  args: PaywallPlanSelectedArgs,
): Promise<IngestResponse> {
  const properties: Record<string, string | number> = {
    placement: args.placement,
    product_id: args.productId,
  }
  if (args.price !== undefined) properties.price = args.price
  if (args.currency) properties.currency = args.currency
  if (args.variant) properties.variant = args.variant
  return analytics.track("paywall.plan_selected", properties)
}

export interface PaywallUpgradeClickedArgs {
  placement: string
  productId: string
  price?: number
  currency?: string
}

export async function trackPaywallUpgradeClicked(
  analytics: GrowthAnalytics,
  args: PaywallUpgradeClickedArgs,
): Promise<IngestResponse> {
  const properties: Record<string, string | number> = {
    placement: args.placement,
    product_id: args.productId,
  }
  if (args.price !== undefined) properties.price = args.price
  if (args.currency) properties.currency = args.currency
  return analytics.track("paywall.upgrade_clicked", properties)
}

export interface PaywallUpgradeCancelledArgs {
  placement: string
  productId?: string
  reason?: string
}

export async function trackPaywallUpgradeCancelled(
  analytics: GrowthAnalytics,
  args: PaywallUpgradeCancelledArgs,
): Promise<IngestResponse> {
  const properties: Record<string, string> = { placement: args.placement }
  if (args.productId) properties.product_id = args.productId
  if (args.reason) properties.reason = args.reason
  return analytics.track("paywall.upgrade_cancelled", properties)
}

export async function trackPaywallClosed(
  analytics: GrowthAnalytics,
  args: { placement: string; reason?: string },
): Promise<IngestResponse> {
  const properties: Record<string, string> = { placement: args.placement }
  if (args.reason) properties.reason = args.reason
  return analytics.track("paywall.closed", properties)
}

export async function trackTrialStarted(
  analytics: GrowthAnalytics,
  args: { productId: string; trialDurationDays?: number; transactionId?: string },
): Promise<IngestResponse> {
  const properties: Record<string, string | number> = { product_id: args.productId }
  if (args.trialDurationDays !== undefined) properties.trial_duration_days = args.trialDurationDays
  if (args.transactionId) properties.transaction_id = args.transactionId
  return analytics.track("trial.started", properties)
}

export async function trackRestoreCompleted(
  analytics: GrowthAnalytics,
  args: { restored: boolean; productIds?: string[] },
): Promise<IngestResponse> {
  const properties: Record<string, boolean | string[]> = { restored: args.restored }
  if (args.productIds?.length) properties.product_ids = args.productIds
  return analytics.track("paywall.restore_completed", properties)
}

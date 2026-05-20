import { createGrowthAnalytics, installAutoInstrumentation } from "@gtmeasy/growth/web"
import { defaultDebugSink } from "@gtmeasy/growth"

/**
 * Single-instance Growth client for the web sample.
 *
 * Configure via Vite env vars at build time:
 *   VITE_GROWTH_ENDPOINT=https://www.gtmeasy.com
 *   VITE_GROWTH_WRITE_KEY=wk_live_...
 *
 * Defaults below point at the LAN staging endpoint used by the GTM Easy
 * monorepo, with a placeholder write key.
 */
const ENDPOINT = import.meta.env.VITE_GROWTH_ENDPOINT ?? "https://www.gtmeasy.com"
const WRITE_KEY = import.meta.env.VITE_GROWTH_WRITE_KEY ?? "wk_sample_replace_me"

const analytics = createGrowthAnalytics({
  app: "twilar",
  writeKey: WRITE_KEY,
  endpoint: ENDPOINT,
  environment: "staging",
  debug: true,
})

// Auto-instrumentation: page views on first load + history navigation,
// data-gtm-event clicks, utm_* / gclid / fbclid capture on first load.
installAutoInstrumentation(analytics, {
  trackPageViews: true,
  trackClicks: true,
  trackReferrer: true,
})

// Wire every identify/track from the debug sink to the live log.
const logEl = document.getElementById("log") as HTMLPreElement
defaultDebugSink.subscribe((event) => {
  const line = JSON.stringify(
    { kind: event.kind, label: event.label, properties: event.properties },
    null,
    2,
  )
  logEl.textContent = `${new Date(event.occurredAt).toISOString().slice(11, 23)}  ${line}\n\n${logEl.textContent ?? ""}`.slice(0, 50_000)
})

// ───────────────────────────────────────────────────────────── lifecycle
document.getElementById("firstOpen")!.addEventListener("click", () => {
  void analytics.trackFirstOpen()
})
document.getElementById("appOpened")!.addEventListener("click", () => {
  void analytics.trackAppOpen()
})
document.getElementById("pageViewed")!.addEventListener("click", () => {
  void analytics.track("page.viewed", { path: location.pathname, title: document.title })
})

// ───────────────────────────────────────────────────────────── identity
document.getElementById("identifyBtn")!.addEventListener("click", () => {
  const userId = readInput("userId")
  const email = readInput("email")
  const phone = readInput("phone")
  const traits: Record<string, unknown> = { signed_up: true }
  if (email) traits.email = email
  if (phone) traits.phone = phone
  void analytics.identify(userId || null, traits as Record<string, never>)
})
document.getElementById("setUserIdBtn")!.addEventListener("click", () => {
  const userId = readInput("userId") || null
  analytics.setUserId(userId)
})
document.getElementById("readAnonBtn")!.addEventListener("click", async () => {
  const id = await analytics.getAnonymousId()
  alert(`anonymousId = ${id}`)
})

// ───────────────────────────────────────────────────────────── click ids
document.getElementById("captureBtn")!.addEventListener("click", async () => {
  const raw = (document.getElementById("deepLink") as HTMLTextAreaElement).value.trim()
  const count = await analytics.captureClickIds(raw)
  appendLog(`captured ${count} click id(s) from ${raw}`)
})
document.getElementById("recordGclidBtn")!.addEventListener("click", async () => {
  await analytics.recordClickId("gclid", "test_g_123")
  appendLog("recorded gclid=test_g_123")
})

// ───────────────────────────────────────────────────────────── funnel
for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("button[data-evt]"))) {
  const evt = button.dataset.evt!
  button.addEventListener("click", () => void analytics.track(evt))
}
for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("button[data-paywall]"))) {
  const stage = button.dataset.paywall!
  button.addEventListener("click", () => void analytics.track(`paywall.${stage}`, {
    placement: "sample_paywall",
    product_id: "twilar.yearly.49_99",
    ...(stage === "plan_selected" || stage === "upgrade_clicked"
      ? { price: 49.99, currency: "USD" }
      : {}),
  }))
}
document.getElementById("purchaseBtn")!.addEventListener("click", () => {
  void analytics.trackPurchaseCompleted({
    amount: 49.99,
    currency: "USD",
    productId: "twilar.yearly.49_99",
  })
})

// ───────────────────────────────────────────────────────────── helpers
function readInput(id: string): string {
  return (document.getElementById(id) as HTMLInputElement).value.trim()
}

function appendLog(line: string) {
  logEl.textContent = `${new Date().toISOString().slice(11, 23)}  ${line}\n\n${logEl.textContent ?? ""}`.slice(0, 50_000)
}

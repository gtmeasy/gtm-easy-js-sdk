---
name: gtm-easy-web
description: Integrate the GTM Easy growth analytics SDK (`@gtmeasy/growth`) into a web app — Next.js, Remix, Vite, Astro, plain HTML, or any browser environment. Use when (1) The user wants to install or wire up `@gtmeasy/growth` for the web, (2) The user mentions "GTM Easy", "growth analytics", "gtmeasy.com", "GrowthAnalytics", or "gtm-easy-js-sdk", (3) The user wants page-view auto-instrumentation, click tracking via `data-gtm-event` attributes, UTM/gclid/fbclid capture, paywall funnel events, identify(), or third-party bridges (Clarity / PostHog / Sentry / Statsig), (4) The user is shipping a checkout, signup, or subscription flow and wants conversions to land in Meta CAPI / Google Ads / TikTok Events.
---

# GTM Easy Web integration

Wire `@gtmeasy/growth` (browser subpath) into the host web app. Covers npm install, singleton, auto-instrumentation, identify + track, deep-link click-id capture, paywall events, and bridges.

## Repo layout reference

Canonical SDK source: <https://github.com/gtmeasy/gtm-easy-js-sdk>.
Working sample: `examples/sample-web/` (Vite 5 + TS). When in doubt about a public API, read `examples/sample-web/src/main.ts`.

## 1. Install

```bash
pnpm add @gtmeasy/growth
# or: bun add / npm i / yarn add
```

The package ships subpath exports — pick the one matching the runtime:

- `@gtmeasy/growth/web` — browsers (uses `localStorage` for anon id)
- `@gtmeasy/growth/node` — server-side (Node / Bun / Deno) for backend tracks + webhooks
- `@gtmeasy/growth/react-native` — RN/Expo (see the `gtm-easy-react-native` skill)

## 2. Singleton (always do this)

`createGrowthAnalytics` owns persistent state. Construct it ONCE per process. For Next.js App Router put it in a client-only module:

```ts
// src/lib/growth.ts
"use client"

import { createGrowthAnalytics } from "@gtmeasy/growth/web"

export const analytics = createGrowthAnalytics({
  app: "<gtm-easy-app-id>",        // from gtmeasy.com → Settings
  writeKey: "<per-app-write-key>", // public SDK key, safe to ship in JS
  environment: "production",       // "staging" for QA
  // endpoint defaults to https://www.gtmeasy.com — override only for self-hosted
})
```

For plain HTML / no-bundler sites, the dashboard's **Install → Web script** snippet drops a `<script async src=".../api/v1/growth/script.js" data-app=... data-write-key=...>` that does the same thing without npm.

## 3. Auto-instrumentation (web only)

Wire this once at the top of the app — it handles SPA history transitions and click capture:

```ts
import { installAutoInstrumentation } from "@gtmeasy/growth/web"
import { analytics } from "@/lib/growth"

installAutoInstrumentation(analytics, {
  trackPageViews: true,   // initial load + history.pushState/popstate
  trackClicks: true,      // ONLY elements carrying data-gtm-event=...
  trackReferrer: true,    // utm_* + gclid + fbclid + every supported click id
})
```

To emit a click event, mark the element:

```html
<button data-gtm-event="cta.clicked" data-gtm-placement="hero">Get started</button>
```

`data-gtm-*` attributes (except `event`) become event properties.

## 4. Deep-link / landing-page click-id capture

`installAutoInstrumentation({ trackReferrer: true })` covers the initial landing URL. For client-side route changes that mutate `?gclid=...` (rare), call:

```ts
await analytics.captureClickIds(window.location.href)
```

`fbc` / `fbp` are auto-synthesized; each click ID persists 90 days.

## 5. Identify + track

```ts
// username + email are first-class — pass them at the top level, not in traits.
await analytics.identify({ userId: "user_123", username: "john_wayne", email: "u@x.com", traits: { plan: "pro" } })
await analytics.track("feature.used", { feature: "export" })

// On logout: forget the identity and rotate the anonymous id.
await analytics.reset()
```

`username` + `email` persist durably and reattach to every later `track`. Email is SHA-256 hashed server-side for Enhanced Matching — never hash on the client. (Email/phone in `traits` are still hashed too, for back-compat.)

## 6. Paywall funnel — use the typed helpers

Ad-platform connectors (Meta CAPI, Google Ads, TikTok Events) depend on canonical payload shapes. Hand-rolled `track("paywall.…")` payloads will drift over time. Use:

```ts
import {
  trackPaywallOpened,
  trackPaywallPlanSelected,
  trackPaywallUpgradeClicked,
  trackPaywallUpgradeCancelled,
} from "@gtmeasy/growth"
import { analytics } from "@/lib/growth"

await trackPaywallOpened(analytics, { placement: "settings_upgrade", productIds: ["pro_yearly"] })
await trackPaywallPlanSelected(analytics, { placement: "settings_upgrade", productId: "pro_yearly", price: 49.99, currency: "USD" })
await trackPaywallUpgradeClicked(analytics, { placement: "settings_upgrade", productId: "pro_yearly", price: 49.99, currency: "USD" })
await analytics.trackPurchaseCompleted({ amount: 49.99, currency: "USD", productId: "pro_yearly" })
```

Also available: `trackPaywallClosed`, `trackTrialStarted`, `trackRestoreCompleted`.

## 7. Server-side conversions (Stripe, post-checkout)

For purchase events that fire from your server (Stripe webhook handler) — use the `node` subpath with a **server write key** (separate from the browser key, scoped to backend writes):

```ts
// api/stripe/webhook
import { createGrowthAnalytics } from "@gtmeasy/growth/node"

const analytics = createGrowthAnalytics({
  app: "<gtm-easy-app-id>",
  writeKey: process.env.GTM_EASY_SERVER_WRITE_KEY!,
})

await analytics.trackPurchaseCompleted({ amount, currency, productId, userId })
```

This is the canonical path for Stripe / RevenueCat / Shopify-style server-attributed revenue.

## 8. Bridges — one user, all your tools

```ts
import {
  installClarityBridge,
  installPostHogBridge,
  installSentryBridge,
  installStatsigBridge,
} from "@gtmeasy/growth/bridges"

installClarityBridge(analytics, window.clarity)
installPostHogBridge(analytics, posthog)
installSentryBridge(analytics, Sentry)
installStatsigBridge(analytics, Statsig)
```

Every bridge wraps third-party calls in try/catch — a misconfigured connector never breaks the event pipeline.

## 9. Onboarding surveys

Capture flexible onboarding answers — choice breakdowns, rating histograms, NPS, and free-text samples aggregate on the dashboard with no server-side survey definition. Mark the survey shown first (optional, drives the shown→completed rate), then submit answers built with the `surveyAnswer.*` helpers:

```ts
import { surveyAnswer, trackSurveyShown } from "@gtmeasy/growth/web"

await trackSurveyShown(analytics, { surveyId: "onboarding_v1", surveyName: "Onboarding" })

const ack = await analytics.submitSurvey({
  surveyId: "onboarding_v1",
  surveyName: "Onboarding",
  surveyVersion: "2",
  responses: [
    surveyAnswer.singleChoice("source", "tiktok", { label: "TikTok", questionText: "Where did you hear about us?" }),
    surveyAnswer.multiChoice("goals", ["focus", "limits"], { labels: ["Stay focused", "Set limits"] }),
    surveyAnswer.nps("recommend", 9),
    surveyAnswer.rating("first_impression", 5),
    surveyAnswer.text("anything_else", "Loving it so far"),
  ],
})
```

Pass `status: "partial"` to store answers without firing a completion event, or `status: "dismissed"` when the user closes it. The SDK mints the `submissionId` on the client so a transparent retry reuses the same key (server dedups); pass your own to make app-level retries idempotent. Don't truncate free text — the survey store accepts up to 2 000 chars per answer.

Attach free-form `metadata` to the whole submission (`submitSurvey({ ..., metadata: { variant: "B" } })`, echoed onto every answer row) or to a single answer (`surveyAnswer.rating("q", 5, { metadata: { ms_to_answer: 1200 } })`, merged **over** the submission-level payload). It lands in a JSON column read with `JSONExtract` on demand — use it for A/B variants, answer timings, or any field you may add later, with no schema migration.

## 10. Things to NOT do

- **Don't construct `createGrowthAnalytics` per render.** It owns persistent state; treat it as a module-level singleton.
- **Don't fire `paywall.*` via raw `track`.** Use the typed helpers so connectors stay correct.
- **Don't hash email/phone before passing to `identify`.** The server hashes; double-hashing breaks Enhanced Matching.
- **Don't ship the server write key in the browser.** Use the browser-scoped write key for `@gtmeasy/growth/web` and a separate `GTM_EASY_SERVER_WRITE_KEY` for `@gtmeasy/growth/node`.
- **Don't import from `@gtmeasy/growth` without a subpath** in app code — always pick `/web`, `/node`, or `/react-native`. The barrel export pulls in cross-runtime weight you don't need.

## 11. Verifying the wire-up

1. Open the GTM Easy dashboard → **Events** for the configured `app`.
2. Load the site once — first event is `app.first_open` + `page.viewed`. Reloading produces only `page.viewed`.
3. Open the site with `?gclid=test_g` — the `page.viewed`'s `_ctx.gclid` must be `test_g`.
4. Click a `data-gtm-event="cta.clicked"` element — dashboard shows `cta.clicked` within a few seconds.
5. Call `analytics.identify("user_123")` — Users view links `user_123` to the device's anonymous id.

If nothing arrives, set `debug: true` and check the browser console — every identify + track logs to `defaultDebugSink`. Wrong write keys return 401 silently in production; staging surfaces them.

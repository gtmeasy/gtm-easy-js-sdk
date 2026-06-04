# GTM Easy JS SDK

First-party TypeScript SDK for [GTM Easy](https://gtmeasy.com) growth analytics — works in **browsers**, **Node**, **Bun**, **Deno**, and **React Native** with a single package and explicit subpath exports.

Sends events to the GTM Easy ingestion API, identifies users, persists an anonymous ID, persists every ad-platform click ID, drives the paywall funnel with typed helpers, captures install / referrer attribution, and bridges a single user across the analytics tools you already use:

## What's new (v0.5.0)

- **Version alignment**: the GTM Easy SDKs (TypeScript / Swift / Kotlin) are now unified at **0.5.0** — no API changes since 0.4.x, so onboarding surveys + extensible survey metadata ship at the same version on every platform.

## What's new (v0.4.0)

- **Onboarding surveys**: `analytics.submitSurvey({ surveyId, responses })` captures flexible, self-describing survey answers (single/multi choice, rating, NPS, scale, boolean, free text) with no length truncation. Build answers with the `surveyAnswer.*` helpers. `trackSurveyShown` / `trackSurveyStarted` power the shown→completed funnel on the dashboard. The SDK mints the idempotency key on-device so transparent retries dedup, and attaches device/click common context under `properties._ctx`.

## What's new (v0.3.0)

- **First-class identity**: `identify(userId, { username, email, traits })` now accepts optional `username` and `email` as top-level fields (not smuggled inside `traits`), persisted and reused on every later `track`.
- **Logout-safe reset**: identity is hydrated once and cached in memory; `track`/`identify` snapshot the anonymous id synchronously, so a concurrent `reset()` can no longer tear the anon id. `reset()` rotates the anon id and clears identity atomically.
- **Identity-aware bridges**: Clarity (friendly name + email/username tags), PostHog (`$set` email/name, reset on logout), Sentry (`setUser` username/email, cleared on logout), and Statsig (`custom.username/email`, cleared on logout) now follow identity automatically.

## What's new (v0.2.0)

- **Click ID store**: `GrowthClickIdStore` persists `fbc/fbp/fbclid/gclid/wbraid/gbraid/ttclid/igshid/msclkid/twclid` with 90-day TTL. `analytics.captureClickIds(url)` walks deep links + landing-page query strings.
- **Auto-instrumentation upgrade**: `installAutoInstrumentation(analytics, { trackReferrer: true })` now captures all click IDs in addition to the historic `gclid`/`fbclid` + UTM.
- **Typed paywall helpers**: `trackPaywallOpened`, `trackPaywallPlanSelected`, `trackPaywallUpgradeClicked`, `trackPaywallUpgradeCancelled`, `trackPaywallClosed`, `trackTrialStarted`, `trackRestoreCompleted`.
- **Debug sink**: `createGrowthAnalytics({ debug: true })` mirrors every event to `defaultDebugSink` (subscribable) and `console.log`.
- **Device context provider**: pluggable `DeviceContextProvider` — `webDeviceContextProvider` collects UA/viewport/screen; React Native apps inject their own bridge.
- **Generated typed client**: `src/generated/` contains an `openapi-generator-cli` `typescript-fetch` low-level client that mirrors the server contract.

- **Microsoft Clarity** (session replay)
- **PostHog** (cloud or self-hosted)
- **Sentry** (cloud or self-hosted)
- **Statsig** (feature flags + product analytics)

## Install

```bash
pnpm add @gtmeasy/growth
# or
bun add @gtmeasy/growth
npm i @gtmeasy/growth
```

For React Native, also install `@react-native-async-storage/async-storage` so the SDK can persist the anonymous id.

## Quick start — web

```ts
import { createGrowthAnalytics } from "@gtmeasy/growth/web"

export const analytics = createGrowthAnalytics({
  app: "<gtm-easy-app-id>",
  writeKey: "<per-app-write-key>",
})

await analytics.identify("user_123", { plan: "pro" })
await analytics.trackFirstOpen()
await analytics.trackPurchaseCompleted({ amount: 9.99, currency: "USD", productId: "pro_monthly" })
```

`endpoint` defaults to the production ingest host
(`https://www.gtmeasy.com` — exported as `GROWTH_DEFAULT_ENDPOINT`). Override
only when running against a self-hosted deployment or local development:

```ts
import { createGrowthAnalytics } from "@gtmeasy/growth/web"

export const analytics = createGrowthAnalytics({
  app: "<gtm-easy-app-id>",
  writeKey: "<per-app-write-key>",
  endpoint: "https://your-self-hosted.example.com",
  environment: "development",
})
```

## Quick start — React Native

```ts
import { createGrowthAnalytics } from "@gtmeasy/growth/react-native"

export const analytics = createGrowthAnalytics({
  app: "<gtm-easy-app-id>",
  writeKey: "<per-app-write-key>",
})

await analytics.identify("user_123")
await analytics.track("page.viewed", { route: "Home" })
```

## Quick start — Node / Bun / Deno (server-side)

```ts
import { createGrowthAnalytics } from "@gtmeasy/growth/node"

const analytics = createGrowthAnalytics({
  app: "<gtm-easy-app-id>",
  writeKey: "<server-write-key>",
})

await analytics.track("subscription.renewed", { planId: "pro" }, { metricValue: 19.99, metricLabel: "USD" })
```

## Identifying users

`identify` attaches a stable **user id** plus optional **username** and **email** to
the current anonymous stream. All three are first-class (not smuggled in `traits`),
persisted to durable storage, and reused automatically on later `track` calls — so a
purchase that happens after an app reload still attributes to the signed-in user. On
the server these power the People dashboard and feed hashed ad-platform match keys
(email is hashed only at ad-platform egress; plaintext at rest).

```ts
// Object form — the ergonomic path for username + email.
await analytics.identify({
  userId: "user_123",
  username: "john_wayne",
  email: "john@example.com",
  traits: { plan: "pro" },
})

// String form still works for id-only identify.
await analytics.identify("user_123", { plan: "pro" })
```

Pass only the fields you have; omit a field to leave it unchanged. On logout, call
`reset()` to forget the identity and rotate the anonymous id so subsequent events
start a fresh anonymous stream instead of re-stitching onto the previous user:

```ts
await analytics.reset()
```

## Onboarding surveys

Capture flexible onboarding-survey answers. Each answer is self-describing (it
carries its question type + optional human label), so the GTM Easy dashboard
aggregates choice breakdowns, rating histograms, NPS, and free-text samples
without any server-side survey definition. Answers are stored verbatim (no
240-char truncation) in a dedicated survey store.

```ts
import { surveyAnswer, trackSurveyShown } from "@gtmeasy/growth/web"

// Optional: mark shown so the dashboard can compute a shown → completed rate.
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
console.log(ack.submissionId, ack.accepted) // idempotency key + rows persisted
```

Pass `status: "partial"` to store answers without completing the survey (no
completion event fires), or `status: "dismissed"` when the user closes it. The
SDK generates a `submissionId` on the client when you omit one, so a transparent
retry reuses the **same** key and the server dedups it; supply your own to make
app-level retries idempotent. A completed or dismissed submission also records a
`survey.completed` / `survey.dismissed` lifecycle event (carrying device/click
context under `_ctx`) for the user-journey timeline and connector fan-out.

### Extensible metadata

Attach free-form `metadata` to a submission (echoed onto every answer row) or to
an individual answer (merged **over** the submission-level payload). It is stored
in a dedicated JSON column and read with `JSONExtract` on demand — so you can add
A/B variants, answer timings, locale overrides, or any future field **without a
schema migration**.

```ts
await analytics.submitSurvey({
  surveyId: "onboarding_v1",
  metadata: { variant: "B", flow: "paywall_first" }, // on every row
  responses: [
    surveyAnswer.rating("first_impression", 5, { metadata: { ms_to_answer: 1200 } }),
    surveyAnswer.text("anything_else", "Loving it"),
  ],
})
```

## Bridges — one user, all your tools

Bridges mirror identify + track into third-party SDKs that the host app already
loads. They are pure interfaces — we never bundle Clarity / PostHog / Sentry /
Statsig as dependencies.

```ts
import { installClarityBridge, installPostHogBridge, installSentryBridge, installStatsigBridge } from "@gtmeasy/growth/bridges"

installClarityBridge(analytics, window.clarity)
installPostHogBridge(analytics, posthog)
installSentryBridge(analytics, Sentry)
installStatsigBridge(analytics, Statsig)
```

Every bridge wraps third-party calls in `try/catch` so a misconfigured connector
never breaks your event pipeline.

## Auto-instrumentation (web only)

```ts
import { installAutoInstrumentation } from "@gtmeasy/growth/web"

installAutoInstrumentation(analytics, {
  trackPageViews: true,
  trackClicks: true, // tracks data-gtm-* attributes only
})
```

## Development

```bash
bun install
bun test
bun run typecheck
bun run build
```

## License

MIT

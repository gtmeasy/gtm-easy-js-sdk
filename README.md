# GTM Easy JS SDK

First-party TypeScript SDK for [GTM Easy](https://gtmeasy.com) growth analytics — works in **browsers**, **Node**, **Bun**, **Deno**, and **React Native** with a single package and explicit subpath exports.

Sends events to the GTM Easy ingestion API, identifies users, persists an anonymous ID, persists every ad-platform click ID, drives the paywall funnel with typed helpers, captures install / referrer attribution, and bridges a single user across the analytics tools you already use:

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

# GTM Easy JS SDK

First-party TypeScript SDK for [GTM Easy](https://gtmeasy.com) growth analytics — works in **browsers**, **Node**, **Bun**, **Deno**, and **React Native** with a single package and explicit subpath exports.

Sends events to the GTM Easy ingestion API, identifies users, persists an anonymous ID, captures install / referrer attribution, and bridges a single user across the analytics tools you already use:

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
  endpoint: "https://www.gtmeasy.com",
  writeKey: "<per-app-write-key>",
  environment: "production",
})

await analytics.identify("user_123", { plan: "pro" })
await analytics.trackFirstOpen()
await analytics.trackPurchaseCompleted({ amount: 9.99, currency: "USD", productId: "pro_monthly" })
```

## Quick start — React Native

```ts
import { createGrowthAnalytics } from "@gtmeasy/growth/react-native"

export const analytics = createGrowthAnalytics({
  app: "<gtm-easy-app-id>",
  endpoint: "https://www.gtmeasy.com",
  writeKey: "<per-app-write-key>",
  environment: "production",
})

await analytics.identify("user_123")
await analytics.track("page.viewed", { route: "Home" })
```

## Quick start — Node / Bun / Deno (server-side)

```ts
import { createGrowthAnalytics } from "@gtmeasy/growth/node"

const analytics = createGrowthAnalytics({
  app: "<gtm-easy-app-id>",
  endpoint: "https://www.gtmeasy.com",
  writeKey: "<server-write-key>",
  environment: "production",
})

await analytics.track("subscription.renewed", { planId: "pro" }, { metricValue: 19.99, metricLabel: "USD" })
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

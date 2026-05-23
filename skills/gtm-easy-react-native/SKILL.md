---
name: gtm-easy-react-native
description: Integrate the GTM Easy growth analytics SDK (`@gtmeasy/growth/react-native`) into a React Native or Expo app. Use when (1) The user wants to install or wire up `@gtmeasy/growth` for React Native / Expo, (2) The user mentions "GTM Easy", "growth analytics", "gtmeasy.com", "GrowthAnalytics", "Expo Go", or "React Native analytics", (3) The user wants paywall funnel events, identify users, capture ad-platform click IDs (gclid/fbclid/...) from deep links (`expo-linking` or `Linking`), or wire iOS ATT / Android Limit-Ad-Tracking on top of `@gtmeasy/growth`, (4) The user is shipping a cross-platform mobile app and wants conversions to land in Meta CAPI / Google Ads / TikTok Events.
---

# GTM Easy React Native / Expo integration

Wire `@gtmeasy/growth/react-native` into a React Native or Expo app. Covers npm install, AsyncStorage persistence, deep-link click-id capture (the trickiest part on RN), identify + track, paywall events, and platform pinning.

## Repo layout reference

Canonical SDK source: <https://github.com/gtmeasy/gtm-easy-js-sdk>.
Working sample (Expo 51 + RN 0.74, every public surface in a single screen): `examples/sample-expo/` in that repo. When in doubt about a public API, read `examples/sample-expo/App.tsx` and `growthClient.ts`.

## 1. Install

```bash
npx expo install @gtmeasy/growth @react-native-async-storage/async-storage expo-linking
# bare RN: yarn add @gtmeasy/growth @react-native-async-storage/async-storage
#         + native autolinking via `pod install` (iOS)
```

`@react-native-async-storage/async-storage` is required — the SDK uses it to persist the anonymous id and click-id store across cold starts.

## 2. Singleton with explicit `platform` (always do this)

The RN adapter sniffs `globalThis.Platform.OS` if `platform` is omitted, but Expo doesn't populate that global — so the adapter falls back to `"web"` and ad-platform connectors mislabel native installs. **Always pass `platform` explicitly.**

```ts
// growthClient.ts
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Platform } from "react-native"
import { createGrowthAnalytics } from "@gtmeasy/growth/react-native"

const platform: "ios" | "android" | "web" =
  Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web"

export const analytics = createGrowthAnalytics({
  app: "<gtm-easy-app-id>",        // from gtmeasy.com → Settings
  writeKey: "<per-app-write-key>", // public SDK key, safe to ship
  environment: "production",       // "staging" for QA
  platform,
  asyncStorage: AsyncStorage,
  // endpoint defaults to https://www.gtmeasy.com — override only for self-hosted
})
```

For Expo, the dashboard endpoint MUST be HTTPS. iOS ATS blocks HTTP — point at LAN dev only if you set `app.json → ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads`.

## 3. Launch sequence (sequential, not parallel)

Three things must happen in this exact order on every cold start. **Doing them in parallel `useEffect`s races `getInitialURL()` against the first event and ships launch events without attribution:**

```tsx
// App.tsx
import { useEffect } from "react"
import * as Linking from "expo-linking"
import { analytics } from "./growthClient"

export default function App() {
  useEffect(() => {
    let cancelled = false
    void (async () => {
      // 1. Capture any inbound click IDs first so events carry them in _ctx.
      const initial = await Linking.getInitialURL()
      if (cancelled) return
      if (initial) await analytics.captureClickIds(initial)
      // 2. trackFirstOpen is server-deduped by identityHash — safe to call every launch.
      void analytics.trackFirstOpen()
      // 3. trackAppOpen on every cold start.
      void analytics.trackAppOpen()
    })()

    // Hot deep links while the app is foregrounded:
    const sub = Linking.addEventListener("url", ({ url }) => {
      void analytics.captureClickIds(url)
    })
    return () => { cancelled = true; sub.remove() }
  }, [])

  // ...
}
```

For bare React Native, swap `expo-linking` for `Linking` from `react-native`.

## 4. Identify + track

```ts
// username + email are first-class — pass them at the top level, not in traits.
await analytics.identify({ userId: "user_123", username: "john_wayne", email: "u@x.com", traits: { plan: "pro" } })
await analytics.track("page.viewed", { screen: "Home" })

// On logout: forget the identity and rotate the anonymous id.
await analytics.reset()
```

`username` + `email` persist via AsyncStorage and reattach to every later `track`.

Email/phone in traits are SHA-256 hashed server-side for Enhanced Matching — never hash on the client.

## 5. Paywall funnel — use the typed helpers

Ad-platform connectors (Meta CAPI, Google Ads, TikTok Events) depend on canonical payload shapes. Hand-rolled `track("paywall.…")` payloads will drift. Use:

```ts
import {
  trackPaywallOpened,
  trackPaywallPlanSelected,
  trackPaywallUpgradeClicked,
  trackPaywallUpgradeCancelled,
} from "@gtmeasy/growth"
import { analytics } from "./growthClient"

await trackPaywallOpened(analytics, { placement: "settings_upgrade", productIds: ["pro_yearly"] })
await trackPaywallPlanSelected(analytics, { placement: "settings_upgrade", productId: "pro_yearly", price: 49.99, currency: "USD" })
await trackPaywallUpgradeClicked(analytics, { placement: "settings_upgrade", productId: "pro_yearly", price: 49.99, currency: "USD" })
await analytics.trackPurchaseCompleted({ amount: 49.99, currency: "USD", productId: "pro_yearly" })
```

Also available: `trackPaywallClosed`, `trackTrialStarted`, `trackRestoreCompleted`.

## 6. iOS ATT (App Tracking Transparency)

Prompt ATT BEFORE firing the first event so the inaugural event carries the right consent state:

```ts
// Expo:
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency"
const { status } = await requestTrackingPermissionsAsync()
// Then proceed with the launch sequence in §3.
```

For bare RN, use `react-native-tracking-transparency`. The SDK does not auto-suppress IDFA — your host app must gate ATT and not pass IDFA into traits when denied.

## 7. App Store / Play Store subscription notifications

Both webhooks are server-to-server — wire them once in the GTM Easy dashboard, no client work required. They emit `subscription.renewed` / `subscription.expired` events keyed to the same identity as in-app events.

## 8. Bridges — one user, all your tools

```ts
import { installPostHogBridge, installSentryBridge, installStatsigBridge } from "@gtmeasy/growth/bridges"

installPostHogBridge(analytics, posthog)
installSentryBridge(analytics, Sentry)
installStatsigBridge(analytics, Statsig)
```

Microsoft Clarity is web-only and has no RN bridge.

## 9. Things to NOT do

- **Don't omit `platform`.** The RN adapter falls back to `"web"` and mislabels installs in Meta / Google connectors.
- **Don't omit `asyncStorage: AsyncStorage`.** Without it, the anonymous id regenerates on every cold start and every cold start looks like a new user.
- **Don't run `getInitialURL()` and `trackFirstOpen()` in separate parallel `useEffect`s.** They race; click IDs miss the launch event.
- **Don't fire `paywall.*` via raw `track`.** Use the typed helpers so connectors stay correct.
- **Don't hash email/phone before passing to `identify`.** The server hashes; double-hashing breaks Enhanced Matching.
- **Don't import from `@gtmeasy/growth` without `/react-native`** — the barrel export pulls in browser-only `localStorage` weight.

## 10. Verifying the wire-up

1. Open the app on a simulator and watch the GTM Easy dashboard → **Events**.
2. First cold start should produce `app.first_open` + `app.opened`. Subsequent launches only `app.opened`.
3. Deep-link into the app with a click ID:
   - iOS sim: `xcrun simctl openurl booted "yourapp://onboarding?gclid=sim_g"`
   - Android emu: `adb shell am start -W -a android.intent.action.VIEW -d "yourapp://onboarding?gclid=adb_g" <package>`
   The next event's `_ctx.gclid` must match.
4. Call `analytics.identify("user_123")` — Users view links `user_123` to the device's anonymous id.

If nothing arrives, set `debug: true` and inspect `defaultDebugSink.subscribe(...)`. Wrong write keys return 401 silently in production; staging surfaces them.

# Examples — GTM Easy Growth JS SDK

Two end-to-end samples that exercise every public surface of
`@gtmeasy/growth`:

| Sample          | Path                | Stack                      |
|-----------------|---------------------|----------------------------|
| Browser app     | `sample-web/`       | Vanilla TS + Vite 5        |
| Cross-platform  | `sample-expo/`      | Expo 51 + React Native     |

Both samples share the same five-section layout so flows are identical
across web, iOS (via Expo Go), and Android (via Expo Go):

1. **Lifecycle** — `trackFirstOpenIfNeeded` (install-vs-update gated), `trackAppOpen`, `page.viewed`
2. **Identity** — `getAnonymousId`, `setUserId`, `identify` (email/phone)
3. **Click IDs** — `captureClickIds(url)` + manual `recordClickId`
4. **Funnel** — paywall.opened → plan_selected → upgrade_clicked →
   purchase.completed
5. **Debug console** — live tail of `defaultDebugSink` (every identify+track)

## sample-web (Vite)

```bash
cd packages/growth-js-sdk/examples/sample-web
bun install
bun run dev          # http://localhost:5173
```

The auto-instrumentation (`installAutoInstrumentation`) wires:

- `page.viewed` on first load + every History API navigation
- `button.clicked` on any element carrying `data-gtm-event="…"`
- `utm_*` / `gclid` / `fbclid` capture from the initial URL

Configure via env vars at build time:

```bash
VITE_GROWTH_ENDPOINT=https://www.gtmeasy.com \
VITE_GROWTH_WRITE_KEY=wk_live_... \
bun run build
```

## sample-expo (Expo Go)

```bash
cd packages/growth-js-sdk/examples/sample-expo
bun install
bun run start        # scan QR with Expo Go app
# or:
bun run ios          # opens in iOS simulator
bun run android      # opens in Android emulator
bun run web          # opens in browser via react-native-web
```

The sample uses `expo-linking` to capture click IDs from inbound deep
links — test from a terminal:

```bash
# iOS simulator
xcrun simctl openurl booted "twilar://onboarding?gclid=adb_demo&fbclid=adb_fb"

# Android emulator
adb shell am start -W -a android.intent.action.VIEW \
  -d "twilar://onboarding?gclid=adb_demo&fbclid=adb_fb" \
  host.exp.exponent
```

Configure via Expo's `EXPO_PUBLIC_*` env vars:

```bash
EXPO_PUBLIC_GROWTH_ENDPOINT=https://www.gtmeasy.com \
EXPO_PUBLIC_GROWTH_WRITE_KEY=wk_live_... \
bun run start
```

## Networking notes

| Runtime               | Reach the dev server at        |
|-----------------------|--------------------------------|
| Browser (sample-web)  | `http://localhost:3000`        |
| iOS simulator (Expo)  | LAN IP, e.g. `http://192.168.3.241:3000` |
| Android emulator      | `http://10.0.2.2:3000`         |
| Physical device       | LAN IP — phone must be on the same network |

Production deployments always use `https://www.gtmeasy.com` (the SDK's
default endpoint).

import AsyncStorage from "@react-native-async-storage/async-storage"
import { Platform } from "react-native"
import { createGrowthAnalytics } from "@gtmeasy/growth/react-native"

/**
 * Singleton Growth client for the Expo sample. AsyncStorage persists the
 * anonymous id + click ids across cold starts.
 *
 * Production endpoint by default. To dogfood against LAN staging
 * (`http://192.168.3.241:3000`) set `EXPO_PUBLIC_GROWTH_ENDPOINT` and
 * disable ATS in `app.json` if needed.
 */
const ENDPOINT = process.env.EXPO_PUBLIC_GROWTH_ENDPOINT ?? "https://www.gtmeasy.com"
const WRITE_KEY = process.env.EXPO_PUBLIC_GROWTH_WRITE_KEY ?? "wk_sample_replace_me"

// The RN adapter sniffs `globalThis.Platform.OS` if `platform` is omitted,
// but Expo doesn't populate that global — so the adapter would fall back to
// "web" and ad-platform connectors would mislabel native installs. Always
// pass `platform` explicitly.
const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web"

export const analytics = createGrowthAnalytics({
  app: "twilar",
  writeKey: WRITE_KEY,
  endpoint: ENDPOINT,
  environment: "staging",
  platform,
  debug: true,
  asyncStorage: AsyncStorage,
})

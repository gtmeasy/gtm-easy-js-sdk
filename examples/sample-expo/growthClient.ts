import AsyncStorage from "@react-native-async-storage/async-storage"
import { createGrowthAnalytics } from "@gtmeasy/growth/react-native"

/**
 * Singleton Growth client for the Expo sample. AsyncStorage persists the
 * anonymous id + click ids across cold starts.
 *
 * LAN staging is HTTP — Expo Go on iOS/Android allows cleartext for `expo
 * start` by default, but production builds must use `https://www.gtmeasy.com`.
 */
const ENDPOINT = process.env.EXPO_PUBLIC_GROWTH_ENDPOINT ?? "http://192.168.3.241:3000"
const WRITE_KEY = process.env.EXPO_PUBLIC_GROWTH_WRITE_KEY ?? "wk_sample_replace_me"

export const analytics = createGrowthAnalytics({
  app: "twilar",
  writeKey: WRITE_KEY,
  endpoint: ENDPOINT,
  environment: "staging",
  debug: true,
  asyncStorage: AsyncStorage,
})

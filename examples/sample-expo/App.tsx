import { useEffect, useMemo, useState } from "react"
import { Button, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import Constants from "expo-constants"
import * as Linking from "expo-linking"
import { StatusBar } from "expo-status-bar"
import {
  defaultDebugSink,
  trackPaywallOpened,
  trackPaywallPlanSelected,
  trackPaywallUpgradeClicked,
  trackPaywallUpgradeCancelled,
  type DebugEvent,
} from "@gtmeasy/growth"

import { analytics } from "./growthClient"

/**
 * Single-screen Expo Go sample. Walks the same surfaces as the iOS/Android
 * samples so an investor can flip between simulators and see identical
 * payloads land on the backend.
 *
 * Sections:
 *   - Lifecycle      — trackFirstOpenIfNeeded + trackAppOpen + trackPageViewed
 *   - Identity       — getAnonymousId / setUserId / identify with traits
 *   - Click IDs      — captureClickIds(URL) + manual recordClickId
 *   - Funnel         — paywall.opened → ... → purchase.completed
 *   - Debug Console  — tail of defaultDebugSink (every identify+track)
 */
// Running bundle version + build, read from the Expo manifest. The SDK persists
// these and only fires app.first_open on a genuine fresh install — an app UPDATE
// (version/build changed) emits app.updated instead, never a second install.
const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0"
const APP_BUILD = String(
  Platform.OS === "ios"
    ? Constants.expoConfig?.ios?.buildNumber ?? "0"
    : Constants.expoConfig?.android?.versionCode ?? 0,
)

export default function App() {
  // ───────────────────────────────────────────────────── launch sequence
  // Run in a fixed order so the first event already carries any inbound
  // click IDs in _ctx:
  //   1. await Linking.getInitialURL() + captureClickIds
  //   2. trackFirstOpenIfNeeded — install-vs-update is decided locally from
  //      persisted state; this is NOT server-deduped, so never swap in the
  //      deprecated trackFirstOpen() here (it would count updates as installs).
  //   3. trackAppOpen (every cold start)
  // Firing these in a separate parallel useEffect races getInitialURL() and
  // ships the launch events without attribution.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const initial = await Linking.getInitialURL()
      if (cancelled) return
      if (initial) await analytics.captureClickIds(initial)
      // Await so a fresh install's inaugural event is app.first_open, not a bare app.opened.
      await analytics.trackFirstOpenIfNeeded({ appVersion: APP_VERSION, buildNumber: APP_BUILD })
      void analytics.trackAppOpen()
    })()
    const sub = Linking.addEventListener("url", ({ url }) => {
      void analytics.captureClickIds(url)
    })
    return () => {
      cancelled = true
      sub.remove()
    }
  }, [])

  // ───────────────────────────────────────────────────────── debug tail
  const [events, setEvents] = useState<DebugEvent[]>([])
  useEffect(() => {
    return defaultDebugSink.subscribe((event) => {
      setEvents((prev) => [event, ...prev].slice(0, 50))
    })
  }, [])

  // ───────────────────────────────────────────────────────── identity
  const [userId, setUserId] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [anonymousId, setAnonymousId] = useState("(loading…)")
  useEffect(() => {
    void analytics.getAnonymousId().then(setAnonymousId)
  }, [])

  // ───────────────────────────────────────────────────────── click ids
  const [deepLink, setDeepLink] = useState(
    "twilar://onboarding?gclid=demo123&fbclid=demoFB&utm_campaign=spring_sale",
  )

  const placement = "sample_paywall"
  const productId = "twilar.yearly.49_99"

  // Memoised button factory using the typed paywall helpers from
  // `@gtmeasy/growth` — connectors (Meta CAPI, Google Ads, TikTok Events)
  // depend on the canonical payload shapes these wrappers enforce, so
  // hand-rolling the same `track("paywall.…")` payloads would drift over time.
  const handlers = useMemo(() => ({
    paywallOpened: () => void trackPaywallOpened(analytics, { placement, productIds: [productId] }),
    planSelected: () => void trackPaywallPlanSelected(analytics, { placement, productId, price: 49.99, currency: "USD" }),
    upgradeClicked: () => void trackPaywallUpgradeClicked(analytics, { placement, productId, price: 49.99, currency: "USD" }),
    upgradeCancelled: () => void trackPaywallUpgradeCancelled(analytics, { placement, productId, reason: "user_cancelled_sheet" }),
    purchase: () => void analytics.trackPurchaseCompleted({ amount: 49.99, currency: "USD", productId }),
  }), [])

  return (
    <View style={styles.flex}>
      <StatusBar style="auto" />
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Twilar Sample · Expo</Text>
        <Text style={styles.subtitle}>
          Exercises every surface of @gtmeasy/growth on React Native.
        </Text>

        <Text style={styles.section}>Lifecycle</Text>
        <Button title="trackAppOpen" onPress={() => void analytics.trackAppOpen()} />
        <Button title="trackFirstOpenIfNeeded (install/update gated)" onPress={() => void analytics.trackFirstOpenIfNeeded({ appVersion: APP_VERSION, buildNumber: APP_BUILD })} />
        <Button title="track('page.viewed')" onPress={() => void analytics.track("page.viewed", { screen: "home" })} />

        <Text style={styles.section}>Identity</Text>
        <Text style={styles.mono}>{`anonymousId = ${anonymousId}`}</Text>
        <TextInput style={styles.input} placeholder="user id" value={userId} onChangeText={setUserId} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="phone (E.164)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Button title="Identify" onPress={() => {
          const traits: Record<string, unknown> = { signed_up: true }
          if (email) traits.email = email
          if (phone) traits.phone = phone
          void analytics.identify(userId || null, traits as Record<string, never>)
        }} />
        <Button title="setUserId only" onPress={() => analytics.setUserId(userId || null)} />

        <Text style={styles.section}>Click IDs</Text>
        <TextInput style={styles.input} placeholder="deep link" value={deepLink} onChangeText={setDeepLink} autoCapitalize="none" />
        <Button title="captureClickIds" onPress={async () => {
          const count = await analytics.captureClickIds(deepLink)
          alert(`captured ${count} click id(s)`)
        }} />
        <Button title="record gclid=test_g_123" onPress={() => void analytics.recordClickId("gclid", "test_g_123")} />

        <Text style={styles.section}>Funnel</Text>
        <Button title="paywall.opened" onPress={handlers.paywallOpened} />
        <Button title="paywall.plan_selected" onPress={handlers.planSelected} />
        <Button title="paywall.upgrade_clicked" onPress={handlers.upgradeClicked} />
        <Button title="paywall.upgrade_cancelled" onPress={handlers.upgradeCancelled} />
        <Button title="purchase.completed ($49.99)" onPress={handlers.purchase} />

        <Text style={styles.section}>Console ({events.length})</Text>
        {events.length === 0 ? (
          <Text style={styles.placeholder}>Trigger anything above. The debug sink mirrors here.</Text>
        ) : null}
        {events.map((event) => (
          <View key={`${event.occurredAt}-${event.label}`} style={styles.eventRow}>
            <Text style={styles.eventKind}>{event.kind.toUpperCase()} · {event.label}</Text>
            <Text style={styles.eventProps}>{JSON.stringify(event.properties, null, 2)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, gap: 8, paddingBottom: 80 },
  title: { fontSize: 22, fontWeight: "700", marginTop: 24 },
  subtitle: { fontSize: 13, opacity: 0.7, marginBottom: 12 },
  section: { fontSize: 16, fontWeight: "600", marginTop: 16, marginBottom: 4 },
  mono: { fontFamily: "Menlo", fontSize: 12, opacity: 0.7 },
  input: { borderWidth: 1, borderColor: "#888", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  placeholder: { opacity: 0.5, fontStyle: "italic" },
  eventRow: { backgroundColor: "rgba(127,127,127,0.08)", padding: 8, borderRadius: 6, marginVertical: 4 },
  eventKind: { fontWeight: "600", fontSize: 12 },
  eventProps: { fontFamily: "Menlo", fontSize: 11, marginTop: 4 },
})

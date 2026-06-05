import { describe, expect, it } from "vitest"

import { resolveLaunch, type ResolveLaunchInput } from "./install-state"

function input(overrides: Partial<ResolveLaunchInput> = {}): ResolveLaunchInput {
  return {
    firstOpenFired: false,
    lastVersion: null,
    lastBuild: null,
    currentVersion: "1.0.0",
    currentBuild: "10",
    signal: "unknown",
    storageIsPersistent: true,
    environment: "production",
    trackBuildChanges: false,
    ...overrides,
  }
}

describe("resolveLaunch", () => {
  it("fresh signal → fresh install", () => {
    expect(resolveLaunch(input({ signal: "fresh" }))).toEqual({ type: "fresh_install" })
  })

  it("unknown signal biases to fresh install", () => {
    expect(resolveLaunch(input({ signal: "unknown" }))).toEqual({ type: "fresh_install" })
  })

  it("existed signal suppresses first_open → pre_existing update", () => {
    expect(resolveLaunch(input({ signal: "existed" }))).toEqual({
      type: "update",
      reason: "pre_existing_install",
      fromVersion: null,
      fromBuild: null,
    })
  })

  it("volatile storage never auto-fires an install", () => {
    expect(resolveLaunch(input({ signal: "fresh", storageIsPersistent: false }))).toEqual({ type: "launch" })
  })

  it("relaunch same version → launch", () => {
    expect(resolveLaunch(input({ firstOpenFired: true, lastVersion: "1.0.0", lastBuild: "10" }))).toEqual({ type: "launch" })
  })

  it("firstOpenFired with no recorded baseline → launch (pre-0.4.0 upgrade / marked pre-existing, no spurious update)", () => {
    // last_app_version/last_build_number are 0.4.0-new keys; a pre-existing install (or one
    // marked via markInstalledBeforeTracking without a version) has firstOpenFired but no
    // baseline. The first version we observe must be adopted silently, NOT reported as a
    // version change with from=null.
    expect(
      resolveLaunch(input({ firstOpenFired: true, lastVersion: null, lastBuild: null, currentVersion: "2.0.0", currentBuild: "100" })),
    ).toEqual({ type: "launch" })
  })

  it("version change → version_change update", () => {
    expect(resolveLaunch(input({ firstOpenFired: true, lastVersion: "0.9.0", lastBuild: "9" }))).toEqual({
      type: "update",
      reason: "version_change",
      fromVersion: "0.9.0",
      fromBuild: "9",
    })
  })

  it("build-only change in production → build_change update", () => {
    expect(resolveLaunch(input({ firstOpenFired: true, lastVersion: "1.0.0", lastBuild: "9" }))).toEqual({
      type: "update",
      reason: "build_change",
      fromVersion: "1.0.0",
      fromBuild: "9",
    })
  })

  it("build-only change outside production is suppressed by default", () => {
    expect(resolveLaunch(input({ firstOpenFired: true, lastVersion: "1.0.0", lastBuild: "9", environment: "staging" }))).toEqual({ type: "launch" })
  })

  it("build-only change outside production fires when opted in", () => {
    expect(
      resolveLaunch(input({ firstOpenFired: true, lastVersion: "1.0.0", lastBuild: "9", environment: "staging", trackBuildChanges: true })),
    ).toEqual({ type: "update", reason: "build_change", fromVersion: "1.0.0", fromBuild: "9" })
  })

  it("null current version/build against a baseline is NOT a change → launch (no bogus update)", () => {
    // Caller omitted appVersion/buildNumber (or native lookup failed). Missing data must not
    // be read as a version/build change, or every arg-less relaunch would fire app.updated.
    expect(
      resolveLaunch(input({ firstOpenFired: true, lastVersion: "1.0.0", lastBuild: "10", currentVersion: null, currentBuild: null })),
    ).toEqual({ type: "launch" })
  })

  it("present version change with a missing build is still a version_change (build absence ignored)", () => {
    expect(
      resolveLaunch(input({ firstOpenFired: true, lastVersion: "1.0.0", lastBuild: "10", currentVersion: "1.1.0", currentBuild: null })),
    ).toEqual({ type: "update", reason: "version_change", fromVersion: "1.0.0", fromBuild: "10" })
  })
})

import { describe, expect, it } from "vitest"

import { detectBuildChannel, isSuppressedBuild, resolveBuildChannel, type GrowthBuildChannel } from "./build-channel"

const ALL: GrowthBuildChannel[] = ["debug", "testflight", "internalTest", "production", "unknown"]

describe("detectBuildChannel", () => {
  it("maps React Native __DEV__ === true to debug", () => {
    expect(detectBuildChannel({ __DEV__: true })).toBe("debug")
  })

  it("is unknown when __DEV__ is false or absent (no NODE_ENV sniffing)", () => {
    expect(detectBuildChannel({ __DEV__: false })).toBe("unknown")
    expect(detectBuildChannel({})).toBe("unknown")
  })

  it("reads globalThis by default", () => {
    const g = globalThis as { __DEV__?: boolean }
    const prev = g.__DEV__
    try {
      g.__DEV__ = true
      expect(detectBuildChannel()).toBe("debug")
      delete g.__DEV__
      expect(detectBuildChannel()).toBe("unknown")
    } finally {
      if (prev === undefined) delete g.__DEV__
      else g.__DEV__ = prev
    }
  })
})

describe("resolveBuildChannel", () => {
  it("an explicit override always wins over detection", () => {
    for (const channel of ALL) expect(resolveBuildChannel(channel, () => "debug")).toBe(channel)
  })

  it("falls back to the detector when no override is given", () => {
    expect(resolveBuildChannel(undefined, () => "testflight")).toBe("testflight")
  })

  it("a throwing detector resolves to unknown", () => {
    expect(resolveBuildChannel(undefined, () => { throw new Error("boom") })).toBe("unknown")
  })
})

describe("isSuppressedBuild", () => {
  it("suppresses debug / testflight / internalTest only when suppressTestBuilds is on", () => {
    for (const channel of ALL) {
      const expected = channel === "debug" || channel === "testflight" || channel === "internalTest"
      expect(isSuppressedBuild({ disabled: false, suppressTestBuilds: true, channel })).toBe(expected)
      expect(isSuppressedBuild({ disabled: false, suppressTestBuilds: false, channel })).toBe(false)
    }
  })

  it("never suppresses unknown (fail open)", () => {
    expect(isSuppressedBuild({ disabled: false, suppressTestBuilds: true, channel: "unknown" })).toBe(false)
  })

  it("disabled always suppresses", () => {
    for (const channel of ALL) expect(isSuppressedBuild({ disabled: true, suppressTestBuilds: false, channel })).toBe(true)
  })
})

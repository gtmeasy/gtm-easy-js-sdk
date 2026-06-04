import { describe, expect, it } from "vitest"

import { createGrowthAnalyticsCore } from "./analytics"
import { MemoryStorage } from "./storage"
import { surveyAnswer, trackSurveyShown, trackSurveyStarted } from "./survey-events"
import type { GrowthHttp, GrowthHttpRequest } from "./types"

function makeAnalytics(responseBody?: string) {
  const calls: GrowthHttpRequest[] = []
  const http: GrowthHttp = async (request) => {
    calls.push(request)
    return {
      status: 201,
      body: responseBody ?? JSON.stringify({ submissionId: "sub_server", accepted: 3, warnings: [] }),
    }
  }
  const analytics = createGrowthAnalyticsCore({
    app: "test-app",
    endpoint: "https://example.gtmeasy.com",
    writeKey: "gte_test",
    environment: "staging",
    platform: "web",
    storage: new MemoryStorage(),
    http,
    generateId: () => "anon_fixed",
    now: () => "2026-05-14T00:00:00.000Z",
  })
  return { analytics, calls }
}

describe("surveyAnswer builders", () => {
  it("builds typed answers and omits undefined fields", () => {
    expect(surveyAnswer.singleChoice("source", "tiktok", { label: "TikTok", questionText: "Where?" })).toEqual({
      questionId: "source",
      type: "single_choice",
      questionText: "Where?",
      choices: ["tiktok"],
      choiceLabels: ["TikTok"],
    })
    // No label → no choiceLabels key at all (not undefined / null).
    expect(surveyAnswer.singleChoice("source", "tiktok")).toEqual({
      questionId: "source",
      type: "single_choice",
      choices: ["tiktok"],
    })
    expect(surveyAnswer.rating("sat", 5)).toEqual({ questionId: "sat", type: "rating", number: 5 })
    expect(surveyAnswer.nps("nps", 9)).toEqual({ questionId: "nps", type: "nps", number: 9 })
    expect(surveyAnswer.boolean("ok", true)).toEqual({ questionId: "ok", type: "boolean", bool: true })
    expect(surveyAnswer.text("why", "love it")).toEqual({ questionId: "why", type: "text", text: "love it" })
    expect(surveyAnswer.skip("q1")).toEqual({ questionId: "q1", type: "text", skipped: true })
  })

  it("carries optional per-answer metadata when provided", () => {
    expect(surveyAnswer.rating("sat", 5, { metadata: { ms: 1200, variant: "B" } })).toEqual({
      questionId: "sat",
      type: "rating",
      number: 5,
      metadata: { ms: 1200, variant: "B" },
    })
    // Omitted metadata stays absent (pruned), not an empty object.
    expect(surveyAnswer.text("why", "love it")).not.toHaveProperty("metadata")
  })
})

describe("submitSurvey", () => {
  it("posts answers to the surveys endpoint and returns the server ack", async () => {
    const { analytics, calls } = makeAnalytics()
    await analytics.identify("user_9")

    const result = await analytics.submitSurvey({
      surveyId: "onboarding_v1",
      surveyName: "Onboarding",
      surveyVersion: "2",
      responses: [
        surveyAnswer.singleChoice("source", "ads", { label: "Ads" }),
        surveyAnswer.rating("satisfaction", 5),
        surveyAnswer.text("goal", "Track screen time"),
      ],
    })

    expect(result).toEqual({ submissionId: "sub_server", accepted: 3, warnings: [] })

    const call = calls.at(-1)!
    expect(call.url).toBe("https://example.gtmeasy.com/api/v1/growth/surveys")
    expect(call.headers["x-gtm-growth-key"]).toBe("gte_test")
    const body = JSON.parse(call.body)
    expect(body.surveyId).toBe("onboarding_v1")
    expect(body.status).toBe("completed")
    expect(body.userId).toBe("user_9")
    expect(body.anonymousId).toBe("anon_fixed")
    expect(body.responses).toHaveLength(3)
    expect(body.responses[0]).toMatchObject({ type: "single_choice", choices: ["ads"], choiceLabels: ["Ads"] })
    // Common context rides under properties._ctx, exactly like track().
    expect(body.properties._ctx).toMatchObject({ sdk: "gtm-easy-js", sdk_version: expect.any(String), platform: "web" })
  })

  it("generates a client-side submissionId when omitted (so transparent retries dedup)", async () => {
    const { analytics, calls } = makeAnalytics()
    const result = await analytics.submitSurvey({ surveyId: "s", responses: [surveyAnswer.text("q1", "a")] })
    // generateId is stubbed to "anon_fixed"; the SDK must SEND the key it minted,
    // not leave it null for the server to generate (which would break idempotency).
    expect(JSON.parse(calls.at(-1)!.body).submissionId).toBe("anon_fixed")
    expect(result.submissionId).toBe("sub_server") // server ack still wins when present
  })

  it("merges caller properties with _ctx, preserving caller keys", async () => {
    const { analytics, calls } = makeAnalytics()
    await analytics.submitSurvey({
      surveyId: "s",
      responses: [surveyAnswer.text("q1", "a")],
      properties: { ab_variant: "B" },
    })
    const props = JSON.parse(calls.at(-1)!.body).properties
    expect(props.ab_variant).toBe("B")
    expect(props._ctx.sdk).toBe("gtm-easy-js")
  })

  it("falls back to the client submissionId when the server omits one", async () => {
    const { analytics } = makeAnalytics(JSON.stringify({ accepted: 1, warnings: ["x"] }))
    const result = await analytics.submitSurvey({
      surveyId: "s",
      submissionId: "sub_client",
      responses: [surveyAnswer.text("q1", "a")],
    })
    expect(result.submissionId).toBe("sub_client")
    expect(result.warnings).toEqual(["x"])
  })

  it("sends status=partial without forcing a lifecycle event", async () => {
    const { analytics, calls } = makeAnalytics()
    await analytics.submitSurvey({ surveyId: "s", status: "partial", responses: [surveyAnswer.text("q1", "half")] })
    expect(JSON.parse(calls.at(-1)!.body).status).toBe("partial")
  })

  it("sends submission-level metadata and per-answer metadata on the wire", async () => {
    const { analytics, calls } = makeAnalytics()
    await analytics.submitSurvey({
      surveyId: "s",
      metadata: { variant: "B", flow: "paywall_first" },
      responses: [surveyAnswer.text("q1", "a", { metadata: { ms: 800 } })],
    })
    const body = JSON.parse(calls.at(-1)!.body)
    expect(body.metadata).toEqual({ variant: "B", flow: "paywall_first" })
    expect(body.responses[0].metadata).toEqual({ ms: 800 })
  })

  it("defaults submission metadata to an empty object when omitted", async () => {
    const { analytics, calls } = makeAnalytics()
    await analytics.submitSurvey({ surveyId: "s", responses: [surveyAnswer.text("q1", "a")] })
    expect(JSON.parse(calls.at(-1)!.body).metadata).toEqual({})
  })
})

describe("survey lifecycle helpers", () => {
  it("trackSurveyShown emits a survey.shown event with survey_id", async () => {
    const { analytics, calls } = makeAnalytics(JSON.stringify({ event: { id: "e", eventName: "survey.shown" }, warnings: [] }))
    await trackSurveyShown(analytics, { surveyId: "onboarding_v1", surveyName: "Onboarding" })
    const body = JSON.parse(calls.at(-1)!.body)
    expect(body.eventName).toBe("survey.shown")
    expect(body.properties).toMatchObject({ survey_id: "onboarding_v1", survey_name: "Onboarding" })
  })

  it("trackSurveyStarted emits a survey.started event", async () => {
    const { analytics, calls } = makeAnalytics(JSON.stringify({ event: { id: "e", eventName: "survey.started" }, warnings: [] }))
    await trackSurveyStarted(analytics, { surveyId: "onboarding_v1" })
    expect(JSON.parse(calls.at(-1)!.body).eventName).toBe("survey.started")
  })
})

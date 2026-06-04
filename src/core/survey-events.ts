import type { GrowthAnalytics, GrowthEventProperties, IngestResponse, SurveyAnswer } from "./types"

/** Shared answer options: every builder accepts a human prompt + per-answer metadata. */
type AnswerOpts = { questionText?: string; metadata?: GrowthEventProperties }

/**
 * Flexible onboarding-survey capture. Mirrors the PostHog Surveys model: a
 * submission is a list of self-describing answers, each carrying its question
 * type + optional human label, so the GTM Easy dashboard aggregates without a
 * server-side survey definition. Submit with `analytics.submitSurvey(...)`;
 * build answers with the `surveyAnswer.*` helpers below. The `trackSurvey*`
 * lifecycle helpers power shown→completed completion rate. See
 * docs/plans/2026-06-03-onboarding-survey-capture.md.
 */

/** Typed builders so `type` always matches the payload shape. */
export const surveyAnswer = {
  /** Single-choice answer. `label` is the human-readable option text (optional). */
  singleChoice(questionId: string, choice: string, opts: AnswerOpts & { label?: string } = {}): SurveyAnswer {
    return prune({
      questionId,
      type: "single_choice",
      questionText: opts.questionText,
      choices: [choice],
      choiceLabels: opts.label ? [opts.label] : undefined,
      metadata: opts.metadata,
    })
  },
  /** Multi-choice answer. `labels` (if given) must be parallel to `choices`. */
  multiChoice(questionId: string, choices: string[], opts: AnswerOpts & { labels?: string[] } = {}): SurveyAnswer {
    return prune({ questionId, type: "multi_choice", questionText: opts.questionText, choices, choiceLabels: opts.labels, metadata: opts.metadata })
  },
  /** Star / 1–5 style rating. */
  rating(questionId: string, value: number, opts: AnswerOpts = {}): SurveyAnswer {
    return prune({ questionId, type: "rating", questionText: opts.questionText, number: value, metadata: opts.metadata })
  },
  /** 0–10 Net Promoter Score answer. */
  nps(questionId: string, value: number, opts: AnswerOpts = {}): SurveyAnswer {
    return prune({ questionId, type: "nps", questionText: opts.questionText, number: value, metadata: opts.metadata })
  },
  /** Generic numeric scale. */
  scale(questionId: string, value: number, opts: AnswerOpts = {}): SurveyAnswer {
    return prune({ questionId, type: "scale", questionText: opts.questionText, number: value, metadata: opts.metadata })
  },
  /** Yes/no answer. */
  boolean(questionId: string, value: boolean, opts: AnswerOpts = {}): SurveyAnswer {
    return prune({ questionId, type: "boolean", questionText: opts.questionText, bool: value, metadata: opts.metadata })
  },
  /** Free-text answer (up to 2 000 chars server-side). */
  text(questionId: string, value: string, opts: AnswerOpts = {}): SurveyAnswer {
    return prune({ questionId, type: "text", questionText: opts.questionText, text: value, metadata: opts.metadata })
  },
  /** Explicitly-skipped question (recorded so completion math can exclude it). */
  skip(questionId: string, opts: AnswerOpts & { type?: string } = {}): SurveyAnswer {
    return prune({ questionId, type: opts.type ?? "text", questionText: opts.questionText, skipped: true, metadata: opts.metadata })
  },
}

/** Drop undefined fields so the wire payload stays compact (no `null` noise). */
function prune(answer: SurveyAnswer): SurveyAnswer {
  return Object.fromEntries(Object.entries(answer).filter(([, v]) => v !== undefined)) as unknown as SurveyAnswer
}

export interface SurveyLifecycleArgs {
  surveyId: string
  surveyName?: string
  surveyVersion?: string
}

/** Lifecycle: the survey was shown. Powers shown→completed completion rate. */
export async function trackSurveyShown(analytics: GrowthAnalytics, args: SurveyLifecycleArgs): Promise<IngestResponse> {
  return analytics.track("survey.shown", surveyProperties(args))
}

/** Lifecycle: the user began answering the survey. */
export async function trackSurveyStarted(analytics: GrowthAnalytics, args: SurveyLifecycleArgs): Promise<IngestResponse> {
  return analytics.track("survey.started", surveyProperties(args))
}

function surveyProperties(args: SurveyLifecycleArgs): Record<string, string> {
  const properties: Record<string, string> = { survey_id: args.surveyId }
  if (args.surveyName) properties.survey_name = args.surveyName
  if (args.surveyVersion) properties.survey_version = args.surveyVersion
  return properties
}

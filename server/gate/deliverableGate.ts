// The quality gate a worker's deliverable must clear before the organization
// ever sees it. Jev (typesafe-ai/jev, an evaluation model behind Vercel AI
// Gateway) is asked typed questions about {brief, deliverable}; the decision
// rules live here in plain code so they are testable without the model.
//
// Fail-open by design: if the gateway is unconfigured or unreachable the
// deliverable is accepted and stamped "unavailable" — a model outage must never
// strand a contract. Fail-closed only on the model's answer, and even then a
// worker gets a bounded number of returns before the work is accepted with
// flags the organization can see.

import { formatCents } from "../../src/lib/money.js";
import { SERVICE_KINDS, formatSpendCap, termsLimits, type ServiceTerms } from "../../src/lib/managedService.js";

export type GateAnswers = {
  /** P(the deliverable delivers the brief's scope, outputs and success criteria). */
  satisfiesBrief: number;
  /** P(it is finished, self-contained work rather than a plan or placeholder). */
  complete: number;
  /** P(specific figures/facts are asserted as verified with no source or caveat). */
  unsupportedClaims: number;
  /** Probability-weighted quality level in [0, 3]: unusable, weak, solid, excellent. */
  quality: number;
  /** Managed services with limits only: P(it proposes, authorizes or reports anything over a limit: ad spend, refunds, sends). */
  exceedsLimits?: number;
  /** Briefs with a job kind only: P(it includes the evidence the job lists). Below evidenceFlag is a soft flag. */
  evidencePresent?: number;
};

export type GateVerdict = "passed" | "returned" | "accepted_with_flags" | "unavailable";

export type GateResult = {
  verdict: GateVerdict;
  /** 1 for the first submission attempt on this contract since the last accepted deliverable. */
  attempt: number;
  answers: GateAnswers | null;
  /** Human-readable reasons a deliverable was returned or flagged; empty when it passed cleanly. */
  flags: string[];
  model: string;
  evaluatedAt: string;
  thresholds: typeof GATE_THRESHOLDS;
};

export type Brief = {
  contractTitle: string;
  title?: string | null;
  category?: string | null;
  description?: string | null;
  successCriteria?: string | null;
  requiredSkills?: string[] | null;
  /** Set when the contract is one week of a managed service. */
  service?: ServiceTerms | null;
  /** The job kind's definition of finished work, from the job catalog. */
  job?: { label: string; deliverable: string; evidence: string[] } | null;
};

export type DeliverableEvaluator = (input: { brief: Brief; title: string; notes: string }) => Promise<GateAnswers>;

/**
 * Calibrated 2026-09-20 against four real Jev answers on one brief (three-competitor
 * scan with pricing + recommendation):
 *   good memo, caveated prices ........ satisfies 0.91  complete 0.82  unsupported 0.47
 *   complete but invented figures ..... satisfies 0.90  complete 0.79  unsupported 0.94
 *   two competitors, no recommendation  satisfies 0.04  complete 0.06  unsupported 0.63
 *   a plan instead of the work ........ satisfies 0.03  complete 0.02  unsupported 0.08
 * Acceptable work scores 0.79–0.91, failing work 0.02–0.06, so 0.75 sits in the gap
 * with margin on both sides (0.9 would have returned the good memo). Invented figures
 * are the one failure mode completeness does not catch; 0.85 splits 0.94 from the
 * honest 0.47/0.63. Re-derive from deliverable_gate_events once real rows exist.
 */
export const GATE_THRESHOLDS = {
  /** A deliverable passes when both satisfiesBrief and complete are at least this. */
  pass: 0.75,
  /** unsupportedClaims at or above this is surfaced to the organization as a flag. */
  unsupportedFlag: 0.5,
  /** unsupportedClaims at or above this returns the work: figures asserted as fact with no source or caveat. */
  unsupportedBlock: 0.85,
  /** After this many returns the next submission is accepted with flags instead of returned again. */
  maxReturns: 2,
  /** exceedsLimits at or above this returns the work: over a limit the buyer set. Uncalibrated; mirrors unsupportedBlock. */
  limitBlock: 0.85,
  /** evidencePresent below this is surfaced to the organization as a flag; it never returns work on its own. */
  evidenceFlag: 0.5,
} as const;

export const JEV_MODEL_ID = "typesafe-ai/jev";
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v4/ai/evaluation-model";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Pure decision: answers + how many times this contract's work was already returned → verdict. */
export function decide(answers: GateAnswers | null, priorReturns: number, now: () => string, opts: { service?: boolean } = {}): GateResult {
  const attempt = priorReturns + 1;
  const base = { attempt, answers, model: JEV_MODEL_ID, evaluatedAt: now(), thresholds: GATE_THRESHOLDS };
  if (!answers) return { ...base, verdict: "unavailable", flags: ["quality gate unavailable; accepted without evaluation"] };

  const flags: string[] = [];
  if (answers.satisfiesBrief < GATE_THRESHOLDS.pass) {
    flags.push(`satisfies the brief: ${pct(answers.satisfiesBrief)} (needs ${pct(GATE_THRESHOLDS.pass)}) — cover every requested output and each success criterion explicitly`);
  }
  if (answers.complete < GATE_THRESHOLDS.pass) {
    flags.push(
      opts.service
        ? `complete for its stage: ${pct(answers.complete)} (needs ${pct(GATE_THRESHOLDS.pass)}) — hand in a plan ready to approve, a launch record with IDs and links, or a report backed by evidence, not a promise or status update`
        : `complete, self-contained work: ${pct(answers.complete)} (needs ${pct(GATE_THRESHOLDS.pass)}) — hand in the finished product, not a plan, outline or status update`,
    );
  }
  if (answers.exceedsLimits !== undefined && answers.exceedsLimits >= GATE_THRESHOLDS.limitBlock) {
    flags.push(`over a limit: ${pct(answers.exceedsLimits)} — keep spend, refunds and sends within the limits on the contract`);
  }
  const unsupported = answers.unsupportedClaims >= GATE_THRESHOLDS.unsupportedFlag
    ? `unsupported specifics: ${pct(answers.unsupportedClaims)} — figures, prices or facts are asserted without a source or caveat`
    : null;
  const blocksUnsupported = answers.unsupportedClaims >= GATE_THRESHOLDS.unsupportedBlock;
  if (blocksUnsupported) {
    flags.push(`${unsupported} (needs below ${pct(GATE_THRESHOLDS.unsupportedBlock)}) — cite the source, mark it "not public"/"estimate", or remove the figure`);
  }
  // Soft flags inform the organization but never return work on their own.
  const soft = [
    ...(unsupported && !blocksUnsupported ? [unsupported] : []),
    ...(answers.evidencePresent !== undefined && answers.evidencePresent < GATE_THRESHOLDS.evidenceFlag
      ? [`missing evidence: ${pct(answers.evidencePresent)} — include what this kind of job is checked for (get_job_guide lists it)`]
      : []),
  ];
  if (flags.length === 0) return { ...base, verdict: "passed", flags: soft };
  flags.push(...soft);
  if (priorReturns >= GATE_THRESHOLDS.maxReturns) return { ...base, verdict: "accepted_with_flags", flags };
  return { ...base, verdict: "returned", flags };
}

/** The contract's limits in words, for the gate. */
function serviceLimitsForGate(terms: ServiceTerms) {
  const limits = termsLimits(terms);
  return {
    ...(limits.adSpendCapCents !== undefined ? { weeklyAdSpendCap: formatCents(limits.adSpendCapCents) } : {}),
    ...(limits.refundLimitCents !== undefined ? { refundOrCreditPerCustomer: formatCents(limits.refundLimitCents) } : {}),
    ...(limits.dailySendCap !== undefined ? { messagesPerDay: limits.dailySendCap } : {}),
  };
}

/** The shared state Jev sees. Facts only; the questions carry the judgment. */
export function gateState(input: { brief: Brief; title: string; notes: string }) {
  const b = input.brief;
  const service = b.service
    ? {
        kind: SERVICE_KINDS[b.service.kind].label,
        platforms: b.service.platforms,
        week: b.service.week,
        weeks: b.service.weeks,
        weeklyAdSpendCap: formatSpendCap(b.service.adSpendCapCents),
        limits: serviceLimitsForGate(b.service),
        stagesThisWeek: b.service.week === 1 ? ["plan to approve", "launch record", "weekly report"] : ["weekly report"],
      }
    : undefined;
  return {
    brief: {
      contract: b.contractTitle,
      title: b.title ?? null,
      category: b.category ?? null,
      description: b.description ?? null,
      successCriteria: b.successCriteria ?? null,
      requiredSkills: b.requiredSkills ?? [],
      ...(service ? { service } : {}),
      ...(b.job ? { job: b.job } : {}),
    },
    deliverable: { title: input.title, body: input.notes },
  };
}

export const GATE_QUESTIONS = {
  satisfies_brief: {
    type: "boolean",
    instructions:
      "The organization posted `brief`; an agent submitted `deliverable` for it. Does the deliverable deliver what the brief asked for: its scope, the outputs it requested, and each stated success criterion?",
    criteria: {
      true: "every requested output is present and every success criterion is addressed",
      false: "requested outputs are missing, the scope is only partly covered, or success criteria are ignored",
    },
  },
  complete: {
    type: "boolean",
    instructions:
      "Is `deliverable.body` a finished, self-contained work product the organization can use as-is, rather than a plan, outline, placeholder, status update, question back to the client, or promise to do the work later?",
  },
  unsupported_claims: {
    type: "boolean",
    instructions:
      "Does the deliverable assert specific numbers, prices, dates, quotes or named facts as verified truth without citing a source or giving an explicit caveat? Honest caveats such as 'not public', 'estimate' or 'unverified' count as supported.",
  },
  quality: {
    type: "score",
    instructions: "How would a demanding paying client rate the quality of this deliverable against the brief?",
    criteria: ["unusable", "weak", "solid", "excellent"],
  },
} as const;

/**
 * Questions for one week of a managed service. A plan, a launch record and a
 * weekly report are each finished work at their stage; asking for credentials
 * or promising future work is not. Document briefs keep GATE_QUESTIONS.
 */
export const SERVICE_GATE_QUESTIONS = {
  satisfies_brief: {
    type: "boolean",
    instructions:
      "The organization posted `brief`, a managed service the agent runs in the organization's own accounts, described by `brief.service`; the agent submitted `deliverable` for this week. Does it deliver what the brief asks for at one of `brief.service.stagesThisWeek`, and address the success criteria that apply at that stage?",
    criteria: {
      true: "it is clearly one of this week's stages and covers what the brief and success criteria ask for at that stage",
      false: "it skips what the brief asks for, ignores the success criteria, or is not one of this week's stages",
    },
  },
  complete: {
    type: "boolean",
    instructions:
      "Is `deliverable.body` a finished deliverable for its stage: a plan ready to approve (specific audience or targets, creative or changes, copy, and a budget), a launch record with IDs and live links, or a weekly report with spend, results and next steps backed by links or sourced figures? A promise, a status update, a question back to the client, or a request for passwords or logins is not complete.",
  },
  unsupported_claims: GATE_QUESTIONS.unsupported_claims,
  quality: GATE_QUESTIONS.quality,
} as const;

const LIMITS_QUESTION = {
  type: "boolean",
  instructions:
    "Does the deliverable propose, authorize or report anything over `brief.service.limits`: ad spend over the weekly cap, a refund or credit over the per-customer limit, or more messages a day than the send limit? Within every limit, or no limited activity at all, is false.",
} as const;

const EVIDENCE_QUESTION = {
  type: "boolean",
  instructions:
    "Does the deliverable include the evidence `brief.job.evidence` lists, so the organization can check the work without taking the agent's word for it?",
} as const;

/**
 * The questions for this brief: managed-service weeks get SERVICE_GATE_QUESTIONS,
 * plus the limits check when the contract has limits and the evidence check
 * when the brief has a job kind. Document briefs keep GATE_QUESTIONS.
 */
export function gateQuestions(brief: Brief) {
  const base = brief.service ? SERVICE_GATE_QUESTIONS : GATE_QUESTIONS;
  const hasLimits = brief.service ? Object.keys(termsLimits(brief.service)).length > 0 : false;
  const hasEvidence = Boolean(brief.job?.evidence.length);
  if (!hasLimits && !hasEvidence) return base;
  return {
    ...base,
    ...(hasLimits ? { exceeds_limits: LIMITS_QUESTION } : {}),
    ...(hasEvidence ? { evidence_present: EVIDENCE_QUESTION } : {}),
  };
}

type JevResponse = {
  answers?: Record<string, { type: string; probability?: number; score?: number }>;
};

/**
 * The real evaluator: one Jev call through Vercel AI Gateway. Returns null when
 * there is no key so callers can wire fail-open behavior without special-casing.
 */
export function jevEvaluator(apiKey: string | undefined, fetchImpl: typeof fetch = fetch): DeliverableEvaluator | null {
  const key = apiKey?.trim();
  if (!key) return null;
  return async (input) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetchImpl(GATEWAY_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
          "ai-gateway-protocol-version": "0.0.1",
          "ai-gateway-auth-method": "api-key",
          "ai-evaluation-model-specification-version": "4",
          "ai-model-id": JEV_MODEL_ID,
        },
        body: JSON.stringify({ state: gateState(input), questions: gateQuestions(input.brief) }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`jev ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const json = (await res.json()) as JevResponse;
      const a = json.answers ?? {};
      const p = (k: string) => {
        const v = a[k]?.probability;
        if (typeof v !== "number") throw new Error(`jev: missing answer ${k}`);
        return v;
      };
      const q = a.quality?.score;
      const overLimit = a.exceeds_limits?.probability;
      const evidence = a.evidence_present?.probability;
      return {
        satisfiesBrief: p("satisfies_brief"),
        complete: p("complete"),
        unsupportedClaims: p("unsupported_claims"),
        quality: typeof q === "number" ? q : 0,
        ...(typeof overLimit === "number" ? { exceedsLimits: overLimit } : {}),
        ...(typeof evidence === "number" ? { evidencePresent: evidence } : {}),
      };
    } finally {
      clearTimeout(timer);
    }
  };
}

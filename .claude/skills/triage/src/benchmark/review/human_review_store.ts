/**
 * The human's deciding vote on each benchmark case, kept beside the suite in
 * `human_review.json`.
 *
 * A reviewer judges between the verdicts the models reached rather than
 * labelling from scratch: they either agree with one candidate verdict (a kind,
 * plus a rule for a regression), or record that none fits, which is a finding
 * about the taxonomy itself and carries structured feedback.
 */

import fs from "node:fs";
import path from "node:path";

import { VERDICT_KINDS, type VerdictKind } from "../load_benchmark_suite.js";

export const HUMAN_REVIEW_FILENAME = "human_review.json";

export interface CandidateVerdict {
  kind: VerdictKind;
  rule_id: string | null;
}

export type WalkthroughAnswer = "yes" | "no" | "unsure" | null;

/** The reviewer's answers to the verdict definitions' questions, in order. */
export interface Walkthrough {
  real_caller: WalkthroughAnswer;
  reaches_definition: WalkthroughAnswer;
  rule_covers: WalkthroughAnswer;
}

export const FEEDBACK_TARGETS = ["verdict-definitions", "classifier-rule", "diagnosis-route", "other"] as const;
export type FeedbackTarget = (typeof FEEDBACK_TARGETS)[number];

export interface TaxonomyFeedback {
  target: FeedbackTarget;
  /** The rule the feedback is about; set exactly when `target` is `classifier-rule`. */
  rule_id: string | null;
  problem: string;
  proposal: string;
}

export interface CaseReview {
  decision: "agree" | "none-fits" | null;
  /** The verdict the reviewer agreed with; set exactly when `decision` is `agree`. */
  chosen: CandidateVerdict | null;
  /** The sources that held `chosen` when the vote was cast, for the audit trail. */
  agreed_with: string[];
  /** Further kinds a careful reviewer could also defend; never includes `chosen.kind`. */
  also_acceptable: VerdictKind[];
  walkthrough: Walkthrough;
  /** Required when `decision` is `none-fits`. */
  feedback: TaxonomyFeedback | null;
  notes: string;
  reviewed_at: string;
}

export interface HumanReviewDocument {
  label_set: string;
  updated_at: string;
  reviews: Record<string, CaseReview>;
}

const ANSWERS: readonly WalkthroughAnswer[] = ["yes", "no", "unsure", null];

function fail(case_id: string, message: string): never {
  throw new Error(`review ${case_id}: ${message}`);
}

function is_record(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

function parse_kind(raw: unknown, case_id: string, field: string): VerdictKind {
  if (!VERDICT_KINDS.includes(raw as VerdictKind)) fail(case_id, `${field} must be a verdict kind`);
  return raw as VerdictKind;
}

function parse_string(raw: unknown, case_id: string, field: string): string {
  if (typeof raw !== "string") fail(case_id, `${field} must be a string`);
  return raw;
}

function parse_candidate(raw: unknown, case_id: string): CandidateVerdict {
  if (!is_record(raw)) fail(case_id, "chosen must be an object");
  const kind = parse_kind(raw.kind, case_id, "chosen.kind");
  const rule_id = raw.rule_id === null ? null : parse_string(raw.rule_id, case_id, "chosen.rule_id");
  if ((kind === "fp-classifier-regression") !== (rule_id !== null)) {
    fail(case_id, "chosen.rule_id is required exactly for a fp-classifier-regression verdict");
  }
  return { kind, rule_id };
}

function parse_feedback(raw: unknown, case_id: string): TaxonomyFeedback {
  if (!is_record(raw)) fail(case_id, "feedback must be an object");
  if (!FEEDBACK_TARGETS.includes(raw.target as FeedbackTarget)) {
    fail(case_id, `feedback.target must be one of ${FEEDBACK_TARGETS.join(", ")}`);
  }
  const target = raw.target as FeedbackTarget;
  const rule_id = raw.rule_id === null ? null : parse_string(raw.rule_id, case_id, "feedback.rule_id");
  if ((target === "classifier-rule") !== (rule_id !== null)) {
    fail(case_id, "feedback.rule_id is required exactly when feedback.target is classifier-rule");
  }
  const problem = parse_string(raw.problem, case_id, "feedback.problem").trim();
  if (problem.length === 0) fail(case_id, "feedback.problem must say what does not fit");
  return { target, rule_id, problem, proposal: parse_string(raw.proposal, case_id, "feedback.proposal").trim() };
}

export function parse_case_review(raw: unknown, case_id: string): CaseReview {
  if (!is_record(raw)) fail(case_id, "must be an object");
  const decision = raw.decision;
  if (decision !== "agree" && decision !== "none-fits" && decision !== null) {
    fail(case_id, "decision must be \"agree\", \"none-fits\" or null");
  }
  const chosen = raw.chosen === null ? null : parse_candidate(raw.chosen, case_id);
  if ((decision === "agree") !== (chosen !== null)) fail(case_id, "chosen is required exactly when decision is agree");
  const feedback = raw.feedback === null ? null : parse_feedback(raw.feedback, case_id);
  if (decision === "none-fits" && feedback === null) fail(case_id, "a none-fits decision requires feedback");
  if (!Array.isArray(raw.agreed_with) || !raw.agreed_with.every((s) => typeof s === "string")) {
    fail(case_id, "agreed_with must be a list of source names");
  }
  if (!Array.isArray(raw.also_acceptable)) fail(case_id, "also_acceptable must be a list");
  const also_acceptable = raw.also_acceptable.map((k, i) => parse_kind(k, case_id, `also_acceptable[${i}]`));
  if (chosen !== null && also_acceptable.includes(chosen.kind)) fail(case_id, "also_acceptable repeats the chosen kind");
  if (!is_record(raw.walkthrough)) fail(case_id, "walkthrough must be an object");
  const walkthrough = raw.walkthrough;
  const answer = (field: keyof Walkthrough): WalkthroughAnswer => {
    const value = walkthrough[field];
    if (!ANSWERS.includes(value as WalkthroughAnswer)) fail(case_id, `walkthrough.${field} must be yes, no, unsure or null`);
    return value as WalkthroughAnswer;
  };
  return {
    decision,
    chosen,
    agreed_with: [...raw.agreed_with],
    also_acceptable,
    walkthrough: {
      real_caller: answer("real_caller"),
      reaches_definition: answer("reaches_definition"),
      rule_covers: answer("rule_covers"),
    },
    feedback,
    notes: parse_string(raw.notes, case_id, "notes"),
    reviewed_at: parse_string(raw.reviewed_at, case_id, "reviewed_at"),
  };
}

export function human_review_path(suite_dir: string): string {
  return path.join(suite_dir, HUMAN_REVIEW_FILENAME);
}

export function read_human_review(suite_dir: string): HumanReviewDocument {
  const file = human_review_path(suite_dir);
  if (!fs.existsSync(file)) {
    return { label_set: `benchmark/${path.basename(suite_dir)}`, updated_at: new Date(0).toISOString(), reviews: {} };
  }
  const raw: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!is_record(raw) || !is_record(raw.reviews) || typeof raw.label_set !== "string" || typeof raw.updated_at !== "string") {
    throw new Error(`${file} is not a human review document`);
  }
  const reviews = Object.fromEntries(Object.entries(raw.reviews).map(([id, r]) => [id, parse_case_review(r, id)]));
  return { label_set: raw.label_set, updated_at: raw.updated_at, reviews };
}

/** Validate and store one case's review; returns the updated document. */
export function write_case_review(
  suite_dir: string,
  known_case_ids: ReadonlySet<string>,
  case_id: string,
  raw: unknown,
): HumanReviewDocument {
  if (!known_case_ids.has(case_id)) throw new Error(`review ${case_id}: no such case in the suite`);
  const review = parse_case_review(raw, case_id);
  const doc = read_human_review(suite_dir);
  const next: HumanReviewDocument = {
    ...doc,
    updated_at: new Date().toISOString(),
    reviews: { ...doc.reviews, [case_id]: review },
  };
  const file = human_review_path(suite_dir);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(next, null, 2) + "\n");
  fs.renameSync(`${file}.tmp`, file);
  return next;
}

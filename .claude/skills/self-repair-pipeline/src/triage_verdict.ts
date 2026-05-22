/**
 * Per-entry verdict emitted by `triage-investigator`. One discriminated union
 * with five `kind`s; each carries its own required payload (no
 * optional-everywhere shape).
 *
 * The dispatcher consumes verdicts in the order they land and routes novel
 * verdicts (`fp-novel-new`, `fp-novel-cited`) through the `triage-coordinator`
 * before the next dispense. Other kinds are absorbed directly.
 */

import {
  assert_keys,
  describe,
  expect_object,
  parse_non_empty_string,
} from "./strict_parse.js";

export interface MemberEvidence {
  file: string;
  line: number;
  why: string;
}

export interface VerdictTp {
  kind: "tp";
  member_evidence: MemberEvidence;
}

export interface VerdictFpNovelNew {
  kind: "fp-novel-new";
  proposed_root_cause: string;
  evidence_excerpt: string;
  member_evidence: MemberEvidence;
}

export interface VerdictFpNovelCited {
  kind: "fp-novel-cited";
  novel_issue_id: string;
  evidence_excerpt: string;
}

export interface VerdictFpClassifierRegression {
  kind: "fp-classifier-regression";
  should_have_matched_rule_id: string;
  evidence_excerpt: string;
  member_evidence: MemberEvidence;
}

export interface VerdictUncertain {
  kind: "uncertain";
  reason: string;
  member_evidence: MemberEvidence;
}

export type TriageVerdict =
  | VerdictTp
  | VerdictFpNovelNew
  | VerdictFpNovelCited
  | VerdictFpClassifierRegression
  | VerdictUncertain;

type TriageVerdictKind = TriageVerdict["kind"];

const VERDICT_KINDS: readonly TriageVerdictKind[] = [
  "tp",
  "fp-novel-new",
  "fp-novel-cited",
  "fp-classifier-regression",
  "uncertain",
] as const;

/**
 * Strict runtime parser. Throws on any shape violation — missing fields, wrong
 * `kind`, wrong field types, or extra unknown fields. Returns a fully typed
 * `TriageVerdict` on success.
 */
export function parse_triage_verdict(raw: unknown): TriageVerdict {
  const obj = expect_object(raw, "verdict");
  const kind = obj["kind"];
  if (typeof kind !== "string") {
    throw new Error(`verdict: 'kind' must be a string, got ${describe(kind)}`);
  }
  if (!is_verdict_kind(kind)) {
    throw new Error(
      `verdict: unknown kind '${kind}'; expected one of ${VERDICT_KINDS.join(", ")}`,
    );
  }
  switch (kind) {
    case "tp":
      assert_keys(obj, ["kind", "member_evidence"], "verdict(tp)");
      return {
        kind: "tp",
        member_evidence: parse_member_evidence(obj["member_evidence"], "verdict(tp).member_evidence"),
      };
    case "fp-novel-new":
      assert_keys(
        obj,
        ["kind", "proposed_root_cause", "evidence_excerpt", "member_evidence"],
        "verdict(fp-novel-new)",
      );
      return {
        kind: "fp-novel-new",
        proposed_root_cause: parse_non_empty_string(
          obj["proposed_root_cause"],
          "verdict(fp-novel-new).proposed_root_cause",
        ),
        evidence_excerpt: parse_non_empty_string(
          obj["evidence_excerpt"],
          "verdict(fp-novel-new).evidence_excerpt",
        ),
        member_evidence: parse_member_evidence(
          obj["member_evidence"],
          "verdict(fp-novel-new).member_evidence",
        ),
      };
    case "fp-novel-cited":
      assert_keys(obj, ["kind", "novel_issue_id", "evidence_excerpt"], "verdict(fp-novel-cited)");
      return {
        kind: "fp-novel-cited",
        novel_issue_id: parse_non_empty_string(
          obj["novel_issue_id"],
          "verdict(fp-novel-cited).novel_issue_id",
        ),
        evidence_excerpt: parse_non_empty_string(
          obj["evidence_excerpt"],
          "verdict(fp-novel-cited).evidence_excerpt",
        ),
      };
    case "fp-classifier-regression":
      assert_keys(
        obj,
        ["kind", "should_have_matched_rule_id", "evidence_excerpt", "member_evidence"],
        "verdict(fp-classifier-regression)",
      );
      return {
        kind: "fp-classifier-regression",
        should_have_matched_rule_id: parse_non_empty_string(
          obj["should_have_matched_rule_id"],
          "verdict(fp-classifier-regression).should_have_matched_rule_id",
        ),
        evidence_excerpt: parse_non_empty_string(
          obj["evidence_excerpt"],
          "verdict(fp-classifier-regression).evidence_excerpt",
        ),
        member_evidence: parse_member_evidence(
          obj["member_evidence"],
          "verdict(fp-classifier-regression).member_evidence",
        ),
      };
    case "uncertain":
      assert_keys(obj, ["kind", "reason", "member_evidence"], "verdict(uncertain)");
      return {
        kind: "uncertain",
        reason: parse_non_empty_string(obj["reason"], "verdict(uncertain).reason"),
        member_evidence: parse_member_evidence(
          obj["member_evidence"],
          "verdict(uncertain).member_evidence",
        ),
      };
  }
}

function parse_member_evidence(raw: unknown, ctx: string): MemberEvidence {
  const obj = expect_object(raw, ctx);
  assert_keys(obj, ["file", "line", "why"], ctx);
  const file = parse_non_empty_string(obj["file"], `${ctx}.file`);
  const line = obj["line"];
  if (typeof line !== "number" || !Number.isInteger(line) || line < 1) {
    throw new Error(`${ctx}.line: must be a positive integer, got ${describe(line)}`);
  }
  const why = parse_non_empty_string(obj["why"], `${ctx}.why`);
  return { file, line, why };
}

function is_verdict_kind(value: string): value is TriageVerdictKind {
  return (VERDICT_KINDS as readonly string[]).includes(value);
}

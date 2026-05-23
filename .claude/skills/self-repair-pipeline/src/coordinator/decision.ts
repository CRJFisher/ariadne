/**
 * Output schema for the `triage-coordinator` sub-agent.
 *
 * The agent emits one JSON object per absorbed novel verdict. The dispatcher
 * parses it with `parse_coordinator_decision` and applies it via
 * `apply_coordinator_decision`.
 *
 * The discriminant is `kind` — matching `TriageVerdict.kind` — so call sites
 * that handle both unions read uniformly.
 *
 * `reason` is always populated — it is the human-readable summary written to
 * `coordinator_log.jsonl` so curator drift analysis can replay decisions.
 */

import {
  assert_keys,
  describe,
  expect_object,
  parse_non_empty_string,
} from "../strict_parse.js";

export interface DecisionMergeInto {
  kind: "merge_into";
  novel_issue_id: string;
  reason: string;
}

export interface DecisionRegisterNew {
  kind: "register_new";
  canonical_name: string;
  root_cause: string;
  reason: string;
}

export interface DecisionFlag {
  kind: "flag";
  reason: string;
}

export type CoordinatorDecision =
  | DecisionMergeInto
  | DecisionRegisterNew
  | DecisionFlag;

export type CoordinatorDecisionKind = CoordinatorDecision["kind"];

const DECISION_KINDS: readonly CoordinatorDecisionKind[] = [
  "merge_into",
  "register_new",
  "flag",
] as const;

/**
 * Strict runtime parser. Throws on any shape violation — missing fields, wrong
 * `kind`, wrong field types, or extra unknown fields.
 */
export function parse_coordinator_decision(raw: unknown): CoordinatorDecision {
  const obj = expect_object(raw, "coordinator_decision");
  const kind = obj["kind"];
  if (typeof kind !== "string") {
    throw new Error(
      `coordinator_decision: 'kind' must be a string, got ${describe(kind)}`,
    );
  }
  if (!is_decision_kind(kind)) {
    throw new Error(
      `coordinator_decision: unknown kind '${kind}'; expected one of ${DECISION_KINDS.join(", ")}`,
    );
  }
  switch (kind) {
    case "merge_into":
      assert_keys(
        obj,
        ["kind", "novel_issue_id", "reason"],
        "coordinator_decision(merge_into)",
      );
      return {
        kind: "merge_into",
        novel_issue_id: parse_non_empty_string(
          obj["novel_issue_id"],
          "coordinator_decision(merge_into).novel_issue_id",
        ),
        reason: parse_non_empty_string(
          obj["reason"],
          "coordinator_decision(merge_into).reason",
        ),
      };
    case "register_new":
      assert_keys(
        obj,
        ["kind", "canonical_name", "root_cause", "reason"],
        "coordinator_decision(register_new)",
      );
      return {
        kind: "register_new",
        canonical_name: parse_non_empty_string(
          obj["canonical_name"],
          "coordinator_decision(register_new).canonical_name",
        ),
        root_cause: parse_non_empty_string(
          obj["root_cause"],
          "coordinator_decision(register_new).root_cause",
        ),
        reason: parse_non_empty_string(
          obj["reason"],
          "coordinator_decision(register_new).reason",
        ),
      };
    case "flag":
      assert_keys(obj, ["kind", "reason"], "coordinator_decision(flag)");
      return {
        kind: "flag",
        reason: parse_non_empty_string(
          obj["reason"],
          "coordinator_decision(flag).reason",
        ),
      };
  }
}

function is_decision_kind(value: string): value is CoordinatorDecisionKind {
  return (DECISION_KINDS as readonly string[]).includes(value);
}

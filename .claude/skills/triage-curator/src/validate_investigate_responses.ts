/**
 * Step 4.25 validation — run over every investigator response AFTER Task()
 * dispatch and BEFORE Step 4.5 authoring. Catches issues the renderer and
 * the finalize dispatcher would otherwise surface too late:
 *
 *   - Unknown SignalCheck ops (renderer dies mid-render, leaves stubs)
 *   - `response.group_id` rename without an explicit retarget declaration
 *   - `retargets_to` pointing at a non-existent registry entry
 *   - Retarget responses carrying `positive_examples` that index the wrong group
 *   - `positive_examples` / `negative_examples` out-of-range vs source group
 *   - `kind: "none"` proposals with no missing-signal claim and no session-log
 *     failure category (silent dead-end)
 *
 * The module is pure and test-focused: no I/O. The companion script
 * `scripts/validate_responses.ts` does file-system loading.
 */

import {
  parse_investigate_response,
  validate_spec_example_indexes,
} from "./apply_proposals.js";
import type {
  FalsePositiveGroup,
  InvestigatorSessionLog,
  KnownIssue,
} from "./types.js";

export type ValidationIssueCode =
  | "shape_error"
  | "group_id_mismatch"
  | "retargets_to_missing_entry"
  | "retarget_must_not_carry_examples"
  | "example_index_out_of_range"
  | "kind_none_no_signals_no_failure";

export interface ValidationIssue {
  group_id: string;
  response_path: string;
  code: ValidationIssueCode;
  message: string;
}

export interface ValidationInput {
  /** Group id derived from the response filename. Used to check group_id renames. */
  dispatch_group_id: string;
  /** Absolute path of the response JSON — surfaces in error messages. */
  response_path: string;
  /** JSON.parse'd content of the response file (raw, pre-shape-validated). */
  response_raw: unknown;
  /** Source-group view from the triage run; null when the dispatch group is absent. */
  source_group: FalsePositiveGroup | null;
  /** Current registry — needed to verify `retargets_to` references an existing entry. */
  registry: KnownIssue[];
  /** Sibling `<group>.session.json`, if present; null otherwise. */
  session_log: InvestigatorSessionLog | null;
}

export function validate_response(inp: ValidationInput): ValidationIssue[] {
  const parsed = parse_investigate_response(inp.response_raw);
  if ("error" in parsed) {
    return [
      {
        group_id: inp.dispatch_group_id,
        response_path: inp.response_path,
        code: "shape_error",
        message: parsed.error,
      },
    ];
  }

  const issues: ValidationIssue[] = [];

  if (parsed.group_id !== inp.dispatch_group_id) {
    issues.push({
      group_id: inp.dispatch_group_id,
      response_path: inp.response_path,
      code: "group_id_mismatch",
      message:
        `response.group_id='${parsed.group_id}' does not match dispatch group ` +
        `'${inp.dispatch_group_id}'. To extend an existing registry entry, keep ` +
        `group_id='${inp.dispatch_group_id}' and set ` +
        `retargets_to='<existing-registry-group-id>' instead of renaming.`,
    });
  }

  if (parsed.retargets_to !== null) {
    const exists = inp.registry.some((r) => r.group_id === parsed.retargets_to);
    if (!exists) {
      issues.push({
        group_id: inp.dispatch_group_id,
        response_path: inp.response_path,
        code: "retargets_to_missing_entry",
        message: `retargets_to='${parsed.retargets_to}' does not match any existing registry group_id`,
      });
    }
    if (parsed.classifier_spec !== null) {
      const pos = parsed.classifier_spec.positive_examples.length;
      const neg = parsed.classifier_spec.negative_examples.length;
      if (pos > 0 || neg > 0) {
        issues.push({
          group_id: inp.dispatch_group_id,
          response_path: inp.response_path,
          code: "retarget_must_not_carry_examples",
          message:
            `retarget response has positive_examples (${pos}) and/or negative_examples (${neg}). ` +
            `Those indices reference the source group '${parsed.group_id}', but the upsert ` +
            `lands on '${parsed.retargets_to}' — leave both arrays empty when retargeting.`,
        });
      }
    }
  } else if (parsed.classifier_spec !== null && inp.source_group !== null) {
    // Non-retargeted: example indices must be in-range against the source group.
    const index_errors = validate_spec_example_indexes(parsed, {
      [parsed.group_id]: inp.source_group.entries.length,
    });
    for (const err of index_errors) {
      issues.push({
        group_id: inp.dispatch_group_id,
        response_path: inp.response_path,
        code: "example_index_out_of_range",
        message: err,
      });
    }
  }

  if (parsed.proposed_classifier?.kind === "none") {
    const has_signals = parsed.new_signals_needed.length > 0;
    const has_failure =
      inp.session_log?.status === "failure" &&
      inp.session_log.failure_category !== null;
    if (!has_signals && !has_failure) {
      issues.push({
        group_id: inp.dispatch_group_id,
        response_path: inp.response_path,
        code: "kind_none_no_signals_no_failure",
        message:
          "proposed_classifier.kind='none' but response carries no new_signals_needed " +
          "and session log has no failure_category — this is a silent dead-end. " +
          "Either declare the missing signal (new_signals_needed[]) or record a " +
          "failure_category in the session log.",
      });
    }
  }

  return issues;
}

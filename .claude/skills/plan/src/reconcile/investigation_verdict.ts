/**
 * The `refactor-investigator`'s strict-parsed `verdict.json`, written beside its
 * `refactor_plan.md`, and the routing it drives.
 *
 * Prioritize previously routed a group on the free-text `<result>` line
 * `PERMANENT-LIMITATION:` while `refactor_plan.md` was authoritative — the
 * anti-pattern the triage lifecycle forbids — and the deterministic export gate
 * (`select_exportable_tasks`) keyed on the plan-engine mint-time
 * `is_permanent_limitation` flag, never updated by the investigation. This module
 * makes the on-disk `verdict.json` authoritative: prioritize routes from it, and a
 * disagreement with the mint-time flag produces a {@link PermanentLimitationReroute}
 * and flips the source `PlanTask` flag so the export gate and the investigation agree.
 */

import type { PermanentLimitationReroute } from "./permanent_reroute.js";

export type InvestigationOutcome = "permanent_limitation" | "fixable";

export interface InvestigationVerdict {
  outcome: InvestigationOutcome;
  /** The static boundary (permanent) or one-line rationale (fixable). */
  boundary: string;
  /** The `PlanTask` ids this verdict covers. */
  row_ids: string[];
}

/** Strict-parse a raw `verdict.json`, throwing a labeled error on any shape violation. */
export function parse_investigation_verdict(raw: unknown, source_label: string): InvestigationVerdict {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`${source_label}: verdict must be a JSON object`);
  }
  const record = raw as Record<string, unknown>;
  const outcome = record["outcome"];
  if (outcome !== "permanent_limitation" && outcome !== "fixable") {
    throw new Error(`${source_label}.outcome must be "permanent_limitation" or "fixable"`);
  }
  const boundary = record["boundary"];
  if (typeof boundary !== "string" || boundary.length === 0) {
    throw new Error(`${source_label}.boundary must be a non-empty string`);
  }
  const row_ids = record["row_ids"];
  if (!Array.isArray(row_ids) || row_ids.length === 0 || !row_ids.every((x) => typeof x === "string")) {
    throw new Error(`${source_label}.row_ids must be a non-empty array of strings`);
  }
  return { outcome, boundary, row_ids };
}

/** The mint-time facts a verdict is reconciled against, per row. */
export interface RowFlag {
  fault_area: string;
  is_permanent_limitation: boolean;
}

export interface VerdictReconciliation {
  /** One record per row whose flag the verdict disagreed with (a flip is required). */
  reroutes: PermanentLimitationReroute[];
  /** Row ids named by a verdict but absent from the task-DB — a hard error for the caller. */
  unknown_row_ids: string[];
}

/**
 * Reconcile investigation verdicts against the mint-time `is_permanent_limitation`
 * flags. Pure: it computes the reroutes and unknown ids; the caller flips the rows
 * through the task-DB writer and persists the reroute records.
 */
export function reconcile_verdicts(
  verdicts: readonly InvestigationVerdict[],
  flag_by_id: ReadonlyMap<string, RowFlag>,
): VerdictReconciliation {
  const reroutes: PermanentLimitationReroute[] = [];
  const unknown_row_ids: string[] = [];
  for (const verdict of verdicts) {
    const now_permanent = verdict.outcome === "permanent_limitation";
    for (const row_id of verdict.row_ids) {
      const flag = flag_by_id.get(row_id);
      if (flag === undefined) {
        unknown_row_ids.push(row_id);
        continue;
      }
      if (flag.is_permanent_limitation !== now_permanent) {
        reroutes.push({
          row_id,
          fault_area: flag.fault_area,
          was_permanent_limitation: flag.is_permanent_limitation,
          now_permanent_limitation: now_permanent,
          boundary: verdict.boundary,
        });
      }
    }
  }
  return { reroutes, unknown_row_ids };
}

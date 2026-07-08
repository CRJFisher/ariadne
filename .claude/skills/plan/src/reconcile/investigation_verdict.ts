/**
 * The `refactor-investigator`'s strict-parsed `verdict.json`, written beside its
 * `refactor_plan.md`, and the routing it drives.
 *
 * The `verdict.json` file is authoritative: prioritize routes each investigated
 * group from it (an `outcome` of `permanent_limitation` sends the group to
 * `classifier-author`, `fixable` keeps it on the backlog path). A verdict that
 * disagrees with a `PlanTask`'s mint-time `is_permanent_limitation` flag produces
 * a {@link PermanentLimitationReroute} and flips the flag through the task-DB
 * writer, so the deterministic export gate (`select_exportable_tasks`, which keys
 * on that flag) and the investigation agree.
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
  /**
   * The reroute records: one per row whose verdict places it in the permanent set
   * (the Z24 wedge-relevant rows) OR whose mint-time flag disagrees with the
   * verdict (a required flip). Emitting every permanent-verdict row — not only the
   * rows whose flag currently disagrees — makes this set a pure function of the
   * verdict files, so a re-run after the flags are already flipped reproduces the
   * same records rather than silently emptying them.
   */
  reroutes: PermanentLimitationReroute[];
  /** Row ids named by a verdict but absent from the task-DB — a hard error for the caller. */
  unknown_row_ids: string[];
  /** Row ids two verdicts place in conflicting outcomes — a hard error for the caller. */
  conflicting_row_ids: string[];
}

/**
 * Reconcile investigation verdicts against the mint-time `is_permanent_limitation`
 * flags. Pure: it computes the reroutes, unknown ids, and conflicts; the caller
 * flips the rows through the task-DB writer and persists the reroute records. A
 * row named by more than one verdict is recorded once (deduped); the same row in
 * two verdicts with opposite outcomes is a conflict, not a silent last-write-wins.
 */
export function reconcile_verdicts(
  verdicts: readonly InvestigationVerdict[],
  flag_by_id: ReadonlyMap<string, RowFlag>,
): VerdictReconciliation {
  const reroutes: PermanentLimitationReroute[] = [];
  const unknown_row_ids: string[] = [];
  const conflicting_row_ids: string[] = [];
  const decided = new Map<string, boolean>();
  for (const verdict of verdicts) {
    const now_permanent = verdict.outcome === "permanent_limitation";
    for (const row_id of verdict.row_ids) {
      const prior = decided.get(row_id);
      if (prior !== undefined) {
        if (prior !== now_permanent) conflicting_row_ids.push(row_id);
        continue;
      }
      const flag = flag_by_id.get(row_id);
      if (flag === undefined) {
        unknown_row_ids.push(row_id);
        continue;
      }
      decided.set(row_id, now_permanent);
      const disagrees = flag.is_permanent_limitation !== now_permanent;
      if (now_permanent || disagrees) {
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
  return { reroutes, unknown_row_ids, conflicting_row_ids };
}

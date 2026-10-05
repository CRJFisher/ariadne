/**
 * The reroute record: prioritize's durable note that a `refactor-investigator`
 * verdict placed a row in the permanent set or disagreed with its mint-time
 * `is_permanent_limitation` flag.
 *
 * `apply_investigation_verdicts` writes one record per wedge-relevant row to
 * `<run>/reroutes.json` and flips any disagreeing flag through the task-DB writer
 * so the export gate and the investigation agree. `validate_consolidation` reads
 * these records: a row judged a permanent limitation routes to `classifier-author`,
 * never into a cluster, so any such id appearing in a consolidation cluster is a
 * routing error.
 */
export interface PermanentLimitationReroute {
  /** The `PlanTask` id whose flag was flipped. */
  row_id: string;
  fault_area: string;
  /** The mint-time flag, before the investigation. */
  was_permanent_limitation: boolean;
  /** The investigator's verdict outcome, now authoritative and written to the row. */
  now_permanent_limitation: boolean;
  /** The static boundary (permanent) or one-line rationale (fixable) from the verdict. */
  boundary: string;
}

/**
 * The row ids a reroute moved INTO the permanent-limitation set. These route to
 * `classifier-author`, not `backlog/`, so they must not appear in any
 * consolidation cluster.
 */
export function permanent_rerouted_ids(reroutes: readonly PermanentLimitationReroute[]): string[] {
  return reroutes.filter((r) => r.now_permanent_limitation).map((r) => r.row_id);
}

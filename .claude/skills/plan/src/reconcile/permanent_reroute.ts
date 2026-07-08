/**
 * The reroute record: prioritize's durable note that a `refactor-investigator`
 * verdict disagreed with a `PlanTask`'s mint-time `is_permanent_limitation` flag,
 * and the flag was flipped to match the investigation.
 *
 * File-authoritative permanent-limitation routing (TASK-190.36.4 item 4) writes
 * one record per disagreement to `<run>/reroutes.json`, then flips the source
 * row through the task-DB writer so the export gate and the investigation agree.
 * `validate_consolidation` (item 2) reads these records: a row now judged a
 * permanent limitation routes to `classifier-author`, never into a cluster, so
 * any such id appearing in a consolidation cluster is the Z24 wedge.
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

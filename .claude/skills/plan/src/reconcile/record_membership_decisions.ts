/**
 * Pass C, membership step — turn a validated strategist plan's `belongs: false`
 * verdicts into durable membership decisions across the stores.
 *
 * The strategist (Pass B) reviewed each member it was handed and excluded the
 * ones a deterministic Pass A mis-routed into its bucket. Those exclusions are
 * recorded here so a fix is grounded only on confirmed members and a mis-route is
 * not re-adjudicated every sweep:
 *
 *   - one `exclude_member` `PlanSweepEvent` per exclusion (the audit trail);
 *   - a membership-override record per exclusion (so Pass A re-routes/suppresses
 *     the member next sweep), keyed on the member's line-drift-stable identity;
 *   - a `derive_fault_area` correction signal for every exclusion that names a
 *     `suggested_area` — a confirmed systematic mis-route the human fixes in the
 *     taxonomy/derivation, the same spirit as the `other`-bucket extension path.
 *
 * The reconcile pass is the SOLE writer of the task-DB sweep log and the override
 * store; the strategist only authored its plan.
 */

import type { PlanSweepEvent, PlanTaskEvidence } from "../store/plan_task.js";
import type { JsonPlanTaskRepository } from "../store/json_plan_task_repository.js";
import type { AriadneFaultArea } from "@ariadnejs/types";

import type { StrategistPlan } from "../types.js";
import type { MembershipExclusion, MembershipOverrideStore } from "../store/membership_override.js";

/**
 * A confirmed `derive_fault_area` mis-route: Pass A routed `member` to `from_area`
 * but the strategist says it belongs in `to_area`. Surfaced in the reconcile
 * summary as the signal to fix the deterministic derivation, not re-adjudicated.
 */
export interface DeriveFaultAreaCorrection {
  from_area: AriadneFaultArea;
  to_area: AriadneFaultArea;
  member: MembershipExclusion["member"];
  reason: string;
}

export interface MembershipDecisionOutcome {
  events: PlanSweepEvent[];
  corrections: DeriveFaultAreaCorrection[];
}

/**
 * Resolve a validated plan's `belongs: false` verdicts to {@link MembershipExclusion}s.
 * Pure: `bucket_evidence[index].member_symbol` is the excluded member's identity.
 * Precondition: the plan passed `validate_plan` (so every verdict index is in
 * range); an out-of-range index here is an upstream contract break and throws.
 */
export function collect_membership_exclusions(
  plan: StrategistPlan,
  bucket_evidence: PlanTaskEvidence[],
): MembershipExclusion[] {
  return plan.membership
    .filter((verdict) => !verdict.belongs)
    .map((verdict) => {
      const evidence = bucket_evidence[verdict.index];
      if (evidence === undefined) {
        throw new Error(
          `collect_membership_exclusions: verdict index ${verdict.index} out of range [0, ${bucket_evidence.length}) — run validate_plan first`,
        );
      }
      return {
        fault_area: plan.fault_area,
        member: evidence.member_symbol,
        reason: verdict.reason,
        suggested_area: verdict.suggested_area ?? null,
      };
    });
}

/**
 * Record `exclusions` across the stores: append one `exclude_member` event per
 * exclusion to the sweep log, upsert the override store, and return the events +
 * the `derive_fault_area` correction signals (the exclusions that name a
 * suggested area). A no-op when there are no exclusions.
 */
export async function record_membership_decisions(
  repo: JsonPlanTaskRepository,
  override_store: MembershipOverrideStore,
  sweep_id: string,
  exclusions: MembershipExclusion[],
): Promise<MembershipDecisionOutcome> {
  const events: PlanSweepEvent[] = exclusions.map((exclusion) => ({
    kind: "exclude_member",
    fault_area: exclusion.fault_area,
    member: exclusion.member,
    reason: exclusion.reason,
    suggested_area: exclusion.suggested_area,
  }));
  for (const event of events) await repo.append_sweep_event(sweep_id, event);

  await override_store.upsert_many(exclusions, sweep_id);

  const corrections: DeriveFaultAreaCorrection[] = exclusions
    .filter((exclusion): exclusion is MembershipExclusion & { suggested_area: AriadneFaultArea } =>
      exclusion.suggested_area !== null,
    )
    .map((exclusion) => ({
      from_area: exclusion.fault_area,
      to_area: exclusion.suggested_area,
      member: exclusion.member,
      reason: exclusion.reason,
    }));

  return { events, corrections };
}

/**
 * The membership-override store — the plan engine's durable record of members a
 * strategist judged NOT to belong in the fault-area bucket they were routed into.
 *
 * Pass A (`derive_fault_area`) buckets every false-positive deterministically and
 * can mis-route one. The strategist excludes a mis-routed member from its plan
 * (Pass B), and the reconcile pass (Pass C) writes the exclusion here. Because a
 * future sweep re-buckets the same member via the SAME deterministic derivation,
 * an exclusion that only skipped it this sweep would be re-adjudicated forever;
 * recording it here lets Pass A re-route (or suppress) it on the next sweep
 * instead — keyed on a drift-tolerant member identity (see
 * {@link member_identity_token}; a line-shifted member re-enters the review).
 *
 * Suppression (an override with no `suggested_area`) is unconditional and
 * persists until a human edits the file: a suppressed member that genuinely
 * resurfaces in a later run is silently dropped, unlike the classifier
 * registry's resurfaced-`fixed`-row review. Clearing the override is the
 * recovery path.
 *
 * Single accumulating JSON file at `~/.ariadne/plan/membership_overrides.json`.
 * The reconcile pass is the SOLE writer (one writer per sweep, so the read-merge-
 * write is race-free without a lock — the same single-writer assumption the task
 * store relies on); Pass A reads it. The path is not registry-shaped, so it stays
 * outside the registry-writer lock contract.
 */

import { mkdir, readFile } from "node:fs/promises";

import type { AriadneFaultArea } from "@ariadnejs/types";
import {
  atomic_write_file,
  error_code,
} from "@ariadnejs/skill-fs";
import type { MemberSymbol } from "@ariadnejs/skill-protocol";
import { plan_dir, plan_membership_overrides_path } from "./paths.js";

/**
 * One recorded mis-route: a member excluded from `fault_area`'s bucket. Keyed on
 * `(fault_area, member_identity_token(member))` — the same member may be a member
 * of (and correctly excluded from) more than one area's bucket over time.
 */
export interface MembershipOverride {
  /** The bucket the member was excluded FROM. */
  fault_area: AriadneFaultArea;
  member: MemberSymbol;
  reason: string;
  /** The area the member should route to instead, or `null` when the strategist could not tell. */
  suggested_area: AriadneFaultArea | null;
  first_excluded_in_sweep: string;
  last_excluded_in_sweep: string;
}

/**
 * The identity token for a member — THE membership-override key primitive,
 * defined once. Joins the `MemberSymbol` fields in declaration order
 * `(file_path, name, kind, start_line)`, newline-delimited so no value can
 * collide with the delimiter. `(file_path, name, kind)` is the drift-tolerant
 * core; `start_line` is the same-name/overload collision-breaker and still moves
 * when surrounding lines shift, so the token is matched only while the member's
 * start line is unchanged (a line-shifted member re-enters the review). Same
 * delimiter-safety discipline as `location_token`, but over the FLAGGED MEMBER
 * (a four-field tuple) rather than the call site (a `file:line` pair).
 */
export function member_identity_token(member: MemberSymbol): string {
  return [member.file_path, member.name, member.kind, String(member.start_line)].join("\n");
}

/** The override-store key: `fault_area` joined to the member identity token. */
export function override_key(fault_area: AriadneFaultArea, member: MemberSymbol): string {
  return `${fault_area}\n${member_identity_token(member)}`;
}

/** One exclusion the reconcile pass records (the input to {@link MembershipOverrideStore.upsert_many}). */
export interface MembershipExclusion {
  fault_area: AriadneFaultArea;
  member: MemberSymbol;
  reason: string;
  suggested_area: AriadneFaultArea | null;
}

/**
 * The override store's read/write seam. The reconcile pass upserts exclusions;
 * Pass A reads the records to re-route or suppress mis-routed members.
 */
export interface MembershipOverrideStore {
  /** Every recorded override; `[]` when the file does not yet exist. */
  read(): Promise<MembershipOverride[]>;
  /**
   * Merge `exclusions` into the store under `sweep_id`. A new key is created with
   * `first_excluded_in_sweep === last_excluded_in_sweep === sweep_id`; an existing
   * key keeps its `first_excluded_in_sweep` and refreshes `last_excluded_in_sweep`,
   * `reason`, and `suggested_area` to the latest sweep's verdict.
   */
  upsert_many(exclusions: MembershipExclusion[], sweep_id: string): Promise<void>;
}

/** JSON-file implementation of {@link MembershipOverrideStore}. */
export class JsonMembershipOverrideStore implements MembershipOverrideStore {
  async read(): Promise<MembershipOverride[]> {
    const file_path = plan_membership_overrides_path();
    let text: string;
    try {
      text = await readFile(file_path, "utf8");
    } catch (err) {
      if (error_code(err) === "ENOENT") return [];
      throw err;
    }
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error(`${file_path}: expected an array of MembershipOverride records`);
    }
    return parsed as MembershipOverride[];
  }

  async upsert_many(exclusions: MembershipExclusion[], sweep_id: string): Promise<void> {
    if (exclusions.length === 0) return;
    const existing = await this.read();
    const by_key = new Map<string, MembershipOverride>();
    for (const record of existing) by_key.set(override_key(record.fault_area, record.member), record);

    for (const exclusion of exclusions) {
      const key = override_key(exclusion.fault_area, exclusion.member);
      const prior = by_key.get(key);
      by_key.set(key, {
        fault_area: exclusion.fault_area,
        member: exclusion.member,
        reason: exclusion.reason,
        suggested_area: exclusion.suggested_area,
        first_excluded_in_sweep: prior?.first_excluded_in_sweep ?? sweep_id,
        last_excluded_in_sweep: sweep_id,
      });
    }

    // Sort by key for a stable, diffable on-disk order (no clock, no randomness).
    const records = [...by_key.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, record]) => record);
    // `atomic_write_file` does not create directories; ensure the plan root exists
    // (mirrors the task store's mkdir-before-write invariant) so the store is
    // self-sufficient rather than relying on a prior task write to create it.
    await mkdir(plan_dir(), { recursive: true });
    await atomic_write_file(plan_membership_overrides_path(), `${JSON.stringify(records, null, 2)}\n`);
  }
}

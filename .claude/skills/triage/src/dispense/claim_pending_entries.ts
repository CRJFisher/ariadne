/**
 * Claim the entries a run's investigators must still investigate, and record
 * the ones that end without a verdict.
 *
 * Every state-file write here is one locked read-modify-write transaction under
 * `atomic_update_registry`, so it is atomic (temp + rename) and crash-safe:
 *
 * - `absorb_and_pick` absorbs the verdict files already in `results/` into
 *   state, picks up to `count` entries still to investigate — `pending`, or
 *   `failed` with retry budget left — and, for each picked `failed` entry,
 *   clears its stale (malformed) result file and flips it back to `pending`
 *   with `retry_count` incremented. It sets `phase = "complete"` once nothing
 *   is left to investigate.
 * - `record_investigation_failure` terminalizes an entry whose investigations
 *   all ended without a verdict, so the run can drain and finalize with the
 *   entry counted as failed.
 *
 * A run is investigated by one `investigate_run` at a time, which claims every
 * pickable entry up front, so no entry is handed to two investigators.
 */

import * as fs from "node:fs/promises";
import path from "node:path";

import { atomic_update_registry } from "@ariadnejs/skill-fs";

import { merge_results } from "../finalize/merge_results.js";
import { RESULTS_SUBDIR } from "../store/paths.js";
import type { TriageEntry, TriageState } from "../triage_state_types.js";

/**
 * Retry budget for a `failed` entry. An entry becomes retryably `failed` only
 * when its result file is malformed; the picker re-dispatches it up to this
 * many times before the failure is terminal. Each retry clears the stale result
 * file so `merge_results` cannot re-fail the entry before the retry writes.
 */
export const MAX_TRIAGE_RETRIES = 2;

/** An entry the LLM pool must still investigate is pending, or a retryable failure. */
function is_pickable(entry: TriageEntry): boolean {
  if (entry.auto_classified === true) return false;
  if (entry.status === "pending") return true;
  if (entry.status === "failed" && entry.retry_count < MAX_TRIAGE_RETRIES) return true;
  return false;
}

/**
 * Pure selection over triage entries. An entry is pickable when:
 *   - `auto_classified !== true` — a builtin classifier already reached a
 *     verdict, so the LLM pool never needs to re-investigate it. Defence in
 *     depth: `build_triage_entries` already flips these to `"completed"`, but
 *     explicit filtering protects against future regressions that toggle
 *     `completed → pending` without clearing the flag.
 *   - `status === "pending"`, OR `status === "failed"` with retry budget left
 *     (a `failed` entry has a malformed result file; the caller clears it and
 *     re-dispatches — see `absorb_and_pick`).
 */
export function pick_next_entries(entries: readonly TriageEntry[], count: number): number[] {
  const picked: number[] = [];
  for (const entry of entries) {
    if (picked.length >= count) break;
    if (!is_pickable(entry)) continue;
    picked.push(entry.entry_index);
  }
  return picked;
}

/**
 * The run is complete only when the LLM pool has nothing left to do: no
 * un-classified `pending` entry and no retryable `failed` entry remain. A
 * `failed` entry that has exhausted its retry budget is terminal and does not
 * hold the gate open.
 */
function pool_is_drained(entries: readonly TriageEntry[]): boolean {
  return !entries.some(is_pickable);
}

export interface AbsorbedState {
  state: TriageState;
  picked: number[];
}

/**
 * Read → merge results → pick → re-dispatch bookkeeping → write, as one
 * transaction. Returns the state as written and the picked indices; `count: 0`
 * only absorbs, which is how a finished pool drains the run.
 */
export async function absorb_and_pick(state_path: string, run_dir: string, count: number): Promise<AbsorbedState> {
  return atomic_update_registry<AbsorbedState>(state_path, async (raw) => {
    const state = JSON.parse(raw) as TriageState;

    await merge_results(state, run_dir);

    const picked = pick_next_entries(state.entries, count);

    for (const index of picked) {
      const entry = state.entries.find((e) => e.entry_index === index);
      if (entry && entry.status === "failed") {
        await fs.unlink(path.join(run_dir, RESULTS_SUBDIR, `${index}.json`)).catch(() => undefined);
        entry.status = "pending";
        entry.error = null;
        entry.retry_count += 1;
      }
    }

    if (pool_is_drained(state.entries)) {
      state.phase = "complete";
    }

    state.updated_at = new Date().toISOString();
    return { kind: "write", next: JSON.stringify(state, null, 2) + "\n", result: { state, picked } };
  });
}

/** Mark `entry_index` failed with no retry budget left, so the run drains without it. */
export async function record_investigation_failure(state_path: string, entry_index: number, error: string): Promise<void> {
  await atomic_update_registry<void>(state_path, async (raw) => {
    const state = JSON.parse(raw) as TriageState;
    const entry = state.entries.find((e) => e.entry_index === entry_index);
    if (entry === undefined) throw new Error(`entry ${entry_index} is not in ${state_path}`);
    entry.status = "failed";
    entry.error = error;
    entry.retry_count = MAX_TRIAGE_RETRIES;
    state.updated_at = new Date().toISOString();
    return { kind: "write", next: JSON.stringify(state, null, 2) + "\n", result: undefined };
  });
}

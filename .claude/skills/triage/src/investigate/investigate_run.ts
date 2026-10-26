/**
 * Investigate every entry a run still needs, then finalize the run once it has
 * drained: dispense → investigate → absorb → finalize, with no agent in the
 * loop.
 *
 * Each call claims the run's pickable entries, investigates them through the
 * warm-up pool, writes each verdict to `results/<entry_index>.json`, records
 * every investigation's usage in `investigations.json`, and stops dispatching
 * at the first of: the queue emptying, the spend cap, the time budget, or an
 * account error (spend limit, rate limit, auth). An entry whose investigation
 * is cut short stays `pending`, so the next call picks it up; an entry whose
 * investigations all end without a verdict is recorded as failed.
 */

import fs from "node:fs";
import path from "node:path";

import { atomic_write_file } from "@ariadnejs/skill-fs";

import { absorb_and_pick, record_investigation_failure } from "../dispense/claim_pending_entries.js";
import { build_dispense_payload } from "../dispense/dispense_payload.js";
import { finalize_run, type FinalizedRun } from "../finalize/finalize_run.js";
import { load_registry } from "../known_issues_registry.js";
import { RESULTS_SUBDIR, require_run } from "../store/paths.js";
import type { TriageEntry } from "../triage_state_types.js";
import type { TriageVerdict } from "../verdict/triage_verdict.js";
import { count_prefix_misses, run_investigation_pool } from "./investigation_pool.js";
import { describe_investigator_model, type InvestigatorModel } from "./investigator_model.js";
import {
  InvestigationStoppedError,
  run_investigation,
  type InvestigationInput,
  type InvestigationOutcome,
  type InvestigationUsage,
} from "./run_investigation.js";

/** Investigations per entry per call before an entry without a verdict is recorded as failed. */
export const MAX_INVESTIGATION_ATTEMPTS = 2;

export const INVESTIGATIONS_FILENAME = "investigations.json";

export interface InvestigationRecord {
  entry_index: number;
  attempt: number;
  lead: boolean;
  model: string;
  verdict_kind: TriageVerdict["kind"] | null;
  error: string | null;
  usage: InvestigationUsage;
}

export interface InvestigateRunOptions {
  project: string;
  run_id: string;
  model: InvestigatorModel;
  concurrency: number;
  max_usd: number;
  /** No investigation starts after this long. */
  dispatch_budget_ms: number;
  /** Investigations still running this long after the call started are aborted and stay pending. */
  hard_budget_ms: number;
  investigate?: (input: InvestigationInput) => Promise<InvestigationOutcome>;
}

export type InvestigateRunStatus = "finalized" | "continue" | "stopped";

export interface InvestigateRunSummary {
  run_id: string;
  /** `continue`: entries remain and the same command picks them up; `stopped`: a cap or an account error needs a decision. */
  status: InvestigateRunStatus;
  stopped: string | null;
  model: string;
  investigations: number;
  leads: number;
  verdicts: Record<TriageVerdict["kind"], number>;
  without_verdict: number;
  failed_entries: number;
  pending_entries: number;
  usd: number;
  prefix_miss: number;
  finalized: FinalizedRun | null;
}

function read_investigation_records(file: string): InvestigationRecord[] {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as InvestigationRecord[]) : [];
}

function tally_verdicts(records: readonly InvestigationRecord[]): Record<TriageVerdict["kind"], number> {
  const tally: Record<TriageVerdict["kind"], number> = { tp: 0, "fp-novel": 0, "fp-classifier-regression": 0, uncertain: 0 };
  for (const record of records) if (record.verdict_kind !== null) tally[record.verdict_kind] += 1;
  return tally;
}

export async function investigate_run(options: InvestigateRunOptions): Promise<InvestigateRunSummary> {
  const started = Date.now();
  const { run_id, run_dir, state_path } = require_run(options.project, options.run_id);
  const claimed = await absorb_and_pick(state_path, run_dir, Number.MAX_SAFE_INTEGER);
  const project_path = claimed.state.project_path;
  const entries = new Map(claimed.state.entries.map((e) => [e.entry_index, e]));
  const registry = load_registry();
  const model_name = describe_investigator_model(options.model);
  const investigate = options.investigate ?? run_investigation;

  const records: InvestigationRecord[] = [];
  const in_flight = new Set<AbortController>();
  let spent = 0;
  let failed_entries = 0;
  const hard_stop = setTimeout(() => {
    for (const controller of in_flight) controller.abort();
  }, options.hard_budget_ms);

  const tasks = claimed.picked.map((index) => ({ entry: entries.get(index) as TriageEntry, attempt: 1 }));
  const pool = await run_investigation_pool({
    tasks,
    concurrency: options.concurrency,
    stop_reason: () => {
      if (spent >= options.max_usd) return `spend cap reached ($${spent.toFixed(2)} of $${options.max_usd})`;
      if (Date.now() - started >= options.dispatch_budget_ms) return "time budget reached";
      return null;
    },
    investigate: async (task, warm_up) => {
      const abort = new AbortController();
      in_flight.add(abort);
      try {
        const outcome = await investigate({
          payload: build_dispense_payload({ entry: task.entry, registry }),
          project_path,
          model: options.model,
          abort,
          on_first_response: warm_up.on_first_response,
        });
        spent += outcome.usage.usd;
        records.push({
          entry_index: task.entry.entry_index,
          attempt: task.attempt,
          lead: warm_up.lead,
          model: model_name,
          verdict_kind: outcome.verdict?.kind ?? null,
          error: outcome.error,
          usage: outcome.usage,
        });
        if (outcome.verdict !== null) {
          await atomic_write_file(
            path.join(run_dir, RESULTS_SUBDIR, `${task.entry.entry_index}.json`),
            JSON.stringify(outcome.verdict, null, 2) + "\n",
          );
          return "done";
        }
        if (task.attempt < MAX_INVESTIGATION_ATTEMPTS) {
          task.attempt += 1;
          return "requeue";
        }
        await record_investigation_failure(state_path, task.entry.entry_index, outcome.error ?? "no verdict");
        failed_entries += 1;
        return "done";
      } catch (err) {
        if (abort.signal.aborted) return "done";
        if (err instanceof InvestigationStoppedError) {
          for (const controller of in_flight) if (controller !== abort) controller.abort();
        }
        throw err;
      } finally {
        in_flight.delete(abort);
      }
    },
  });
  clearTimeout(hard_stop);

  const records_file = path.join(run_dir, INVESTIGATIONS_FILENAME);
  await atomic_write_file(records_file, JSON.stringify([...read_investigation_records(records_file), ...records], null, 2) + "\n");

  const absorbed = await absorb_and_pick(state_path, run_dir, 0);
  const pending_entries = absorbed.state.entries.filter((e) => e.status === "pending" && !e.auto_classified).length;
  const finalized = absorbed.state.phase === "complete" ? await finalize_run(options.project, run_id) : null;
  const status: InvestigateRunStatus =
    finalized !== null ? "finalized" : pool.stopped === null || pool.stopped === "time budget reached" ? "continue" : "stopped";

  return {
    run_id,
    status,
    stopped: pool.stopped,
    model: model_name,
    investigations: records.length,
    leads: records.filter((r) => r.lead).length,
    verdicts: tally_verdicts(records),
    without_verdict: records.filter((r) => r.verdict_kind === null).length,
    failed_entries,
    pending_entries,
    usd: Math.round(spent * 10000) / 10000,
    prefix_miss: count_prefix_misses(records.map((r) => ({ lead: r.lead, turn1_cache_read_input_tokens: r.usage.turn1_cache_read_input_tokens }))),
    finalized,
  };
}

/**
 * Replay one benchmark case through the pipeline's own investigation
 * (`run_investigation`), exactly as `investigate_run` dispatches an entry: the
 * case's frozen `TriageEntry`, rebased onto the local clone, with the in-scope
 * slice of the registry the labels were graded against.
 */

import type { KnownIssuesRegistry } from "@ariadnejs/types";

import { build_dispense_payload, type DispensePayload } from "../dispense/dispense_payload.js";
import { describe_investigator_model, type InvestigatorModel } from "../investigate/investigator_model.js";
import { run_investigation, type InvestigationUsage, type ToolCall } from "../investigate/run_investigation.js";
import type { TriageVerdict } from "../verdict/triage_verdict.js";
import { rebase_clone_paths, type BenchmarkCase } from "./load_benchmark_suite.js";

export interface ReplayRecord {
  case_id: string;
  repeat: number;
  /** The investigator model, with its effort when it takes one. */
  model: string;
  /** True when the replay started while the run's prompt cache was cold. */
  lead: boolean;
  verdict: TriageVerdict | null;
  error: string | null;
  usage: InvestigationUsage | null;
  /** The investigator's tool calls in order, so a reviewer can see what it looked at. */
  tool_calls: ToolCall[];
}

export function replay_payload(kase: BenchmarkCase, clone_dir: string, registry: KnownIssuesRegistry): DispensePayload {
  return build_dispense_payload({ entry: rebase_clone_paths(kase.entry, kase.project, clone_dir), registry });
}

export interface ReplayOptions {
  case_id: string;
  repeat: number;
  payload: DispensePayload;
  clone_dir: string;
  model: InvestigatorModel;
  lead: boolean;
  abort: AbortController;
  on_first_response: () => void;
}

/** Throws `InvestigationStoppedError` when the account cannot serve further investigations. */
export async function replay_investigation(options: ReplayOptions): Promise<ReplayRecord> {
  const outcome = await run_investigation({
    payload: options.payload,
    project_path: options.clone_dir,
    model: options.model,
    abort: options.abort,
    on_first_response: options.on_first_response,
  });
  return {
    case_id: options.case_id,
    repeat: options.repeat,
    model: describe_investigator_model(options.model),
    lead: options.lead,
    verdict: outcome.verdict,
    error: outcome.error,
    usage: outcome.usage,
    tool_calls: outcome.tool_calls,
  };
}

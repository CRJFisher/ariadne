import fs from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RunManifest, TriageEntry, TriageState } from "../triage_state_types.js";
import { INVESTIGATIONS_FILENAME, investigate_run, type InvestigationRecord } from "./investigate_run.js";
import { InvestigationStoppedError, type InvestigationInput, type InvestigationOutcome, type InvestigationUsage } from "./run_investigation.js";

// Set before `paths.js` reads it at import.
const STORE = vi.hoisted(() => {
  const dir = `${process.env.TMPDIR ?? "/tmp"}/ariadne-test-investigate-run-${process.pid}`;
  process.env.ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE = dir;
  return dir;
});

const PROJECT = "acme--app";
const RUN_ID = "abc1234-2026-10-26T00-00-00.000Z";
const RUN_DIR = path.join(STORE, "triage_state", PROJECT, "runs", RUN_ID);
const PROJECT_PATH = path.join(STORE, "repos", PROJECT);

function make_entry(entry_index: number, overrides: Partial<TriageEntry> = {}): TriageEntry {
  return {
    entry_index,
    name: `fn_${entry_index}`,
    file_path: `${PROJECT_PATH}/src/fn.ts`,
    start_line: 1,
    kind: "function",
    signature: null,
    route: "llm-triage",
    diagnosis: "no-textual-callers",
    known_source: null,
    status: "pending",
    result: null,
    error: null,
    retry_count: 0,
    is_exported: true,
    access_modifier: null,
    diagnostics: {
      grep_call_sites: [],
      grep_call_sites_outside_index: [],
      reference_sites: [],
      has_uncaptured_indexed_grep_hit: false,
      ariadne_call_refs: [],
      diagnosis: "no-textual-callers",
    },
    auto_classified: false,
    classifier_hints: [],
    tp_source_run_id: null,
    tp_stability_sample: false,
    ...overrides,
  };
}

function usage(usd: number, turn1_cache_read: number): InvestigationUsage {
  return {
    usd,
    turns: 3,
    duration_ms: 1000,
    input_tokens: 10,
    output_tokens: 20,
    cache_read_input_tokens: turn1_cache_read * 3,
    cache_creation_input_tokens: 500,
    turn1_cache_read_input_tokens: turn1_cache_read,
    turn1_cache_creation_input_tokens: 500,
  };
}

function seed_run(entries: TriageEntry[]): void {
  fs.mkdirSync(path.join(RUN_DIR, "results"), { recursive: true });
  fs.mkdirSync(path.join(PROJECT_PATH, "src"), { recursive: true });
  fs.writeFileSync(path.join(PROJECT_PATH, "src", "fn.ts"), "export function fn() {}\n");
  const state: TriageState = {
    project_name: PROJECT,
    project_path: PROJECT_PATH,
    phase: "triage",
    entries,
    created_at: "2026-10-26T00:00:00.000Z",
    updated_at: "2026-10-26T00:00:00.000Z",
  };
  const manifest: RunManifest = {
    schema_version: 1,
    run_id: RUN_ID,
    project_name: PROJECT,
    project_path: PROJECT_PATH,
    created_at: "2026-10-26T00:00:00.000Z",
    finalized_at: null,
    status: "active",
    source_analysis_path: "/analysis.json",
    source_analysis_run_id: "analysis",
    max_count: 250,
    commit_hash: "abc1234",
    tp_cache: { enabled: false, source_run_id: null, skipped_count: 0, skipped_entry_keys: [], stability: null },
  };
  fs.writeFileSync(path.join(RUN_DIR, "triage.json"), JSON.stringify(state));
  fs.writeFileSync(path.join(RUN_DIR, "manifest.json"), JSON.stringify(manifest));
}

const TP: InvestigationOutcome["verdict"] = { kind: "tp", member_evidence: { file: "src/fn.ts", line: 1, why: "no caller anywhere" } };

const OPTIONS = {
  project: PROJECT,
  run_id: RUN_ID,
  model: { model: "claude-haiku-5-5", effort: "medium" as const },
  concurrency: 2,
  max_usd: Infinity,
  dispatch_budget_ms: 60_000,
  hard_budget_ms: 120_000,
};

beforeEach(() => {
  fs.rmSync(STORE, { recursive: true, force: true });
});

afterEach(() => {
  fs.rmSync(STORE, { recursive: true, force: true });
});

describe("investigate_run", () => {
  it("investigates every pending entry, writes each verdict, records usage and finalizes the drained run", async () => {
    seed_run([make_entry(0), make_entry(1), make_entry(2, { status: "completed", route: "known-unreachable", known_source: "registry:x", auto_classified: true })]);
    const seen: number[] = [];
    const investigate = async (input: InvestigationInput): Promise<InvestigationOutcome> => {
      seen.push(input.payload.entry_context.entry_index);
      input.on_first_response?.();
      return { verdict: TP, error: null, usage: usage(0.01, seen.length === 1 ? 0 : 1200), tool_calls: [] };
    };

    const summary = await investigate_run({ ...OPTIONS, investigate });

    expect(seen.sort()).toEqual([0, 1]);
    expect(JSON.parse(fs.readFileSync(path.join(RUN_DIR, "results", "1.json"), "utf8"))).toEqual(TP);
    expect(summary.status).toEqual("finalized");
    expect(summary.verdicts).toEqual({ tp: 2, "fp-novel": 0, "fp-classifier-regression": 0, uncertain: 0 });
    expect(summary.leads).toEqual(1);
    expect(summary.prefix_miss).toEqual(0);
    expect(summary.usd).toEqual(0.02);
    const records = JSON.parse(fs.readFileSync(path.join(RUN_DIR, INVESTIGATIONS_FILENAME), "utf8")) as InvestigationRecord[];
    expect(records.map((r) => [r.attempt, r.verdict_kind, r.model])).toEqual([
      [1, "tp", "claude-haiku-5-5@medium"],
      [1, "tp", "claude-haiku-5-5@medium"],
    ]);
    const manifest = JSON.parse(fs.readFileSync(path.join(RUN_DIR, "manifest.json"), "utf8")) as RunManifest;
    expect(manifest.status).toEqual("finalized");
  });

  it("retries an entry that ends without a verdict once, then records it as failed and still finalizes", async () => {
    seed_run([make_entry(0)]);
    const investigate = async (): Promise<InvestigationOutcome> => ({
      verdict: null,
      error: "reached the 20-turn cap without a verdict",
      usage: usage(0.01, 0),
      tool_calls: [],
    });

    const summary = await investigate_run({ ...OPTIONS, investigate });

    expect(summary.investigations).toEqual(2);
    expect(summary.without_verdict).toEqual(2);
    expect(summary.failed_entries).toEqual(1);
    expect(summary.status).toEqual("finalized");
    expect(summary.finalized?.summary.failed_count).toEqual(1);
  });

  it("stops dispatching on an account error and leaves the run resumable", async () => {
    seed_run([make_entry(0), make_entry(1), make_entry(2)]);
    const investigate = async (): Promise<InvestigationOutcome> => {
      throw new InvestigationStoppedError("investigation stopped by billing_error");
    };

    const summary = await investigate_run({ ...OPTIONS, concurrency: 1, investigate });

    expect(summary.status).toEqual("stopped");
    expect(summary.stopped).toEqual("investigation stopped by billing_error");
    expect(summary.pending_entries).toEqual(3);
    expect(summary.finalized).toEqual(null);
  });

  it("stops at the spend cap", async () => {
    seed_run([make_entry(0), make_entry(1), make_entry(2)]);
    const investigate = async (input: InvestigationInput): Promise<InvestigationOutcome> => {
      input.on_first_response?.();
      return { verdict: TP, error: null, usage: usage(0.5, 0), tool_calls: [] };
    };

    const summary = await investigate_run({ ...OPTIONS, concurrency: 1, max_usd: 0.5, investigate });

    expect(summary.status).toEqual("stopped");
    expect(summary.stopped).toEqual("spend cap reached ($0.50 of $0.5)");
    expect(summary.investigations).toEqual(1);
    expect(summary.pending_entries).toEqual(2);
  });
});

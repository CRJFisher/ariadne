import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FilePath } from "@ariadnejs/types";
import { afterEach, describe, expect, it } from "vitest";

import type { TriageEntry, TriageState } from "../triage_state_types.js";
import type { BenchmarkCase } from "./load_benchmark_suite.js";
import { stage_replay_run } from "./stage_replay_run.js";

const CONTAINER_CLONE = "/home/node/.ariadne/triage-entrypoints/repos/acme--lib";
const LOCAL_CLONE = "/local/.ariadne/triage-entrypoints/repos/acme--lib";

function make_entry(overrides: Partial<TriageEntry> = {}): TriageEntry {
  return {
    entry_index: 7,
    name: "run",
    file_path: `${CONTAINER_CLONE}/src/a.js` as FilePath,
    start_line: 3,
    kind: "function",
    signature: null,
    route: "llm-triage",
    diagnosis: "no-textual-callers",
    known_source: null,
    status: "failed",
    result: null,
    error: "stale",
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
    retry_count: 1,
    ...overrides,
  };
}

function make_case(entry: TriageEntry): BenchmarkCase {
  return {
    case_id: "acme--lib__run__L3",
    strata: "javascript/stable-tp",
    project: "acme--lib",
    github: "acme/lib",
    commit: "abc1234",
    language: "javascript",
    diagnosis: "no-textual-callers",
    member_symbol: { file_path: "src/a.js", name: "run", kind: "function", start_line: 3 },
    entry,
    prior_verdicts: [],
  };
}

describe("stage_replay_run", () => {
  let store: string;
  afterEach(() => fs.rmSync(store, { recursive: true, force: true }));

  it("writes a one-entry pending run with clone paths rebased, and clears an earlier verdict", () => {
    store = fs.mkdtempSync(path.join(os.tmpdir(), "bench-store-"));
    const run_dir = path.join(store, "triage_state/acme--lib/runs/bench-r2-acme--lib__run__L3");
    fs.mkdirSync(path.join(run_dir, "results"), { recursive: true });
    fs.writeFileSync(path.join(run_dir, "results/7.json"), "{}");

    const staged = stage_replay_run(store, make_case(make_entry()), 2, LOCAL_CLONE);

    expect(staged).toEqual({
      project: "acme--lib",
      run_id: "bench-r2-acme--lib__run__L3",
      entry_index: 7,
      verdict_path: path.join(run_dir, "results/7.json"),
    });
    expect(fs.existsSync(staged.verdict_path)).toEqual(false);
    const state = JSON.parse(fs.readFileSync(path.join(run_dir, "triage.json"), "utf8")) as TriageState;
    expect(state.project_path).toEqual(LOCAL_CLONE);
    expect(state.entries).toEqual([
      make_entry({ file_path: `${LOCAL_CLONE}/src/a.js` as FilePath, status: "pending", error: null }),
    ]);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  pick_next_entries,
  absorb_and_pick,
  MAX_TRIAGE_RETRIES,
} from "./get_next_triage_entry.js";
import type { TriageEntry, TriageState } from "../src/triage_state_types.js";

function make_entry(overrides: Partial<TriageEntry> & { entry_index: number }): TriageEntry {
  return {
    name: `entry_${overrides.entry_index}`,
    file_path: "src/x.ts",
    start_line: 1,
    kind: "function",
    signature: null,
    route: "llm-triage",
    diagnosis: "callers-not-in-registry",
    known_source: null,
    status: "pending",
    result: null,
    error: null,
    retry_count: 0,
    is_exported: true,
    access_modifier: null,
    diagnostics: {
      grep_call_sites: [],
      grep_call_sites_unindexed_tests: [],
      has_uncaptured_indexed_grep_hit: false,
      callers_only_in_unindexed_tests: false,
      ariadne_call_refs: [],
      diagnosis: "callers-not-in-registry",
    },
    auto_classified: false,
    classifier_hints: [],
    tp_source_run_id: null,
    tp_stability_sample: false,
    ...overrides,
  };
}

function make_state(entries: TriageEntry[]): TriageState {
  return {
    project_name: "proj",
    project_path: "/tmp/proj",
    phase: "triage",
    entries,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

/** A minimal well-formed `tp` verdict file, accepted by `parse_triage_verdict`. */
function tp_verdict_json(): string {
  return JSON.stringify({
    kind: "tp",
    member_evidence: { file: "src/x.ts", line: 1, why: "no callers" },
  });
}

describe("pick_next_entries", () => {
  it("returns the first pending entry", () => {
    const entries: TriageEntry[] = [
      make_entry({ entry_index: 0, status: "completed" }),
      make_entry({ entry_index: 1 }),
      make_entry({ entry_index: 2 }),
    ];
    expect(pick_next_entries(entries, 1)).toEqual([1]);
  });

  it("respects --count", () => {
    const entries: TriageEntry[] = [
      make_entry({ entry_index: 0 }),
      make_entry({ entry_index: 1 }),
      make_entry({ entry_index: 2 }),
    ];
    expect(pick_next_entries(entries, 2)).toEqual([0, 1]);
  });

  it("skips auto_classified entries even if status is pending", () => {
    const entries: TriageEntry[] = [
      make_entry({ entry_index: 0, status: "pending", auto_classified: true }),
      make_entry({ entry_index: 1 }),
    ];
    expect(pick_next_entries(entries, 2)).toEqual([1]);
  });

  it("returns [] when nothing is pickable", () => {
    const entries: TriageEntry[] = [
      make_entry({ entry_index: 0, status: "completed" }),
      make_entry({ entry_index: 1, status: "pending", auto_classified: true }),
    ];
    expect(pick_next_entries(entries, 5)).toEqual([]);
  });

  it("re-picks a failed entry with retry budget left", () => {
    const entries: TriageEntry[] = [
      make_entry({ entry_index: 0, status: "failed", retry_count: 0 }),
      make_entry({ entry_index: 1, status: "failed", retry_count: MAX_TRIAGE_RETRIES - 1 }),
    ];
    expect(pick_next_entries(entries, 5)).toEqual([0, 1]);
  });

  it("does not re-pick a failed entry that exhausted its retry budget", () => {
    const entries: TriageEntry[] = [
      make_entry({ entry_index: 0, status: "failed", retry_count: MAX_TRIAGE_RETRIES }),
    ];
    expect(pick_next_entries(entries, 5)).toEqual([]);
  });
});

describe("absorb_and_pick", () => {
  let run_dir: string;
  let state_path: string;
  let results_dir: string;

  beforeEach(async () => {
    run_dir = await fs.mkdtemp(path.join(os.tmpdir(), "triage-absorb-"));
    results_dir = path.join(run_dir, "results");
    state_path = path.join(run_dir, "triage.json");
    await fs.mkdir(results_dir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(run_dir, { recursive: true, force: true });
  });

  async function write_state(state: TriageState): Promise<void> {
    await fs.writeFile(state_path, JSON.stringify(state, null, 2) + "\n");
  }

  async function read_state(): Promise<TriageState> {
    return JSON.parse(await fs.readFile(state_path, "utf8")) as TriageState;
  }

  it("absorbs a batch's completed verdicts, drains the pool, and releases the lock", async () => {
    await write_state(
      make_state([
        make_entry({ entry_index: 0 }),
        make_entry({ entry_index: 1 }),
      ]),
    );
    await fs.writeFile(path.join(results_dir, "0.json"), tp_verdict_json());
    await fs.writeFile(path.join(results_dir, "1.json"), tp_verdict_json());

    const picked = await absorb_and_pick(state_path, run_dir, 2);

    expect(picked).toEqual([]);
    const state = await read_state();
    expect(state.entries.map((e) => e.status)).toEqual(["completed", "completed"]);
    expect(state.phase).toEqual("complete");
    expect(await fs.readdir(run_dir)).not.toContain("triage.json.lock");
  });

  it("re-picking a failed entry clears its stale result file and bumps retry_count", async () => {
    await write_state(make_state([make_entry({ entry_index: 0, status: "failed", retry_count: 0 })]));
    await fs.writeFile(path.join(results_dir, "0.json"), "not valid json{{{");

    const picked = await absorb_and_pick(state_path, run_dir, 1);

    expect(picked).toEqual([0]);
    const state = await read_state();
    expect(state.entries[0].status).toEqual("pending");
    expect(state.entries[0].error).toBeNull();
    expect(state.entries[0].retry_count).toEqual(1);
    expect(await fs.readdir(results_dir)).not.toContain("0.json");
  });

  it("keeps phase 'triage' while a retryable failed entry remains, then completes when it terminalizes", async () => {
    await write_state(
      make_state([make_entry({ entry_index: 0, status: "failed", retry_count: MAX_TRIAGE_RETRIES - 1 })]),
    );
    await fs.writeFile(path.join(results_dir, "0.json"), "still malformed{{{");

    // One retry left: entry is re-picked, so the pool is not drained.
    await absorb_and_pick(state_path, run_dir, 1);
    expect((await read_state()).phase).toEqual("triage");

    // The retry investigator writes another malformed file; the budget is now
    // exhausted, so the entry terminalizes as failed and the gate closes.
    await fs.writeFile(path.join(results_dir, "0.json"), "malformed again{{{");
    const picked = await absorb_and_pick(state_path, run_dir, 1);
    expect(picked).toEqual([]);
    const state = await read_state();
    expect(state.entries[0].status).toEqual("failed");
    expect(state.entries[0].retry_count).toEqual(MAX_TRIAGE_RETRIES);
    expect(state.phase).toEqual("complete");
  });

  it("picks a still-running pending entry but holds phase 'triage' until it completes", async () => {
    await write_state(make_state([make_entry({ entry_index: 0, status: "pending" })]));

    const picked = await absorb_and_pick(state_path, run_dir, 1);

    expect(picked).toEqual([0]);
    expect((await read_state()).phase).toEqual("triage");
  });
});

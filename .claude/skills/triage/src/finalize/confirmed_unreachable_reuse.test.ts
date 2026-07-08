import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fsSync from "fs";
import path from "path";

import type { TriageResultsFile, ConfirmedUnreachableSource } from "@ariadnejs/skill-protocol";
import type { TriageEntry, TriageState } from "../triage_state_types.js";
import type { TriageVerdict } from "../verdict/triage_verdict.js";
import {
  apply_tp_cache_to_entries,
  compute_tp_stability,
  derive_tp_cache,
  cache_key_string,
  select_stability_sample_indices,
  TP_STABILITY_SAMPLE_TARGET,
} from "./confirmed_unreachable_reuse.js";

// vi.hoisted runs before all `import` statements, so the env var is set
// before `paths.js` (transitively imported by `confirmed_unreachable_reuse.js`) reads it.
const TMP = vi.hoisted(() => {
  const tmp_path = `${process.env.TMPDIR ?? "/tmp"}/ariadne-test-tp-cache-${process.pid}`;
  process.env.ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE = tmp_path;
  return tmp_path;
});

const ANALYSIS_OUTPUT = path.join(TMP, "analysis_output");

beforeEach(() => {
  fsSync.rmSync(TMP, { recursive: true, force: true });
  fsSync.mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  fsSync.rmSync(TMP, { recursive: true, force: true });
});

function seed_triage_results(project: string, run_id: string, output: TriageResultsFile): void {
  const dir = path.join(ANALYSIS_OUTPUT, project, "triage_results");
  fsSync.mkdirSync(dir, { recursive: true });
  fsSync.writeFileSync(path.join(dir, `${run_id}.json`), JSON.stringify(output));
}

/**
 * Write a raw on-disk record without forcing it to satisfy `TriageResultsFile`.
 * Used to simulate legacy v1 records that lack the `kind` field on entries.
 */
function seed_raw_triage_results(project: string, run_id: string, raw: unknown): void {
  const dir = path.join(ANALYSIS_OUTPUT, project, "triage_results");
  fsSync.mkdirSync(dir, { recursive: true });
  fsSync.writeFileSync(path.join(dir, `${run_id}.json`), JSON.stringify(raw));
}

function build_output(
  confirmed: { name: string; file: string; line: number; kind?: "function" | "method" | "constructor"; source?: ConfirmedUnreachableSource }[],
): TriageResultsFile {
  return {
    schema_version: 5,
    project_path: "/some/path",
    commit_hash: null,
    novel_issues: [],
    classifier_regressions: [],
    confirmed_unreachable: confirmed.map((c, idx) => ({
      entry_index: idx,
      name: c.name,
      file_path: c.file,
      start_line: c.line,
      kind: c.kind ?? "function",
      source: c.source ?? { kind: "llm-tp" as const },
      member_evidence: null,
    })),
    uncertain: [],
    last_updated: "2026-04-28T13:42:07.812Z",
  };
}

const NO_OPTS = { no_reuse: false, pinned_source_run_id: null };

describe("derive_tp_cache", () => {
  it("returns null when no_reuse is true", async () => {
    seed_triage_results("p", "deadbee-2026-04-26T00-00-00.000Z", build_output([
      { name: "f", file: "src/f.ts", line: 1 },
    ]));
    const cache = await derive_tp_cache("p", "deadbee", { no_reuse: true, pinned_source_run_id: null });
    expect(cache).toBeNull();
  });

  it("returns null when current_short_commit is null (no-git project)", async () => {
    seed_triage_results("p", "deadbee-2026-04-26T00-00-00.000Z", build_output([
      { name: "f", file: "src/f.ts", line: 1 },
    ]));
    expect(await derive_tp_cache("p", null, NO_OPTS)).toBeNull();
  });

  it("returns null when no source at the current commit", async () => {
    seed_triage_results("p", "feedf00-2026-04-26T00-00-00.000Z", build_output([
      { name: "f", file: "src/f.ts", line: 1 },
    ]));
    expect(await derive_tp_cache("p", "deadbee", NO_OPTS)).toBeNull();
  });

  it("accumulates llm-tp entries from all runs; source_run_id is the newest contributor", async () => {
    seed_triage_results("p", "deadbee-2026-04-26T00-00-00.000Z", build_output([
      { name: "old_func", file: "src/o.ts", line: 1 },
    ]));
    seed_triage_results("p", "deadbee-2026-04-28T00-00-00.000Z", build_output([
      { name: "new_func", file: "src/n.ts", line: 1 },
    ]));
    const cache = await derive_tp_cache("p", "deadbee", NO_OPTS);
    expect(cache).not.toBeNull();
    expect(cache!.source_run_id).toBe("deadbee-2026-04-28T00-00-00.000Z");
    expect(cache!.entries_by_key.size).toBe(2);
    const k_new = cache_key_string({ name: "new_func", file_path_rel: "src/n.ts", kind: "function", start_line: 1 });
    const k_old = cache_key_string({ name: "old_func", file_path_rel: "src/o.ts", kind: "function", start_line: 1 });
    expect(cache!.entries_by_key.has(k_new)).toBe(true);
    expect(cache!.entries_by_key.has(k_old)).toBe(true);
  });

  it("skips a legacy-schema file with a warning and returns null when no valid runs remain", async () => {
    const legacy_record = {
      schema_version: 3,
      commit_hash: null,
      confirmed_unreachable: [
        { name: "legacy", file_path: "src/l.ts", start_line: 1, kind: "function" },
      ],
      false_positive_groups: {},
      last_updated: "2026-04-28T13:42:07.812Z",
    };
    seed_raw_triage_results("p", "deadbee-2026-04-26T00-00-00.000Z", legacy_record);
    const warn_spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cache = await derive_tp_cache("p", "deadbee", NO_OPTS);
    expect(cache).toBeNull();
    expect(warn_spy).toHaveBeenCalledWith(expect.stringContaining("deadbee-2026-04-26T00-00-00.000Z"));
    warn_spy.mockRestore();
  });

  it("throws when pinned source run-id has the wrong commit prefix", async () => {
    seed_triage_results("p", "feedf00-2026-04-26T00-00-00.000Z", build_output([
      { name: "f", file: "src/f.ts", line: 1 },
    ]));
    await expect(
      derive_tp_cache("p", "deadbee", {
        no_reuse: false,
        pinned_source_run_id: "feedf00-2026-04-26T00-00-00.000Z",
      }),
    ).rejects.toThrow(/not at the current commit/);
  });

  it("throws when pinned source run-id is missing", async () => {
    await expect(
      derive_tp_cache("p", "deadbee", {
        no_reuse: false,
        pinned_source_run_id: "deadbee-2099-01-01T00-00-00.000Z",
      }),
    ).rejects.toThrow(/no triage_results file/);
  });

  it("loads the pinned source when commit matches", async () => {
    seed_triage_results("p", "deadbee-2026-04-26T00-00-00.000Z", build_output([
      { name: "older", file: "src/o.ts", line: 1 },
    ]));
    seed_triage_results("p", "deadbee-2026-04-28T00-00-00.000Z", build_output([
      { name: "newer", file: "src/n.ts", line: 1 },
    ]));
    const cache = await derive_tp_cache("p", "deadbee", {
      no_reuse: false,
      pinned_source_run_id: "deadbee-2026-04-26T00-00-00.000Z",
    });
    expect(cache!.source_run_id).toBe("deadbee-2026-04-26T00-00-00.000Z");
    expect(cache!.entries_by_key.size).toBe(1);
  });
});

describe("derive_tp_cache — source-kind eligibility", () => {
  it("excludes registry rows from the cache", async () => {
    seed_triage_results(
      "p",
      "deadbee-2026-04-26T00-00-00.000Z",
      build_output([
        { name: "f", file: "src/f.ts", line: 1, source: { kind: "registry", group_id: "g1" } },
      ]),
    );
    // null cache → apply_tp_cache_to_entries is never called → entries keep route="llm-triage"
    const cache = await derive_tp_cache("p", "deadbee", NO_OPTS);
    expect(cache).toBeNull();
  });

  it("excludes previously-confirmed-tp rows from the cache", async () => {
    seed_triage_results(
      "p",
      "deadbee-2026-04-26T00-00-00.000Z",
      build_output([
        { name: "f", file: "src/f.ts", line: 1, source: { kind: "previously-confirmed-tp" } },
      ]),
    );
    const cache = await derive_tp_cache("p", "deadbee", NO_OPTS);
    expect(cache).toBeNull();
  });

  it("includes llm-tp rows in the cache", async () => {
    seed_triage_results(
      "p",
      "deadbee-2026-04-26T00-00-00.000Z",
      build_output([
        { name: "f", file: "src/f.ts", line: 1, source: { kind: "llm-tp" } },
      ]),
    );
    const cache = await derive_tp_cache("p", "deadbee", NO_OPTS);
    expect(cache).not.toBeNull();
    const k = cache_key_string({ name: "f", file_path_rel: "src/f.ts", kind: "function", start_line: 1 });
    expect(cache!.entries_by_key.get(k)).toEqual({
      entry_index: 0,
      name: "f",
      file_path: "src/f.ts",
      start_line: 1,
      kind: "function",
      source: { kind: "llm-tp" },
      member_evidence: null,
    });
  });

  it("indexes only llm-tp rows when source file mixes all three kinds", async () => {
    seed_triage_results(
      "p",
      "deadbee-2026-04-26T00-00-00.000Z",
      build_output([
        { name: "tp_fn",   file: "src/a.ts", line: 1, source: { kind: "llm-tp" } },
        { name: "reg_fn",  file: "src/b.ts", line: 2, source: { kind: "registry", group_id: "g2" } },
        { name: "prev_fn", file: "src/c.ts", line: 3, source: { kind: "previously-confirmed-tp" } },
      ]),
    );
    const cache = await derive_tp_cache("p", "deadbee", NO_OPTS);
    expect(cache).not.toBeNull();
    expect(cache!.entries_by_key.size).toBe(1);
    const k = cache_key_string({ name: "tp_fn", file_path_rel: "src/a.ts", kind: "function", start_line: 1 });
    expect(cache!.entries_by_key.get(k)).toEqual({
      entry_index: 0,
      name: "tp_fn",
      file_path: "src/a.ts",
      start_line: 1,
      kind: "function",
      source: { kind: "llm-tp" },
      member_evidence: null,
    });
  });
});

describe("derive_tp_cache — fallback through older runs", () => {
  it("falls back to an older run when the most recent run has only previously-confirmed-tp rows", async () => {
    // Run 1: original LLM investigation
    seed_triage_results("p", "deadbee-2026-04-26T00-00-00.000Z", build_output([
      { name: "f", file: "src/f.ts", line: 1, source: { kind: "llm-tp" } },
    ]));
    // Run 2: cache hit on run 1 — reuses and publishes as previously-confirmed-tp
    seed_triage_results("p", "deadbee-2026-04-28T00-00-00.000Z", build_output([
      { name: "f", file: "src/f.ts", line: 1, source: { kind: "previously-confirmed-tp" } },
    ]));

    const cache = await derive_tp_cache("p", "deadbee", NO_OPTS);
    expect(cache).not.toBeNull();
    expect(cache!.source_run_id).toBe("deadbee-2026-04-26T00-00-00.000Z");
    const k = cache_key_string({ name: "f", file_path_rel: "src/f.ts", kind: "function", start_line: 1 });
    expect(cache!.entries_by_key.has(k)).toBe(true);
  });

  it("breaks the alternating cadence: run3 reuses run1's llm-tp rows without re-investigation", async () => {
    // Run 1: LLM investigated → llm-tp
    seed_triage_results("p", "deadbee-2026-04-26T00-00-00.000Z", build_output([
      { name: "f", file: "src/f.ts", line: 1, source: { kind: "llm-tp" } },
    ]));
    // Run 2: reused run 1 → previously-confirmed-tp
    seed_triage_results("p", "deadbee-2026-04-27T00-00-00.000Z", build_output([
      { name: "f", file: "src/f.ts", line: 1, source: { kind: "previously-confirmed-tp" } },
    ]));
    // Run 3 starting: should find run 1's llm-tp rows, not return null
    const cache = await derive_tp_cache("p", "deadbee", NO_OPTS);
    expect(cache).not.toBeNull();
    expect(cache!.source_run_id).toBe("deadbee-2026-04-26T00-00-00.000Z");
  });

  it("returns null when all runs at the commit have no eligible rows", async () => {
    seed_triage_results("p", "deadbee-2026-04-26T00-00-00.000Z", build_output([
      { name: "f", file: "src/f.ts", line: 1, source: { kind: "previously-confirmed-tp" } },
    ]));
    seed_triage_results("p", "deadbee-2026-04-28T00-00-00.000Z", build_output([
      { name: "f", file: "src/f.ts", line: 1, source: { kind: "previously-confirmed-tp" } },
    ]));
    expect(await derive_tp_cache("p", "deadbee", NO_OPTS)).toBeNull();
  });

  it("accumulates across runs: newest run has mixed kinds, older run fills in the rest", async () => {
    // Run 1: LLM investigates fn A
    seed_triage_results("p", "deadbee-2026-04-26T00-00-00.000Z", build_output([
      { name: "a", file: "src/a.ts", line: 1, source: { kind: "llm-tp" } },
    ]));
    // Run 2: LLM investigates new fn B; reuses fn A from cache (previously-confirmed-tp)
    seed_triage_results("p", "deadbee-2026-04-28T00-00-00.000Z", build_output([
      { name: "b", file: "src/b.ts", line: 1, source: { kind: "llm-tp" } },
      { name: "a", file: "src/a.ts", line: 1, source: { kind: "previously-confirmed-tp" } },
    ]));
    // Run 3 starting: both fn A and fn B must be in the cache
    const cache = await derive_tp_cache("p", "deadbee", NO_OPTS);
    expect(cache).not.toBeNull();
    const k_a = cache_key_string({ name: "a", file_path_rel: "src/a.ts", kind: "function", start_line: 1 });
    const k_b = cache_key_string({ name: "b", file_path_rel: "src/b.ts", kind: "function", start_line: 1 });
    expect(cache!.entries_by_key.has(k_a)).toBe(true);
    expect(cache!.entries_by_key.has(k_b)).toBe(true);
    expect(cache!.entries_by_key.size).toBe(2);
  });

  it("newer run wins on key collision when the same function appears as llm-tp in multiple runs", async () => {
    seed_triage_results("p", "deadbee-2026-04-26T00-00-00.000Z", build_output([
      { name: "f", file: "src/f.ts", line: 1, source: { kind: "llm-tp" } },
    ]));
    seed_triage_results("p", "deadbee-2026-04-28T00-00-00.000Z", build_output([
      { name: "f", file: "src/f.ts", line: 1, source: { kind: "llm-tp" } },
    ]));
    const cache = await derive_tp_cache("p", "deadbee", NO_OPTS);
    expect(cache).not.toBeNull();
    expect(cache!.entries_by_key.size).toBe(1);
    expect(cache!.source_run_id).toBe("deadbee-2026-04-28T00-00-00.000Z");
  });

  it("skips a corrupt run and collects llm-tp entries from older valid runs", async () => {
    seed_raw_triage_results("p", "deadbee-2026-04-28T00-00-00.000Z", {
      schema_version: 3,
      commit_hash: null,
      confirmed_unreachable: [],
      false_positive_groups: {},
      last_updated: "2026-04-28T13:42:07.812Z",
    });
    seed_triage_results("p", "deadbee-2026-04-26T00-00-00.000Z", build_output([
      { name: "f", file: "src/f.ts", line: 1, source: { kind: "llm-tp" } },
    ]));
    const warn_spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cache = await derive_tp_cache("p", "deadbee", NO_OPTS);
    expect(cache).not.toBeNull();
    const k = cache_key_string({ name: "f", file_path_rel: "src/f.ts", kind: "function", start_line: 1 });
    expect(cache!.entries_by_key.has(k)).toBe(true);
    expect(warn_spy).toHaveBeenCalledWith(expect.stringContaining("deadbee-2026-04-28T00-00-00.000Z"));
    warn_spy.mockRestore();
  });
});

const PROJECT_PATH = "/projects/myapp";

function entry(over: Partial<TriageEntry> = {}): TriageEntry {
  return {
    entry_index: 0,
    name: "f",
    file_path: `${PROJECT_PATH}/src/f.ts`,
    start_line: 1,
    kind: "function",
    signature: null,
    route: "llm-triage",
    diagnosis: "no-textual-callers",
    known_source: null,
    status: "pending",
    result: null,
    error: null,
    is_exported: true,
    access_modifier: null,
    diagnostics: { grep_call_sites: [], grep_call_sites_unindexed_tests: [], ariadne_call_refs: [], diagnosis: "no-textual-callers", has_uncaptured_indexed_grep_hit: false, callers_only_in_unindexed_tests: false },
    auto_classified: false,
    classifier_hints: [],
    tp_source_run_id: null,
    tp_stability_sample: false,
    retry_count: 0,
    ...over,
  };
}

describe("apply_tp_cache_to_entries", () => {
  function build_cache_from_published(
    run_id: string,
    items: { name: string; file_path: string; start_line: number; kind: "function" | "method" | "constructor" }[],
  ) {
    return {
      source_run_id: run_id,
      entries_by_key: new Map(
        items.map((i, idx) => [
          cache_key_string({ name: i.name, file_path_rel: i.file_path, kind: i.kind, start_line: i.start_line }),
          { entry_index: idx, source: { kind: "llm-tp" } as const, member_evidence: null, ...i },
        ]),
      ),
    };
  }

  /** `n` distinct matching entries + a cache that covers all of them. */
  function matching_run(n: number): { entries: TriageEntry[]; cache: ReturnType<typeof build_cache_from_published> } {
    const items = Array.from({ length: n }, (_, i) => ({
      name: `f${i}`,
      file_path: `src/f${i}.ts`,
      start_line: 1,
      kind: "function" as const,
    }));
    const cache = build_cache_from_published("source-run-id", items);
    const entries = items.map((it, i) =>
      entry({ entry_index: i, name: it.name, file_path: `${PROJECT_PATH}/${it.file_path}` }),
    );
    return { entries, cache };
  }

  it("flips non-sampled matching llm-triage entries to known-unreachable + previously-confirmed-tp", () => {
    // 7 hits: TP_STABILITY_SAMPLE_TARGET (5) are left as stability samples, 2 flip.
    const { entries, cache } = matching_run(7);
    const skipped = apply_tp_cache_to_entries(entries, cache, PROJECT_PATH);

    const sampled = entries.filter((e) => e.tp_stability_sample);
    const flipped = entries.filter((e) => e.route === "known-unreachable");
    expect(sampled).toHaveLength(TP_STABILITY_SAMPLE_TARGET);
    expect(flipped).toHaveLength(2);
    expect(skipped).toHaveLength(2);

    // Sampled entries stay on the llm-triage route, untouched otherwise, so the
    // picker investigates them and the completion gate does not see them as done.
    for (const e of sampled) {
      expect(e.route).toBe("llm-triage");
      expect(e.auto_classified).toBe(false);
      expect(e.status).toBe("pending");
      expect(e.known_source).toBe(null);
    }
    // Flipped entries carry the full TP-cache stamping.
    for (const e of flipped) {
      expect(e.tp_stability_sample).toBe(false);
      expect(e.auto_classified).toBe(true);
      expect(e.status).toBe("completed");
      expect(e.known_source).toBe("previously-confirmed-tp");
      expect(e.tp_source_run_id).toBe("source-run-id");
      // TP-cache reuse does not synthesize a TriageEntryResult; the
      // confirmed_unreachable record is built from (route, known_source,
      // tp_source_run_id) at finalize time, not from entry.result.
      expect(e.result).toBe(null);
    }
    expect(skipped.map((k) => k.name).sort()).toEqual(flipped.map((e) => e.name).sort());
  });

  it("leaves up to TP_STABILITY_SAMPLE_TARGET hits as stability samples, evenly spread", () => {
    const { entries, cache } = matching_run(12);
    apply_tp_cache_to_entries(entries, cache, PROJECT_PATH);
    const sampled_idx = entries.filter((e) => e.tp_stability_sample).map((e) => e.entry_index);
    expect(sampled_idx).toEqual([...select_stability_sample_indices(12, TP_STABILITY_SAMPLE_TARGET)].sort((a, b) => a - b));
    expect(sampled_idx).toHaveLength(TP_STABILITY_SAMPLE_TARGET);
    expect(entries.filter((e) => e.route === "known-unreachable")).toHaveLength(7);
  });

  it("samples every hit and flips none when there are fewer hits than the target", () => {
    const { entries, cache } = matching_run(3);
    const skipped = apply_tp_cache_to_entries(entries, cache, PROJECT_PATH);
    expect(entries.every((e) => e.tp_stability_sample)).toBe(true);
    expect(skipped).toHaveLength(0);
  });

  it("does not override registry-classified entries (route=known-unreachable)", () => {
    const cache = build_cache_from_published("r", [
      { name: "f", file_path: "src/f.ts", start_line: 1, kind: "function" },
    ]);
    const e = entry({ route: "known-unreachable", known_source: "registry:some-group" });
    const skipped = apply_tp_cache_to_entries([e], cache, PROJECT_PATH);
    expect(skipped).toHaveLength(0);
    expect(e.known_source).toBe("registry:some-group");
  });

  it("misses on different start_line (overload disambiguation)", () => {
    const cache = build_cache_from_published("r", [
      { name: "f", file_path: "src/f.ts", start_line: 1, kind: "function" },
    ]);
    const e = entry({ start_line: 99 });
    const skipped = apply_tp_cache_to_entries([e], cache, PROJECT_PATH);
    expect(skipped).toHaveLength(0);
    expect(e.route).toBe("llm-triage");
  });

  it("misses on different kind (function vs method)", () => {
    const cache = build_cache_from_published("r", [
      { name: "f", file_path: "src/f.ts", start_line: 1, kind: "function" },
    ]);
    const e = entry({ kind: "method" });
    const skipped = apply_tp_cache_to_entries([e], cache, PROJECT_PATH);
    expect(skipped).toHaveLength(0);
  });

  it("misses on different file_path", () => {
    const cache = build_cache_from_published("r", [
      { name: "f", file_path: "src/f.ts", start_line: 1, kind: "function" },
    ]);
    const e = entry({ file_path: `${PROJECT_PATH}/other/f.ts` });
    const skipped = apply_tp_cache_to_entries([e], cache, PROJECT_PATH);
    expect(skipped).toHaveLength(0);
  });

  it("relativizes absolute file paths against project_path before matching", () => {
    const cache = build_cache_from_published("r", [
      { name: "f", file_path: "src/f.ts", start_line: 1, kind: "function" },
    ]);
    const e = entry({ file_path: `${PROJECT_PATH}/src/f.ts` });
    apply_tp_cache_to_entries([e], cache, PROJECT_PATH);
    // The absolute path relativized to "src/f.ts" and matched the cache; as the
    // sole hit it is taken as the stability sample, proving the match landed.
    expect(e.tp_stability_sample).toBe(true);
  });

  it("cache_key_string uses NUL separator so paths with spaces don't collide", () => {
    // Distinct entries that would have collided under a space separator.
    const k1 = cache_key_string({ name: "foo bar", file_path_rel: "src/x.ts", kind: "function", start_line: 1 });
    const k2 = cache_key_string({ name: "foo", file_path_rel: "bar src/x.ts", kind: "function", start_line: 1 });
    expect(k1).not.toBe(k2);
  });

  it("returns empty when called against an empty entry list", () => {
    const cache = build_cache_from_published("r", [
      { name: "f", file_path: "src/f.ts", start_line: 1, kind: "function" },
    ]);
    expect(apply_tp_cache_to_entries([], cache, PROJECT_PATH)).toEqual([]);
  });
});

describe("select_stability_sample_indices", () => {
  it("returns all indices when n <= target", () => {
    expect([...select_stability_sample_indices(3, 5)].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect([...select_stability_sample_indices(0, 5)]).toEqual([]);
  });

  it("spreads target indices evenly across [0, n) when n > target", () => {
    expect([...select_stability_sample_indices(10, 5)].sort((a, b) => a - b)).toEqual([0, 2, 4, 6, 8]);
    expect(select_stability_sample_indices(100, 5).size).toBe(5);
  });

  it("is deterministic — same (n, target) yields the same set", () => {
    expect(select_stability_sample_indices(37, 5)).toEqual(select_stability_sample_indices(37, 5));
  });
});

describe("compute_tp_stability", () => {
  function state_with(entries: TriageEntry[]): TriageState {
    return {
      project_name: "p",
      project_path: "/p",
      phase: "complete",
      entries,
      created_at: "2026-04-16T00:00:00.000Z",
      updated_at: "2026-04-16T00:00:00.000Z",
    };
  }

  const evidence = { file: "src/f.ts", line: 1, why: "no callers" };
  const tp_verdict: TriageVerdict = { kind: "tp", member_evidence: evidence };
  const uncertain_verdict: TriageVerdict = { kind: "uncertain", reason: "unsure", member_evidence: evidence };

  it("counts sampled entries whose fresh verdict agreed with the cached tp", () => {
    const s1 = entry({ entry_index: 0, tp_stability_sample: true });
    const s2 = entry({ entry_index: 1, tp_stability_sample: true });
    const s3 = entry({ entry_index: 2, tp_stability_sample: true });
    const not_sampled = entry({ entry_index: 3, tp_stability_sample: false });
    const verdicts = new Map<number, TriageVerdict>([
      [0, tp_verdict],
      [1, tp_verdict],
      [2, uncertain_verdict],
      [3, tp_verdict],
    ]);
    expect(compute_tp_stability(state_with([s1, s2, s3, not_sampled]), verdicts)).toEqual({
      sampled: 3,
      agreed: 2,
      rate: 2 / 3,
    });
  });

  it("excludes a sample with no verdict — driven by verdict absence, not entry.status", () => {
    // Both s2 and s3 lack a verdict and must be excluded; their differing status
    // (failed vs completed) proves the exclusion signal is verdict absence, not
    // status. Only s1 (which has a verdict) is counted.
    const s1 = entry({ entry_index: 0, tp_stability_sample: true });
    const s2 = entry({ entry_index: 1, tp_stability_sample: true, status: "failed" });
    const s3 = entry({ entry_index: 2, tp_stability_sample: true, status: "completed" });
    const verdicts = new Map<number, TriageVerdict>([[0, tp_verdict]]);
    expect(compute_tp_stability(state_with([s1, s2, s3]), verdicts)).toEqual({
      sampled: 1,
      agreed: 1,
      rate: 1,
    });
  });

  it("returns a null rate when nothing was sampled", () => {
    const only = entry({ entry_index: 0, tp_stability_sample: false });
    expect(compute_tp_stability(state_with([only]), new Map())).toEqual({
      sampled: 0,
      agreed: 0,
      rate: null,
    });
  });
});

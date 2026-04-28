import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fsSync from "fs";
import path from "path";

import type { FinalizationOutput } from "./build_finalization_output.js";
import type { TriageEntry } from "./triage_state_types.js";
import {
  apply_tp_cache_to_entries,
  derive_tp_cache,
  cache_key_string,
} from "./confirmed_unreachable_reuse.js";

// vi.hoisted runs before all `import` statements, so the env var is set
// before `paths.js` (transitively imported by `confirmed_unreachable_reuse.js`) reads it.
const TMP = vi.hoisted(() => {
  const tmp_path = `${process.env.TMPDIR ?? "/tmp"}/ariadne-test-tp-cache-${process.pid}`;
  process.env.ARIADNE_SELF_REPAIR_DIR_OVERRIDE = tmp_path;
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

function seed_triage_results(project: string, run_id: string, output: FinalizationOutput): void {
  const dir = path.join(ANALYSIS_OUTPUT, project, "triage_results");
  fsSync.mkdirSync(dir, { recursive: true });
  fsSync.writeFileSync(path.join(dir, `${run_id}.json`), JSON.stringify(output));
}

/**
 * Write a raw on-disk record without forcing it to satisfy `FinalizationOutput`.
 * Used to simulate legacy v1 records that lack the `kind` field on entries.
 */
function seed_raw_triage_results(project: string, run_id: string, raw: unknown): void {
  const dir = path.join(ANALYSIS_OUTPUT, project, "triage_results");
  fsSync.mkdirSync(dir, { recursive: true });
  fsSync.writeFileSync(path.join(dir, `${run_id}.json`), JSON.stringify(raw));
}

function build_output(
  confirmed: { name: string; file: string; line: number; kind?: "function" | "method" | "constructor" }[],
): FinalizationOutput {
  return {
    schema_version: 2,
    project_path: "/some/path",
    commit_hash: null,
    confirmed_unreachable: confirmed.map((c) => ({
      name: c.name,
      file_path: c.file,
      start_line: c.line,
      kind: c.kind ?? "function",
    })),
    false_positive_groups: {},
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

  it("picks the lex-max source at the current commit", async () => {
    seed_triage_results("p", "deadbee-2026-04-26T00-00-00.000Z", build_output([
      { name: "old_func", file: "src/o.ts", line: 1 },
    ]));
    seed_triage_results("p", "deadbee-2026-04-28T00-00-00.000Z", build_output([
      { name: "new_func", file: "src/n.ts", line: 1 },
    ]));
    const cache = await derive_tp_cache("p", "deadbee", NO_OPTS);
    expect(cache).not.toBeNull();
    expect(cache!.source_run_id).toBe("deadbee-2026-04-28T00-00-00.000Z");
    expect(cache!.entries_by_key.size).toBe(1);
    const k = cache_key_string({ name: "new_func", file_path_rel: "src/n.ts", kind: "function", start_line: 1 });
    expect(cache!.entries_by_key.has(k)).toBe(true);
  });

  it("returns null and warns when pre-v2 source has zero usable entries", async () => {
    // Simulates a legacy on-disk v1 record where confirmed_unreachable entries
    // do not carry `kind`. Written as raw JSON so we don't have to fight the
    // FinalizationOutput type to express an invalid record.
    const legacy_record = {
      schema_version: 1,
      commit_hash: null,
      confirmed_unreachable: [
        { name: "legacy", file_path: "src/l.ts", start_line: 1 },
      ],
      false_positive_groups: {},
      last_updated: "2026-04-28T13:42:07.812Z",
    };
    seed_raw_triage_results("p", "deadbee-2026-04-26T00-00-00.000Z", legacy_record);

    const stderr_chunks: string[] = [];
    const stderr_spy = vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
      stderr_chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    });
    try {
      const cache = await derive_tp_cache("p", "deadbee", NO_OPTS);
      expect(cache).toBeNull();
      expect(stderr_chunks.join("")).toMatch(/pre-schema-v2/);
    } finally {
      stderr_spy.mockRestore();
    }
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

describe("apply_tp_cache_to_entries", () => {
  const PROJECT_PATH = "/projects/myapp";

  function build_cache_from_published(
    run_id: string,
    items: { name: string; file_path: string; start_line: number; kind: "function" | "method" | "constructor" }[],
  ) {
    return {
      source_run_id: run_id,
      entries_by_key: new Map(
        items.map((i) => [
          cache_key_string({ name: i.name, file_path_rel: i.file_path, kind: i.kind, start_line: i.start_line }),
          { ...i },
        ]),
      ),
    };
  }

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
      diagnostics: { grep_call_sites: [], grep_call_sites_unindexed_tests: [], ariadne_call_refs: [], diagnosis: "no-textual-callers" },
      auto_classified: false,
      classifier_hints: [],
      tp_source_run_id: null,
      ...over,
    };
  }

  it("flips matching llm-triage entries to known-unreachable + previously-confirmed-tp", () => {
    const cache = build_cache_from_published("source-run-id", [
      { name: "f", file_path: "src/f.ts", start_line: 1, kind: "function" },
    ]);
    const e = entry();
    const skipped = apply_tp_cache_to_entries([e], cache, PROJECT_PATH);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toEqual({
      name: "f",
      file_path: "src/f.ts",
      kind: "function",
      start_line: 1,
    });
    expect(e.route).toBe("known-unreachable");
    expect(e.auto_classified).toBe(true);
    expect(e.status).toBe("completed");
    expect(e.known_source).toBe("previously-confirmed-tp");
    expect(e.tp_source_run_id).toBe("source-run-id");
    expect(e.result?.ariadne_correct).toBe(true);
    expect(e.result?.group_id).toBe("previously-confirmed-tp");
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
    const skipped = apply_tp_cache_to_entries([e], cache, PROJECT_PATH);
    expect(skipped).toHaveLength(1);
    expect(e.route).toBe("known-unreachable");
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

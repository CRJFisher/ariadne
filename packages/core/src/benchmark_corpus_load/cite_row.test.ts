/**
 * The line a number is quoted with.
 *
 * The obligation is that six things travel with every figure. These pin that
 * the line renders all six, that a slice says it is a slice, and that the
 * citation is derived from the row rather than restated beside it.
 */

import { describe, expect, it } from "vitest";
import { cite_row, format_citation, type RowCitation } from "./cite_row";
import { capture_run_environment } from "./measurement_row";

const CITATION: RowCitation = {
  corpus_name: "microsoft/vscode",
  corpus_commit: "f3fa55c3",
  predicate: "src",
  offered_file_count: 8494,
  discovered_file_count: 8494,
  ariadne_commit: "12458246",
  machine: "Darwin 21.6.0 x64",
  node_version: "v22.23.2",
};

describe("format_citation", () => {
  it("names all six things a quoted number must carry", () => {
    expect(format_citation(CITATION)).toEqual(
      "microsoft/vscode@f3fa55c3 · src · 8494 files · ariadne@12458246 · Darwin 21.6.0 x64 · node v22.23.2",
    );
  });

  it("says a sliced arm is a slice, so a prefix is never read as the corpus", () => {
    expect(
      format_citation({
        ...CITATION,
        predicate: "folder-ts:src/vs/base",
        offered_file_count: 200,
        discovered_file_count: 479,
      }),
    ).toEqual(
      "microsoft/vscode@f3fa55c3 · folder-ts:src/vs/base · 200 of 479 files · ariadne@12458246 · Darwin 21.6.0 x64 · node v22.23.2",
    );
  });
});

describe("cite_row", () => {
  it("derives the citation from the row rather than from a second source", () => {
    const environment = capture_run_environment({
      session_id: "s",
      ariadne_repo_path: __dirname,
    });
    const cited = cite_row({
      arm: "a",
      sequence_index: 0,
      corpus: {
        corpus_name: "microsoft/vscode",
        corpus_root: "/corpora/vscode",
        corpus_commit: "f3fa55c3",
        predicate: "src",
      },
      file_counts: { discovered: 8494, offered: 200, indexed: 191, dropped: 9 },
      ingest_order: "forward",
      seed: 1,
      include_tests: false,
      cpu_user_ms: 1,
      cpu_system_ms: 1,
      wall_ms: 1,
      cpu_per_wall: 1,
      load_cpu_ms: 1,
      trace_cpu_ms: 1,
      loadavg_at_start: [0, 0, 0],
      loadavg_at_end: [0, 0, 0],
      peak_rss_mb: 1,
      rss_at_end_mb: 1,
      settled_heap_mb: 1,
      fingerprint: { schema_version: 3, components: {} as never },
      diagnostics: {
        schema_version: 1,
        entry_point_count: 1,
        diag_hash: "1".repeat(16),
        canonical_hash: "2".repeat(16),
      },
      index_dispatch: {
        worker_width: 1,
        boot_ms: 0,
        worker_pass_ms: 0,
        main_deserialize_ms: 0,
        redispatched_inputs: 0,
        worker_restarts: 0,
      },
      environment,
    });

    expect({
      corpus_name: cited.corpus_name,
      corpus_commit: cited.corpus_commit,
      predicate: cited.predicate,
      offered_file_count: cited.offered_file_count,
      discovered_file_count: cited.discovered_file_count,
      machine: cited.machine,
      node_version: cited.node_version,
    }).toEqual({
      corpus_name: "microsoft/vscode",
      corpus_commit: "f3fa55c3",
      predicate: "src",
      offered_file_count: 200,
      discovered_file_count: 8494,
      machine: environment.machine,
      node_version: process.version,
    });
  });

  it("renders a sliced row as a slice straight off the row", () => {
    const environment = capture_run_environment({
      session_id: "s",
      ariadne_repo_path: __dirname,
    });
    const cited = cite_row({
      arm: "a",
      sequence_index: 0,
      corpus: {
        corpus_name: "microsoft/vscode",
        corpus_root: "/corpora/vscode",
        corpus_commit: "f3fa55c3",
        predicate: "folder-ts:src/vs/base",
      },
      file_counts: { discovered: 479, offered: 200, indexed: 191, dropped: 9 },
      ingest_order: "forward",
      seed: 1,
      include_tests: false,
      cpu_user_ms: 1,
      cpu_system_ms: 1,
      wall_ms: 1,
      cpu_per_wall: 1,
      load_cpu_ms: 1,
      trace_cpu_ms: 1,
      loadavg_at_start: [0, 0, 0],
      loadavg_at_end: [0, 0, 0],
      peak_rss_mb: 1,
      rss_at_end_mb: 1,
      settled_heap_mb: 1,
      fingerprint: { schema_version: 3, components: {} as never },
      diagnostics: {
        schema_version: 1,
        entry_point_count: 1,
        diag_hash: "1".repeat(16),
        canonical_hash: "2".repeat(16),
      },
      index_dispatch: {
        worker_width: 1,
        boot_ms: 0,
        worker_pass_ms: 0,
        main_deserialize_ms: 0,
        redispatched_inputs: 0,
        worker_restarts: 0,
      },
      environment,
    });
    expect(format_citation(cited)).toContain("200 of 479 files");
  });
});

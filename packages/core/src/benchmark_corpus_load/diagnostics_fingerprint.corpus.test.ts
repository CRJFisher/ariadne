/**
 * The diagnostics-payload guard, run against a real load on every test run.
 *
 * Three arms ingest `packages/core/benchmark_corpus` forward, reversed and
 * seeded-shuffled, and must produce ONE diag hash and ONE canonical hash —
 * the diagnostics half of the multi-order verdict. The call-graph half is
 * deliberately not asserted here: on this corpus the ingest order still moves
 * `indirect_reachability_evidence` through resolution itself, which is
 * TASK-381.11's defect, and folding it into this guard would make the
 * diagnostics repair unlandable until resolution is fixed.
 *
 * The committed hashes are anchored to a payload the test reads back: the
 * summary assertion names the six entry points the corpus produces, and the
 * derivation assertion recomputes the committed hex from that same payload,
 * so a regression cannot be blessed by pasting sixteen hex digits.
 *
 * This corpus cannot exercise the capped-evidence channels — its six entry
 * points carry empty evidence lists, which the summary assertion pins so the
 * limitation stays visible. The order-dependence those channels had is
 * guarded where it can bite, by the ingest-order test in
 * `extract_entry_point_diagnostics.test.ts`, whose sixty same-named call
 * sites overrun the fifty-site cap.
 */

import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { extract_entry_point_diagnostics } from "../classify_entry_points/extract_entry_point_diagnostics";
import { load_project } from "../project/load_project";
import { trace_call_graph } from "../trace_call_graph/trace_call_graph";
import { run_benchmark_arm, diff_ingest_orders } from "./benchmark_corpus_load";
import { discover_corpus } from "./corpus_predicate";
import {
  DIAGNOSTICS_FINGERPRINT_SCHEMA_VERSION,
  fingerprint_diagnostics,
} from "./diagnostics_fingerprint";
import type { IngestOrder } from "./ingest_order";
import { create_session_id, find_ariadne_repo_root } from "./measurement_row";

const CORPUS_ROOT = path.join(
  find_ariadne_repo_root(),
  "packages",
  "core",
  "benchmark_corpus",
);

/**
 * The guard baseline, re-taken when export metadata became keyed on declaration
 * space and `duplicate_exports.js` rejoined the corpus. Its two `res`
 * declarations are two more uncalled exports, so the payload grows from four
 * entries to six and both digests move with it.
 */
const EXPECTED_DIAGNOSTICS = {
  schema_version: DIAGNOSTICS_FINGERPRINT_SCHEMA_VERSION,
  entry_point_count: 6,
  diag_hash: "dad1bdd809fb2716",
  canonical_hash: "263b466cf26d9e3e",
};

async function load_order_arm(order: IngestOrder, sequence_index: number, session_id: string) {
  return run_benchmark_arm({
    arm: `order-${order}`,
    sequence_index,
    corpus_name: "ariadne/benchmark_corpus",
    corpus_root: CORPUS_ROOT,
    corpus_commit: "in-repo",
    predicate: "src",
    slice_size: "full",
    ingest_order: order,
    seed: 1,
    include_tests: false,
    ariadne_repo_path: find_ariadne_repo_root(),
    session_id,
  });
}

describe("the in-repo diagnostics guard", () => {
  it("produces one payload whichever order the corpus is ingested in", async () => {
    const session_id = create_session_id();
    const forward = await load_order_arm("forward", 0, session_id);
    const reversed = await load_order_arm("reversed", 1, session_id);
    const shuffled = await load_order_arm("shuffled", 2, session_id);

    const verdict = diff_ingest_orders(forward, [reversed, shuffled]);
    expect(verdict.diagnostics_identical_across_orders).toEqual(true);
    expect(forward.row.diagnostics).toEqual(EXPECTED_DIAGNOSTICS);
    expect(reversed.row.diagnostics).toEqual(EXPECTED_DIAGNOSTICS);
    expect(shuffled.row.diagnostics).toEqual(EXPECTED_DIAGNOSTICS);
  }, 60_000);

  it("derives the committed hashes from a payload it reads back", async () => {
    // The same file set the arms load: the corpus root also holds `tools/`,
    // which the `src` predicate excludes.
    const files = await discover_corpus(CORPUS_ROOT, "src");
    const loaded = await load_project({ project_path: CORPUS_ROOT, files });
    const call_graph = trace_call_graph(
      loaded.project.definitions,
      loaded.project.resolutions,
      loaded.project.get_languages(),
      { include_tests: false },
    );
    const payload = extract_entry_point_diagnostics(call_graph, loaded.project);

    const summary = payload
      .map((entry) => ({
        file: entry.file_path.slice(CORPUS_ROOT.length + 1),
        name: entry.name,
        kind: entry.kind,
        diagnosis: entry.diagnostics.diagnosis,
        grep: entry.diagnostics.grep_call_sites.length,
        refs: entry.diagnostics.ariadne_call_refs.length,
        reference_sites: entry.diagnostics.reference_sites.length,
      }))
      .sort((a, b) =>
        a.file === b.file
          ? a.name < b.name
            ? -1
            : 1
          : a.file < b.file
            ? -1
            : 1,
      );

    expect(summary).toEqual([
      {
        file: "src/aaa_first_reader.ts",
        name: "read_first",
        kind: "function",
        diagnosis: "no-textual-callers",
        grep: 0,
        refs: 0,
        reference_sites: 0,
      },
      {
        file: "src/duplicate_exports.js",
        name: "res",
        kind: "function",
        diagnosis: "no-textual-callers",
        grep: 0,
        refs: 0,
        reference_sites: 0,
      },
      {
        file: "src/duplicate_exports.js",
        name: "res",
        kind: "function",
        diagnosis: "no-textual-callers",
        grep: 0,
        refs: 0,
        reference_sites: 0,
      },
      {
        file: "src/orphan.ts",
        name: "also_never_called",
        kind: "function",
        diagnosis: "no-textual-callers",
        grep: 0,
        refs: 0,
        reference_sites: 0,
      },
      {
        file: "src/orphan.ts",
        name: "never_called",
        kind: "function",
        diagnosis: "no-textual-callers",
        grep: 0,
        refs: 0,
        reference_sites: 0,
      },
      {
        file: "src/zzz_second_reader.ts",
        name: "read_second",
        kind: "function",
        diagnosis: "no-textual-callers",
        grep: 0,
        refs: 0,
        reference_sites: 0,
      },
    ]);

    expect(fingerprint_diagnostics(payload, CORPUS_ROOT)).toEqual(
      EXPECTED_DIAGNOSTICS,
    );
  }, 60_000);
});

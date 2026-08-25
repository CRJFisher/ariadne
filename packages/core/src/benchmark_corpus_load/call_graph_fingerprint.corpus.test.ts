/**
 * The fingerprint mechanism, guarded against a real load on every test run.
 *
 * The vscode corpus this epic measures is absent in CI and in most checkouts,
 * so the corpus-scale ROWS skip — but the mechanism never does. This guard runs
 * against `packages/core/benchmark_corpus`, a nine-file corpus committed beside
 * the harness and chosen so that all seven components are non-empty: a
 * dropped file, both indirect-reachability variants, unresolved calls,
 * uncalled exports, and a module-scope call that no node encloses.
 *
 * The corpus deliberately does NOT live under `tests/` or `fixtures/`.
 * `is_in_test_dir` matches those segments, `detect_entry_points` drops every
 * test node, and a corpus under such a path reports ZERO raw entry points —
 * measured: the same files scored 0 entry points inside `tests/fixtures/` and
 * 38 outside it. One of the seven numbers would then be a constant empty
 * digest on every run, which is the vacuous guard TASK-370 exists about.
 *
 * WHAT THE COMMITTED MEMBER LIST BUYS, AND WHAT IT DOES NOT. What is committed
 * here is the MEMBER LIST — symbol ids and file paths a reviewer can read — and
 * the hashes are asserted to be the digest OF that list. So a regression cannot
 * be blessed by pasting sixteen hex digits; it takes an edit to the list.
 *
 * How much protection that is depends on the defect. One that moves symbol
 * IDENTITY shows up as a name appearing or disappearing, which reads clearly in
 * review. One that moves only a LOCATION — a reachability witness sliding from
 * a use site to an import statement — shows up as changed line:column tuples
 * inside otherwise identical ids, which is easy to wave through. Regenerating
 * this list from a run is therefore a real way to launder such a defect, and
 * the list is a review artefact rather than a proof.
 *
 * To update after a deliberate change: re-derive the member list by reading the
 * corpus, not by pasting a run's output, then let the derivation test compute
 * the hashes.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { run_benchmark_arm } from "./benchmark_corpus_load";
import {
  FINGERPRINT_COMPONENT_NAMES,
  type FingerprintComponentName,
} from "./call_graph_fingerprint";
import { create_session_id } from "./measurement_row";
import { digest_members } from "./streaming_digest";

/**
 * Walk up to the directory holding `pnpm-workspace.yaml`. The same walk
 * `registry_permanent_data.sync.test.ts` uses — core cannot import
 * skill-protocol's `repo_root()`.
 */
function find_repo_root(): string {
  let dir = __dirname;
  while (!fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("could not locate repo root (no pnpm-workspace.yaml found)");
    }
    dir = parent;
  }
  return dir;
}

const CORPUS_ROOT = path.join(
  find_repo_root(),
  "packages",
  "core",
  "benchmark_corpus",
);

const EXPECTED_MEMBERS: Readonly<Record<FingerprintComponentName, readonly string[]>> = {
  nodes: [
    "function:src/aaa_first_reader.ts:5:17:5:26:read_first",
    "function:src/callback.ts:3:17:3:27:apply_twice",
    "function:src/callback.ts:7:17:7:19:run",
    "function:src/entry.ts:6:17:6:20:main",
    "function:src/handlers.ts:1:17:1:21:alpha",
    "function:src/handlers.ts:5:17:5:20:beta",
    "function:src/orphan.ts:1:17:1:28:never_called",
    "function:src/orphan.ts:5:17:5:33:also_never_called",
    "function:src/registry.ts:5:17:5:24:dispatch",
    "function:src/unresolved.ts:1:17:1:29:parse_payload",
    "function:src/unresolved.ts:5:17:5:22:report",
    "function:src/utils.ts:1:17:1:22:helper",
    "function:src/utils.ts:5:17:5:28:other_helper",
    "function:src/zzz_second_reader.ts:5:17:5:27:read_second",
  ],
  call_edges: [
    "function:src/callback.ts:3:17:3:27:apply_twice->parameter:src/callback.ts:3:29:3:30:fn#2",
    "function:src/callback.ts:7:17:7:19:run->function:src/callback.ts:3:17:3:27:apply_twice#1",
    "function:src/entry.ts:6:17:6:20:main->function:src/callback.ts:7:17:7:19:run#1",
    "function:src/entry.ts:6:17:6:20:main->function:src/registry.ts:5:17:5:24:dispatch#1",
    "function:src/entry.ts:6:17:6:20:main->function:src/unresolved.ts:1:17:1:29:parse_payload#1",
    "function:src/entry.ts:6:17:6:20:main->function:src/unresolved.ts:5:17:5:22:report#1",
    "function:src/entry.ts:6:17:6:20:main->function:src/utils.ts:1:17:1:22:helper#1",
    "function:src/registry.ts:5:17:5:24:dispatch->function:src/handlers.ts:1:17:1:21:alpha#1",
    "function:src/registry.ts:5:17:5:24:dispatch->function:src/handlers.ts:5:17:5:20:beta#1",
    "module:src/entry.ts->function:src/entry.ts:6:17:6:20:main#1",
    "module:src/entry.ts->function:src/unresolved.ts:5:17:5:22:report#1",
  ],
  unresolved_calls: [
    "function:src/unresolved.ts:1:17:1:29:parse_payload|method|parse@src/unresolved.ts:2:10:2:24",
    "function:src/unresolved.ts:5:17:5:22:report|method|log@src/unresolved.ts:6:3:6:22",
  ],
  raw_entry_points: [
    "function:src/aaa_first_reader.ts:5:17:5:26:read_first",
    "function:src/orphan.ts:1:17:1:28:never_called",
    "function:src/orphan.ts:5:17:5:33:also_never_called",
    "function:src/zzz_second_reader.ts:5:17:5:27:read_second",
  ],
  indirect_reachability_keys: [
    "function:src/callback.ts:3:17:3:27:apply_twice",
    "function:src/callback.ts:7:17:7:19:run",
    "function:src/entry.ts:6:17:6:20:main",
    "function:src/handlers.ts:1:17:1:21:alpha",
    "function:src/handlers.ts:5:17:5:20:beta",
    "function:src/registry.ts:5:17:5:24:dispatch",
    "function:src/unresolved.ts:1:17:1:29:parse_payload",
    "function:src/unresolved.ts:5:17:5:22:report",
    "function:src/utils.ts:1:17:1:22:helper",
    "function:src/utils.ts:5:17:5:28:other_helper",
  ],
  dropped_files: [
    "src/duplicate_exports.js",
  ],
  indirect_reachability_evidence: [
    "function:src/callback.ts:3:17:3:27:apply_twice|function_reference||src/callback.ts:8:10:8:20",
    "function:src/callback.ts:7:17:7:19:run|function_reference||src/entry.ts:9:19:9:21",
    "function:src/entry.ts:6:17:6:20:main|function_reference||src/entry.ts:15:19:15:22",
    "function:src/handlers.ts:1:17:1:21:alpha|collection_read|variable:src/registry.ts:3:7:3:14:HANDLERS|src/registry.ts:6:19:6:26",
    "function:src/handlers.ts:5:17:5:20:beta|collection_read|variable:src/registry.ts:3:7:3:14:HANDLERS|src/registry.ts:6:19:6:26",
    "function:src/registry.ts:5:17:5:24:dispatch|function_reference||src/entry.ts:8:22:8:29",
    "function:src/unresolved.ts:1:17:1:29:parse_payload|function_reference||src/entry.ts:10:3:10:15",
    "function:src/unresolved.ts:5:17:5:22:report|function_reference||src/entry.ts:17:1:17:6",
    "function:src/utils.ts:1:17:1:22:helper|collection_read|variable:src/zzz_second_reader.ts:3:7:3:18:SECOND_TABLE|src/zzz_second_reader.ts:6:10:6:21",
    "function:src/utils.ts:5:17:5:28:other_helper|function_reference||src/callback.ts:8:22:8:33",
  ],
};

/** The counts the corpus produces. Every one is positive by construction. */
const EXPECTED_COUNTS: Readonly<Record<FingerprintComponentName, number>> = {
  nodes: 14,
  call_edges: 11,
  unresolved_calls: 2,
  raw_entry_points: 4,
  indirect_reachability_keys: 10,
  dropped_files: 1,
  indirect_reachability_evidence: 10,
};

async function load_guard_arm() {
  return run_benchmark_arm({
    arm: "guard",
    sequence_index: 0,
    corpus_name: "ariadne/benchmark_corpus",
    corpus_root: CORPUS_ROOT,
    corpus_commit: "in-repo",
    predicate: "src",
    slice_size: "full",
    ingest_order: "forward",
    seed: 1,
    include_tests: false,
    ariadne_repo_path: find_repo_root(),
    session_id: create_session_id(),
  });
}

describe("the in-repo corpus guard", () => {
  it("reproduces every component's member list exactly", async () => {
    const { fingerprint } = await load_guard_arm();
    for (const name of FINGERPRINT_COMPONENT_NAMES) {
      expect([...fingerprint[name].members]).toEqual([
        ...EXPECTED_MEMBERS[name],
      ]);
    }
  }, 60_000);

  it("derives each committed hash from the committed member list", async () => {
    // This is what makes the guard non-circular: the hashes are a function of
    // a list a reviewer can read, not of whatever the code emitted.
    const { fingerprint } = await load_guard_arm();
    for (const name of FINGERPRINT_COMPONENT_NAMES) {
      expect(fingerprint[name].hash).toEqual(
        digest_members([...EXPECTED_MEMBERS[name]]),
      );
    }
  }, 60_000);

  it("holds a non-empty member list for all seven components", async () => {
    // A component that is always empty has a constant digest and guards
    // nothing. Every count in EXPECTED_COUNTS is positive, and asserting the
    // exact value is what stops the corpus being moved under a `tests/` path —
    // which silently empties `raw_entry_points` — without a test failing.
    const { fingerprint } = await load_guard_arm();
    const counts = Object.fromEntries(
      FINGERPRINT_COMPONENT_NAMES.map((name) => [name, fingerprint[name].count]),
    );
    expect(counts).toEqual(EXPECTED_COUNTS);
  }, 60_000);

  it("records the file counts the corpus produces", async () => {
    const { row } = await load_guard_arm();
    expect(row.file_counts).toEqual({
      discovered: 10,
      offered: 10,
      indexed: 9,
      dropped: 1,
    });
  }, 60_000);

  it("names the grammars the fingerprint is pinned to", async () => {
    // A grammar bump fails here by name rather than as an opaque hash
    // mismatch across seven components.
    const { row } = await load_guard_arm();
    expect({
      tree_sitter: row.environment.tree_sitter_version,
      tree_sitter_typescript: row.environment.tree_sitter_typescript_version,
    }).toEqual({ tree_sitter: "0.25.0", tree_sitter_typescript: "0.23.2" });
  }, 60_000);
});

/**
 * The fingerprint mechanism, guarded against a real load on every test run.
 *
 * A corpus of vscode's scale is absent in CI and in most checkouts, so the
 * corpus-scale ROWS skip — but the mechanism never does. This guard runs
 * against `packages/core/benchmark_corpus`, a ten-file corpus committed beside
 * the harness and chosen so that six of the seven components are non-empty:
 * both indirect-reachability variants, unresolved calls, uncalled exports, and
 * a module-scope call that no node encloses.
 *
 * The seventh, `dropped_files`, is asserted EMPTY and that is the point. It was
 * non-empty only because `duplicate_exports.js` — a file whose two
 * `exports.res = function res()` lines are legal JavaScript — used to abort
 * indexing, so the component's guard was purchased by a bug. Keying export
 * metadata on declaration space readmitted it, and manufacturing a replacement
 * would mean committing a file Ariadne cannot index as a permanent fixture.
 * `dropped_files` at zero is now the load-coverage guarantee itself, and the
 * component's mechanism — that a drop enters the digest and that a comparison
 * can see it move — is proven synthetically in `call_graph_fingerprint.test.ts`
 * over a `broken.js` member instead.
 *
 * The corpus deliberately does NOT live under `tests/` or `fixtures/`.
 * `is_in_test_dir` matches those segments, `detect_entry_points` drops every
 * test node, and a corpus under such a path reports ZERO raw entry points —
 * measured: the same files scored 0 entry points inside `tests/fixtures/` and
 * 38 outside it. One of the seven numbers would then be a constant empty
 * digest on every run, guarding nothing.
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

import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { run_benchmark_arm } from "./benchmark_corpus_load";
import {
  FINGERPRINT_COMPONENT_NAMES,
  type FingerprintComponentName,
} from "./call_graph_fingerprint";
import { create_session_id, find_ariadne_repo_root } from "./measurement_row";
import { digest_members } from "./streaming_digest";

const CORPUS_ROOT = path.join(
  find_ariadne_repo_root(),
  "packages",
  "core",
  "benchmark_corpus",
);

const EXPECTED_MEMBERS: Readonly<Record<FingerprintComponentName, readonly string[]>> = {
  nodes: [
    "function:src/aaa_first_reader.ts:5:17:5:26:read_first",
    "function:src/arithmetic.ts:1:17:1:25:increment",
    "function:src/arithmetic.ts:5:17:5:22:double",
    "function:src/callback.ts:3:17:3:27:apply_twice",
    "function:src/callback.ts:7:17:7:19:run",
    "function:src/duplicate_exports.js:1:24:1:26:res",
    "function:src/duplicate_exports.js:5:24:5:26:res",
    "function:src/entry.ts:6:17:6:20:main",
    "function:src/handlers.ts:1:17:1:21:alpha",
    "function:src/handlers.ts:5:17:5:20:beta",
    "function:src/orphan.ts:1:17:1:28:never_called",
    "function:src/orphan.ts:5:17:5:33:also_never_called",
    "function:src/registry.ts:5:17:5:24:dispatch",
    "function:src/unresolved.ts:1:17:1:29:parse_payload",
    "function:src/unresolved.ts:5:17:5:22:report",
    "function:src/zzz_second_reader.ts:5:17:5:27:read_second",
  ],
  call_edges: [
    "function:src/callback.ts:3:17:3:27:apply_twice->parameter:src/callback.ts:3:29:3:30:fn#2",
    "function:src/callback.ts:7:17:7:19:run->function:src/callback.ts:3:17:3:27:apply_twice#1",
    "function:src/entry.ts:6:17:6:20:main->function:src/arithmetic.ts:1:17:1:25:increment#1",
    "function:src/entry.ts:6:17:6:20:main->function:src/callback.ts:7:17:7:19:run#1",
    "function:src/entry.ts:6:17:6:20:main->function:src/registry.ts:5:17:5:24:dispatch#1",
    "function:src/entry.ts:6:17:6:20:main->function:src/unresolved.ts:1:17:1:29:parse_payload#1",
    "function:src/entry.ts:6:17:6:20:main->function:src/unresolved.ts:5:17:5:22:report#1",
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
    "function:src/duplicate_exports.js:1:24:1:26:res",
    "function:src/duplicate_exports.js:5:24:5:26:res",
    "function:src/orphan.ts:1:17:1:28:never_called",
    "function:src/orphan.ts:5:17:5:33:also_never_called",
    "function:src/zzz_second_reader.ts:5:17:5:27:read_second",
  ],
  indirect_reachability_keys: [
    "function:src/arithmetic.ts:1:17:1:25:increment",
    "function:src/arithmetic.ts:5:17:5:22:double",
    "function:src/callback.ts:3:17:3:27:apply_twice",
    "function:src/callback.ts:7:17:7:19:run",
    "function:src/entry.ts:6:17:6:20:main",
    "function:src/handlers.ts:1:17:1:21:alpha",
    "function:src/handlers.ts:5:17:5:20:beta",
    "function:src/registry.ts:5:17:5:24:dispatch",
    "function:src/unresolved.ts:1:17:1:29:parse_payload",
    "function:src/unresolved.ts:5:17:5:22:report",
  ],
  dropped_files: [],
  indirect_reachability_evidence: [
    "function:src/arithmetic.ts:1:17:1:25:increment|collection_read|variable:src/zzz_second_reader.ts:3:7:3:18:SECOND_TABLE|src/zzz_second_reader.ts:6:10:6:21",
    "function:src/arithmetic.ts:5:17:5:22:double|function_reference||src/callback.ts:8:22:8:27",
    "function:src/callback.ts:3:17:3:27:apply_twice|function_reference||src/callback.ts:8:10:8:20",
    "function:src/callback.ts:7:17:7:19:run|function_reference||src/entry.ts:9:19:9:21",
    "function:src/entry.ts:6:17:6:20:main|function_reference||src/entry.ts:15:19:15:22",
    "function:src/handlers.ts:1:17:1:21:alpha|collection_read|variable:src/registry.ts:3:7:3:14:HANDLERS|src/registry.ts:6:19:6:26",
    "function:src/handlers.ts:5:17:5:20:beta|collection_read|variable:src/registry.ts:3:7:3:14:HANDLERS|src/registry.ts:6:19:6:26",
    "function:src/registry.ts:5:17:5:24:dispatch|function_reference||src/entry.ts:8:22:8:29",
    "function:src/unresolved.ts:1:17:1:29:parse_payload|function_reference||src/entry.ts:10:3:10:15",
    "function:src/unresolved.ts:5:17:5:22:report|function_reference||src/entry.ts:17:1:17:6",
  ],
};

/** The counts the corpus produces. Every one is positive by construction. */
const EXPECTED_COUNTS: Readonly<Record<FingerprintComponentName, number>> = {
  nodes: 16,
  call_edges: 11,
  unresolved_calls: 2,
  raw_entry_points: 6,
  indirect_reachability_keys: 10,
  dropped_files: 0,
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
    ariadne_repo_path: find_ariadne_repo_root(),
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

  it("holds the exact count of every component, six of them non-empty", async () => {
    // A component that is always empty has a constant digest and guards
    // nothing, so every count but `dropped_files` is positive here and the
    // exact value is asserted — which is what stops the corpus being moved
    // under a `tests/` path, silently emptying `raw_entry_points`, without a
    // test failing. `dropped_files` is pinned at zero for the reason in this
    // file's header.
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
      indexed: 10,
      dropped: 0,
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

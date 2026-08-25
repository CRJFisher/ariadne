/**
 * One arm, and the multi-order verdict built out of four of them.
 *
 * These run against the in-repo benchmark corpus, so they exercise the real
 * load path on every test run rather than a mock of it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { diff_ingest_orders, run_benchmark_arm } from "./benchmark_corpus_load";
import { create_session_id } from "./measurement_row";
import { INGEST_ORDERS, type IngestOrder } from "./ingest_order";

function find_repo_root(): string {
  let dir = __dirname;
  while (!fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("could not locate repo root");
    dir = parent;
  }
  return dir;
}

const REPO_ROOT = find_repo_root();
const CORPUS = path.join(REPO_ROOT, "packages", "core", "benchmark_corpus");

function arm(order: IngestOrder, sequence_index: number, session_id: string) {
  return run_benchmark_arm({
    arm: `order-${order}`,
    sequence_index,
    corpus_name: "ariadne/benchmark_corpus",
    corpus_root: CORPUS,
    corpus_commit: "in-repo",
    predicate: "src",
    slice_size: "full",
    ingest_order: order,
    seed: 12345,
    include_tests: false,
    ariadne_repo_path: REPO_ROOT,
    session_id,
  });
}

describe("run_benchmark_arm", () => {
  it("records the corpus, the file set and the run's provenance", async () => {
    const { row } = await arm("forward", 0, create_session_id());

    expect(row.corpus).toEqual({
      corpus_name: "ariadne/benchmark_corpus",
      corpus_root: CORPUS,
      corpus_commit: "in-repo",
      predicate: "src",
    });
    expect(row.file_counts).toEqual({
      discovered: 10,
      offered: 10,
      indexed: 9,
      dropped: 1,
    });
    expect(row.ingest_order).toEqual("forward");
    expect(row.seed).toEqual(12345);
    expect(row.include_tests).toEqual(false);
    expect(row.sequence_index).toEqual(0);
  }, 60_000);

  it("offers every discovered file when the slice is full", async () => {
    const { row } = await arm("forward", 0, create_session_id());
    expect(row.file_counts.offered).toEqual(row.file_counts.discovered);
  }, 60_000);

  it("splits the cost into a load phase and a trace phase, both in CPU", async () => {
    const { row } = await arm("forward", 0, create_session_id());
    // The two phases sum to the total; neither is a wall figure.
    expect(
      Math.abs(
        row.load_cpu_ms + row.trace_cpu_ms - (row.cpu_user_ms + row.cpu_system_ms),
      ) < 1,
    ).toEqual(true);
  }, 60_000);

  it("resolves the corpus root, so a relative root still fingerprints relatively", async () => {
    // An unresolved root leaks absolute paths into every member and makes the
    // fingerprint a function of where the corpus sits on disk.
    const relative_root = path.relative(process.cwd(), CORPUS);
    const { row } = await run_benchmark_arm({
      arm: "relative",
      sequence_index: 0,
      corpus_name: "ariadne/benchmark_corpus",
      corpus_root: relative_root,
      corpus_commit: "in-repo",
      predicate: "src",
      slice_size: "full",
      ingest_order: "forward",
      seed: 1,
      include_tests: false,
      ariadne_repo_path: REPO_ROOT,
      session_id: create_session_id(),
    });
    expect(row.corpus.corpus_root).toEqual(CORPUS);
  }, 60_000);
});

describe("refusals before the work", () => {
  it("refuses a predicate that selected no files, rather than loading the corpus root", async () => {
    // `load_project` reads an empty file list as "no filter" and walks the whole
    // project path, so without this a mistyped predicate costs a full-corpus
    // load before failing.
    await expect(
      run_benchmark_arm({
        arm: "typo",
        sequence_index: 0,
        corpus_name: "ariadne/benchmark_corpus",
        corpus_root: CORPUS,
        corpus_commit: "in-repo",
        predicate: "folder:no_such_folder",
        slice_size: "full",
        ingest_order: "forward",
        seed: 1,
        include_tests: false,
        ariadne_repo_path: REPO_ROOT,
        session_id: create_session_id(),
      }),
    ).rejects.toThrow(/selected no files/);
  }, 60_000);

  it("refuses a slice the corpus cannot supply", async () => {
    await expect(
      run_benchmark_arm({
        arm: "too-big",
        sequence_index: 0,
        corpus_name: "ariadne/benchmark_corpus",
        corpus_root: CORPUS,
        corpus_commit: "in-repo",
        predicate: "src",
        slice_size: 5000,
        ingest_order: "forward",
        seed: 1,
        include_tests: false,
        ariadne_repo_path: REPO_ROOT,
        session_id: create_session_id(),
      }),
    ).rejects.toThrow(/but the corpus holds 10/);
  }, 60_000);
});

describe("diff_ingest_orders", () => {
  it("reports the corpus as order-DEPENDENT, in the evidence component", async () => {
    // This pins a real defect, not a desired property. Ariadne records the LAST
    // writer's read site as a function's reachability evidence, so when two
    // files both read the same function as a value, which one is remembered
    // depends on the order the loader walked them. `helper` is read by
    // `aaa_first_reader` and `zzz_second_reader` for exactly this purpose.
    //
    // Only the seventh component moves: the SET of reachable functions is
    // unchanged, and what the graph says about them is not. That is the shape
    // of failure the six-value fingerprint could not see, which is why the
    // seventh exists.
    //
    // TASK-381.11 makes the reported graph a function of the codebase rather
    // than of the walk. When it lands, this test fails — and that failure is
    // the signal it worked. Update it to assert independence then.
    const session_id = create_session_id();
    const baseline = await arm("forward", 0, session_id);
    const others = [];
    let sequence_index = 1;
    for (const order of INGEST_ORDERS) {
      if (order === "forward") continue;
      others.push(await arm(order, sequence_index, session_id));
      sequence_index++;
    }

    const verdict = diff_ingest_orders(baseline, others);

    expect(verdict.baseline_order).toEqual("forward");
    expect(verdict.comparisons.map((entry) => entry.order)).toEqual([
      "reversed",
      "descending_size",
      "shuffled",
    ]);
    expect(verdict.identical_across_orders).toEqual(false);

    const reversed = verdict.comparisons[0].comparison;
    expect([...reversed.differing_components]).toEqual([
      "indirect_reachability_evidence",
    ]);
    const evidence = reversed.components.find(
      (component) => component.component === "indirect_reachability_evidence",
    );
    expect(evidence?.only_baseline).toEqual([
      "function:src/utils.ts:1:17:1:22:helper|collection_read|variable:src/zzz_second_reader.ts:3:7:3:18:SECOND_TABLE|src/zzz_second_reader.ts:6:10:6:21",
    ]);
    expect(evidence?.only_candidate).toEqual([
      "function:src/utils.ts:1:17:1:22:helper|collection_read|variable:src/aaa_first_reader.ts:3:7:3:17:FIRST_TABLE|src/aaa_first_reader.ts:6:10:6:20",
    ]);
  }, 120_000);

  it("reports a difference when one exists, naming the component", async () => {
    // Without this the verdict could be hardcoded `true` and every test would
    // still pass — and `identical_across_orders` is the single boolean the
    // determinism capability reports, printed straight to the operator.
    const session_id = create_session_id();
    const baseline = await arm("forward", 0, session_id);
    const perturbed: typeof baseline = {
      row: { ...baseline.row, ingest_order: "reversed" },
      fingerprint: {
        ...baseline.fingerprint,
        raw_entry_points: {
          count: baseline.fingerprint.raw_entry_points.count + 1,
          hash: "0000000000000000",
          members: [
            ...baseline.fingerprint.raw_entry_points.members,
            "function:src/invented.ts:1:1:1:2:ghost",
          ],
        },
      },
    };

    const verdict = diff_ingest_orders(baseline, [perturbed]);

    expect(verdict.identical_across_orders).toEqual(false);
    expect([...verdict.comparisons[0].comparison.differing_components]).toEqual([
      "raw_entry_points",
    ]);
    expect(verdict.comparisons[0].comparison.components
      .find((c) => c.component === "raw_entry_points")?.only_candidate).toEqual([
      "function:src/invented.ts:1:1:1:2:ghost",
    ]);
  }, 120_000);

  it("carries the recorded validation, so silence is never read alone", async () => {
    const session_id = create_session_id();
    const baseline = await arm("forward", 0, session_id);
    const reversed = await arm("reversed", 1, session_id);
    const verdict = diff_ingest_orders(baseline, [reversed]);

    expect(verdict.recorded_validation.entry_points_moved).toEqual(31);
    expect(
      verdict.recorded_validation.comparable_with_current_fingerprint,
    ).toEqual(false);
  }, 120_000);

  it("refuses to read two different corpora as an order difference", async () => {
    const session_id = create_session_id();
    const baseline = await arm("forward", 0, session_id);
    const other_predicate = await run_benchmark_arm({
      arm: "other",
      sequence_index: 1,
      corpus_name: "ariadne/benchmark_corpus",
      corpus_root: CORPUS,
      corpus_commit: "in-repo",
      predicate: "repository-root",
      slice_size: "full",
      ingest_order: "reversed",
      seed: 1,
      include_tests: false,
      ariadne_repo_path: REPO_ROOT,
      session_id,
    });

    expect(() => diff_ingest_orders(baseline, [other_predicate])).toThrow(
      /Refusing to compare/,
    );
  }, 120_000);
});

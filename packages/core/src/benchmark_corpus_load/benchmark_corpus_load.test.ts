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
      discovered: 8,
      offered: 8,
      indexed: 7,
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

describe("diff_ingest_orders", () => {
  it("reports this corpus as order-independent across all four orders", async () => {
    // Pinning today's truth, not asserting a property. TASK-381.11 is the task
    // that makes the corpus-scale answer order-independent; if this corpus ever
    // stops being so, that is a finding and this test should fail loudly.
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
    expect(verdict.identical_across_orders).toEqual(true);
    for (const entry of verdict.comparisons) {
      expect([...entry.comparison.differing_components]).toEqual([]);
    }
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

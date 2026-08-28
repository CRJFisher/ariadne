/**
 * One arm, and the multi-order verdict built out of four of them.
 *
 * These run against the in-repo benchmark corpus, so they exercise the real
 * load path on every test run rather than a mock of it.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { diff_ingest_orders, run_benchmark_arm } from "./benchmark_corpus_load";
import { create_session_id, find_ariadne_repo_root } from "./measurement_row";
import { INGEST_ORDERS, type IngestOrder } from "./ingest_order";

const REPO_ROOT = find_ariadne_repo_root();
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
      indexed: 10,
      dropped: 0,
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

  it("refuses a corpus root that lies inside a test tree", async () => {
    // `is_in_test_dir` matches the ABSOLUTE path, so a corpus checked out under
    // a `test`, `tests` or `fixtures` directory anywhere above it marks every
    // file as a test file and the arm reports zero raw entry points. Nothing
    // about that result looks wrong from the outside.
    const staging = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "corpus-in-tests-")),
    );
    const under_tests = path.join(staging, "tests", "corpus");
    fs.mkdirSync(path.join(under_tests, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(under_tests, "src", "entry.ts"),
      "export function main(): number {\n  return 1;\n}\n",
    );

    await expect(
      run_benchmark_arm({
        arm: "in-tests",
        sequence_index: 0,
        corpus_name: "staged",
        corpus_root: under_tests,
        corpus_commit: "in-repo",
        predicate: "src",
        slice_size: "full",
        ingest_order: "forward",
        seed: 1,
        include_tests: false,
        ariadne_repo_path: REPO_ROOT,
        session_id: create_session_id(),
      }),
    ).rejects.toThrow(/lies inside a test tree/);

    fs.rmSync(staging, { recursive: true, force: true });
  }, 60_000);

  it("refuses a discovery walk that disagrees with a pinned file count", async () => {
    // Every corpus-scale figure is stated over the pinned count. A walk that
    // starts selecting a different file set re-bases all of them while every
    // row keeps naming the old corpus.
    await expect(
      run_benchmark_arm({
        arm: "mislabelled",
        sequence_index: 0,
        corpus_name: "microsoft/vscode",
        corpus_root: CORPUS,
        corpus_commit: "f3fa55c3",
        predicate: "src",
        slice_size: "full",
        ingest_order: "forward",
        seed: 1,
        include_tests: false,
        ariadne_repo_path: REPO_ROOT,
        session_id: create_session_id(),
      }),
    ).rejects.toThrow(/found 10 files, but 8494 is pinned for it/);
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
  it("reports the corpus as order-INDEPENDENT, evidence component included", async () => {
    // `increment` is read as a value by both `aaa_first_reader` and
    // `zzz_second_reader`, so the corpus carries the shape that used to make
    // the seventh component move: one function, two candidate read sites, one
    // slot to report. The recorded evidence is the site earliest in the
    // project, whichever file the walk reached first, so all four orders agree
    // — and the site named below is `aaa_first_reader`'s in every one of them.
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
    expect(
      verdict.comparisons.map((entry) => [
        ...entry.comparison.differing_components,
      ]),
    ).toEqual([[], [], []]);

    // Named rather than merely compared: three orders agreeing on an evidence
    // component that lost the entry would also report no difference. The site
    // is `aaa_first_reader`'s import of `increment`, which is the first read of
    // it anywhere in the corpus.
    expect([
      ...baseline.fingerprint.indirect_reachability_evidence.members,
    ]).toContain(
      "function:src/arithmetic.ts:1:17:1:25:increment|function_reference||src/aaa_first_reader.ts:1:10:1:18",
    );
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
    expect(verdict.recorded_validation.file_count).toEqual(8494);
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

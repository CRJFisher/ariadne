/**
 * The guard is only worth having while it sits above what the arms actually
 * cost and below what the box can back. Both halves are checked against the
 * two recorded measurements rather than against a restatement of the formula,
 * so a re-fit that drops under a corpus this repository has already measured
 * fails here instead of at the OOM killer.
 */

import { describe, expect, it } from "vitest";
import { heap_mb_for, required_heap_mb } from "./heap_requirement";
import { RECORDED_FAILURE_TAXONOMY_BASELINE } from "./recorded_failure_taxonomy_baseline";
import { RECORDED_CORPUS_RESOLUTION } from "./recorded_corpus_resolution";

/** Every measured arm, as (indexed files, the heap cap it ran under). */
const MEASURED_ARMS = [
  ...RECORDED_FAILURE_TAXONOMY_BASELINE.rows,
  ...RECORDED_CORPUS_RESOLUTION.rows,
].map((row) => ({
  corpus: row.corpus,
  files: row.file_counts.indexed,
}));

/**
 * Peak resident set, per corpus, taken as the larger of the two arms. Held
 * here rather than on the recorded rows because those rows carry the taxonomy
 * and the fingerprint; this is the one figure the guard is fitted against.
 */
const PEAK_RSS_MB: ReadonlyArray<readonly [string, number, number]> = [
  ["expressjs/express", 141, 250.3],
  ["launchbadge/sqlx", 459, 412.6],
  ["mochajs/mocha", 534, 270.8],
  ["tokio-rs/tokio", 790, 465.4],
  ["pandas-dev/pandas", 1510, 2183.2],
  ["django/django", 3012, 1749.3],
  ["rust-lang/rust", 3516, 3010.8],
  ["angular/angular", 6345, 4447.1],
  ["microsoft/TypeScript", 19783, 3623.2],
];

describe("the heap an arm is given", () => {
  it("sits above the peak resident set of every corpus this repository has measured", () => {
    expect(
      PEAK_RSS_MB.filter(([, files, peak]) => required_heap_mb(files) < peak),
    ).toEqual([]);
  });

  it("is the same requirement for every file count the two records hold", () => {
    // The parent sizes a child from this function and the child refuses under
    // it; a divergence would let a parent spawn an arm its own child rejects.
    expect(
      MEASURED_ARMS.filter(
        ({ files }) => heap_mb_for(files) < required_heap_mb(files),
      ),
    ).toEqual([]);
  });

  it("grows with the file count and never shrinks", () => {
    const counts = [0, 141, 1510, 6345, 19783, 100000];
    const requirements = counts.map((n) => required_heap_mb(n));
    expect(requirements).toEqual([1500, 1571, 2255, 4673, 11392, 51500]);
    expect([...requirements].sort((a, b) => a - b)).toEqual(requirements);
  });

  it("gives a small arm the floor rather than a cap below what node starts with", () => {
    expect([heap_mb_for(0), heap_mb_for(141), heap_mb_for(6345)]).toEqual([
      2048, 2048, 5842,
    ]);
  });

  it("admits microsoft/TypeScript, the corpus the previous fit refused", () => {
    // The previous fit asked 28,096 MB of a 32,768 MB box for this corpus and
    // left it unmeasured through the whole of TASK-376. It peaks at 3,623 MB.
    const typescript = RECORDED_CORPUS_RESOLUTION.rows.find(
      (row) => row.corpus === "microsoft/TypeScript",
    );
    expect(typescript!.file_counts.discovered).toEqual(19783);
    expect(RECORDED_FAILURE_TAXONOMY_BASELINE.not_measured).toEqual([]);
    expect(heap_mb_for(19783)).toEqual(14240);
    expect(heap_mb_for(19783)).toBeLessThan(32768);
  });

  it("over-provisions, which is what a ceiling fitted on file count costs", () => {
    // Recorded so a re-fit on bytes of source (TASK-398) has the figure it has
    // to beat. The spread is the point: the same line is 3.1x too generous on
    // TypeScript and 1.03x on pandas.
    expect(
      PEAK_RSS_MB.map(([corpus, files, peak]) => [
        corpus,
        Number((required_heap_mb(files) / peak).toFixed(2)),
      ]),
    ).toEqual([
      ["expressjs/express", 6.28],
      ["launchbadge/sqlx", 4.19],
      ["mochajs/mocha", 6.53],
      ["tokio-rs/tokio", 4.07],
      ["pandas-dev/pandas", 1.03],
      ["django/django", 1.72],
      ["rust-lang/rust", 1.08],
      ["angular/angular", 1.05],
      ["microsoft/TypeScript", 3.14],
    ]);
  });
});

/**
 * The record is worth keeping only while it stays internally consistent: its
 * provenance complete, the bracket a real bracket, every memory figure a mean
 * over repeated runs rather than one process's reading, and the two claims it
 * exists to carry still true of the numbers written down — the ceiling decides
 * whether the load finishes and never what it reports, and the RSS-to-live-heap
 * ratio is a pair rather than a constant.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_MEMORY_CONTRACT } from "./recorded_memory_contract";
import { RECORDED_ORDER_INDEPENDENCE } from "./recorded_order_independence";
import { round_to_hundredth } from "./round_measurement";

const RECORD = RECORDED_MEMORY_CONTRACT;

interface Spread {
  readonly mean: number;
  readonly min: number;
  readonly max: number;
  readonly spread_percent: number;
  readonly cv_percent: number;
  readonly observations: readonly number[];
}

function every_spread_on_the_record(): readonly { label: string; spread: Spread }[] {
  const spreads: { label: string; spread: Spread }[] = [
    { label: "live heap", spread: RECORD.live_heap_mb },
  ];
  for (const arm of RECORD.completing) {
    spreads.push(
      { label: `${arm.heap_flag_mb} MB CPU`, spread: arm.cpu_seconds },
      { label: `${arm.heap_flag_mb} MB peak RSS`, spread: arm.peak_rss_mb },
      { label: `${arm.heap_flag_mb} MB settled heap`, spread: arm.settled_heap_mb },
    );
  }
  spreads.push(
    { label: "repository-root CPU", spread: RECORD.other_corpus.cpu_seconds },
    { label: "repository-root peak RSS", spread: RECORD.other_corpus.peak_rss_mb },
    { label: "repository-root live heap", spread: RECORD.other_corpus.live_heap_mb },
  );
  return spreads;
}

describe("RECORDED_MEMORY_CONTRACT", () => {
  it("names its full provenance", () => {
    expect({
      corpus: RECORD.corpus,
      corpus_commit: RECORD.corpus_commit,
      predicate: RECORD.predicate,
      discovered_files: RECORD.discovered_files,
      machine: RECORD.machine,
      node_version: RECORD.node_version,
      cpu_count: RECORD.cpu_count,
      total_memory_mb: RECORD.total_memory_mb,
      tree_sitter_version: RECORD.tree_sitter_version,
      tree_sitter_typescript_version: RECORD.tree_sitter_typescript_version,
      ariadne_commit: RECORD.ariadne_commit,
      session_id: RECORD.session_id,
    }).toEqual({
      corpus: "microsoft/vscode",
      corpus_commit: "f3fa55c3",
      predicate: "src",
      discovered_files: 8494,
      machine: "Darwin 24.6.0 x64",
      node_version: "v22.22.1",
      cpu_count: 6,
      total_memory_mb: 32768,
      tree_sitter_version: "0.25.0",
      tree_sitter_typescript_version: "0.23.2",
      ariadne_commit: "417de2fc",
      session_id: "task-381.16",
    });
  });

  it("brackets the requirement between a ceiling that fails and the smallest one that completes", () => {
    const failing = RECORD.at_default_ceiling;
    expect(failing.completed).toBe(false);
    expect(failing.heap_flag_mb).toBeNull();
    expect(failing.heap_cap_mb).toEqual(RECORD.default_old_space_ceiling_mb);
    expect(failing.heap_cap_mb).toBeLessThan(RECORD.required_old_space_mb);

    const flags = RECORD.completing.map((arm) => arm.heap_flag_mb);
    expect(Math.min(...flags)).toEqual(RECORD.required_old_space_mb);
    expect(RECORD.requirement).toContain(String(RECORD.required_old_space_mb));
    expect(RECORD.requirement).toContain("`src/`");
  });

  it("records the death as a collector that stopped making progress", () => {
    const failing = RECORD.at_default_ceiling;
    expect(failing.fatal_error).toContain("FATAL ERROR");
    expect(failing.cpu_seconds).toBeGreaterThan(0);

    // A run that dies produces no fingerprint and no file counts. Recording the
    // absence is the result; a partial arm is never substituted for a finished
    // one.
    expect(failing.reached_trace_phase).toBe(false);

    const collections = failing.final_collections;
    expect(collections.length).toBeGreaterThanOrEqual(2);
    const last = collections[collections.length - 1];
    expect(last.at_ms).toBeGreaterThan(collections[0].at_ms);
    // The last collection frees single-digit megabytes for seconds of work, at
    // a mutator utilisation that says the process is no longer indexing.
    expect(last.heap_before_mb - last.heap_after_mb).toBeLessThan(10);
    expect(last.duration_ms).toBeGreaterThan(1000);
    expect(last.current_mutator_utilisation).toBeLessThan(0.05);
    expect(last.committed_after_mb).toBeGreaterThan(failing.heap_cap_mb);
  });

  it("indexes every discovered file at every ceiling that completes", () => {
    expect(RECORD.completing.length).toBeGreaterThanOrEqual(2);
    for (const arm of RECORD.completing) {
      expect(arm.completed).toBe(true);
      expect(arm.indexed).toEqual(RECORD.discovered_files);
      expect(arm.dropped).toEqual(0);
      expect(arm.heap_cap_mb).toBeGreaterThan(arm.heap_flag_mb);
    }
  });

  it("states every memory figure as a mean over at least two independent runs", () => {
    for (const { label, spread } of every_spread_on_the_record()) {
      expect(
        spread.observations.length,
        `${label} is a single run`,
      ).toBeGreaterThanOrEqual(2);

      const values = spread.observations;
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const variance =
        values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
        values.length;
      expect({
        label,
        mean: spread.mean,
        min: spread.min,
        max: spread.max,
        spread_percent: spread.spread_percent,
        cv_percent: spread.cv_percent,
      }).toEqual({
        label,
        mean: round_to_hundredth(mean),
        min: round_to_hundredth(Math.min(...values)),
        max: round_to_hundredth(Math.max(...values)),
        spread_percent: round_to_hundredth(
          ((Math.max(...values) - Math.min(...values)) / mean) * 100,
        ),
        cv_percent: round_to_hundredth((Math.sqrt(variance) / mean) * 100),
      });
    }
  });

  it("takes the cost of the smaller ceiling from arms interleaved in one session", () => {
    const [smaller, larger] = RECORD.completing;
    expect(smaller.heap_flag_mb).toBeLessThan(larger.heap_flag_mb);

    // A,B,A,B: the two arms share the session's thermal and scheduling drift,
    // which is the only reason the ratio between them means anything.
    expect(smaller.sequence_indices).toEqual([1, 3]);
    expect(larger.sequence_indices).toEqual([2, 4]);

    expect(
      Number((smaller.cpu_seconds.mean / larger.cpu_seconds.mean).toFixed(2)),
    ).toEqual(RECORD.cost_of_the_smaller_ceiling);
    expect(RECORD.cost_of_the_smaller_ceiling).toBeGreaterThan(1);
  });

  it("puts the live heap below the default ceiling and keeps it stable across ceilings", () => {
    expect(RECORD.live_heap_mb.mean).toBeLessThan(
      RECORD.default_old_space_ceiling_mb,
    );
    expect(
      round_to_hundredth(
        RECORD.default_old_space_ceiling_mb - RECORD.live_heap_mb.mean,
      ),
    ).toEqual(RECORD.live_heap_headroom_below_default_ceiling_mb);

    // The whole diagnosis: the load retains less than the default ceiling and
    // still cannot run under it, so what is missing is collector working set
    // rather than memory for the data.
    expect(RECORD.live_heap_headroom_below_default_ceiling_mb).toBeLessThan(
      RECORD.default_old_space_ceiling_mb * 0.05,
    );
    expect(RECORD.live_heap_mb.spread_percent).toBeLessThan(0.1);
  });

  it("records the RSS-to-live-heap ratio as a pair over one live set", () => {
    expect(RECORD.rss_to_live_heap.length).toBeGreaterThanOrEqual(2);
    const ratios = new Set(RECORD.rss_to_live_heap.map((row) => row.ratio));
    expect(ratios.size).toEqual(RECORD.rss_to_live_heap.length);

    for (const row of RECORD.rss_to_live_heap) {
      const arm = RECORD.completing.find(
        (candidate) => candidate.heap_cap_mb === row.heap_cap_mb,
      );
      expect(arm?.peak_rss_mb.mean).toEqual(row.peak_rss_mb);
      expect(row.live_heap_mb).toEqual(RECORD.live_heap_mb.mean);
      expect(Number((row.peak_rss_mb / row.live_heap_mb).toFixed(2))).toEqual(
        row.ratio,
      );
    }
  });

  it("reports one call graph at every ceiling, and it is this tree's recorded digest", () => {
    const agreed = RECORD.fingerprint_at_every_ceiling;
    expect(agreed.arms_agreeing).toEqual(
      RECORD.completing.reduce(
        (total, arm) => total + arm.sequence_indices.length,
        0,
      ),
    );

    // The same digest four independent ingest orders converged on. A ceiling
    // that changed the reported graph would be a different finding entirely.
    const [full_corpus] = RECORDED_ORDER_INDEPENDENCE.slices;
    expect(agreed.components).toEqual(full_corpus.agreed_components);
    expect(agreed.canonical_hash).toEqual(full_corpus.agreed_canonical_hash);
    expect(agreed.diag_hash).toEqual(full_corpus.diag_hashes_by_order.forward);
  });

  it("scopes the floor to the corpus it was measured on", () => {
    const other = RECORD.other_corpus;
    expect(other.predicate).not.toEqual(RECORD.predicate);
    expect(other.discovered_files).toBeGreaterThan(RECORD.discovered_files);

    // The other corpus retains more than this one and peaks above the floor
    // stated for it, so the floor may not be quoted here. That is the whole
    // reason the row exists.
    expect(other.live_heap_mb.mean).toBeGreaterThan(RECORD.live_heap_mb.mean);
    expect(other.peak_rss_mb.mean).toBeGreaterThan(RECORD.required_old_space_mb);
    expect(other.heap_flag_mb).toBeGreaterThan(RECORD.required_old_space_mb);
    expect(other.verdict).toContain("6,144");
  });

  it("carries the audit behind the no-heap-flag claim", () => {
    const audit = RECORD.no_heap_flag_in_ariadne;
    expect(audit.matches_in_shipped_code).toEqual(0);
    expect(audit.searched).toContain("--max-old-space-size");
    expect(audit.searched).toContain("NODE_OPTIONS");
    expect(audit.matches_in_the_harness.length).toBeGreaterThan(0);
    expect(audit.why.length).toBeGreaterThan(0);
  });

  it("keeps every figure measured elsewhere with the reason it is not a comparand", () => {
    expect(RECORD.recorded_elsewhere.length).toBeGreaterThanOrEqual(4);
    for (const entry of RECORD.recorded_elsewhere) {
      expect(entry.claim.length).toBeGreaterThan(0);
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });
});

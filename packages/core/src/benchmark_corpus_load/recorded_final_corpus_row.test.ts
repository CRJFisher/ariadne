import { describe, expect, it } from "vitest";
import { RECORDED_FINAL_CORPUS_ROW as ROW } from "./recorded_final_corpus_row";

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function coefficient_of_variation_percent(values: readonly number[]): number {
  const centre = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - centre) ** 2, 0) /
    (values.length - 1);
  return (100 * Math.sqrt(variance)) / centre;
}

describe("RECORDED_FINAL_CORPUS_ROW", () => {
  it("closes the file counts over the corpus", () => {
    expect(ROW.indexed_files + ROW.dropped_files).toEqual(ROW.discovered_files);
    expect(ROW.agreed_components.dropped_files.count).toEqual(
      ROW.dropped_files
    );
  });

  it("holds one canonical hash across four orders while the emitted hash differs", () => {
    expect(ROW.orders.map((arm) => arm.ingest_order)).toEqual([
      "forward",
      "reversed",
      "descending_size",
      "shuffled",
    ]);
    expect(ROW.orders.map((arm) => arm.canonical_hash)).toEqual(
      ROW.orders.map(() => ROW.canonical_hash)
    );
    expect(new Set(ROW.orders.map((arm) => arm.diag_hash)).size).toEqual(
      ROW.orders.length
    );
  });

  it("shows the probe moving on the tree before the commit that made the orders agree", () => {
    const { arms } = ROW.non_vacuity_on_the_tree_before;
    expect(new Set(arms.map((arm) => arm.call_edges)).size).toEqual(
      arms.length
    );
    expect(arms.map((arm) => arm.call_edges)).not.toContain(
      ROW.agreed_components.call_edges.count
    );
  });

  it("derives the serial CPU summary from its five observations", () => {
    const { observations, mean: recorded_mean, cv_percent } = ROW.serial_cpu_s;
    expect(observations.length).toBeGreaterThanOrEqual(5);
    expect(mean(observations)).toBeCloseTo(recorded_mean, 1);
    expect(coefficient_of_variation_percent(observations)).toBeCloseTo(
      cv_percent,
      1
    );
  });

  it("derives the pooled means from its arms and refuses to call them idle-box figures", () => {
    expect(mean(ROW.pooled.arms.map((arm) => arm.wall_s))).toBeCloseTo(
      ROW.pooled.wall_s_mean,
      1
    );
    expect(mean(ROW.pooled.arms.map((arm) => arm.cpu_s))).toBeCloseTo(
      ROW.pooled.cpu_s_mean,
      1
    );
    expect(ROW.pooled.measured_on_an_idle_box).toBe(false);
  });

  it("brackets the heap with a ceiling that fails and a ceiling that completes", () => {
    const completed = ROW.memory.arms.filter((arm) => arm.completed);
    const failed = ROW.memory.arms.filter((arm) => !arm.completed);
    expect(failed.map((arm) => arm.heap_flag_mb)).toEqual([4144, 4144]);
    expect(completed.map((arm) => arm.heap_flag_mb)).toEqual([6144, 6144]);

    const peaks = completed.map((arm) => arm.peak_rss_mb ?? 0);
    expect(mean(peaks)).toBeCloseTo(
      ROW.memory.completed_at_6144.peak_rss_mb_mean,
      2
    );
    expect(
      (100 * (Math.max(...peaks) - Math.min(...peaks))) / mean(peaks)
    ).toBeCloseTo(ROW.memory.completed_at_6144.peak_rss_spread_percent, 1);
    expect(mean(completed.map((arm) => arm.live_heap_mb ?? 0))).toBeCloseTo(
      ROW.memory.completed_at_6144.live_heap_mb_mean,
      1
    );
  });

  it("accounts for every file of the killed-and-restarted load", () => {
    const resumption = ROW.cache_resumption;
    expect(
      resumption.blobs_reused_on_restart + resumption.files_indexed_on_restart
    ).toEqual(resumption.files);
    expect(resumption.blobs_reused_on_restart).toEqual(
      resumption.blobs_finished_at_kill
    );
  });
});

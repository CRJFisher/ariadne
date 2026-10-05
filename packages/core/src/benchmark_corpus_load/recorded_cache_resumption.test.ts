/**
 * The record is worth keeping only while it stays internally consistent: its
 * provenance complete, its before-and-after a real pair taken in one session,
 * every CPU figure a mean over repeated runs rather than one process's reading,
 * and the claims it exists to carry still true of the numbers written down —
 * resumption reuses exactly what the killed run finished, a warm cache hits
 * everything it is offered minus the drops, and the byte target it did not meet
 * says so.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_CACHE_RESUMPTION } from "./recorded_cache_resumption";
import { FINGERPRINT_COMPONENT_NAMES } from "./call_graph_fingerprint";

const RECORD = RECORDED_CACHE_RESUMPTION;

describe("RECORDED_CACHE_RESUMPTION", () => {
  it("names its full provenance", () => {
    expect({
      corpus: RECORD.corpus,
      corpus_commit: RECORD.corpus_commit,
      machine: RECORD.machine,
      node_version: RECORD.node_version,
      cpu_count: RECORD.cpu_count,
      ariadne_commit: RECORD.ariadne_commit,
      control_commit: RECORD.control_commit,
      session_id: RECORD.session_id,
    }).toEqual({
      corpus: "microsoft/vscode",
      corpus_commit: "f3fa55c3",
      machine: "Darwin 24.6.0 x64",
      node_version: "v22.22.1",
      cpu_count: 6,
      ariadne_commit: "ded8a2ca+task-381.9",
      control_commit: "ded8a2ca",
      session_id: "task-381.9",
    });
  });

  // The finding is the gap between what the killed run finished and what the
  // next one could use. Both arms must have finished the same amount of work,
  // or the pair compares two different interruptions.
  it("kills both arms at the same point of the same corpus", () => {
    const { candidate, control } = RECORD.kill_and_resume;
    expect(candidate.blobs_on_disk_after_the_kill).toEqual(
      control.blobs_on_disk_after_the_kill,
    );
    expect(candidate.manifest_on_disk_after_the_kill).toEqual(false);
    expect(control.manifest_on_disk_after_the_kill).toEqual(false);
  });

  it("reuses every blob the killed run finished, against none before", () => {
    const { candidate, control, files } = RECORD.kill_and_resume;
    expect(candidate.cache_hits_on_restart).toEqual(
      candidate.blobs_on_disk_after_the_kill,
    );
    expect(control.cache_hits_on_restart).toEqual(0);
    expect(
      candidate.cache_hits_on_restart + candidate.cache_misses_on_restart,
    ).toEqual(files);
    expect(candidate.indexed_on_restart).toEqual(files);
  });

  it("leaves no temporary file at either end of the interruption", () => {
    const { candidate } = RECORD.kill_and_resume;
    expect({
      after_kill: candidate.temporary_files_after_the_kill,
      after_restart: candidate.temporary_files_after_the_restart,
    }).toEqual({ after_kill: 0, after_restart: 0 });
  });

  it("reports the same call graph as an uninterrupted cold load", () => {
    expect(RECORD.kill_and_resume.fingerprint_components_moved).toEqual([]);
    expect(Object.keys(RECORD.kill_and_resume.fingerprint)).toEqual([
      ...FINGERPRINT_COMPONENT_NAMES,
    ]);
  });

  it("hits every offered file minus the dropped ones at every slice", () => {
    for (const row of RECORD.warm_cache_hits.rows) {
      expect(row.warm_hits).toEqual(row.files_offered - row.dropped);
      expect(row.warm_misses).toEqual(row.dropped);
      expect(row.cold_hits).toEqual(0);
    }
    expect(RECORD.warm_cache_hits.rows.map((row) => row.files_offered)).toEqual([
      50, 200, 400, 800,
    ]);
  });

  // A cache that matches nothing must not make a load meaningfully worse than
  // having no cache at all, or a user who upgrades pays for the invalidation.
  it("costs under six percent to reject a cache that matches nothing", () => {
    const arm = RECORD.rejecting_a_full_cache;
    expect(arm.cache_hits).toEqual(0);
    expect(arm.overhead_percent).toBeLessThanOrEqual(6);
    expect(
      round_to_hundredth(arm.candidate.mean_ms / arm.control.mean_ms - 1) * 100,
    ).toBeCloseTo(arm.overhead_percent, 0);
  });

  it("states every CPU and parse figure as a mean over repeated runs", () => {
    const arm = RECORD.rejecting_a_full_cache;
    const spreads = [
      arm.control,
      arm.candidate,
      RECORD.blob_size.control.parse_ms,
      RECORD.blob_size.candidate.parse_ms,
    ];
    for (const spread of spreads) {
      expect(spread.observations_ms.length).toBeGreaterThanOrEqual(2);
      expect(spread.min_ms).toEqual(Math.min(...spread.observations_ms));
      expect(spread.max_ms).toEqual(Math.max(...spread.observations_ms));
      const mean =
        spread.observations_ms.reduce((total, ms) => total + ms, 0) /
        spread.observations_ms.length;
      expect(spread.mean_ms).toBeCloseTo(mean, 0);
    }
  });

  it("meets the parse bound and records the byte target as refuted", () => {
    const { control, candidate, size_ratio, parse_ratio, composition } =
      RECORD.blob_size;

    expect(candidate.parse_ms.mean_ms).toBeLessThanOrEqual(175);
    expect(candidate.bytes).toBeLessThan(control.bytes);
    expect(size_ratio).toBeCloseTo(control.bytes / candidate.bytes, 2);
    expect(parse_ratio).toBeCloseTo(
      control.parse_ms.mean_ms / candidate.parse_ms.mean_ms,
      2,
    );

    // The refutation has to be checkable, not asserted: no elision of the path
    // could have reached 32 MB, because removing it everywhere still floors
    // above that.
    expect(candidate.megabytes).toBeGreaterThan(32);
    expect(composition.whole_blob_elision_floor_mb).toBeGreaterThan(32);
    expect(composition.whole_blob_elision_floor_mb).toBeLessThan(
      candidate.megabytes,
    );
    expect(RECORD.blob_size.refuted).toContain("refuted");
  });
});

function round_to_hundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

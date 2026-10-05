/**
 * The record is only worth keeping while it stays internally consistent:
 * provenance complete, file counts closing, both arms repeated, the ratios it
 * states reproducible from the repetitions beside them, and the two claims it
 * exists to carry — no scan survives, and the keyed cost per evicted symbol is
 * flat — still true of the numbers written down.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_EVICTION_INDEX_COST } from "./recorded_eviction_index_cost";

const SIZES = RECORDED_EVICTION_INDEX_COST.sizes;

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

describe("RECORDED_EVICTION_INDEX_COST", () => {
  it("names its full provenance", () => {
    expect({
      corpus: RECORDED_EVICTION_INDEX_COST.corpus,
      corpus_commit: RECORDED_EVICTION_INDEX_COST.corpus_commit,
      predicate: RECORDED_EVICTION_INDEX_COST.predicate,
      discovered_files: RECORDED_EVICTION_INDEX_COST.discovered_files,
      machine: RECORDED_EVICTION_INDEX_COST.machine,
      node_version: RECORDED_EVICTION_INDEX_COST.node_version,
      file_counts: SIZES.map((size) => size.file_count),
    }).toEqual({
      corpus: "microsoft/vscode",
      corpus_commit: "f3fa55c3",
      predicate: "src",
      discovered_files: 8494,
      machine: "Darwin 24.6.0 x64",
      node_version: "v22.22.1",
      file_counts: [200, 600, 1200],
    });
  });

  it("closes each size's file counts over its slice", () => {
    for (const size of SIZES) {
      expect(size.indexed + size.dropped).toEqual(size.file_count);
      expect(size.file_count).toBeLessThanOrEqual(
        RECORDED_EVICTION_INDEX_COST.discovered_files,
      );
    }
  });

  it("repeats both arms of every size, in one session, across two trees", () => {
    for (const size of SIZES) {
      expect(size.control.cpu_seconds.length).toBeGreaterThanOrEqual(2);
      expect(size.candidate.cpu_seconds.length).toEqual(
        size.control.cpu_seconds.length,
      );
      expect(size.control.ariadne_commit).not.toEqual(
        size.candidate.ariadne_commit,
      );
      expect(size.session_id).toMatch(/^\S+-\d+-\d{4}-\d{2}-\d{2}T/);
      for (const arm of [size.control, size.candidate]) {
        expect(arm.cpu_user_ms.length).toEqual(arm.cpu_seconds.length);
        expect(arm.cpu_per_wall.length).toEqual(arm.cpu_seconds.length);
        expect(arm.loadavg_at_start.length).toEqual(arm.cpu_seconds.length);
        expect(arm.peak_rss_mb.length).toEqual(arm.cpu_seconds.length);
      }
    }
  });

  it("states a speedup its own repetitions reproduce", () => {
    for (const size of SIZES) {
      const ratio = mean(size.control.cpu_seconds) / mean(size.candidate.cpu_seconds);
      expect(Math.round(ratio * 100) / 100).toEqual(size.speedup);
    }
  });

  it("leaves no scanned entry in any eviction, having counted billions before", () => {
    for (const size of SIZES) {
      expect(size.scanned_entries_after).toEqual(0);
      expect(size.scanned_entries_before).toBeGreaterThan(size.evicted_symbols);
    }
    expect(SIZES[SIZES.length - 1].scanned_entries_before).toBeGreaterThan(
      1_000_000_000,
    );
  });

  it("costs the same keyed operations per evicted symbol at every size", () => {
    const per_symbol = SIZES.map((size) => size.keyed_per_evicted_symbol_after);
    const lowest = Math.min(...per_symbol);
    const highest = Math.max(...per_symbol);
    expect((highest - lowest) / lowest).toBeLessThanOrEqual(0.25);

    for (const size of SIZES) {
      expect(
        Math.round((size.keyed_operations_after / size.evicted_symbols) * 100) /
          100,
      ).toEqual(size.keyed_per_evicted_symbol_after);
    }
  });

  it("carries the seven components and both diagnostics digests the arms agreed on", () => {
    for (const size of SIZES) {
      const components = Object.entries(size.fingerprint);
      expect(components).toHaveLength(7);
      for (const [, value] of components) {
        expect(value).toMatch(/^\d+\/[0-9a-f]{16}$/);
      }
      expect(size.fingerprint.dropped_files).toEqual(
        `${size.dropped}/${size.fingerprint.dropped_files.split("/")[1]}`,
      );
      for (const hash of size.diagnostics_hashes) {
        expect(hash).toMatch(/^[0-9a-f]{16}$/);
      }
    }
  });
});

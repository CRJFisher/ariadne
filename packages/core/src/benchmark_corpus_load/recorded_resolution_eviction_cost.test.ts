/**
 * The record is only worth keeping while it stays internally consistent:
 * provenance complete, file counts closing, its totals adding up from the edits
 * beside them, and the three claims it exists to carry — a cold load allocates
 * no clone, one edit to a hub used to clone the project once per affected file,
 * and the copy-on-write share a profile reports belongs to another caller —
 * still true of the numbers written down.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_RESOLUTION_EVICTION_COST } from "./recorded_resolution_eviction_cost";

const COLD_LOAD = RECORDED_RESOLUTION_EVICTION_COST.cold_load;
const INCREMENTAL = RECORDED_RESOLUTION_EVICTION_COST.incremental;

function total(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

describe("RECORDED_RESOLUTION_EVICTION_COST", () => {
  it("names its full provenance", () => {
    expect({
      corpus: RECORDED_RESOLUTION_EVICTION_COST.corpus,
      corpus_commit: RECORDED_RESOLUTION_EVICTION_COST.corpus_commit,
      predicate: RECORDED_RESOLUTION_EVICTION_COST.predicate,
      discovered_files: RECORDED_RESOLUTION_EVICTION_COST.discovered_files,
      machine: RECORDED_RESOLUTION_EVICTION_COST.machine,
      node_version: RECORDED_RESOLUTION_EVICTION_COST.node_version,
      cpu_count: RECORDED_RESOLUTION_EVICTION_COST.cpu_count,
      ingest_order: RECORDED_RESOLUTION_EVICTION_COST.ingest_order,
      base_commit: RECORDED_RESOLUTION_EVICTION_COST.base_commit,
      file_counts: COLD_LOAD.map((row) => row.file_count),
    }).toEqual({
      corpus: "microsoft/vscode",
      corpus_commit: "f3fa55c3",
      predicate: "src",
      discovered_files: 8494,
      machine: "Darwin 24.6.0 x64",
      node_version: "v22.22.1",
      cpu_count: 6,
      ingest_order: "forward",
      base_commit: "e20ecd23",
      file_counts: [200, 600, 1200],
    });
  });

  it("closes each size's file counts over its slice", () => {
    for (const row of COLD_LOAD) {
      expect(row.indexed + row.dropped).toEqual(row.file_count);
      expect(row.files_evicted).toEqual(row.file_count);
      expect(row.file_count).toBeLessThanOrEqual(
        RECORDED_RESOLUTION_EVICTION_COST.discovered_files,
      );
    }
  });

  it("evicts a cold load in one call per resolution pass plus one per drop", () => {
    for (const row of COLD_LOAD) {
      expect(row.eviction_calls.per_file).toEqual(row.file_count);
      expect(row.eviction_calls.batched).toEqual(row.dropped + 1);
      expect(row.identity_returns).toEqual(row.eviction_calls.batched);
    }
  });

  it("allocates no clone over a cold load, having allocated five per file", () => {
    for (const row of COLD_LOAD) {
      expect(row.cloned_entries.batched).toEqual(0);
      expect(row.clone_allocations.batched).toEqual(0);
      expect(row.clone_allocations.per_file).toEqual(row.file_count * 5);
    }
  });

  it("scans and clones the project once per edit, not once per affected file", () => {
    for (const edit of INCREMENTAL.edits) {
      // The per-file walk scans a state that shrinks as it goes, so its total
      // sits just under the affected count times one whole scan, and equals it
      // exactly when one file is affected.
      expect(edit.scanned_entries.per_file).toBeLessThanOrEqual(
        edit.scanned_entries.batched * edit.affected_files,
      );
      expect(edit.scanned_entries.per_file).toBeGreaterThanOrEqual(
        edit.scanned_entries.batched,
      );
      expect(edit.cloned_entries.batched).toBeLessThanOrEqual(
        edit.cloned_entries.per_file,
      );
    }

    const hub = INCREMENTAL.edits[0];
    expect(hub.affected_files).toBeGreaterThan(200);
    expect(hub.cloned_entries.per_file).toBeGreaterThan(28_000_000);
    expect(hub.cloned_entries.batched).toBeLessThan(200_000);
  });

  it("totals the edits it lists", () => {
    expect(INCREMENTAL.eviction_calls.batched).toEqual(INCREMENTAL.edits.length);
    expect(INCREMENTAL.eviction_calls.per_file).toEqual(
      total(INCREMENTAL.edits.map((edit) => edit.affected_files)),
    );
    expect(INCREMENTAL.total_scanned_entries.per_file).toEqual(
      total(INCREMENTAL.edits.map((edit) => edit.scanned_entries.per_file)),
    );
    expect(INCREMENTAL.total_cloned_entries.per_file).toEqual(
      total(INCREMENTAL.edits.map((edit) => edit.cloned_entries.per_file)),
    );
    expect(INCREMENTAL.total_scanned_entries.batched).toEqual(
      total(INCREMENTAL.edits.map((edit) => edit.scanned_entries.batched)),
    );
    expect(INCREMENTAL.total_cloned_entries.batched).toEqual(
      total(INCREMENTAL.edits.map((edit) => edit.cloned_entries.batched)),
    );
  });

  it("attributes the profiled copy-on-write share away from bulk load", () => {
    const attribution = RECORDED_RESOLUTION_EVICTION_COST.copy_on_write;
    expect(attribution.profiled_seconds).toBeGreaterThan(
      attribution.bulk_load_seconds * 5,
    );
    expect(attribution.applies_over_a_cold_load).toEqual(2);
    expect(attribution.apply_cloned_entries_over_a_cold_load).toEqual(0);
    expect(attribution.owner).toContain("TASK-381.8");
    expect(attribution.owner).toContain("TASK-381.7");
  });

  it("carries the seven components both shapes agreed on, at every size and after the edits", () => {
    const fingerprints = [
      ...COLD_LOAD.map((row) => row.fingerprint),
      INCREMENTAL.fingerprint,
    ];
    for (const fingerprint of fingerprints) {
      const components = Object.entries(fingerprint);
      expect(components).toHaveLength(7);
      for (const [, value] of components) {
        expect(value).toMatch(/^\d+\/[0-9a-f]{16}$/);
      }
    }

    for (const row of COLD_LOAD) {
      expect(row.fingerprint.dropped_files.split("/")[0]).toEqual(
        String(row.dropped),
      );
      for (const hash of row.diagnostics_hashes) {
        expect(hash).toMatch(/^[0-9a-f]{16}$/);
      }
    }
  });
});

/**
 * The record is only worth keeping while it stays internally consistent:
 * provenance complete, file counts closing, the slices nested, and the four
 * claims it exists to carry — the chain stores a fraction of the entries, it
 * exposes the identical visible name set, it costs nothing in CPU, and
 * interning was measured and refuted — still true of the numbers written down.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_NAME_TABLE_MEMORY } from "./recorded_name_table_memory";

const SLICES = RECORDED_NAME_TABLE_MEMORY.slices;
const INTERNING = RECORDED_NAME_TABLE_MEMORY.interning_ceiling;

describe("RECORDED_NAME_TABLE_MEMORY", () => {
  it("names its full provenance", () => {
    expect({
      corpus: RECORDED_NAME_TABLE_MEMORY.corpus,
      corpus_commit: RECORDED_NAME_TABLE_MEMORY.corpus_commit,
      predicate: RECORDED_NAME_TABLE_MEMORY.predicate,
      discovered_files: RECORDED_NAME_TABLE_MEMORY.discovered_files,
      machine: RECORDED_NAME_TABLE_MEMORY.machine,
      node_version: RECORDED_NAME_TABLE_MEMORY.node_version,
      cpu_count: RECORDED_NAME_TABLE_MEMORY.cpu_count,
      ingest_order: RECORDED_NAME_TABLE_MEMORY.ingest_order,
      base_commit: RECORDED_NAME_TABLE_MEMORY.base_commit,
      offered: SLICES.map((slice) => slice.offered_files),
    }).toEqual({
      corpus: "microsoft/vscode",
      corpus_commit: "f3fa55c3",
      predicate: "src",
      discovered_files: 8494,
      machine: "Darwin 24.6.0 x64",
      node_version: "v22.22.1",
      cpu_count: 6,
      ingest_order: "forward",
      base_commit: "bbbe3290",
      offered: [200, 400, 800],
    });
  });

  it("closes each slice's file counts and nests it inside the next", () => {
    for (const slice of SLICES) {
      expect(slice.indexed + slice.dropped).toEqual(slice.offered_files);
      expect(slice.offered_files).toBeLessThanOrEqual(
        RECORDED_NAME_TABLE_MEMORY.discovered_files,
      );
      expect(slice.reps_per_arm).toBeGreaterThanOrEqual(2);
    }
    for (let i = 1; i < SLICES.length; i += 1) {
      expect(SLICES[i].offered_files).toBeGreaterThan(
        SLICES[i - 1].offered_files,
      );
      expect(SLICES[i].scopes).toBeGreaterThan(SLICES[i - 1].scopes);
    }
  });

  it("stores each binding once, at the scope that binds it", () => {
    for (const slice of SLICES) {
      // The flattened shape stores every visible pair; the chain stores only
      // what each scope introduces.
      expect(slice.stored_entries.flattened).toEqual(
        slice.visible_scope_name_pairs,
      );
      expect(slice.stored_entries.chained).toBeLessThan(
        slice.stored_entries.flattened / 5,
      );
    }
  });

  it("gives a scope that binds nothing no link of its own", () => {
    for (const slice of SLICES) {
      expect(slice.chain_links).toBeLessThan(slice.scopes);
      expect(slice.mean_chain_depth).toBeGreaterThan(1);
      expect(slice.max_chain_depth).toBeGreaterThanOrEqual(
        Math.ceil(slice.mean_chain_depth),
      );
    }
  });

  it("frees an order of magnitude of the table at every slice", () => {
    for (const slice of SLICES) {
      const ratio =
        slice.name_table_kb_per_file.flattened /
        slice.name_table_kb_per_file.chained;
      expect(ratio).toBeGreaterThan(10);
      expect(slice.name_table_kb_per_file.chained).toBeLessThan(11);
      expect(slice.settled_heap_kb_per_file.chained).toBeLessThan(
        slice.settled_heap_kb_per_file.flattened,
      );
    }
  });

  it("costs nothing in CPU, in either direction", () => {
    for (const slice of SLICES) {
      const ratio = slice.cpu_total_ms.chained / slice.cpu_total_ms.flattened;
      expect(ratio).toBeGreaterThan(0.95);
      expect(ratio).toBeLessThan(1.05);
      // The arms have to be quiet enough for the ratio to mean anything.
      expect(slice.cpu_cv_percent.flattened).toBeLessThan(1);
      expect(slice.cpu_cv_percent.chained).toBeLessThan(1);
    }
  });

  it("carries the seven components both shapes agreed on, at every slice", () => {
    for (const slice of SLICES) {
      const components = Object.entries(slice.fingerprint);
      expect(components).toHaveLength(7);
      for (const [, value] of components) {
        expect(value).toMatch(/^\d+\/[0-9a-f]{16}$/);
      }
      expect(slice.fingerprint.dropped_files.split("/")[0]).toEqual(
        String(slice.dropped),
      );
    }
  });

  it("keeps interning refuted by the measurement that refuted it", () => {
    expect(INTERNING.measured_kb_per_file * 12).toBeLessThan(
      INTERNING.estimated_kb_per_file,
    );
    expect(INTERNING.slots_rewritten).toBeGreaterThan(1_000_000);
    // The parts summing above the whole is the noise signature the verdict cites.
    const by_class = Object.values(INTERNING.by_class_kb_per_file);
    expect(by_class.reduce((sum, value) => sum + value, 0)).toBeGreaterThan(
      INTERNING.measured_kb_per_file,
    );
    // The verdict names where path interning does pay, so a reader who arrives
    // here from the refutation lands on the measurement rather than re-deriving.
    expect(INTERNING.verdict).toContain("RECORDED_CACHE_RESUMPTION");
  });
});

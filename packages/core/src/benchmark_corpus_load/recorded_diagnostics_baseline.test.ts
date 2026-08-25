/**
 * The recorded baseline is only worth keeping while it stays internally
 * consistent: provenance complete, file counts closing, and the before/after
 * story actually told by the hashes it carries.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_DIAGNOSTICS_BASELINE } from "./recorded_diagnostics_baseline";

describe("RECORDED_DIAGNOSTICS_BASELINE", () => {
  it("names its full provenance", () => {
    expect({
      corpus: RECORDED_DIAGNOSTICS_BASELINE.corpus,
      corpus_commit: RECORDED_DIAGNOSTICS_BASELINE.corpus_commit,
      file_count: RECORDED_DIAGNOSTICS_BASELINE.file_count,
      orders: RECORDED_DIAGNOSTICS_BASELINE.orders_compared,
    }).toEqual({
      corpus: "microsoft/vscode",
      corpus_commit: "f3fa55c3",
      file_count: 200,
      orders: ["forward", "reversed", "seeded-shuffle"],
    });
    expect(RECORDED_DIAGNOSTICS_BASELINE.predicate).toContain("mulberry32 seed 1");
    expect(RECORDED_DIAGNOSTICS_BASELINE.ariadne_commit).toContain("12458246");
  });

  it("closes the file counts over the slice", () => {
    expect(
      RECORDED_DIAGNOSTICS_BASELINE.indexed + RECORDED_DIAGNOSTICS_BASELINE.dropped,
    ).toEqual(RECORDED_DIAGNOSTICS_BASELINE.file_count);
  });

  it("reports every raw entry point as a reported one", () => {
    // Extraction enriches the raw set one-to-one; a count drift between the
    // two would mean entries were lost between trace and report.
    expect(RECORDED_DIAGNOSTICS_BASELINE.recorded.reported_entry_points.count).toEqual(
      RECORDED_DIAGNOSTICS_BASELINE.recorded.raw_entry_points.count,
    );
  });

  it("keeps the recorded hashes in the probe's own 16-hex width", () => {
    const { recorded } = RECORDED_DIAGNOSTICS_BASELINE;
    const hashes = [
      recorded.raw_entry_points.hash,
      recorded.reported_entry_points.hash,
      recorded.nodes.hash,
      recorded.edges.hash,
      recorded.diagnostics_payload.diag,
      recorded.diagnostics_payload.canonical,
    ];
    for (const hash of hashes) {
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    }
    expect(new Set(hashes).size).toEqual(hashes.length);
  });

  it("records a distinct diag hash per order at both pre-repair stages", () => {
    // Three orders, three hashes, twice over — that spread is the recorded
    // demonstration that the three-orders-one-payload silence can fail, and
    // that sorting the file iteration alone did not close it.
    const { both_causes_present, file_iteration_sorted_only } =
      RECORDED_DIAGNOSTICS_BASELINE.diag_hashes_before_repair;
    expect(both_causes_present).toHaveLength(3);
    expect(file_iteration_sorted_only).toHaveLength(3);
    expect(new Set(both_causes_present).size).toEqual(3);
    expect(new Set(file_iteration_sorted_only).size).toEqual(3);
  });
});

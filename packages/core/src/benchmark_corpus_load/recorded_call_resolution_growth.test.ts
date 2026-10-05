/**
 * The record is only worth keeping while it stays internally consistent:
 * provenance complete, the arms genuinely interleaved, and the four claims it
 * exists to carry — the index changes the scan's shape, it buys nothing at cold
 * load, the growth that remains is polymorphic dispatch, and both builds report
 * one call graph — still true of the numbers written down.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_CALL_RESOLUTION_GROWTH } from "./recorded_call_resolution_growth";
import { RECORDED_ORDER_INDEPENDENCE } from "./recorded_order_independence";

const RECORD = RECORDED_CALL_RESOLUTION_GROWTH;
const ARMS = RECORD.arms;

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scan_of(
  build: "control" | "candidate",
  project_files: number,
): { callables_read: number; registry_entries_visited: number } {
  const edit = RECORD.incremental_edit.find(
    (row) => row.build === build && row.project_files === project_files,
  );
  if (!edit) throw new Error(`expected a ${build} edit at ${project_files} files`);
  return edit.scan;
}

describe("RECORDED_CALL_RESOLUTION_GROWTH", () => {
  it("names its full provenance", () => {
    expect({
      corpus: RECORD.corpus,
      corpus_commit: RECORD.corpus_commit,
      predicate: RECORD.predicate,
      discovered_files: RECORD.discovered_files,
      indexed_files: RECORD.indexed_files,
      dropped_files: RECORD.dropped_files,
      machine: RECORD.machine,
      node_version: RECORD.node_version,
      cpu_count: RECORD.cpu_count,
      total_memory_mb: RECORD.total_memory_mb,
      heap_cap_mb: RECORD.heap_cap_mb,
      ingest_order: RECORD.ingest_order,
      control_commit: RECORD.control_commit,
    }).toEqual({
      corpus: "microsoft/vscode",
      corpus_commit: "f3fa55c3",
      predicate: "src",
      discovered_files: 8494,
      indexed_files: 8494,
      dropped_files: 0,
      machine: "Darwin 24.6.0 x64",
      node_version: "v22.22.1",
      cpu_count: 6,
      total_memory_mb: 32768,
      heap_cap_mb: 12336,
      ingest_order: "forward",
      control_commit: "3da741d7",
    });
  });

  it("interleaves the arms it takes its difference from", () => {
    expect(ARMS.map((arm) => arm.arm)).toEqual([
      "control",
      "candidate",
      "control",
      "candidate",
      "control",
      "candidate",
      "control",
      "candidate",
    ]);
    const sequence = ARMS.map((arm) => arm.sequence_index);
    expect([...sequence].sort((a, b) => a - b)).toEqual(sequence);

    // The summarized spreads are the arms, not a second set of numbers.
    expect(
      ARMS.filter((arm) => arm.arm === "control").map((arm) => arm.term_cpu_ms),
    ).toEqual(RECORD.control_term.observations);
    expect(
      ARMS.filter((arm) => arm.arm === "candidate").map((arm) => arm.term_cpu_ms),
    ).toEqual(RECORD.candidate_term.observations);
  });

  it("reads the batch's callbacks instead of the project's callables", () => {
    // The criterion's own unit: one file per pass, with the project grown
    // around it. What the pass reads is a property of the file, not the project.
    const small = scan_of("candidate", 1200);
    const large = scan_of("candidate", 8494);
    expect(small.callables_read).toEqual(large.callables_read);
    expect(small.registry_entries_visited).toEqual(
      large.registry_entries_visited,
    );

    // The shape it replaces reads the whole project for the same one file.
    const control_small = scan_of("control", 1200);
    const control_large = scan_of("control", 8494);
    expect(control_large.callables_read / control_small.callables_read).
      toBeGreaterThan(7);
    expect(control_large.callables_read / large.callables_read).toBeGreaterThan(
      10000,
    );
  });

  it("costs the cold load nothing, and says so", () => {
    expect(mean(RECORD.control_term.observations)).toBeCloseTo(
      RECORD.control_term.mean,
      1,
    );
    expect(mean(RECORD.candidate_term.observations)).toBeCloseTo(
      RECORD.candidate_term.mean,
      1,
    );

    // The difference is smaller than either arm's own run-to-run spread, which
    // is what makes "no measurable change" the reading rather than a saving.
    const delta = Math.abs(RECORD.term_cpu_delta_ms);
    expect(delta).toBeLessThan(
      RECORD.control_term.mean * (RECORD.control_term.cv_percent / 100),
    );
    expect(Math.abs(RECORD.term_share_delta_percentage_points)).toBeLessThan(3);
    expect(RECORD.verdict).toContain("EXPLANATION at cold load");
  });

  it("names the growth it measured rather than leaving it open", () => {
    expect(RECORD.growth_curve.map((point) => point.files)).toEqual([
      927, 2000, 8494,
    ]);
    expect(RECORD.term_exponent_least_squares).toBeGreaterThan(1.1);

    const input = RECORD.mechanism_exponents.find((row) =>
      row.quantity.includes("input"),
    );
    const output = RECORD.mechanism_exponents.find((row) =>
      row.quantity.includes("output"),
    );
    const enumerated = RECORD.mechanism_exponents.find((row) =>
      row.quantity.includes("subtype edges"),
    );
    if (!input || !output || !enumerated) {
      throw new Error("expected the input, output and enumeration exponents");
    }
    // The input is linear and the answer is not: that is what makes the growth
    // the cost of a bigger result rather than a scan that could be indexed.
    expect(input.exponent).toBeLessThan(1.1);
    expect(output.exponent).toBeGreaterThan(input.exponent);
    expect(enumerated.exponent).toBeGreaterThan(output.exponent);

    // And the fan-out of one dispatch grows with the corpus.
    const fan_out = RECORD.dispatch_enumeration.map(
      (row) => row.edges_per_expansion,
    );
    expect(fan_out).toEqual([...fan_out].sort((left, right) => left - right));
    expect(fan_out[fan_out.length - 1]).toBeGreaterThan(3 * fan_out[0]);
  });

  it("states the scaling limit as sizes, against the ceiling that arrives first", () => {
    expect(RECORD.scaling_limit.length).toBeGreaterThanOrEqual(2);
    for (const limit of RECORD.scaling_limit) {
      expect(limit.exponent_used).toBeGreaterThan(1);
      expect(limit.reaches_10_percent_of_the_run_at_files).toBeGreaterThan(
        RECORD.discovered_files,
      );
      expect(limit.reaches_25_percent_of_the_run_at_files).toBeGreaterThan(
        limit.reaches_10_percent_of_the_run_at_files,
      );
      expect(limit.becomes_dominant_at_files).toBeGreaterThan(
        limit.reaches_25_percent_of_the_run_at_files,
      );
    }
    expect(RECORD.memory_wall).toContain("live");
  });

  it("keeps the polymorphic share of the term rising across the curve", () => {
    const control_splits = RECORD.term_split.filter(
      (split) => split.build === "control",
    );
    const shares = control_splits.map(
      (split) =>
        split.polymorphic_dispatch_ms / split.resolve_calls_for_files_ms,
    );
    expect(shares).toEqual([...shares].sort((left, right) => left - right));
    expect(shares[shares.length - 1]).toBeGreaterThan(3 * shares[0]);

    // Every nested figure is part of the term it sits inside, never beside it.
    for (const split of RECORD.term_split) {
      expect(split.resolve_calls_ms).toBeLessThan(
        split.resolve_calls_for_files_ms,
      );
      expect(split.resolve_callback_invocations_ms).toBeLessThan(
        split.resolve_calls_for_files_ms,
      );
      expect(split.polymorphic_dispatch_ms).toBeLessThan(
        split.resolve_method_call_ms,
      );
      expect(split.get_transitive_subtypes_ms).toBeLessThan(
        split.polymorphic_dispatch_ms,
      );
    }
  });

  it("reports one call graph at every size it was measured at", () => {
    expect(RECORD.identical_fingerprints.map((entry) => entry.files)).toEqual([
      200, 1200, 8494,
    ]);
    for (const entry of RECORD.identical_fingerprints) {
      const components = Object.entries(entry.components);
      expect(components).toHaveLength(7);
      for (const [, value] of components) {
        expect(value).toMatch(/^\d+\/[0-9a-f]{16}$/);
      }
      expect(entry.components.dropped_files).toEqual("0/e3b0c44298fc1c14");
      expect(entry.diag_hash).toMatch(/^[0-9a-f]{16}$/);
      expect(entry.canonical_hash).toMatch(/^[0-9a-f]{16}$/);
    }

    // The full-corpus one is the value already on record for this corpus in
    // this order, so the pair of builds is anchored rather than self-consistent.
    const full_corpus = RECORDED_ORDER_INDEPENDENCE.slices.find(
      (slice) => slice.offered_files === RECORD.discovered_files,
    );
    if (!full_corpus) throw new Error("expected a full-corpus slice on record");
    const forward = full_corpus.arms.find(
      (arm) => arm.ingest_order === RECORD.ingest_order,
    );
    if (!forward) throw new Error("expected a forward arm on record");
    const measured = RECORD.identical_fingerprints.find(
      (entry) => entry.files === RECORD.discovered_files,
    );
    if (!measured) throw new Error("expected a full-corpus fingerprint");
    expect(measured.components).toEqual(
      Object.fromEntries(
        Object.entries(forward.components).map(([component, digest]) => [
          component,
          `${digest.count}/${digest.hash}`,
        ]),
      ),
    );
    expect({
      diag_hash: measured.diag_hash,
      canonical_hash: measured.canonical_hash,
    }).toEqual({
      diag_hash: forward.diag_hash,
      canonical_hash: forward.canonical_hash,
    });
  });

  it("keeps the figures it replaces, with what replaced them", () => {
    expect(RECORD.superseded).toHaveLength(3);
    const pre_repair = RECORD.superseded[0];
    expect(pre_repair.claim).toContain("778 s");
    expect(pre_repair.outcome).toContain("SUPERSEDED");

    const target = RECORD.superseded[1];
    expect(target.claim).toContain("15 s");
    expect(target.outcome).toContain("NOT MET");
    expect(target.outcome).toContain(String(RECORD.term_exponent_least_squares));
  });
});

/**
 * The record is only worth keeping while it stays internally consistent:
 * provenance complete, the arms genuinely interleaved, and the four claims it
 * exists to carry — the descent answers what the scan answered, the batch is
 * worth the CPU it claims over the whole corpus, it moves nothing the pipeline
 * reports, and the one test it makes unwitnessable is named with its reason —
 * still true of the numbers written down.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_PER_FILE_REDERIVATION_COST } from "./recorded_per_file_rederivation_cost";
import { RECORDED_ORDER_INDEPENDENCE } from "./recorded_order_independence";

const RECORD = RECORDED_PER_FILE_REDERIVATION_COST;

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function arm_cpu(arm: "control" | "candidate"): number[] {
  return RECORD.corpus_arms
    .filter((row) => row.arm === arm)
    .map((row) => row.run_cpu_s);
}

describe("RECORDED_PER_FILE_REDERIVATION_COST", () => {
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
      ingest_order: RECORD.ingest_order,
      control_commit: RECORD.control_commit,
      candidate_commit: RECORD.candidate_commit,
      heap_ceiling_mb: RECORD.heap_ceiling_mb,
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
      ingest_order: "forward",
      control_commit: "65e9c387",
      candidate_commit: "cdad9682",
      heap_ceiling_mb: 15365,
    });
  });

  it("interleaves its corpus arms and its sample arms", () => {
    expect(RECORD.corpus_arms.map((arm) => arm.arm)).toEqual([
      "control",
      "candidate",
      "control",
      "candidate",
      "control",
      "candidate",
    ]);
    expect(RECORD.corpus_arms.map((arm) => arm.sequence_index)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    expect(RECORD.sample_arms.map((arm) => arm.arm)).toEqual([
      "control",
      "candidate",
      "control",
      "candidate",
      "control",
      "candidate",
      "control",
      "candidate",
    ]);
    // Two trees, so the ratio is a change and not the session's noise floor.
    expect(RECORD.control_commit).not.toEqual(RECORD.candidate_commit);
  });

  it("takes its corpus saving from arms that ran every discovered file", () => {
    for (const arm of RECORD.corpus_arms) {
      expect(arm.cpu_per_wall).toBeGreaterThan(0.9);
    }
    expect(RECORD.indexed_files).toEqual(RECORD.discovered_files);
    expect(RECORD.dropped_files).toEqual(0);

    expect(mean(arm_cpu("control"))).toBeCloseTo(RECORD.control_run_cpu_s.mean, 1);
    expect(mean(arm_cpu("candidate"))).toBeCloseTo(
      RECORD.candidate_run_cpu_s.mean,
      1,
    );

    const saving = RECORD.control_run_cpu_s.mean - RECORD.candidate_run_cpu_s.mean;
    expect(saving).toBeCloseTo(RECORD.corpus_saving_s, 1);
    // The criterion this row exists to answer.
    expect(saving).toBeGreaterThanOrEqual(25);
    expect((saving * 1000) / RECORD.discovered_files).toBeCloseTo(
      RECORD.corpus_saving_ms_per_file,
      2,
    );
    // Every observation of the slower arm is slower than every observation of
    // the faster one, so the gap does not rest on two means overlapping.
    expect(RECORD.control_run_cpu_s.min).toBeGreaterThan(
      RECORD.candidate_run_cpu_s.max,
    );
  });

  it("prices one file on a sample that carries the corpus's size distribution", () => {
    expect(RECORD.sample_files).toEqual(160);
    expect(
      Math.abs(1 - RECORD.sample_mean_bytes / RECORD.corpus_mean_bytes),
    ).toBeLessThan(0.05);

    expect(
      mean(
        RECORD.sample_arms
          .filter((arm) => arm.arm === "control")
          .map((arm) => arm.index_ms_per_file),
      ),
    ).toBeCloseTo(RECORD.control_index_ms_per_file.mean, 2);
    expect(
      mean(
        RECORD.sample_arms
          .filter((arm) => arm.arm === "candidate")
          .map((arm) => arm.index_ms_per_file),
      ),
    ).toBeCloseTo(RECORD.candidate_index_ms_per_file.mean, 2);

    const saving =
      RECORD.control_index_ms_per_file.mean - RECORD.candidate_index_ms_per_file.mean;
    expect(saving).toBeCloseTo(RECORD.sample_saving_ms_per_file, 2);
    expect(saving).toBeGreaterThanOrEqual(4);

    // The sample under-predicts the corpus here, which is the reason the
    // corpus arms exist and not a reason to trust the sample more.
    expect(RECORD.corpus_saving_ms_per_file).toBeGreaterThan(saving);
    expect(RECORD.warm_repeat_caution).toContain("ONCE");
  });

  it("reports each component against the figure it was written against", () => {
    expect(RECORD.components).toHaveLength(2);
    for (const component of RECORD.components) {
      expect(component.control - component.candidate).toBeCloseTo(
        component.saving,
        2,
      );
      expect(component.saving).toBeGreaterThan(0);
      expect(component.prototype).not.toEqual("");
    }
    const [descent, normalisation] = RECORD.components;
    expect(descent.unit).toEqual("ms/file");
    expect(normalisation.unit).toEqual("us/capture");
    // The two components in one unit, against what the sample measured end to
    // end. Priced separately with their inputs hot they over-state, which is
    // why the sample arm and not their sum is the per-file figure.
    const component_sum =
      descent.saving + (normalisation.saving * RECORD.captures_per_file) / 1000;
    expect(component_sum).toBeGreaterThan(RECORD.sample_saving_ms_per_file * 0.8);
    expect(component_sum).toBeLessThan(RECORD.sample_saving_ms_per_file * 1.2);
  });

  it("answers every lookup the scan answered, with no tie left to report", () => {
    const equivalence = RECORD.descent_equivalence;
    expect(equivalence.lookups).toBeGreaterThanOrEqual(100000);
    expect(equivalence.agreements).toEqual(equivalence.lookups);
    expect(equivalence.disagreements).toEqual(0);
    // What the removed throw reported. Zero over every lookup on record, which
    // is why removing it costs no coverage of real source.
    expect(equivalence.scan_ties).toEqual(0);
    expect(equivalence.get_scope_id_calls_per_file).toBeGreaterThan(1000);
  });

  it("names the deleted test and why the descent cannot witness it", () => {
    expect(RECORD.deleted_test.file).toEqual(
      "packages/core/src/index_single_file/scopes/scopes.test.ts",
    );
    expect(RECORD.deleted_test.name).toContain("multiple scopes at same depth");
    expect(RECORD.deleted_test.reason).toContain("child_ids");
    expect(RECORD.deleted_test.reason).toContain("NOT equivalent");
  });

  it("reports the same call graph at every size it was asked", () => {
    expect(RECORD.fingerprint_agreement.map((row) => row.offered_files)).toEqual([
      200, 1200, 8494,
    ]);
    for (const row of RECORD.fingerprint_agreement) {
      expect(row.identical).toEqual(true);
      expect(row.speedup).toBeGreaterThan(1);
      expect(row.candidate_cpu_s.mean).toBeLessThan(row.control_cpu_s.mean);
    }

    const components = Object.entries(RECORD.full_corpus_fingerprint);
    expect(components).toHaveLength(7);
    for (const [, value] of components) {
      expect(value).toMatch(/^\d+\/[0-9a-f]{16}$/);
    }
    expect(RECORD.full_corpus_fingerprint.dropped_files.split("/")[0]).toEqual(
      String(RECORD.dropped_files),
    );

    // And it is the value already on record for this corpus in this order, so
    // the agreement is anchored rather than merely self-consistent.
    const full_corpus = RECORDED_ORDER_INDEPENDENCE.slices.find(
      (slice) => slice.offered_files === RECORD.discovered_files,
    );
    if (!full_corpus) throw new Error("expected a full-corpus slice on record");
    const forward = full_corpus.arms.find(
      (arm) => arm.ingest_order === RECORD.ingest_order,
    );
    if (!forward) throw new Error("expected a forward arm on record");
    expect(RECORD.full_corpus_fingerprint).toEqual(
      Object.fromEntries(
        Object.entries(forward.components).map(([component, digest]) => [
          component,
          `${digest.count}/${digest.hash}`,
        ]),
      ),
    );
    expect({
      diag_hash: RECORD.diag_hash,
      canonical_hash: RECORD.canonical_hash,
    }).toEqual({
      diag_hash: forward.diag_hash,
      canonical_hash: forward.canonical_hash,
    });
  });

  it("keeps the parent-chain walk out of scope with the reading that excludes it", () => {
    const exclusion = RECORD.not_in_scope.find((entry) =>
      entry.what.includes("extract_construct_target"),
    );
    if (!exclusion) throw new Error("expected the parent-chain walk on record");
    expect(exclusion.measured).toContain("403");
    expect(exclusion.measured).toContain("7,322");
    expect(exclusion.reason).toContain("changes the answer");
  });

  it("says what kind of change it is before any number is quoted off it", () => {
    expect(RECORD.verdict).toContain("SPEEDUP");
    expect(RECORD.note).toContain("interleaved");
    expect(RECORD.note).toContain("tree-sitter 0.25.0");
  });
});

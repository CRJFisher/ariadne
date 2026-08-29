/**
 * The record is only worth keeping while it stays internally consistent:
 * provenance complete, the arms genuinely interleaved, the profiled family kept
 * apart from the unprofiled one, and the four claims it exists to carry — the
 * crossings fall, the binding self-time falls by the budgeted seconds, nothing
 * the pipeline reports moves, and the parser configuration is untouched — still
 * true of the numbers written down.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_TREE_SITTER_CROSSINGS } from "./recorded_tree_sitter_crossings";
import { RECORDED_ORDER_INDEPENDENCE } from "./recorded_order_independence";

const RECORD = RECORDED_TREE_SITTER_CROSSINGS;

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe("RECORDED_TREE_SITTER_CROSSINGS", () => {
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
      control_commit: "4be67581",
      candidate_commit: "87d94d30",
      heap_ceiling_mb: 15365,
    });
    // Two trees, so every ratio is a change and not the session's noise floor.
    expect(RECORD.control_commit).not.toEqual(RECORD.candidate_commit);
  });

  it("interleaves every family of arms it reports", () => {
    for (const arms of [
      RECORD.profiled_arms,
      RECORD.corpus_arms,
      RECORD.sample_arms,
    ]) {
      expect(arms.map((arm) => arm.arm)).toEqual(
        arms.map((_, index) => (index % 2 === 0 ? "control" : "candidate"))
      );
      expect(arms.map((arm) => arm.sequence_index)).toEqual(
        arms.map((_, index) => index)
      );
    }
  });

  it("counts the crossings it claims to have removed", () => {
    const control = RECORD.accessor_calls.reduce(
      (total, row) => total + row.control,
      0
    );
    const candidate = RECORD.accessor_calls.reduce(
      (total, row) => total + row.candidate,
      0
    );

    expect(control / RECORD.sample_files).toBeCloseTo(
      RECORD.crossings_per_file_control,
      1
    );
    expect(candidate / RECORD.sample_files).toBeCloseTo(
      RECORD.crossings_per_file_candidate,
      1
    );
    expect((1 - candidate / control) * 100).toBeCloseTo(
      RECORD.crossings_fall_percent,
      1
    );
    // The criterion this row exists to answer.
    expect(RECORD.crossings_fall_percent).toBeGreaterThanOrEqual(30);

    // `text` is a Node accessor the code reads but does not itself reach the
    // addon, so the fall is stated a second time without it.
    const addon = RECORD.accessor_calls.filter((row) => row.reaches_the_addon);
    const addon_control = addon.reduce((total, row) => total + row.control, 0);
    const addon_candidate = addon.reduce(
      (total, row) => total + row.candidate,
      0
    );
    expect((1 - addon_candidate / addon_control) * 100).toBeCloseTo(
      RECORD.addon_crossings_fall_percent,
      1
    );

    // The counting instrument is one file run against both trees, which is what
    // makes a difference between the two a difference in the trees.
    expect(RECORD.counting_instrument).toContain("BEFORE it imports");
  });

  it("takes its binding self-time saving from profiled whole-corpus arms", () => {
    for (const arm of ["control", "candidate"] as const) {
      const observed = RECORD.profiled_arms
        .filter((row) => row.arm === arm)
        .map((row) => row.binding_self_time_s);
      const recorded =
        arm === "control"
          ? RECORD.control_binding_self_time_s
          : RECORD.candidate_binding_self_time_s;
      expect(mean(observed)).toBeCloseTo(recorded.mean, 1);
      expect(recorded.observations).toEqual(observed);
      expect(observed.length).toBeGreaterThanOrEqual(2);
    }

    const saving =
      RECORD.control_binding_self_time_s.mean -
      RECORD.candidate_binding_self_time_s.mean;
    expect(saving).toBeCloseTo(RECORD.binding_self_time_saving_s, 1);
    // The criterion this row exists to answer.
    expect(saving).toBeGreaterThanOrEqual(60);
    // And it does not rest on two means overlapping: the worst pairing clears
    // the budget too.
    expect(
      RECORD.control_binding_self_time_s.min -
        RECORD.candidate_binding_self_time_s.max
    ).toBeGreaterThanOrEqual(60);

    // The share is recorded on both arms and asserted on neither, because
    // TASK-381.8 moved the denominator.
    expect(RECORD.control_binding_share_percent).toBeGreaterThan(
      RECORD.candidate_binding_share_percent
    );

    // A profiled arm is never a comparand for an unprofiled one.
    const profiled_control = mean(
      RECORD.profiled_arms
        .filter((row) => row.arm === "control")
        .map((row) => row.run_cpu_s)
    );
    expect(profiled_control).toBeGreaterThan(RECORD.control_run_cpu_s.mean);
    expect(RECORD.note).toContain("NOT comparands");
  });

  it("accounts for the saving frame by frame", () => {
    const control = RECORD.binding_frames.reduce(
      (total, frame) => total + frame.control_s,
      0
    );
    const candidate = RECORD.binding_frames.reduce(
      (total, frame) => total + frame.candidate_s,
      0
    );
    // The listed frames are the movers, not every frame, so they account for
    // most of each arm rather than all of it.
    expect(control).toBeGreaterThan(
      RECORD.control_binding_self_time_s.observations[0] * 0.95
    );
    expect(candidate).toBeGreaterThan(
      RECORD.candidate_binding_self_time_s.observations[0] * 0.95
    );

    const type_read = RECORD.binding_frames.find(
      (frame) => frame.frame === "get type"
    );
    if (!type_read) throw new Error("expected the type accessor on record");
    expect(type_read.candidate_s).toEqual(0);
    expect(type_read.control_s).toBeGreaterThan(40);
  });

  it("takes its corpus saving from arms that ran every discovered file", () => {
    for (const arm of RECORD.corpus_arms) {
      expect(arm.cpu_per_wall).toBeGreaterThan(0.9);
    }
    expect(RECORD.indexed_files).toEqual(RECORD.discovered_files);
    expect(RECORD.dropped_files).toEqual(0);

    const saving =
      RECORD.control_run_cpu_s.mean - RECORD.candidate_run_cpu_s.mean;
    expect(saving).toBeCloseTo(RECORD.corpus_saving_s, 1);
    expect((saving * 1000) / RECORD.discovered_files).toBeCloseTo(
      RECORD.corpus_saving_ms_per_file,
      2
    );
    expect(RECORD.control_run_cpu_s.min).toBeGreaterThan(
      RECORD.candidate_run_cpu_s.max
    );
  });

  it("prices one file on a sample that carries the corpus's size distribution", () => {
    expect(RECORD.sample_files).toEqual(200);
    expect(
      Math.abs(1 - RECORD.sample_mean_bytes / RECORD.corpus_mean_bytes)
    ).toBeLessThan(0.06);

    const saving =
      RECORD.control_index_ms_per_file.mean -
      RECORD.candidate_index_ms_per_file.mean;
    expect(saving).toBeCloseTo(RECORD.sample_saving_ms_per_file, 2);
    // The sample under-predicts the corpus, which is the reason the corpus arms
    // exist and not a reason to trust the sample more.
    expect(RECORD.corpus_saving_ms_per_file).toBeGreaterThan(saving);
  });

  it("reports the same call graph at every size it was asked", () => {
    expect(
      RECORD.fingerprint_agreement.map((row) => row.offered_files)
    ).toEqual([200, 1200, 8494]);
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

    // And it is the value already on record for this corpus in this order, so
    // the agreement is anchored rather than merely self-consistent.
    const full_corpus = RECORDED_ORDER_INDEPENDENCE.slices.find(
      (slice) => slice.offered_files === RECORD.discovered_files
    );
    if (!full_corpus) throw new Error("expected a full-corpus slice on record");
    const forward = full_corpus.arms.find(
      (arm) => arm.ingest_order === RECORD.ingest_order
    );
    if (!forward) throw new Error("expected a forward arm on record");
    expect(RECORD.full_corpus_fingerprint).toEqual(
      Object.fromEntries(
        Object.entries(forward.components).map(([component, digest]) => [
          component,
          `${digest.count}/${digest.hash}`,
        ])
      )
    );
    expect({
      diag_hash: RECORD.diag_hash,
      canonical_hash: RECORD.canonical_hash,
    }).toEqual({
      diag_hash: forward.diag_hash,
      canonical_hash: forward.canonical_hash,
    });
  });

  it("leaves parser configuration where it found it", () => {
    const compilation = RECORD.query_compilation;
    // One Query per dialect per process, and one `captures` call per file.
    expect(compilation.compilations).toEqual(compilation.dialects.length);
    expect(compilation.captures_calls_per_file).toEqual(1);
    expect(compilation.parser_buffer_sizing).toContain("Untouched");
  });

  it("licenses each substitution with the oracle that was run over it", () => {
    expect(RECORD.type_name_equivalence).toContain("601,005 agreements");
    expect(RECORD.type_name_equivalence).toContain("zero disagreements");
    // Pinning per class rather than per type id is the near-miss, and it is
    // recorded as refuted rather than left for someone to re-propose.
    expect(RECORD.type_name_equivalence).toContain("NOT equivalent");
    expect(RECORD.capture_text_equivalence).toContain("212,870 agreements");
    expect(RECORD.capture_text_equivalence).toContain("zero disagreements");
  });

  it("says what kind of change it is before any number is quoted off it", () => {
    expect(RECORD.verdict).toContain("SPEEDUP");
    expect(RECORD.note).toContain("interleaved");
    expect(RECORD.note).toContain("tree-sitter 0.25.0");
    expect(RECORD.not_in_scope.length).toBeGreaterThanOrEqual(3);
    for (const exclusion of RECORD.not_in_scope) {
      expect(exclusion.measured).not.toEqual("");
      expect(exclusion.reason).not.toEqual("");
    }
  });
});

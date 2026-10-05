/**
 * The record is only worth keeping while it stays internally consistent: its
 * provenance complete, its file counts closing over the corpus, its summarized
 * spreads recomputable from the observations beside them, and the three claims
 * it exists to carry — nothing lost, every removed candidate accounted for at
 * the resolution level, and every residual named with its cause — still true of
 * the numbers written down.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_EXPORT_DECLARATION_SPACE } from "./recorded_export_declaration_space";

const RECORD = RECORDED_EXPORT_DECLARATION_SPACE;
const CONTROL = RECORD.arms[0];
const CANDIDATE = RECORD.arms[1];
const ACCOUNTING = RECORD.entry_point_accounting;

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe("RECORDED_EXPORT_DECLARATION_SPACE", () => {
  it("names its full provenance", () => {
    expect({
      corpus: RECORD.corpus,
      corpus_commit: RECORD.corpus_commit,
      predicate: RECORD.predicate,
      discovered_files: RECORD.discovered_files,
      machine: RECORD.machine,
      node_version: RECORD.node_version,
      cpu_count: RECORD.cpu_count,
      heap_cap_mb: RECORD.heap_cap_mb,
      ingest_order: RECORD.ingest_order,
      control_commit: RECORD.control_commit,
      arms: RECORD.arms.map((arm) => arm.arm),
    }).toEqual({
      corpus: "microsoft/vscode",
      corpus_commit: "f3fa55c3",
      predicate: "src",
      discovered_files: 8494,
      machine: "Darwin 24.6.0 x64",
      node_version: "v22.22.1",
      cpu_count: 6,
      heap_cap_mb: 12336,
      ingest_order: "forward",
      control_commit: "73cc6ab0",
      arms: ["control", "candidate"],
    });
  });

  it("takes both arms from one session, so the ratio between them is admissible", () => {
    expect(RECORD.session_id).toEqual("task-381.8");
    expect(RECORD.arms.map((arm) => arm.sequence_indices)).toEqual([
      [0, 2],
      [1, 3],
    ]);
  });

  it("closes every arm's file counts over the corpus", () => {
    for (const arm of RECORD.arms) {
      expect({
        offered: arm.offered,
        sum: arm.indexed + arm.dropped,
        contents: arm.file_contents_size,
      }).toEqual({
        offered: RECORD.discovered_files,
        sum: RECORD.discovered_files,
        contents: arm.indexed,
      });
    }
  });

  it("reports the corpus fully indexed with no drop and no rollback", () => {
    expect({
      indexed: CANDIDATE.indexed,
      dropped: CANDIDATE.dropped,
      remove_file_calls: CANDIDATE.remove_file_calls,
      file_contents_size: CANDIDATE.file_contents_size,
      taxonomy: RECORD.drop_taxonomy_candidate,
    }).toEqual({
      indexed: 8494,
      dropped: 0,
      remove_file_calls: 0,
      file_contents_size: 8494,
      taxonomy: {},
    });
  });

  it("records the control arm's 676 drops as one defect rather than 676", () => {
    expect(RECORD.drop_taxonomy_control).toEqual({
      "Duplicate export name \"…\" in file <path>": 676,
    });
    expect(
      Object.values(RECORD.drop_taxonomy_control).reduce((a, b) => a + b, 0),
    ).toEqual(CONTROL.dropped);
  });

  it("counts zero rollbacks on the control arm too, so the CPU claim cannot rest on one", () => {
    expect(CONTROL.remove_file_calls).toEqual(0);
  });

  it("summarizes each arm's observations consistently with the spreads beside them", () => {
    for (const arm of RECORD.arms) {
      for (const spread of [arm.cpu_seconds, arm.peak_rss_mb]) {
        expect(spread.observations.length).toBeGreaterThanOrEqual(2);
        expect(spread.mean).toBeCloseTo(mean(spread.observations), 1);
        // The harness reports the summary to two decimal places and the
        // observations verbatim, so the two agree only after rounding.
        expect(spread.min).toBeCloseTo(Math.min(...spread.observations), 1);
        expect(spread.max).toBeCloseTo(Math.max(...spread.observations), 1);
      }
      expect(arm.cpu_per_wall.length).toEqual(arm.sequence_indices.length);
      expect(arm.loadavg_at_arm_start.length).toEqual(
        arm.sequence_indices.length,
      );
    }
  });

  it("states the CPU ratio the two arms' means actually give", () => {
    expect(
      Number((CONTROL.cpu_seconds.mean / CANDIDATE.cpu_seconds.mean).toFixed(2)),
    ).toEqual(RECORD.cpu_ratio);
  });

  it("loses nothing: the node set difference is zero and the count only rises", () => {
    const nodes = RECORD.fingerprint_moves.find((m) => m.component === "nodes");
    expect(RECORD.nodes_lost).toEqual(0);
    expect(nodes).toEqual({
      component: "nodes",
      control_count: 184957,
      candidate_count: 201595,
      only_control: 0,
      only_candidate: 16638,
    });
  });

  it("moves each fingerprint component consistently with the counts it records", () => {
    for (const move of RECORD.fingerprint_moves) {
      const control = CONTROL.fingerprint[move.component];
      const candidate = CANDIDATE.fingerprint[move.component];
      expect(control.split("/")[0]).toEqual(String(move.control_count));
      expect(candidate.split("/")[0]).toEqual(String(move.candidate_count));
      expect(
        move.control_count - move.only_control + move.only_candidate,
      ).toEqual(move.candidate_count);
    }
    expect(RECORD.fingerprint_moves.map((m) => m.component)).toEqual(
      Object.keys(CONTROL.fingerprint),
    );
  });

  it("accounts for every removed raw candidate without a residue", () => {
    expect(
      ACCOUNTING.removed_in_candidate_called_set +
        ACCOUNTING.removed_that_lost_their_node +
        ACCOUNTING.removed_unexplained,
    ).toEqual(ACCOUNTING.removed);
    expect({
      lost_node: ACCOUNTING.removed_that_lost_their_node,
      unexplained: ACCOUNTING.removed_unexplained,
    }).toEqual({ lost_node: 0, unexplained: 0 });
    expect(
      ACCOUNTING.raw_candidates_control -
        ACCOUNTING.removed +
        ACCOUNTING.added,
    ).toEqual(ACCOUNTING.raw_candidates_candidate);
  });

  it("puts all but 14 added candidates inside the readmitted files", () => {
    expect(
      ACCOUNTING.added_inside_readmitted_files +
        ACCOUNTING.added_outside_readmitted_files,
    ).toEqual(ACCOUNTING.added);
    expect(ACCOUNTING.added_outside_readmitted_files).toEqual(14);
  });

  it("names every residual outside the readmitted files with its cause", () => {
    const by_cause = new Map<string, number>();
    for (const residual of RECORD.residual_outside_readmitted_files) {
      by_cause.set(residual.cause, (by_cause.get(residual.cause) ?? 0) + 1);
      // A classifier decision is a candidate in BOTH arms; a retarget is one
      // that the candidate arm alone stopped resolving a caller for.
      expect(residual.raw_candidate_in_candidate).toBe(true);
      expect(residual.raw_candidate_in_control).toBe(
        residual.cause === "classifier decision",
      );
    }
    expect(Object.fromEntries(by_cause)).toEqual({
      "classifier decision": 3,
      "call site retargeted": 14,
    });
  });

  it("keeps the three reverse sites the residual is named for", () => {
    expect(
      RECORD.residual_outside_readmitted_files
        .filter((r) => r.cause === "classifier decision")
        .map((r) => r.site),
    ).toEqual([
      "src/vs/editor/common/core/ranges/rangeMapping.ts:51:reverse",
      "src/vs/workbench/contrib/mergeEditor/browser/model/mapping.ts:74:reverse",
      "src/vs/workbench/contrib/mergeEditor/browser/model/mapping.ts:327:reverse",
    ]);
  });

  it("records guards that were shown to fail before the repair", () => {
    expect(RECORD.guards).toEqual({
      new_export_guards: 11,
      failing_on_the_pre_repair_tree: 11,
    });
  });

  it("keeps every refuted claim rather than dropping it", () => {
    expect(RECORD.superseded.length).toEqual(4);
    for (const entry of RECORD.superseded) {
      expect(entry.claim.length).toBeGreaterThan(0);
      expect(entry.reason.length).toBeGreaterThan(0);
      expect(entry.outcome.length).toBeGreaterThan(0);
    }
  });
});

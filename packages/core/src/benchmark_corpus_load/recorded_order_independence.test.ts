/**
 * The record is worth keeping only while it stays internally consistent: its
 * provenance complete, its file counts closing over the corpus, and the four
 * claims it exists to carry still true of the numbers written down — the orders
 * agree, the probe moved before the change, the converged answer is a strict
 * improvement, and the cost came from one session.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_ORDER_INDEPENDENCE } from "./recorded_order_independence";

const RECORD = RECORDED_ORDER_INDEPENDENCE;
const FULL_CORPUS = RECORD.slices[0];
const SLICE_1200 = RECORD.slices[1];

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe("RECORDED_ORDER_INDEPENDENCE", () => {
  it("names its full provenance", () => {
    expect({
      corpus: RECORD.corpus,
      corpus_commit: RECORD.corpus_commit,
      predicate: RECORD.predicate,
      discovered_files: RECORD.discovered_files,
      machine: RECORD.machine,
      node_version: RECORD.node_version,
      cpu_count: RECORD.cpu_count,
      tree_sitter_version: RECORD.tree_sitter_version,
      session_id: RECORD.session_id,
      control_commit: RECORD.control_commit,
    }).toEqual({
      corpus: "microsoft/vscode",
      corpus_commit: "f3fa55c3",
      predicate: "src",
      discovered_files: 8494,
      machine: "Darwin 24.6.0 x64",
      node_version: "v22.22.1",
      cpu_count: 6,
      tree_sitter_version: "0.25.0",
      session_id: "task-381.11",
      control_commit: "7a7d99b0",
    });
  });

  it("offers every discovered file at the full-corpus slice and loses none", () => {
    expect({
      offered: FULL_CORPUS.offered_files,
      indexed: FULL_CORPUS.indexed,
      dropped: FULL_CORPUS.dropped,
    }).toEqual({ offered: 8494, indexed: 8494, dropped: 0 });
    expect(FULL_CORPUS.offered_files).toEqual(RECORD.discovered_files);
    expect(SLICE_1200.indexed + SLICE_1200.dropped).toEqual(
      SLICE_1200.offered_files,
    );
  });

  it("reproduces the smaller slice under a second shuffle seed", () => {
    // One seed says a shuffle agrees; a second says the first shuffle was not
    // the one permutation that happened to.
    expect(SLICE_1200.seed).toEqual(7);
    expect(SLICE_1200.seeds_also_reproduced).toEqual([13]);
  });

  it("carries four orders per slice, each agreeing on all seven components", () => {
    for (const slice of RECORD.slices) {
      expect(slice.orders_compared).toEqual([
        "forward",
        "reversed",
        "descending_size",
        "shuffled",
      ]);
      expect(slice.arms.map((arm) => arm.ingest_order)).toEqual([
        ...slice.orders_compared,
      ]);
      expect(Object.keys(slice.agreed_components)).toEqual([
        "nodes",
        "call_edges",
        "unresolved_calls",
        "raw_entry_points",
        "indirect_reachability_keys",
        "dropped_files",
        "indirect_reachability_evidence",
      ]);
      for (const arm of slice.arms) {
        expect(arm.components).toEqual(slice.agreed_components);
        expect(arm.canonical_hash).toEqual(slice.agreed_canonical_hash);
      }
    }
  });

  it("keeps the diagnostics ordering residue visible rather than rounded away", () => {
    // Four distinct diag hashes under one canonical hash is the whole finding:
    // the payload's membership is a function of the corpus, its emission order
    // is not. Collapsing to one number would hide which half is settled.
    for (const slice of RECORD.slices) {
      const diag = Object.values(slice.diag_hashes_by_order);
      expect(diag.length).toEqual(4);
      expect(new Set(diag).size).toEqual(4);
      expect(slice.arms.map((arm) => arm.diag_hash)).toEqual(diag);
    }
  });

  it("shows the probe moving on the tree this change was made on", () => {
    for (const probe of RECORD.non_vacuity) {
      expect(probe.ariadne_commit).toEqual(RECORD.control_commit);
      expect(probe.entry_points_only_in_first).toBeGreaterThan(0);

      const moved_and_held = [
        ...probe.components_that_moved,
        ...probe.components_that_held,
      ];
      expect(moved_and_held.length).toEqual(7);
      expect(probe.components_that_held).toEqual([
        "nodes",
        "indirect_reachability_keys",
        "dropped_files",
      ]);

      // A component listed as moved has to differ between the arms, and a
      // component listed as held has to be identical, or the list is decoration.
      const [first, ...rest] = probe.arms;
      for (const other of rest) {
        for (const held of probe.components_that_held) {
          expect(other.components[held]).toEqual(first.components[held]);
        }
      }
      for (const moved of probe.components_that_moved) {
        const hashes = probe.arms.map((arm) => arm.components[moved].hash);
        expect(new Set(hashes).size).toBeGreaterThan(1);
      }
    }
  });

  it("reports the same node set the probe held still, in the same numbers", () => {
    const nodes = RECORD.strict_improvement.find(
      (row) => row.component === "nodes",
    );
    expect(nodes).toEqual({
      component: "nodes",
      before: 201595,
      after: 201595,
      only_before: 0,
      only_after: 0,
    });
    expect(nodes?.after).toEqual(FULL_CORPUS.agreed_components.nodes.count);
  });

  it("states a strict improvement rather than a different answer", () => {
    const by_component = new Map(
      RECORD.strict_improvement.map((row) => [row.component, row]),
    );

    // Entry points and unresolved call sites only leave; edges and reachable
    // functions only arrive. One direction empty in every row IS the claim.
    for (const component of ["raw_entry_points", "unresolved_calls"]) {
      expect(by_component.get(component)?.only_after).toEqual(0);
      expect(by_component.get(component)?.only_before).toBeGreaterThan(0);
    }
    for (const component of ["call_edges", "indirect_reachability_keys"]) {
      expect(by_component.get(component)?.only_before).toEqual(0);
      expect(by_component.get(component)?.only_after).toBeGreaterThan(0);
    }

    expect(RECORD.entry_points_removed).toEqual(
      by_component.get("raw_entry_points")?.only_before,
    );
    expect(RECORD.entry_points_added).toEqual(0);
    expect(RECORD.indirect_reachability_gained.length).toEqual(
      by_component.get("indirect_reachability_keys")?.only_after,
    );
    expect(RECORD.resolved_call_sites.after).toBeGreaterThan(
      RECORD.resolved_call_sites.before,
    );

    // Each component's "after" count is the count the four orders agreed on, so
    // the improvement is stated over the converged answer and not over one arm.
    for (const [component, row] of by_component) {
      expect(row.after).toEqual(
        FULL_CORPUS.agreed_components[component].count,
      );
    }
  });

  it("names a call site for each spot-verified removal", () => {
    expect(RECORD.spot_verified_removals.length).toBeGreaterThanOrEqual(4);
    for (const removal of RECORD.spot_verified_removals) {
      expect(removal.entry_point).toMatch(/^method:src\//);
      expect(removal.called_from).toMatch(/^(function|method):src\//);
      expect(removal.source_call_site.length).toBeGreaterThan(0);
    }
  });

  it("takes both cost arms from one interleaved session", () => {
    const [before, after] = RECORD.cost;
    expect(before.sequence_indices).toEqual([0, 2]);
    expect(after.sequence_indices).toEqual([1, 3]);
    expect(before.cpu_seconds.length).toBeGreaterThanOrEqual(2);
    expect(after.cpu_seconds.length).toBeGreaterThanOrEqual(2);

    const ratio = mean(after.cpu_seconds) / mean(before.cpu_seconds);
    expect(Number(ratio.toFixed(3))).toEqual(RECORD.cost_ratio);
  });

  it("accounts for every call site that stops failing at receiver_type_unknown", () => {
    const { before, after } = RECORD.failure_taxonomy;
    const freed =
      before.by_reason.receiver_type_unknown -
      after.by_reason.receiver_type_unknown;
    expect(freed).toEqual(4941);

    // Every freed call site is accounted for, and so is the reference-count
    // difference between the two arms: leaving that 9 out would let the two
    // sides look balanced while the corpus grew underneath them.
    const newly_resolved = after.resolved - before.resolved;
    const moved_to_member_lookup =
      after.by_reason.method_not_on_type -
      before.by_reason.method_not_on_type +
      (after.by_reason.member_type_unknown - before.by_reason.member_type_unknown);
    const added_references = after.call_references - before.call_references;
    expect(added_references).toEqual(9);
    expect(newly_resolved + moved_to_member_lookup).toEqual(
      freed + added_references,
    );

    // The taxonomies close over their own reference totals in both arms.
    for (const arm of [before, after]) {
      const unresolved = Object.values(arm.by_reason).reduce(
        (sum, count) => sum + count,
        0,
      );
      expect(arm.resolved + unresolved).toEqual(arm.call_references);
    }
    expect(before.call_references - before.resolved).toEqual(
      RECORD.strict_improvement.find((r) => r.component === "unresolved_calls")
        ?.before,
    );
    expect(after.call_references - after.resolved).toEqual(
      RECORD.strict_improvement.find((r) => r.component === "unresolved_calls")
        ?.after,
    );
  });

  it("keeps every superseded claim with the reason it was replaced", () => {
    expect(RECORD.superseded.length).toEqual(4);
    for (const entry of RECORD.superseded) {
      expect(entry.claim.length).toBeGreaterThan(0);
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });
});

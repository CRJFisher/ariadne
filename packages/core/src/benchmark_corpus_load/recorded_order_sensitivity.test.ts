/**
 * The recorded order-dependence is a constant: the tree that produced it no
 * longer exists, so it cannot be recomputed. What CAN be checked is its
 * internal consistency — the only failure mode a transcribed constant has is a
 * typo.
 */

import { describe, expect, it } from "vitest";
import { FINGERPRINT_COMPONENT_NAMES } from "./call_graph_fingerprint";
import { RECORDED_ORDER_SENSITIVITY } from "./recorded_order_sensitivity";

describe("RECORDED_ORDER_SENSITIVITY", () => {
  it("names the tree, corpus and file set the observation came from", () => {
    expect({
      ariadne_tree: RECORDED_ORDER_SENSITIVITY.ariadne_tree,
      corpus: RECORDED_ORDER_SENSITIVITY.corpus,
      corpus_commit: RECORDED_ORDER_SENSITIVITY.corpus_commit,
      predicate: RECORDED_ORDER_SENSITIVITY.predicate,
      file_count: RECORDED_ORDER_SENSITIVITY.file_count,
    }).toEqual({
      ariadne_tree:
        "a tree whose polymorphic expansion depended on the order files arrived in",
      corpus: "microsoft/vscode",
      corpus_commit: "f3fa55c3",
      predicate: "src",
      file_count: 8494,
    });
  });

  it("counts more entry points moving than the totals net out to", () => {
    // `entry_points_moved` counts membership changes in both directions; the
    // net change in the total is smaller whenever some functions entered the
    // set while others left. Here 26 left and 5 entered: net 21, moved 31.
    const net_change =
      RECORDED_ORDER_SENSITIVITY.entry_points_forward -
      RECORDED_ORDER_SENSITIVITY.entry_points_descending_size;
    expect(net_change).toEqual(21);
    expect(RECORDED_ORDER_SENSITIVITY.entry_points_moved).toEqual(31);

    // moved = left + entered and net = left - entered, so their difference is
    // twice the smaller direction and must be even and non-negative. A typo in
    // any of the three numbers breaks this.
    const both_directions =
      RECORDED_ORDER_SENSITIVITY.entry_points_moved - Math.abs(net_change);
    expect(both_directions % 2).toEqual(0);
    expect(both_directions).toEqual(10);
  });

  it("marks a hash as changed exactly when its two values differ", () => {
    for (const [name, pair] of Object.entries(
      RECORDED_ORDER_SENSITIVITY.recorded_hashes,
    )) {
      expect({ name, changed: pair.changed }).toEqual({
        name,
        changed: pair.forward !== pair.descending_size,
      });
    }
  });

  it("records four hashes moving while the node hash holds still", () => {
    // That is what an order dependence looks like from outside: the set of
    // functions is unchanged, and what the graph says about them is not.
    const changed = Object.entries(RECORDED_ORDER_SENSITIVITY.recorded_hashes)
      .filter(([, pair]) => pair.changed)
      .map(([name]) => name);
    expect(changed.sort()).toEqual([
      "call_references",
      "entry_points",
      "indirect_reachability",
      "resolved_edges",
    ]);
    expect(RECORDED_ORDER_SENSITIVITY.recorded_hashes.nodes.changed).toEqual(false);
  });

  it("keeps the five names of the fingerprint that recorded it, not today's seven", () => {
    // The values came from SHA-1 over `join("|")` against a five-component
    // fingerprint, so they are a record of one run rather than a value to
    // compare a current digest with. `nodes` is the one name the two sets
    // share, and even there the two hashes are of different things.
    const recorded = Object.keys(RECORDED_ORDER_SENSITIVITY.recorded_hashes);
    expect(recorded.sort()).toEqual([
      "call_references",
      "entry_points",
      "indirect_reachability",
      "nodes",
      "resolved_edges",
    ]);
    expect(
      recorded.filter((name) =>
        (FINGERPRINT_COMPONENT_NAMES as readonly string[]).includes(name),
      ),
    ).toEqual(["nodes"]);
  });
});

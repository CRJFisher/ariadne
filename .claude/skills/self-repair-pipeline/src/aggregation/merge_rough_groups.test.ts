import { describe, it, expect } from "vitest";
import { merge_rough_groups } from "./merge_rough_groups.js";
import type { Pass1Output } from "./types.js";

describe("merge_rough_groups", () => {
  it("returns empty when no slices produced groups or ungrouped entries", () => {
    const slice: Pass1Output = { slice_id: 0, groups: [], ungrouped_indices: [] };
    expect(merge_rough_groups([slice])).toEqual([]);
  });

  it("unions entries across slices that share a group_id", () => {
    const a: Pass1Output = {
      slice_id: 0,
      groups: [{ group_id: "g1", root_cause: "cause", entry_indices: [1, 2] }],
      ungrouped_indices: [],
    };
    const b: Pass1Output = {
      slice_id: 1,
      groups: [{ group_id: "g1", root_cause: "cause", entry_indices: [3] }],
      ungrouped_indices: [],
    };
    expect(merge_rough_groups([a, b])).toEqual([
      {
        group_id: "g1",
        root_cause: "cause",
        entry_indices: [1, 2, 3],
        source_group_ids: ["g1"],
      },
    ]);
  });

  it("collects ungrouped entries from every slice into a single residual-ungrouped group", () => {
    const a: Pass1Output = { slice_id: 0, groups: [], ungrouped_indices: [7, 8] };
    const b: Pass1Output = { slice_id: 1, groups: [], ungrouped_indices: [9] };
    expect(merge_rough_groups([a, b])).toEqual([
      {
        group_id: "residual-ungrouped",
        root_cause: "Entries that could not be grouped by any rough-aggregator",
        entry_indices: [7, 8, 9],
        source_group_ids: ["residual-ungrouped"],
      },
    ]);
  });

  it("keeps the root_cause from the first slice that introduces a group_id", () => {
    const a: Pass1Output = {
      slice_id: 0,
      groups: [{ group_id: "g1", root_cause: "first", entry_indices: [1] }],
      ungrouped_indices: [],
    };
    const b: Pass1Output = {
      slice_id: 1,
      groups: [{ group_id: "g1", root_cause: "second", entry_indices: [2] }],
      ungrouped_indices: [],
    };
    expect(merge_rough_groups([a, b])[0].root_cause).toEqual("first");
  });
});

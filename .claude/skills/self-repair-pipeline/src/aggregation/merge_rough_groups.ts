import type { CanonicalGroup, Pass1Output } from "./types.js";

/**
 * Collapse rough-aggregator outputs into canonical groups keyed by `group_id`.
 * Ungrouped entries across all slices become a single `residual-ungrouped` group.
 */
export function merge_rough_groups(pass1_outputs: readonly Pass1Output[]): CanonicalGroup[] {
  const merged = new Map<string, { root_cause: string; entry_indices: number[] }>();
  const all_ungrouped: number[] = [];

  for (const output of pass1_outputs) {
    for (const group of output.groups) {
      const existing = merged.get(group.group_id);
      if (existing) {
        existing.entry_indices.push(...group.entry_indices);
      } else {
        merged.set(group.group_id, {
          root_cause: group.root_cause,
          entry_indices: [...group.entry_indices],
        });
      }
    }
    all_ungrouped.push(...output.ungrouped_indices);
  }

  if (all_ungrouped.length > 0) {
    merged.set("residual-ungrouped", {
      root_cause: "Entries that could not be grouped by any rough-aggregator",
      entry_indices: all_ungrouped,
    });
  }

  return Array.from(merged.entries()).map(([group_id, g]) => ({
    group_id,
    root_cause: g.root_cause,
    entry_indices: g.entry_indices,
    source_group_ids: [group_id],
  }));
}

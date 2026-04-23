import type { TriageEntry, TriageState } from "../triage_state_types.js";
import type { Slice, SliceEntry } from "./types.js";

export const DEFAULT_SLICE_SIZE = 50;

/**
 * Filter a triage state's completed false-positive entries into fixed-size
 * slices. Pure — filesystem writes live in the calling CLI script.
 */
export function prepare_slices(state: TriageState, slice_size: number = DEFAULT_SLICE_SIZE): Slice[] {
  const fp_entries: SliceEntry[] = state.entries
    .filter(
      (e): e is TriageEntry & { result: NonNullable<TriageEntry["result"]> } =>
        e.status === "completed" && e.result !== null && !e.result.ariadne_correct,
    )
    .map((e) => ({
      entry_index: e.entry_index,
      name: e.name,
      file_path: e.file_path,
      kind: e.kind,
      investigator_group_id: e.result.group_id,
      diagnosis_category: e.diagnosis,
      is_exported: e.is_exported,
    }));

  const slices: Slice[] = [];
  for (let i = 0; i < fp_entries.length; i += slice_size) {
    slices.push({ slice_id: slices.length, entries: fp_entries.slice(i, i + slice_size) });
  }
  return slices;
}

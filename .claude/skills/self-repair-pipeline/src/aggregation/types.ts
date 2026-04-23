/**
 * Shared types for the three aggregation stages (prepare_slices, merge_rough_groups,
 * finalize_aggregation). The scripts under `scripts/` are thin CLI wrappers over
 * these stages.
 */

export interface SliceEntry {
  entry_index: number;
  name: string;
  file_path: string;
  kind: string;
  investigator_group_id: string;
  diagnosis_category: string;
  is_exported: boolean;
}

export interface Slice {
  slice_id: number;
  entries: SliceEntry[];
}

export interface Pass1Group {
  group_id: string;
  root_cause: string;
  entry_indices: number[];
}

export interface Pass1Output {
  slice_id: number;
  groups: Pass1Group[];
  ungrouped_indices: number[];
}

export interface CanonicalGroup {
  group_id: string;
  root_cause: string;
  entry_indices: number[];
  source_group_ids: string[];
}

export interface RejectedMember {
  entry_index: number;
  suggested_group_id: string;
}

export interface GroupInvestigation {
  group_id: string;
  root_cause: string;
  confirmed_members: number[];
  rejected_members: RejectedMember[];
}

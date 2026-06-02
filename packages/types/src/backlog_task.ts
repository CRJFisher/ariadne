import type { AriadneFaultArea } from "./ariadne_fault_area.js";

/**
 * Frontmatter shape of an ariadne-bug backlog task that the curator files and
 * the fix-sequencer reads back. This is the fix-sequencer-relevant subset of
 * the full backlog schema — additional fields exist on disk but are not load-
 * bearing for clustering or scoring.
 *
 * `touched_files` is the deterministic clustering input stamped by 190.18.2;
 * `cluster_hint` mirrors a label for type-level access without re-parsing the
 * `labels[]` array.
 */
export interface BacklogTaskFrontmatter {
  /** e.g. "TASK-190.16.42". */
  id: string;
  title: string;
  status: "To Do" | "In Progress" | "Done";
  /** Includes `cluster_hint:<fault_area>` for the same value as `cluster_hint`. */
  labels: string[];
  /** Repo-relative POSIX paths; may be empty (treated as singleton-cluster signal). */
  touched_files: string[];
  /** Mirrors a label for type-level access. */
  cluster_hint: AriadneFaultArea;
}

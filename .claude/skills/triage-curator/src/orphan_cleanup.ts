/**
 * Compute which authored classifier files in a shared multi-run authored-files
 * map belong to the current run and must be deleted because their target did
 * not land in the registry.
 *
 * Shape of the input map: `{ target_group_id → absolute_file_path }` — the
 * `target_group_id` is `retargets_to ?? group_id` of an investigator response.
 * In a multi-run sweep the main agent passes the same map to every per-run
 * finalize invocation, so paths for targets owned by sibling runs appear in
 * the map too. Those must be left alone.
 *
 * An authored path is an orphan of THIS run iff:
 *   - Its target_group_id appears among the current run's investigate responses,
 *     AND
 *   - Its path is NOT in the accepted-upsert set (i.e. the apply_proposals
 *     stage rejected the entry — AST failure, missing file, etc.).
 */
export interface ResponseTarget {
  group_id: string;
  retargets_to: string | null;
}

export function compute_orphan_paths(
  authored_files_raw: Record<string, string>,
  this_run_responses: readonly ResponseTarget[],
  accepted_paths: readonly string[],
): string[] {
  const accepted = new Set(accepted_paths);
  const this_run_targets = new Set<string>();
  for (const r of this_run_responses) {
    this_run_targets.add(r.retargets_to ?? r.group_id);
  }
  const orphans: string[] = [];
  for (const [target_group_id, path] of Object.entries(authored_files_raw)) {
    if (!this_run_targets.has(target_group_id)) continue;
    if (accepted.has(path)) continue;
    orphans.push(path);
  }
  return orphans;
}

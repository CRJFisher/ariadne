/**
 * What is already on record for a file set, printed beside the arms that just
 * measured it.
 *
 * A run reports two different kinds of number. The arms above these lines were
 * measured now, on this box, in this session, and a ratio may be taken between
 * them. Everything here was measured somewhere else: the counts travel because
 * they are properties of the algorithm, and the CPU and RSS beside them do not,
 * because they are properties of the machine. Dividing a live arm into a
 * recorded one is the mistake that turned a measured 1.570x into a claimed
 * 2.202x, so each of these lines says what it is as it prints.
 *
 * Every function here selects on the offered file count and prints nothing when
 * the run is about a different file set: a record quoted under a row it does
 * not describe is worse than no record at all.
 */

import {
  RECORDED_CORPUS_PASS_COST,
  RECORDED_EVICTION_INDEX_COST,
  RECORDED_EXPORT_DECLARATION_SPACE,
  RECORDED_FULL_CORPUS_BASELINE,
  RECORDED_MEMORY_CONTRACT,
  RECORDED_WORKER_INDEX_DISPATCH,
  RECORDED_NAME_TABLE_MEMORY,
  RECORDED_ORDER_INDEPENDENCE,
  RECORDED_RESOLUTION_EVICTION_COST,
} from "../src/benchmark_corpus_load";

/**
 * What this file set needs from the heap, and what it does at the ceiling a
 * user gets without a flag.
 *
 * Printed under a full-corpus arm because the ceiling is the difference
 * between an entry-point report and a fatal V8 error several minutes in, and
 * the flag that decides it lives on the command line that started the process.
 * The live heap and the verdict travel between machines; the CPU and peak RSS
 * beside them do not, so they are marked as a record.
 */
export function report_recorded_memory_contract(offered_file_count: number): void {
  const record = RECORDED_MEMORY_CONTRACT;
  const header = `\nrecorded memory contract for this file set (${record.machine}, ${record.node_version}, session ${record.session_id}):`;

  // The floor is one corpus's. Printing it over the other one's row would hand
  // a reader a requirement measured on a file set they are not running.
  if (offered_file_count === record.other_corpus.discovered_files) {
    const other = record.other_corpus;
    console.log(
      header +
        `\n  ${other.discovered_files} discovered, ${other.indexed} indexed, ${other.dropped} dropped over ${other.cpu_seconds.observations.length} processes at --max-old-space-size=${other.heap_flag_mb}` +
        `\n  live heap ${other.live_heap_mb.mean} MB, peak RSS ${other.peak_rss_mb.mean} MB (mean of ${other.peak_rss_mb.observations.length}, spread ${other.peak_rss_mb.spread_percent}%)` +
        `\n  ${other.verdict}`,
    );
    return;
  }
  if (offered_file_count !== record.discovered_files) return;

  const failing = record.at_default_ceiling;
  const [smaller, larger] = record.completing;
  console.log(
    header +
      `\n  --max-old-space-size >= ${record.required_old_space_mb} required; at node's ${record.default_old_space_ceiling_mb} MB default this corpus dies after ${failing.cpu_seconds} s of CPU with "${failing.fatal_error}"` +
      `\n  live heap ${record.live_heap_mb.mean} MB (${record.live_heap_mb.observations.length} runs, spread ${record.live_heap_mb.spread_percent}%), ${record.live_heap_headroom_below_default_ceiling_mb} MB below that ceiling, so what is missing is collector working set` +
      `\n  peak RSS ${smaller.peak_rss_mb.mean} MB at ${smaller.heap_flag_mb} against ${larger.peak_rss_mb.mean} MB at ${larger.heap_flag_mb} over one live set — the RSS-to-heap ratio is ${record.rss_to_live_heap.map((row) => `${row.ratio}x`).join(" and ")}, not a constant` +
      `\n  the smaller ceiling costs ${record.cost_of_the_smaller_ceiling}x the CPU and reports the same graph; Ariadne sets no heap flag itself`,
  );
}

/**
 * The re-baseline this corpus's fingerprint stands at, and what moved to get
 * there.
 *
 * Printed for an arm over the same file set because a fingerprint that differs
 * from the committed one is either this step's move — accounted for member by
 * member here — or a regression, and a reader has no way to tell without the
 * accounting beside it. The counts travel between machines; the CPU and RSS
 * absolutes do not, so they are marked as a record.
 */
export function report_recorded_export_declaration_space(
  offered_file_count: number,
): void {
  const record = RECORDED_EXPORT_DECLARATION_SPACE;
  if (record.discovered_files !== offered_file_count) return;
  const [control, candidate] = record.arms;
  console.log(
    `\nrecorded for this corpus when export metadata was keyed on declaration space (${record.machine}, ${record.node_version}, session ${record.session_id} — not a comparand for the arms above):` +
      `\n  indexed ${control.indexed} -> ${candidate.indexed} of ${record.discovered_files}, dropped ${control.dropped} -> ${candidate.dropped}` +
      `, Project.remove_file called ${candidate.remove_file_calls} times on both arms` +
      `\n  nodes ${control.fingerprint.nodes} -> ${candidate.fingerprint.nodes} with ${record.nodes_lost} lost` +
      `, resolved call edges ${control.fingerprint.call_edges} -> ${candidate.fingerprint.call_edges}` +
      `\n  raw candidates ${record.entry_point_accounting.raw_candidates_control} -> ${record.entry_point_accounting.raw_candidates_candidate}` +
      `: ${record.entry_point_accounting.removed} removed, all ${record.entry_point_accounting.removed_in_candidate_called_set} of them called in the repaired arm` +
      `; ${record.entry_point_accounting.added} added, ${record.entry_point_accounting.added_inside_readmitted_files} inside the readmitted files` +
      `\n  CPU ${control.cpu_seconds.mean} s -> ${candidate.cpu_seconds.mean} s (${record.cpu_ratio}x)` +
      `, peak RSS ${control.peak_rss_mb.mean} -> ${candidate.peak_rss_mb.mean} MB` +
      `\n  residual outside the readmitted files: ${record.residual_outside_readmitted_files.length}` +
      ` (${record.residual_outside_readmitted_files.filter((r) => r.cause === "classifier decision").length} classifier decisions,` +
      ` ${record.residual_outside_readmitted_files.filter((r) => r.cause === "call site retargeted").length} retargeted call sites)`,
  );
}

/**
 * What a whole corpus cost when it was last run end to end, and where that cost
 * was.
 *
 * Printed for an arm that offered every file one of the two pinned predicates
 * discovers, because that is the only arm the record is about: a slice's cost
 * per file is not the corpus's, and two fits from slices missed the measured
 * corpus cost by 2.19x and 16.8x. The file counts and the phase shares travel
 * between machines; the CPU and RSS absolutes beside them do not, so they are
 * marked as a record rather than a comparand for the arms above.
 */
export function report_recorded_full_corpus_baseline(offered_file_count: number): void {
  const recorded = RECORDED_FULL_CORPUS_BASELINE.corpora.find(
    (arm) => arm.offered === offered_file_count,
  );
  if (recorded === undefined) return;
  // The split was taken over one predicate's corpus, so printing it under the
  // other one's row would attribute a share to a run that never produced it.
  const phases =
    recorded.predicate === RECORDED_FULL_CORPUS_BASELINE.phase_split_predicate
      ? `\n  where the CPU went: ${RECORDED_FULL_CORPUS_BASELINE.phase_split
          .filter((phase) => phase.contained_by === "the run")
          .map((phase) => `${phase.phase} ${phase.share_percent}%`)
          .join(", ")}`
      : "";
  console.log(
    `\nrecorded for this corpus when it last ran end to end (${RECORDED_FULL_CORPUS_BASELINE.machine}, ${RECORDED_FULL_CORPUS_BASELINE.node_version}, ariadne@${RECORDED_FULL_CORPUS_BASELINE.ariadne_commit} — not a comparand for the arms above):` +
      `\n  ${recorded.predicate}: ${recorded.indexed} of ${recorded.offered} indexed, ${recorded.dropped} dropped, in ${recorded.processes} processes at a ${recorded.heap_cap_mb} MB heap` +
      `\n  CPU ${recorded.cpu_seconds.mean} s (CV ${recorded.cpu_seconds.cv_percent}%), peak RSS ${recorded.peak_rss_mb.mean} MB (spread ${recorded.peak_rss_mb.spread_percent}%) against a settled heap of ${recorded.settled_heap_mb.mean} MB (spread ${recorded.settled_heap_mb.spread_percent}%)` +
      phases,
  );
}

/**
 * What the name table retained for this file set under both shapes.
 *
 * The stored-entry and visible-pair counts travel between machines because they
 * are properties of the algorithm; the KB/file figures beside them were taken
 * in their own session and are printed as a record rather than a comparand.
 */
export function report_recorded_name_table(offered_file_count: number): void {
  const recorded = RECORDED_NAME_TABLE_MEMORY.slices.find(
    (slice) => slice.offered_files === offered_file_count,
  );
  if (recorded === undefined) return;
  console.log(
    `\nrecorded for this file set when the name table became a parent chain (${RECORDED_NAME_TABLE_MEMORY.machine}, ${RECORDED_NAME_TABLE_MEMORY.node_version} — not a comparand for the arms above):` +
      `\n  retained name table ${recorded.name_table_kb_per_file.flattened} -> ${recorded.name_table_kb_per_file.chained} KB/file` +
      `, stored entries ${recorded.stored_entries.flattened.toLocaleString("en-US")} -> ${recorded.stored_entries.chained.toLocaleString("en-US")}` +
      `, ${recorded.scopes.toLocaleString("en-US")} scopes over ${recorded.chain_links.toLocaleString("en-US")} links at mean depth ${recorded.mean_chain_depth}` +
      `\n  visible (scope, name) pairs ${recorded.visible_scope_name_pairs.toLocaleString("en-US")} under both shapes, fingerprint identical, CPU ${recorded.cpu_total_ms.flattened} -> ${recorded.cpu_total_ms.chained} ms`,
  );
}

/**
 * What resolution-state eviction cost this file set under both shapes.
 *
 * Entry counts only: they are properties of the algorithm and travel, while the
 * CPU beside them in the record is a single observation of one process and is
 * never a comparand for a live arm.
 */
export function report_recorded_resolution_eviction(offered_file_count: number): void {
  const recorded = RECORDED_RESOLUTION_EVICTION_COST.cold_load.find(
    (row) => row.file_count === offered_file_count,
  );
  if (recorded === undefined) return;
  const hub = RECORDED_RESOLUTION_EVICTION_COST.incremental.edits[0];
  console.log(
    `\nrecorded for this file set when resolution state started evicting a batch in one pass (${RECORDED_RESOLUTION_EVICTION_COST.machine}, ${RECORDED_RESOLUTION_EVICTION_COST.node_version} — not a comparand for the arms above):` +
      `\n  eviction calls over the load ${recorded.eviction_calls.per_file.toLocaleString("en-US")} -> ${recorded.eviction_calls.batched}` +
      `, cloned map entries ${recorded.cloned_entries.batched}, clone allocations ${recorded.clone_allocations.per_file.toLocaleString("en-US")} -> ${recorded.clone_allocations.batched}` +
      `\n  one edit to ${hub.file} (${hub.affected_files} files affected) clones ${hub.cloned_entries.per_file.toLocaleString("en-US")} -> ${hub.cloned_entries.batched.toLocaleString("en-US")} entries, fingerprint identical`,
  );
}

/**
 * What the two-phase corpus pass measured for this file set.
 *
 * The counts travel between machines because they are properties of the
 * algorithm; the CPU ratio beside them does not, so it is printed with its own
 * session and marked as a record rather than a comparand.
 */
export function report_recorded_corpus_pass(offered_file_count: number): void {
  const collapse = RECORDED_CORPUS_PASS_COST.resolve_names.find(
    (size) => size.file_count === offered_file_count,
  );
  if (collapse !== undefined) {
    console.log(
      `\nrecorded for this file set when the bulk load became a two-phase corpus pass (${RECORDED_CORPUS_PASS_COST.machine}, ${RECORDED_CORPUS_PASS_COST.node_version}):` +
        `\n  resolve_names calls ${collapse.calls.before} -> ${collapse.calls.after}` +
        `, files resolved ${collapse.files_resolved.before} -> ${collapse.files_resolved.after}` +
        `, peak heap ${collapse.peak_heap_mb.before} -> ${collapse.peak_heap_mb.after} MB`,
    );
  }

  const ratio = RECORDED_CORPUS_PASS_COST.reverse_index_ratio.find(
    (size) => size.file_count === offered_file_count,
  );
  if (ratio !== undefined) {
    console.log(
      `  with TASK-381.3's reverse indices against without, both carrying this driver: ${ratio.speedup}x` +
        ` (control ${ratio.control.cpu_seconds.join(" / ")} s against candidate ${ratio.candidate.cpu_seconds.join(" / ")} s,` +
        ` session ${ratio.session_id} — not a comparand for the arms above)`,
    );
  }
}

/**
 * What this file set cost when `DefinitionRegistry`'s eviction became keyed.
 *
 * Printed as a record and never as a comparand: it was taken in its own
 * session on its own machine, and dividing a live arm into it is the mistake
 * that turned 1.570x into a claimed 2.202x. What does travel is the entry
 * count, which is a property of the algorithm rather than of the box.
 */
export function report_recorded_eviction_cost(offered_file_count: number): void {
  const recorded = RECORDED_EVICTION_INDEX_COST.sizes.find(
    (size) => size.file_count === offered_file_count,
  );
  if (recorded === undefined) return;
  console.log(
    `\nrecorded for this file set when eviction became keyed (${RECORDED_EVICTION_INDEX_COST.machine}, ${RECORDED_EVICTION_INDEX_COST.node_version}, session ${recorded.session_id} — not a comparand for the arms above):` +
      `\n  scanned entries inside remove_file ${recorded.scanned_entries_before.toLocaleString("en-US")} -> ${recorded.scanned_entries_after}` +
      `, keyed operations ${recorded.keyed_per_evicted_symbol_after} per evicted symbol over ${recorded.evicted_symbols.toLocaleString("en-US")} of them` +
      `\n  CPU control ${recorded.control.cpu_seconds.join(" / ")} s against candidate ${recorded.candidate.cpu_seconds.join(" / ")} s (${recorded.speedup}x), fingerprint identical`,
  );
}

/**
 * The digests this file set converged on when the graph stopped depending on
 * the walk, and what moved to get there.
 *
 * Printed under a multi-order run because a fingerprint that differs from the
 * committed one is either a later step's deliberate move or a regression, and a
 * reader has no way to tell without the accounting beside it. These digests DO
 * travel between machines — they are the seven components of this same
 * harness — while the CPU and RSS beside them do not, so those are marked as a
 * record rather than a comparand.
 */
export function report_recorded_order_independence(offered_file_count: number): void {
  const record = RECORDED_ORDER_INDEPENDENCE;
  const slice = record.slices.find(
    (entry) => entry.offered_files === offered_file_count,
  );
  if (slice === undefined) return;
  const probe = record.non_vacuity.find(
    (entry) => entry.offered_files === offered_file_count,
  );
  const [before, after] = record.cost;
  console.log(
    `\nrecorded for this file set when the graph stopped depending on the walk (${record.machine}, ${record.node_version}, session ${record.session_id}):` +
      `\n  ${slice.orders_compared.join(", ")} at seed ${slice.seed} agreed on ` +
      Object.entries(slice.agreed_components)
        .map(([name, digest]) => `${name} ${digest.count}/${digest.hash}`)
        .join(", ") +
      (probe === undefined
        ? ""
        : `\n  on ariadne@${probe.ariadne_commit} the same probe moved ${probe.entry_points_only_in_first + probe.entry_points_only_in_second} entry points` +
          ` and ${probe.components_that_moved.length} of 7 components, while ${probe.components_that_held.join(", ")} held still`) +
      (offered_file_count !== record.discovered_files
        ? ""
        : `\n  entry points -${record.entry_points_removed}/+${record.entry_points_added}, resolved edges +${record.strict_improvement.find((row) => row.component === "call_edges")?.only_after}/-0` +
          `, nodes byte-identical, receiver_type_unknown ${record.failure_taxonomy.before.by_reason.receiver_type_unknown} -> ${record.failure_taxonomy.after.by_reason.receiver_type_unknown}` +
          `\n  CPU ${before.cpu_seconds.join(" / ")} s before against ${after.cpu_seconds.join(" / ")} s after (${record.cost_ratio}x) — not a comparand for the arms above`),
  );
}

/**
 * The one record judged on WALL. Printed with the loads its arms ran at,
 * because a wall figure taken under contention is not a measurement.
 */
export function report_recorded_worker_index_dispatch(
  offered_file_count: number,
): void {
  const record = RECORDED_WORKER_INDEX_DISPATCH;
  if (offered_file_count !== record.discovered_files) return;

  console.log(
    `\nrecorded worker dispatch for this file set (${record.machine}, ${record.node_version}, ${record.cpu_count} cores):` +
      `\n  ${(record.parallelisable_share * 100).toFixed(2)}% of the serial run is parse-and-index, measured on ariadne@${record.share_arm_commit} before any pool code existed` +
      `\n  target ${record.target_wall_s} s of wall = ${record.serial_wall_s} s x (1 - share + share/${record.target_efficiency}); achieved ${record.achieved_wall_s} s, which is ${record.wall_speedup}x` +
      `\n  CPU ${record.pooled_cpu_s} s against ${record.serial_cpu_s} s serial — ${record.cpu_ratio}x, inside the ${record.cpu_ratio_permitted}x permitted; no CPU reduction is claimed` +
      `\n  main-thread deserialize is ${(record.main_deserialize_share_of_wall * 100).toFixed(1)}% of that wall and the pool cannot remove it` +
      `\n  ${record.memory_contract_at_6144}`,
  );
}

/**
 * Measuring what a full-corpus load costs, and guarding what it produces.
 *
 * The surface is an arm (`run_benchmark_arm`), the corpora it may run over, the
 * comparisons the harness permits, and the way an arm's result travels between
 * the processes that produced it. This barrel is exactly what
 * `packages/core/scripts/run_load_benchmark.ts` imports; everything else in the
 * folder is reached from its own file, by its own tests.
 */

export {
  run_benchmark_arm,
  diff_ingest_orders,
  type ArmRequest,
  type ArmResult,
  type SliceSize,
} from "./benchmark_corpus_load";

export {
  discover_corpus,
  parse_corpus_predicate_name,
} from "./corpus_predicate";

export { plan_nested_slices } from "./nested_slice";

export { INGEST_ORDERS, type IngestOrder } from "./ingest_order";

export {
  create_session_id,
  find_ariadne_repo_root,
  type MeasurementRow,
} from "./measurement_row";

export { cite_row, format_citation } from "./cite_row";

export { RECORDED_EVICTION_INDEX_COST } from "./recorded_eviction_index_cost";

export { RECORDED_CORPUS_PASS_COST } from "./recorded_corpus_pass_cost";

export { RECORDED_RESOLUTION_EVICTION_COST } from "./recorded_resolution_eviction_cost";

export { RECORDED_NAME_TABLE_MEMORY } from "./recorded_name_table_memory";

export { compare_fingerprints } from "./call_graph_fingerprint";

export {
  assert_rows_comparable,
  measure_speedup_against_control,
  summarize_cpu_seconds,
  summarize_peak_rss,
} from "./compare_measurements";

export { read_arm_result, write_arm_result } from "./arm_result_file";

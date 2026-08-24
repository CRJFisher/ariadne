/**
 * Measuring what a full-corpus load costs, and guarding what it produces.
 *
 * The surface is an arm (`run_benchmark_arm`), the seven-number fingerprint of
 * what that arm produced, the comparisons the harness permits, and the ones it
 * refuses. It is deliberately narrow: everything here has a caller in
 * `packages/core/scripts/run_load_benchmark.ts` or in this folder's tests, and
 * a symbol that loses its caller is deleted rather than kept for later.
 */

export {
  run_benchmark_arm,
  diff_ingest_orders,
  type ArmRequest,
  type ArmResult,
  type MultiOrderVerdict,
  type SliceSize,
} from "./benchmark_corpus_load";

export {
  compare_fingerprints,
  FINGERPRINT_COMPONENT_NAMES,
  type CallGraphFingerprint,
  type FingerprintComparison,
  type FingerprintComponentName,
  type RecordedFingerprint,
} from "./call_graph_fingerprint";

export {
  discover_corpus,
  parse_corpus_predicate_name,
  PINNED_CORPUS_COUNTS,
  type CorpusPredicateName,
} from "./corpus_predicate";

export {
  plan_nested_slices,
  INGEST_ORDERS,
  type IngestOrder,
} from "./ingest_order";

export {
  create_session_id,
  type MeasurementRow,
} from "./measurement_row";

export {
  measure_speedup_against_control,
  summarize_cpu_seconds,
  summarize_peak_rss,
  type SampleSummary,
} from "./compare_measurements";

export { read_arm_result, write_arm_result } from "./arm_result_file";

/**
 * One measured arm: one file set, offered to one process, in one order.
 *
 * An arm is the unit everything else in this module is built out of. A budget
 * is judged by running a candidate arm interleaved with a control arm in the
 * same session and dividing one into the other; a determinism claim is made by
 * running the same file set as four arms in four orders and diffing their
 * fingerprints. Nothing here spawns processes: interleaving arms A,B,A,B
 * across separate processes is the orchestrator's job, because two arms are
 * usually two checkouts and a process can only be one of them.
 *
 * The arm times the load and the call-graph trace separately and reports both
 * plus their total, because the capability a budget is about is "entry points
 * reported", and that is the two together. Both splits are CPU: a per-phase
 * wall figure is what the unit rule says is never a measurement.
 */

import * as path from "path";
import { performance } from "node:perf_hooks";
import * as v8 from "v8";
import { trace_call_graph } from "../trace_call_graph/trace_call_graph";
import { load_project } from "../project/load_project";
import {
  discover_corpus,
  type CorpusIdentity,
  type CorpusPredicateName,
  type FileCounts,
} from "./corpus_predicate";
import {
  measure_file_sizes,
  nested_slice,
  order_files,
  type IngestOrder,
} from "./ingest_order";
import {
  fingerprint_call_graph,
  record_fingerprint,
  compare_fingerprints,
  type CallGraphFingerprint,
  type FingerprintComparison,
} from "./call_graph_fingerprint";
import {
  RECORDED_ORDER_SENSITIVITY,
  type RecordedOrderSensitivity,
} from "./recorded_order_sensitivity";
import { assert_rows_comparable } from "./compare_measurements";
import {
  capture_run_environment,
  current_load_average,
  round_to_tenth,
  round_to_hundredth,
  start_resident_set_sampler,
  type MeasurementRow,
} from "./measurement_row";

const BYTES_PER_MB = 1024 * 1024;

/** How many files the arm is offered. `"full"` offers every discovered file. */
export type SliceSize = number | "full";

export interface ArmRequest {
  /** The arm's label. An interleaved pair is conventionally "control" and "candidate". */
  readonly arm: string;
  /** Position in the interleaved sequence, 0-based and unique within a session. */
  readonly sequence_index: number;
  /** Stable corpus name, e.g. "microsoft/vscode". */
  readonly corpus_name: string;
  readonly corpus_root: string;
  /** The corpus's commit. Supplied, never inferred: a row without it is not a measurement. */
  readonly corpus_commit: string;
  readonly predicate: CorpusPredicateName;
  readonly slice_size: SliceSize;
  readonly ingest_order: IngestOrder;
  /** The mulberry32 seed, recorded on the row whether or not the order uses it. */
  readonly seed: number;
  /** Whether test-file callables are admitted as entry points. */
  readonly include_tests: boolean;
  /**
   * The Ariadne checkout this arm measures. Named by the caller because an
   * interleaved pair is two worktrees and only the orchestrator knows which.
   */
  readonly ariadne_repo_path: string;
  /** Shared by every arm of one orchestrator invocation. */
  readonly session_id: string;
}

export interface ArmResult {
  readonly row: MeasurementRow;
  /** The full fingerprint, members included, for diffing against another arm. */
  readonly fingerprint: CallGraphFingerprint;
}

export async function run_benchmark_arm(
  request: ArmRequest,
): Promise<ArmResult> {
  const corpus_root = path.resolve(request.corpus_root);
  const discovered = await discover_corpus(corpus_root, request.predicate);
  const offered =
    request.slice_size === "full"
      ? discovered
      : nested_slice(discovered, request.slice_size);

  assert_predicate_selected_files(offered.length, request, corpus_root);
  assert_heap_is_large_enough(offered.length);

  const file_sizes =
    request.ingest_order === "descending_size"
      ? await measure_file_sizes(offered)
      : new Map<never, never>();

  const ordered = order_files(offered, request.ingest_order, {
    file_sizes,
    seed: request.seed,
  });

  const sampler = start_resident_set_sampler();
  const loadavg_at_start = current_load_average();
  const cpu_at_start = process.cpuUsage();
  const wall_at_start = performance.now();

  const loaded = await load_project({
    project_path: corpus_root,
    files: ordered,
  });

  const cpu_after_load = process.cpuUsage(cpu_at_start);

  const call_graph = trace_call_graph(
    loaded.project.definitions,
    loaded.project.resolutions,
    loaded.project.get_languages(),
    { include_tests: request.include_tests },
  );

  const cpu_total = process.cpuUsage(cpu_at_start);
  const wall_total_ms = performance.now() - wall_at_start;
  const loadavg_at_end = current_load_average();

  assert_offered_files_reached_the_loader(loaded.discovered_files.size, ordered.length);

  const indexed_files = [...loaded.project.get_file_contents().keys()];
  const fingerprint = fingerprint_call_graph({
    call_graph,
    resolutions: loaded.project.resolutions,
    indexed_files,
    dropped_files: loaded.dropped_files,
    corpus_root,
  });

  // Stopped after the fingerprint, not before it: the member strings a
  // corpus-scale fingerprint holds are hundreds of megabytes, and a peak that
  // excluded them would describe a moment the process was never nearest its
  // ceiling.
  const peak_rss_mb = sampler.stop();

  const corpus: CorpusIdentity = {
    corpus_name: request.corpus_name,
    corpus_root,
    corpus_commit: request.corpus_commit,
    predicate: request.predicate,
  };

  const file_counts: FileCounts = {
    discovered: discovered.length,
    offered: ordered.length,
    indexed: indexed_files.length,
    dropped: loaded.dropped_files.size,
  };

  const cpu_user_ms = cpu_total.user / 1000;
  const cpu_system_ms = cpu_total.system / 1000;
  const load_cpu_ms = (cpu_after_load.user + cpu_after_load.system) / 1000;

  const row: MeasurementRow = {
    arm: request.arm,
    sequence_index: request.sequence_index,
    corpus,
    file_counts,
    ingest_order: request.ingest_order,
    seed: request.seed,
    include_tests: request.include_tests,
    cpu_user_ms: round_to_tenth(cpu_user_ms),
    cpu_system_ms: round_to_tenth(cpu_system_ms),
    wall_ms: round_to_tenth(wall_total_ms),
    cpu_per_wall:
      wall_total_ms === 0
        ? 0
        : round_to_hundredth((cpu_user_ms + cpu_system_ms) / wall_total_ms),
    load_cpu_ms: round_to_tenth(load_cpu_ms),
    trace_cpu_ms: round_to_tenth(cpu_user_ms + cpu_system_ms - load_cpu_ms),
    loadavg_at_start,
    loadavg_at_end,
    peak_rss_mb,
    rss_at_end_mb: round_to_tenth(process.memoryUsage.rss() / BYTES_PER_MB),
    settled_heap_mb: round_to_tenth(
      v8.getHeapStatistics().used_heap_size / BYTES_PER_MB,
    ),
    fingerprint: record_fingerprint(fingerprint),
    environment: capture_run_environment({
      session_id: request.session_id,
      ariadne_repo_path: request.ariadne_repo_path,
    }),
  };

  return { row, fingerprint };
}

/**
 * Refuse a predicate that matched nothing, before the load rather than after.
 *
 * `load_project` treats an empty `files` list as "no filter" and walks the
 * whole project path, so a mistyped predicate would quietly load the entire
 * repository root — 12,654 files and 1,653.9 s of CPU against vscode — and only
 * then fail, blaming discovery for disagreeing with the loader. One typo would
 * cost the hours-then-die failure this harness exists to end.
 */
function assert_predicate_selected_files(
  offered_file_count: number,
  request: ArmRequest,
  corpus_root: string,
): void {
  if (offered_file_count > 0) return;
  throw new Error(
    `Predicate "${request.predicate}" selected no files under ${corpus_root}. ` +
      "There is nothing to measure, and loading would walk the whole corpus root instead.",
  );
}

/**
 * Refuse an arm the heap cannot hold, before it spends the CPU.
 *
 * The requirement scales with the file count from measured growth — roughly
 * 1.26 MB of settled heap per file, over a 400 MB base — because a single
 * threshold is wrong in both directions: a flat 3,000-file floor refuses a
 * 2,999-file arm that fits comfortably, and passes a 5,000-file arm that does
 * not.
 */
function assert_heap_is_large_enough(offered_file_count: number): void {
  const required_mb = Math.ceil(400 + 1.4 * offered_file_count);
  const heap_cap_mb = Math.round(
    v8.getHeapStatistics().heap_size_limit / BYTES_PER_MB,
  );
  if (heap_cap_mb >= required_mb) return;
  throw new Error(
    `Refusing to start a ${offered_file_count}-file arm: it needs about ${required_mb} MB of heap and this process has ${heap_cap_mb} MB. ` +
      `The run would die part-way through after spending the CPU. Re-run with --max-old-space-size=${Math.ceil(required_mb * 1.25)}.`,
  );
}

/**
 * The loader is handed the arm's file list, and `load_project` re-filters it
 * through `is_supported_file`. A divergence means the two walks disagree about
 * what the corpus is, which makes the row's file count a claim about a
 * different file set than the one measured.
 */
function assert_offered_files_reached_the_loader(
  loader_saw: number,
  offered: number,
): void {
  if (loader_saw === offered) return;
  throw new Error(
    `The loader took ${loader_saw} of the ${offered} files this arm offered. ` +
      "Discovery and the loader disagree about the corpus, so the row's file count would name a different file set than the one measured.",
  );
}

export interface OrderComparison {
  readonly order: IngestOrder;
  readonly comparison: FingerprintComparison;
}

/**
 * The verdict of a multi-order run: whether the reported call graph is a
 * function of the codebase or of the order the loader walked it.
 */
export interface MultiOrderVerdict {
  readonly baseline_order: IngestOrder;
  readonly comparisons: readonly OrderComparison[];
  readonly identical_across_orders: boolean;
  /**
   * The measured order-dependence this probe was validated against, carried on
   * the verdict so a silent result is never read without it.
   */
  readonly recorded_validation: RecordedOrderSensitivity;
}

/**
 * Diff every other order's fingerprint against the baseline order's.
 *
 * The arms are taken as inputs rather than run here, because a full corpus
 * cannot hold four of its own call graphs in one process. The orchestrator
 * runs one arm per process and hands the results back, one at a time if it
 * must.
 *
 * Each pair is checked comparable first, so a grammar mismatch or a different
 * corpus is refused rather than reported as an order dependence. That the
 * comparison can see each of the seven components move is proven by
 * `call_graph_fingerprint.test.ts` over a synthetic fingerprint; proving it
 * again here would re-sort and re-digest every component of a corpus-scale
 * fingerprint on every verdict, for a result that does not depend on the data.
 */
export function diff_ingest_orders(
  baseline: ArmResult,
  others: readonly ArmResult[],
): MultiOrderVerdict {
  const comparisons = others.map((other) => {
    assert_rows_comparable(baseline.row, other.row);
    return {
      order: other.row.ingest_order,
      comparison: compare_fingerprints(baseline.fingerprint, other.fingerprint),
    };
  });

  return {
    baseline_order: baseline.row.ingest_order,
    comparisons,
    identical_across_orders: comparisons.every(
      (entry) => entry.comparison.identical,
    ),
    recorded_validation: RECORDED_ORDER_SENSITIVITY,
  };
}

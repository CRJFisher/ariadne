#!/usr/bin/env npx tsx
/**
 * Run measured arms over a corpus, and report only what the harness permits.
 *
 * Two roles in one file. As a CHILD (`--run-arm`) it runs exactly one arm and
 * writes one result file. As a PARENT it spawns children and reports. Arms are
 * separate processes because two arms are usually two checkouts, and because a
 * corpus-scale fingerprint cannot share a heap with another one.
 *
 * The parent never takes an arm's CPU from its own `process.cpuUsage()`: a
 * child process's CPU is invisible to its parent — measured, a 1,500 ms child
 * spin counted as 2 ms in the parent — so every number comes from the arm's own
 * row. (A worker thread is the opposite case and IS counted in-process, which
 * is why the unit rule treats worker-pool arms differently.)
 *
 *   npx tsx packages/core/scripts/run_load_benchmark.ts --interleave \
 *     --corpus-root ~/.ariadne/triage-entrypoints/repos/microsoft--vscode \
 *     --corpus-commit f3fa55c3 --predicate folder-ts:src/vs/base --slice 200
 *
 * Modes: --interleave (A,B,A,B and a controlled speedup), --slices (a nested
 * cost-per-file curve), --orders (the same file set in four arrival orders,
 * diffed through the seven-number fingerprint).
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  assert_rows_comparable,
  cite_row,
  compare_fingerprints,
  create_session_id,
  diff_ingest_orders,
  discover_corpus,
  find_ariadne_repo_root,
  format_citation,
  measure_speedup_against_control,
  parse_corpus_predicate_name,
  plan_nested_slices,
  read_arm_result,
  run_benchmark_arm,
  summarize_cpu_seconds,
  summarize_peak_rss,
  write_arm_result,
  INGEST_ORDERS,
  RECORDED_CORPUS_PASS_COST,
  RECORDED_EVICTION_INDEX_COST,
  RECORDED_EXPORT_DECLARATION_SPACE,
  RECORDED_FULL_CORPUS_BASELINE,
  RECORDED_NAME_TABLE_MEMORY,
  RECORDED_RESOLUTION_EVICTION_COST,
  type ArmRequest,
  type ArmResult,
  type IngestOrder,
  type MeasurementRow,
  type SliceSize,
} from "../src/benchmark_corpus_load";

/**
 * What `"full"` is assumed to cost when sizing a child, since the parent does
 * not walk the corpus before spawning. vscode's `src/` is 8,494 files.
 */
const FULL_SLICE_HEAP_BASIS = 8494;

/**
 * The heap an arm of this size needs, from measured growth: two same-session
 * vscode arms cost 420.1 MB of settled heap at 200 files and 925.1 MB at 600 —
 * about 1.26 MB per file, with peak RSS a little above that.
 *
 * The parent sizes each child from the same function the child refuses
 * against, so the two can never disagree. A floor set independently of the flag
 * that feeds it is a guard that cannot fire: a 6,144 MB flag yields a 6,192 MB
 * limit, so a 6,000 MB floor passed every arm the CLI could spawn.
 *
 * The coefficient comes from two points and is unverified above 600 files.
 * Re-measure before trusting a full-corpus figure.
 */
export function required_heap_mb(offered_file_count: number): number {
  return Math.ceil(400 + 1.4 * offered_file_count);
}

/** What to give a child: its requirement plus headroom. */
function heap_mb_for(slice: SliceSize): number {
  const offered = slice === "full" ? FULL_SLICE_HEAP_BASIS : slice;
  return Math.max(2048, Math.ceil(required_heap_mb(offered) * 1.25));
}

/** Every arm runs at least twice: a single peak-RSS figure is not a measurement. */
const REPETITIONS = 2;

const DEFAULT_CORPUS_ROOT = path.join(
  os.homedir(),
  ".ariadne",
  "triage-entrypoints",
  "repos",
  "microsoft--vscode",
);

function flag(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required flag --${name}`);
  }
  const value = process.argv[index + 1];
  // A flag whose value is missing, or is itself a flag, is a mangled command
  // line rather than a request for the default. Falling back would launder it
  // into a run that looks deliberate.
  if (value === undefined) {
    throw new Error(`--${name} needs a value`);
  }
  if (value.startsWith("--")) {
    throw new Error(
      `--${name} was given "${value}", which is another flag. Supply its value.`,
    );
  }
  return value;
}

function numeric_flag(name: string, fallback?: string): number {
  const raw = flag(name, fallback);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`--${name} must be a number, got "${raw}"`);
  }
  return value;
}

function has_flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function show_help(): void {
  console.log(
    [
      "Usage: run_load_benchmark.ts <mode> [options]",
      "",
      "Modes:",
      "  --interleave   control and candidate arms A,B,A,B, then a controlled speedup",
      "  --slices       one arm per nested slice, for a cost-per-file curve",
      "  --orders       the same file set in four arrival orders, diffed",
      "",
      "Options:",
      "  --corpus-root <path>    default ~/.ariadne/triage-entrypoints/repos/microsoft--vscode",
      "  --corpus-name <name>    required: which corpus this row is for",
      "  --run-dir <path>        where arm results land",
      "  --corpus-commit <sha>   required: a row without it is not a measurement",
      "  --predicate <name>      src | repository-root | folder:<p> | folder-ts:<p>",
      "  --slice <n|full>        default full",
      "  --control-repo <path>   the control arm's checkout, for --interleave",
      "  --candidate-repo <path> the candidate arm's checkout, for --interleave",
      "  --seed <n>              default 1",
    ].join("\n"),
  );
}

// ---------------------------------------------------------------- child role

async function run_as_child(): Promise<void> {
  const request = JSON.parse(flag("run-arm")) as ArmRequest;
  const result = await run_benchmark_arm(request);
  await write_arm_result(flag("out"), result);
}

// --------------------------------------------------------------- parent role

function spawn_arm(request: ArmRequest, out: string): Promise<ArmResult> {
  // The arm runs the script belonging to the checkout it claims to measure. A
  // run that spawned the orchestrator's own script would execute one tree's
  // bytes and stamp another tree's commit onto the row — a row naming something
  // other than what it measured, which is the one thing this harness exists to
  // make impossible.
  const script = path.join(
    request.ariadne_repo_path,
    "packages",
    "core",
    "scripts",
    "run_load_benchmark.ts",
  );
  if (!fs.existsSync(script)) {
    return Promise.reject(
      new Error(
        `Arm "${request.arm}" names ${request.ariadne_repo_path} as its checkout, but ${script} does not exist there. An arm must run the tree it reports.`,
      ),
    );
  }

  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        `--max-old-space-size=${heap_mb_for(request.slice_size)}`,
        script,
        "--run-arm",
        JSON.stringify(request),
        "--out",
        out,
      ],
      { cwd: request.ariadne_repo_path, stdio: ["ignore", "ignore", "inherit"] },
    );
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        read_arm_result(out).then(resolve, (error: unknown) =>
          reject(
            new Error(
              `Arm "${request.arm}" (sequence ${request.sequence_index}) exited 0 but its result could not be read: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ),
          ),
        );
        return;
      }
      // A SIGKILL here is almost always the OOM killer, which is the expected
      // corpus-scale failure; reporting it as "exited null" reads like a
      // harness bug instead.
      const cause =
        signal === "SIGKILL"
          ? "was killed on SIGKILL — most likely the OOM killer; raise the heap"
          : signal !== null
            ? `was killed on ${signal}`
            : `exited ${code}`;
      reject(
        new Error(
          `Arm "${request.arm}" (sequence ${request.sequence_index}) ${cause}. No usable result; a partial arm is never substituted for a finished one.`,
        ),
      );
    });
  });
}

interface RunContext {
  readonly session_id: string;
  readonly run_dir: string;
  readonly corpus_name: string;
  readonly corpus_root: string;
  readonly corpus_commit: string;
  readonly predicate: ReturnType<typeof parse_corpus_predicate_name>;
  readonly seed: number;
}

function arm_request(
  context: RunContext,
  arm: string,
  sequence_index: number,
  slice_size: SliceSize,
  ingest_order: IngestOrder,
  ariadne_repo_path: string,
): ArmRequest {
  return {
    arm,
    sequence_index,
    corpus_name: context.corpus_name,
    corpus_root: context.corpus_root,
    corpus_commit: context.corpus_commit,
    predicate: context.predicate,
    slice_size,
    ingest_order,
    seed: context.seed,
    include_tests: false,
    ariadne_repo_path,
    session_id: context.session_id,
  };
}

function report_rows(label: string, rows: readonly MeasurementRow[]): void {
  console.log(`\n${label}`);
  console.log(`  ${format_citation(cite_row(rows[0]))}`);
  const cpu = summarize_cpu_seconds(rows);
  const rss = summarize_peak_rss(rows);
  console.log(
    `  CPU s   mean ${cpu.mean}  min ${cpu.min}  max ${cpu.max}  spread ${cpu.spread_pct}%  (n=${cpu.run_count})`,
  );
  console.log(
    `  peak RSS MB  mean ${rss.mean}  min ${rss.min}  max ${rss.max}  spread ${rss.spread_pct}%  (n=${rss.run_count})`,
  );
  for (const row of rows) {
    console.log(
      `  #${row.sequence_index} pid ${row.environment.pid}  cpu/wall ${row.cpu_per_wall}  loadavg ${row.loadavg_at_start[0]}  indexed ${row.file_counts.indexed}/${row.file_counts.offered}  dropped ${row.file_counts.dropped}`,
    );
  }
}

/**
 * Whether the two trees report the same call graph, component by component.
 *
 * A speedup between two arms that describe different graphs is not a speedup,
 * so the two are printed together. A step that moves the fingerprint by design
 * reads the component breakdown here and accounts for every moved member; every
 * other step needs this line to say "identical", and a difference exits
 * non-zero so a chain cannot go green over it.
 */
function report_fingerprint_agreement(
  control: ArmResult,
  candidate: ArmResult,
): void {
  assert_rows_comparable(control.row, candidate.row);
  const comparison = compare_fingerprints(
    control.fingerprint,
    candidate.fingerprint,
  );
  if (comparison.identical) {
    console.log("\nfingerprint identical across arms");
    return;
  }
  console.log(
    `\nfingerprint differs across arms: ${comparison.differing_components.join(", ")}`,
  );
  for (const component of comparison.components) {
    if (component.identical) continue;
    console.log(
      `  ${component.component}: ${component.baseline_count} -> ${component.candidate_count}` +
        `, only_control ${component.only_baseline_total}, only_candidate ${component.only_candidate_total}`,
    );
    for (const member of component.only_baseline.slice(0, 5)) console.log(`     -${member}`);
    for (const member of component.only_candidate.slice(0, 5)) console.log(`     +${member}`);
  }
  process.exitCode = 1;
}

async function run_interleaved(context: RunContext, slice: SliceSize): Promise<void> {
  // Both checkouts are named, each defaulting to the orchestrator's own tree,
  // so which arm the orchestrator happens to live in never decides which arm is
  // the control. A row that named the wrong tree would invert every ratio taken
  // from it.
  const control_repo = flag("control-repo", find_ariadne_repo_root());
  const candidate_repo = flag("candidate-repo", find_ariadne_repo_root());
  const control: ArmResult[] = [];
  const candidate: ArmResult[] = [];

  // A,B,A,B rather than A,A,B,B: the two arms then share whatever thermal and
  // scheduling drift the session has, which is the only reason a ratio between
  // them means anything.
  for (let repetition = 0; repetition < REPETITIONS; repetition++) {
    const control_index = repetition * 2;
    control.push(
      await spawn_arm(
        arm_request(context, "control", control_index, slice, "forward", control_repo),
        path.join(context.run_dir, `${control_index}-control.arm`),
      ),
    );
    const candidate_index = control_index + 1;
    candidate.push(
      await spawn_arm(
        arm_request(context, "candidate", candidate_index, slice, "forward", candidate_repo),
        path.join(context.run_dir, `${candidate_index}-candidate.arm`),
      ),
    );
  }

  report_rows("control", control.map((result) => result.row));
  report_rows("candidate", candidate.map((result) => result.row));

  report_fingerprint_agreement(control[0], candidate[0]);

  const speedup = measure_speedup_against_control(
    control.map((result) => result.row),
    candidate.map((result) => result.row),
  );
  console.log(
    `\nspeedup ${speedup.speedup}x (control ${speedup.control.mean}s / candidate ${speedup.candidate.mean}s, session ${speedup.session_id})`,
  );

  // Two arms of one tree measure the session's noise, not a change. Printed as
  // a speedup it reads as a result, and a 1.03x noise floor has been quoted as
  // a 3% win before.
  if (
    control[0].row.environment.ariadne_commit ===
    candidate[0].row.environment.ariadne_commit
  ) {
    console.log(
      `  NOISE FLOOR: both arms ran ariadne@${control[0].row.environment.ariadne_commit}. ` +
        "This figure is what a null change measures in this session, not a speedup. Pass --candidate-repo to measure one.",
    );
  }

  report_recorded_eviction_cost(control[0].row.file_counts.offered);
  report_recorded_corpus_pass(control[0].row.file_counts.offered);
  report_recorded_resolution_eviction(control[0].row.file_counts.offered);
  report_recorded_name_table(control[0].row.file_counts.offered);
  report_recorded_full_corpus_baseline(control[0].row.file_counts.offered);
  report_recorded_export_declaration_space(control[0].row.file_counts.offered);
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
function report_recorded_export_declaration_space(
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
function report_recorded_full_corpus_baseline(offered_file_count: number): void {
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
function report_recorded_name_table(offered_file_count: number): void {
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
function report_recorded_resolution_eviction(offered_file_count: number): void {
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
function report_recorded_corpus_pass(offered_file_count: number): void {
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
function report_recorded_eviction_cost(offered_file_count: number): void {
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
 * CPU seconds per file, and the marginal cost of the files a slice added over
 * the one before it.
 *
 * The mean is what a budget gets extrapolated from and the marginal is what
 * says whether that extrapolation is allowed: cost per file is not constant,
 * and two fits taken from small slices missed the measured corpus cost by
 * 2.19x and 16.8x. A rising marginal is the curve saying so.
 */
function report_cost_per_file(
  size: number,
  cpu_mean_seconds: number,
  previous: { size: number; cpu_mean_seconds: number } | undefined,
): void {
  const mean_ms_per_file = (cpu_mean_seconds / size) * 1000;
  const marginal =
    previous === undefined
      ? "—"
      : `${(((cpu_mean_seconds - previous.cpu_mean_seconds) / (size - previous.size)) * 1000).toFixed(1)} ms/file over the ${size - previous.size} files added`;
  console.log(
    `  cost per file  mean ${mean_ms_per_file.toFixed(1)} ms   marginal ${marginal}`,
  );
}

async function run_slices(context: RunContext): Promise<void> {
  const discovered = await discover_corpus(context.corpus_root, context.predicate);
  const sizes = plan_nested_slices(discovered);
  console.log(`nested slices over ${discovered.length} discovered files: ${sizes.join(", ")}`);

  let sequence_index = 0;
  let previous: { size: number; cpu_mean_seconds: number } | undefined;
  for (const size of sizes) {
    const rows: MeasurementRow[] = [];
    for (let repetition = 0; repetition < REPETITIONS; repetition++) {
      const result = await spawn_arm(
        arm_request(context, `slice-${size}`, sequence_index, size, "forward", find_ariadne_repo_root()),
        path.join(context.run_dir, `${sequence_index}-slice-${size}.arm`),
      );
      rows.push(result.row);
      sequence_index++;
    }
    report_rows(`slice ${size}`, rows);
    const cpu_mean_seconds = summarize_cpu_seconds(rows).mean;
    report_cost_per_file(size, cpu_mean_seconds, previous);
    previous = { size, cpu_mean_seconds };
  }
}

async function run_orders(context: RunContext, slice: SliceSize): Promise<void> {
  // One arm per process, compared pairwise against the baseline: a full corpus
  // cannot hold four of its own fingerprints in one heap.
  const baseline = await spawn_arm(
    arm_request(context, "order-forward", 0, slice, "forward", find_ariadne_repo_root()),
    path.join(context.run_dir, "0-order-forward.arm"),
  );

  const others: ArmResult[] = [];
  let sequence_index = 1;
  for (const order of INGEST_ORDERS) {
    if (order === "forward") continue;
    others.push(
      await spawn_arm(
        arm_request(context, `order-${order}`, sequence_index, slice, order, find_ariadne_repo_root()),
        path.join(context.run_dir, `${sequence_index}-order-${order}.arm`),
      ),
    );
    sequence_index++;
  }

  const verdict = diff_ingest_orders(baseline, others);
  console.log(`\n${format_citation(cite_row(baseline.row))}`);
  console.log(`baseline order: ${verdict.baseline_order}`);
  for (const entry of verdict.comparisons) {
    if (!entry.diagnostics_identical) {
      console.log(`  ${entry.order}: diagnostics payload differs`);
    }
    if (entry.comparison.identical) {
      console.log(`  ${entry.order}: identical`);
      continue;
    }
    console.log(`  ${entry.order}: ${entry.comparison.differing_components.join(", ")}`);
    for (const component of entry.comparison.components) {
      if (component.identical) continue;
      console.log(
        `     ${component.component}: ${component.baseline_count} -> ${component.candidate_count}` +
          `, only_baseline ${component.only_baseline_total}, only_candidate ${component.only_candidate_total}`,
      );
      for (const member of component.only_baseline.slice(0, 5)) console.log(`        -${member}`);
      for (const member of component.only_candidate.slice(0, 5)) console.log(`        +${member}`);
    }
  }
  console.log(`\nidentical across orders: ${verdict.identical_across_orders}`);
  console.log(
    `diagnostics identical across orders: ${verdict.diagnostics_identical_across_orders}`,
  );
  if (
    !verdict.identical_across_orders ||
    !verdict.diagnostics_identical_across_orders
  ) {
    // The one question this mode exists to answer, answered "the reported
    // product is a function of the walk". Exiting 0 would let a CI chain go
    // green on it.
    process.exitCode = 1;
  }

  // The silence above is only evidence because the probe was shown to report a
  // difference on a tree that had one. That demonstration travels with it.
  const recorded = verdict.recorded_validation;
  console.log(
    `validated against ${recorded.ariadne_tree} on ${recorded.corpus}@${recorded.corpus_commit} ` +
      `(${recorded.predicate}, ${recorded.file_count} files): ${recorded.entry_points_moved} entry points moved ` +
      `(${recorded.entry_points_forward} -> ${recorded.entry_points_descending_size}), ` +
      `${Object.values(recorded.recorded_hashes).filter((pair) => pair.changed).length} of ` +
      `${Object.keys(recorded.recorded_hashes).length} recorded hashes changed`,
  );
  const recorded_diagnostics = verdict.recorded_diagnostics_validation;
  console.log(
    `diagnostics validated on ${recorded_diagnostics.corpus}@${recorded_diagnostics.corpus_commit} ` +
      `(${recorded_diagnostics.file_count} files): three ingest orders once produced ` +
      `${new Set(recorded_diagnostics.diag_hashes_before_repair.both_causes_present).size} distinct payloads`,
  );
}

async function main(): Promise<void> {
  if (has_flag("run-arm")) {
    await run_as_child();
    return;
  }
  if (has_flag("help") || process.argv.length <= 2) {
    show_help();
    return;
  }

  const corpus_root = path.resolve(flag("corpus-root", DEFAULT_CORPUS_ROOT));
  if (!fs.existsSync(corpus_root)) {
    // The corpus is absent in CI and in most checkouts. Corpus-scale ROWS skip
    // cleanly; the fingerprint mechanism itself is guarded by the in-repo
    // corpus on every test run and never skips.
    console.log(
      `Corpus absent at ${corpus_root} — skipping corpus-scale rows. ` +
        "Point --corpus-root at a checkout to measure, or run the test suite for the mechanism guard.",
    );
    return;
  }

  const mode = ["interleave", "slices", "orders"].find((name) => has_flag(name));
  if (mode === undefined) {
    show_help();
    return;
  }

  const session_id = create_session_id();
  const run_dir = flag(
    "run-dir",
    path.join(os.homedir(), ".ariadne", "benchmark-runs", session_id),
  );
  fs.mkdirSync(run_dir, { recursive: true });

  const context: RunContext = {
    session_id,
    run_dir,
    corpus_name: flag("corpus-name"),
    corpus_root,
    corpus_commit: flag("corpus-commit"),
    predicate: parse_corpus_predicate_name(flag("predicate", "src")),
    seed: numeric_flag("seed", "1"),
  };

  const slice_flag = flag("slice", "full");
  const slice: SliceSize =
    slice_flag === "full" ? "full" : numeric_flag("slice");

  console.log(`session ${session_id}`);
  console.log(`results in ${run_dir}`);

  if (mode === "interleave") {
    await run_interleaved(context, slice);
  } else if (mode === "slices") {
    await run_slices(context);
  } else {
    await run_orders(context, slice);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

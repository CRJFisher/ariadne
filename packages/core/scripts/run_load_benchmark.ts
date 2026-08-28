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
  type ArmRequest,
  type ArmResult,
  type IngestOrder,
  type MeasurementRow,
  type SliceSize,
} from "../src/benchmark_corpus_load";
import {
  report_recorded_corpus_pass,
  report_recorded_eviction_cost,
  report_recorded_export_declaration_space,
  report_recorded_full_corpus_baseline,
  report_recorded_name_table,
  report_recorded_order_independence,
  report_recorded_resolution_eviction,
} from "./recorded_measurement_report";

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
      // Which of the payload's two hashes moved is the diagnosis, not a
      // detail: the canonical hash holding means the same entries were found
      // and fed in a different order, and the canonical hash moving means a
      // different set of entries was found. Reported as one boolean, an
      // ordering residue reads as a membership regression.
      const other = others.find((arm) => arm.row.ingest_order === entry.order);
      const membership_moved =
        other?.row.diagnostics.canonical_hash !==
        baseline.row.diagnostics.canonical_hash;
      console.log(
        `  ${entry.order}: diagnostics payload differs — ${
          membership_moved
            ? "canonical hash moved, so its MEMBERSHIP differs"
            : "canonical hash held, so only the EMISSION ORDER of its evidence lists differs"
        }`,
      );
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

  report_recorded_order_independence(baseline.row.file_counts.offered);
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

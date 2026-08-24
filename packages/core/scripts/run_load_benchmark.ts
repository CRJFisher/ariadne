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
  create_session_id,
  diff_ingest_orders,
  discover_corpus,
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
import { cite_row, format_citation } from "../src/benchmark_corpus_load/measurement_row";

/** The heap the corpus needs; the default ceiling kills a full-corpus arm. */
const HEAP_MB = 6144;

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
  if (index === -1 || index === process.argv.length - 1) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required flag --${name}`);
  }
  return process.argv[index + 1];
}

function has_flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function repo_root(): string {
  let dir = __dirname;
  while (!fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("could not locate repo root");
    dir = parent;
  }
  return dir;
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
      "  --corpus-name <name>    default microsoft/vscode",
      "  --corpus-commit <sha>   required: a row without it is not a measurement",
      "  --predicate <name>      src | repository-root | folder:<p> | folder-ts:<p>",
      "  --slice <n|full>        default full",
      "  --candidate-repo <path> the second checkout, for --interleave",
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
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        `--max-old-space-size=${HEAP_MB}`,
        __filename,
        "--run-arm",
        JSON.stringify(request),
        "--out",
        out,
      ],
      { cwd: repo_root(), stdio: ["ignore", "ignore", "inherit"] },
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Arm "${request.arm}" (sequence ${request.sequence_index}) exited ${code}. ` +
              "No usable result; a partial arm is never substituted for a finished one.",
          ),
        );
        return;
      }
      read_arm_result(out).then(resolve, reject);
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

async function run_interleaved(context: RunContext, slice: SliceSize): Promise<void> {
  const control_repo = repo_root();
  const candidate_repo = flag("candidate-repo", control_repo);
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

  const speedup = measure_speedup_against_control(
    control.map((result) => result.row),
    candidate.map((result) => result.row),
  );
  console.log(
    `\nspeedup ${speedup.speedup}x (control ${speedup.control.mean}s / candidate ${speedup.candidate.mean}s, session ${speedup.session_id})`,
  );
}

async function run_slices(context: RunContext): Promise<void> {
  const discovered = await discover_corpus(context.corpus_root, context.predicate);
  const sizes = plan_nested_slices(discovered);
  console.log(`nested slices over ${discovered.length} discovered files: ${sizes.join(", ")}`);

  let sequence_index = 0;
  for (const size of sizes) {
    const rows: MeasurementRow[] = [];
    for (let repetition = 0; repetition < REPETITIONS; repetition++) {
      const result = await spawn_arm(
        arm_request(context, `slice-${size}`, sequence_index, size, "forward", repo_root()),
        path.join(context.run_dir, `${sequence_index}-slice-${size}.arm`),
      );
      rows.push(result.row);
      sequence_index++;
    }
    report_rows(`slice ${size}`, rows);
  }
}

async function run_orders(context: RunContext, slice: SliceSize): Promise<void> {
  // One arm per process, compared pairwise against the baseline: a full corpus
  // cannot hold four of its own fingerprints in one heap.
  const baseline = await spawn_arm(
    arm_request(context, "order-forward", 0, slice, "forward", repo_root()),
    path.join(context.run_dir, "0-order-forward.arm"),
  );

  const others: ArmResult[] = [];
  let sequence_index = 1;
  for (const order of INGEST_ORDERS) {
    if (order === "forward") continue;
    others.push(
      await spawn_arm(
        arm_request(context, `order-${order}`, sequence_index, slice, order, repo_root()),
        path.join(context.run_dir, `${sequence_index}-order-${order}.arm`),
      ),
    );
    sequence_index++;
  }

  const verdict = diff_ingest_orders(baseline, others);
  console.log(`\n${format_citation(cite_row(baseline.row))}`);
  console.log(`baseline order: ${verdict.baseline_order}`);
  for (const entry of verdict.comparisons) {
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

  // The silence above is only evidence because the probe was shown to report a
  // difference on a tree that had one. That demonstration travels with it.
  const recorded = verdict.recorded_validation;
  console.log(
    `validated against ${recorded.ariadne_tree} on ${recorded.corpus}@${recorded.corpus_commit} ` +
      `(${recorded.predicate}, ${recorded.file_count} files): ${recorded.entry_points_moved} entry points moved ` +
      `(${recorded.entry_points_forward} -> ${recorded.entry_points_descending_size}), ` +
      `${Object.values(recorded.legacy_hashes).filter((pair) => pair.changed).length} of ` +
      `${Object.keys(recorded.legacy_hashes).length} recorded hashes changed`,
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

  const session_id = create_session_id();
  const run_dir = path.join(os.homedir(), ".ariadne", "benchmark-runs", session_id);
  fs.mkdirSync(run_dir, { recursive: true });

  const context: RunContext = {
    session_id,
    run_dir,
    corpus_name: flag("corpus-name", "microsoft/vscode"),
    corpus_root,
    corpus_commit: flag("corpus-commit"),
    predicate: parse_corpus_predicate_name(flag("predicate", "src")),
    seed: Number(flag("seed", "1")),
  };

  const slice_flag = flag("slice", "full");
  const slice: SliceSize = slice_flag === "full" ? "full" : Number(slice_flag);

  console.log(`session ${session_id}`);
  console.log(`results in ${run_dir}`);

  if (has_flag("interleave")) {
    await run_interleaved(context, slice);
  } else if (has_flag("slices")) {
    await run_slices(context);
  } else if (has_flag("orders")) {
    await run_orders(context, slice);
  } else {
    show_help();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

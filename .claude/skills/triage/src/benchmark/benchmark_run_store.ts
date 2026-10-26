/**
 * On-disk layout of benchmark runs:
 *
 *   benchmark_runs/<started_at>--<model>/
 *     run.json                     the run's configuration
 *     replays/<case_id>.r<n>.json  one ReplayRecord per case and repeat
 *     score.json                   the run graded against the suite
 *     store/                       the scratch triage store the replays read and write
 */

import fs from "node:fs";
import path from "node:path";

import { default_store_dir } from "../store/store_layout.js";
import type { LabelledCase } from "./load_benchmark_suite.js";
import { score_benchmark_verdicts, type BenchmarkScore, type VerdictUnderTest } from "./score_benchmark_verdicts.js";
import type { ReplayRecord } from "./replay_investigation.js";

export const BENCHMARK_RUNS_SUBDIR = "benchmark_runs";

export interface BenchmarkRunConfig {
  run_id: string;
  model: string;
  coordinator_model: string;
  repeats: number;
  case_ids: string[];
  sdk_version: string;
  suite_dir: string;
  started_at: string;
}

export function benchmark_runs_root(store_dir: string = default_store_dir()): string {
  return path.join(store_dir, BENCHMARK_RUNS_SUBDIR);
}

export function benchmark_run_id(started_at: string, model: string): string {
  return `${started_at.replace(/[:.]/g, "-")}--${model}`;
}

export function replay_record_path(run_dir: string, case_id: string, repeat: number): string {
  return path.join(run_dir, "replays", `${case_id}.r${repeat}.json`);
}

export function scratch_store_dir(run_dir: string): string {
  return path.join(run_dir, "store");
}

export function write_json(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

export function read_run_config(run_dir: string): BenchmarkRunConfig {
  return JSON.parse(fs.readFileSync(path.join(run_dir, "run.json"), "utf8")) as BenchmarkRunConfig;
}

export function read_replay_records(run_dir: string): ReplayRecord[] {
  const dir = path.join(run_dir, "replays");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as ReplayRecord);
}

/** Every run under `root`, newest first. */
export function list_benchmark_runs(root: string = benchmark_runs_root()): { run_dir: string; config: BenchmarkRunConfig }[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .map((name) => path.join(root, name))
    .filter((dir) => fs.existsSync(path.join(dir, "run.json")))
    .map((run_dir) => ({ run_dir, config: read_run_config(run_dir) }))
    .sort((a, b) => b.config.started_at.localeCompare(a.config.started_at));
}

export interface RunScore extends BenchmarkScore {
  answer_key_exposures: string[];
  efficiency: {
    total_usd: number;
    coordinator_usd: number;
    mean_usd_per_replay: number | null;
    mean_turns: number | null;
  };
}

/**
 * Grade a run's replays against the suite's current labels and write the
 * result to the run's `score.json`, so the file always reflects the labels
 * it was last graded against.
 */
export function write_run_score(run_dir: string, cases: readonly LabelledCase[]): RunScore {
  const records = read_replay_records(run_dir);
  const total_usd = records.reduce((t, r) => t + (r.usage?.usd ?? 0), 0);
  const coordinator_usd = records.reduce((t, r) => t + (r.usage?.coordinator_usd ?? 0), 0);
  const turns = records.reduce((t, r) => t + (r.usage?.turns ?? 0), 0);
  const score: RunScore = {
    ...score_benchmark_verdicts(records.map(verdict_under_test), cases),
    answer_key_exposures: records.filter((r) => r.saw_answer_key).map((r) => `${r.case_id} r${r.repeat}`),
    efficiency: {
      total_usd: Math.round(total_usd * 10000) / 10000,
      coordinator_usd: Math.round(coordinator_usd * 10000) / 10000,
      mean_usd_per_replay: records.length === 0 ? null : Math.round((total_usd / records.length) * 100000) / 100000,
      mean_turns: records.length === 0 ? null : Math.round((turns / records.length) * 100) / 100,
    },
  };
  write_json(path.join(run_dir, "score.json"), score);
  return score;
}

export function verdict_under_test(record: ReplayRecord): VerdictUnderTest {
  const verdict = record.verdict;
  return {
    case_id: record.case_id,
    kind: verdict?.kind ?? null,
    rule_id: verdict?.kind === "fp-classifier-regression" ? verdict.should_have_matched_rule_id : null,
    evidence_file: verdict?.member_evidence.file ?? null,
  };
}

/**
 * On-disk layout of benchmark runs:
 *
 *   benchmark_runs/<started_at>--<model>/
 *     run.json                     the run's configuration
 *     replays/<case_id>.r<n>.json  one ReplayRecord per case and repeat
 *     score.json                   the run graded against the suite
 */

import fs from "node:fs";
import path from "node:path";

import type { EffortLevel } from "@anthropic-ai/claude-agent-sdk";

import { count_prefix_misses } from "../investigate/investigation_pool.js";
import { describe_investigator_model } from "../investigate/investigator_model.js";
import { default_store_dir } from "../store/store_layout.js";
import type { LabelledCase } from "./load_benchmark_suite.js";
import { score_benchmark_verdicts, type BenchmarkScore, type VerdictUnderTest } from "./score_benchmark_verdicts.js";
import type { ReplayRecord } from "./replay_investigation.js";

export const BENCHMARK_RUNS_SUBDIR = "benchmark_runs";

export interface BenchmarkRunConfig {
  run_id: string;
  model: string;
  /** `null` for a model without effort control. */
  effort: EffortLevel | null;
  repeats: number;
  case_ids: string[];
  sdk_version: string;
  suite_dir: string;
  started_at: string;
}

export function benchmark_runs_root(store_dir: string = default_store_dir()): string {
  return path.join(store_dir, BENCHMARK_RUNS_SUBDIR);
}

export function benchmark_run_id(started_at: string, run_label: string): string {
  return `${started_at.replace(/[:.]/g, "-")}--${run_label.replace("@", "-")}`;
}

/** The configuration a run compares as: its model, with its effort when it takes one. */
export function run_label(config: Pick<BenchmarkRunConfig, "model" | "effort">): string {
  return describe_investigator_model(config);
}

export function replay_record_path(run_dir: string, case_id: string, repeat: number): string {
  return path.join(run_dir, "replays", `${case_id}.r${repeat}.json`);
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
  efficiency: {
    total_usd: number;
    mean_usd_per_replay: number | null;
    mean_turns: number | null;
    /** Replays that started into a warm cache yet missed the shared prefix (see `count_prefix_misses`). */
    prefix_miss: number;
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
  const turns = records.reduce((t, r) => t + (r.usage?.turns ?? 0), 0);
  const score: RunScore = {
    ...score_benchmark_verdicts(records.map(verdict_under_test), cases),
    efficiency: {
      total_usd: Math.round(total_usd * 10000) / 10000,
      mean_usd_per_replay: records.length === 0 ? null : Math.round((total_usd / records.length) * 100000) / 100000,
      mean_turns: records.length === 0 ? null : Math.round((turns / records.length) * 100) / 100,
      prefix_miss: count_prefix_misses(
        records.map((r) => ({ lead: r.lead, turn1_cache_read_input_tokens: r.usage?.turn1_cache_read_input_tokens ?? 0 })),
      ),
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

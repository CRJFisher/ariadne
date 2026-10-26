#!/usr/bin/env node
/**
 * Replay the triage benchmark through the pipeline's investigation and grade
 * the verdicts.
 *
 *   node --import tsx .claude/skills/triage/scripts/run_benchmark.ts --model claude-haiku-5-5 --effort medium [--repeats 2]
 *     [--concurrency 4] [--cases <id,id,...>] [--max-usd <n>] [--resume <run_dir>]
 *
 * `--effort` is required for a model with effort control and refused for
 * `claude-haiku-4-5`, which runs with thinking disabled. Each case replays
 * `--repeats` times through the same warm-up pool the pipeline uses. Records
 * land under `~/.ariadne/triage-entrypoints/benchmark_runs/<started_at>--<label>/`,
 * one file per replay as it finishes, so `--resume` picks up exactly the
 * replays still missing. Dispatch stops at the first account error (spend,
 * rate limit, auth) and once the run's spend reaches `--max-usd`.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import type { EffortLevel } from "@anthropic-ai/claude-agent-sdk";

import { load_registry } from "../src/known_issues_registry.js";
import { repos_root, default_store_dir } from "../src/store/store_layout.js";
import {
  benchmark_run_id,
  benchmark_runs_root,
  read_replay_records,
  read_run_config,
  replay_record_path,
  run_label,
  write_json,
  write_run_score,
  type BenchmarkRunConfig,
} from "../src/benchmark/benchmark_run_store.js";
import { load_benchmark_suite, type LabelledCase } from "../src/benchmark/load_benchmark_suite.js";
import { replay_investigation, replay_payload } from "../src/benchmark/replay_investigation.js";
import { run_investigation_pool } from "../src/investigate/investigation_pool.js";
import { EFFORT_LEVELS, investigator_model } from "../src/investigate/investigator_model.js";
import { InvestigationStoppedError } from "../src/investigate/run_investigation.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const SDK_PACKAGE_JSON = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "node_modules",
  "@anthropic-ai",
  "claude-agent-sdk",
  "package.json",
);

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function clone_head(clone_dir: string): string | null {
  try {
    return execFileSync("git", ["-C", clone_dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function clone_dir(project: string): string {
  return path.join(repos_root(default_store_dir()), project);
}

/** Every case must replay against the clone and the rules its gold label was graded on. */
function check_replay_inputs(cases: readonly LabelledCase[], snapshot_rules: unknown): void {
  if (JSON.stringify(load_registry()) !== JSON.stringify(snapshot_rules)) {
    fail("The live classifier registry differs from benchmark/v1/registry_snapshot.json; regression verdicts would be graded against rules the investigator never saw.");
  }
  const drifted = new Set<string>();
  for (const { case: kase } of cases) {
    const head = clone_head(clone_dir(kase.project));
    if (head === null || !head.startsWith(kase.commit)) drifted.add(`${kase.project} (want ${kase.commit}, have ${head ?? "no clone"})`);
  }
  if (drifted.size > 0) fail(`Clones are not at the benchmark's pinned commits:\n  ${[...drifted].join("\n  ")}`);
}

function parse_effort(raw: string | undefined): EffortLevel | null {
  if (raw === undefined) return null;
  const level = EFFORT_LEVELS.find((l) => l === raw);
  if (level === undefined) fail(`--effort must be one of ${EFFORT_LEVELS.join(", ")}`);
  return level;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      model: { type: "string" },
      effort: { type: "string" },
      repeats: { type: "string", default: "2" },
      concurrency: { type: "string", default: "4" },
      cases: { type: "string" },
      resume: { type: "string" },
      "max-usd": { type: "string" },
    },
  });
  const max_usd = values["max-usd"] === undefined ? Infinity : Number(values["max-usd"]);
  const suite = load_benchmark_suite();

  let run_dir: string;
  let config: BenchmarkRunConfig;
  if (values.resume !== undefined) {
    run_dir = path.resolve(values.resume);
    config = read_run_config(run_dir);
  } else {
    if (values.model === undefined) fail("--model is required (for example claude-haiku-5-5)");
    const wanted = values.cases?.split(",").map((s) => s.trim());
    const unknown = wanted?.filter((id) => !suite.cases.some((c) => c.case.case_id === id)) ?? [];
    if (unknown.length > 0) fail(`Unknown case ids: ${unknown.join(", ")}`);
    const started_at = new Date().toISOString();
    const effort = parse_effort(values.effort);
    config = {
      run_id: benchmark_run_id(started_at, run_label({ model: values.model, effort })),
      model: values.model,
      effort,
      repeats: Number(values.repeats),
      case_ids: wanted ?? suite.cases.map((c) => c.case.case_id),
      sdk_version: (JSON.parse(fs.readFileSync(SDK_PACKAGE_JSON, "utf8")) as { version: string }).version,
      suite_dir: suite.suite_dir,
      started_at,
    };
    run_dir = path.join(benchmark_runs_root(), config.run_id);
  }
  let model;
  try {
    model = investigator_model(config.model, config.effort);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  const cases = suite.cases.filter((c) => config.case_ids.includes(c.case.case_id));
  check_replay_inputs(cases, suite.registry_snapshot);
  write_json(path.join(run_dir, "run.json"), config);

  // Rendering every context before any paid call means a case that cannot be
  // rendered fails the run up front, not after the spend.
  const pending = cases.flatMap((labelled) => {
    const payload = replay_payload(labelled.case, clone_dir(labelled.case.project), suite.registry_snapshot);
    return Array.from({ length: config.repeats }, (_, i) => ({ labelled, payload, repeat: i + 1 })).filter(
      ({ repeat }) => !fs.existsSync(replay_record_path(run_dir, labelled.case.case_id, repeat)),
    );
  });
  process.stdout.write(`${config.run_id}: ${pending.length} replays to run on ${run_label(config)}\n`);

  let done = 0;
  let spent = read_replay_records(run_dir).reduce((t, r) => t + (r.usage?.usd ?? 0), 0);
  const in_flight = new Set<AbortController>();
  const pool = await run_investigation_pool({
    tasks: pending,
    concurrency: Number(values.concurrency),
    stop_reason: () => (spent >= max_usd ? `spend cap reached ($${spent.toFixed(2)} of $${max_usd})` : null),
    investigate: async (task, warm_up) => {
      const kase = task.labelled.case;
      const abort = new AbortController();
      in_flight.add(abort);
      try {
        const record = await replay_investigation({
          case_id: kase.case_id,
          repeat: task.repeat,
          payload: task.payload,
          clone_dir: clone_dir(kase.project),
          model,
          lead: warm_up.lead,
          abort,
          on_first_response: warm_up.on_first_response,
        });
        write_json(replay_record_path(run_dir, kase.case_id, task.repeat), record);
        done += 1;
        spent += record.usage?.usd ?? 0;
        const outcome = record.verdict?.kind ?? `no verdict (${record.error})`;
        process.stdout.write(`[${done}] ${kase.case_id} r${task.repeat}: ${outcome} $${record.usage?.usd.toFixed(4) ?? "?"}\n`);
        return "done";
      } catch (err) {
        // A replay that dies before its result leaves no record, so --resume retries it.
        if (err instanceof InvestigationStoppedError) for (const other of in_flight) if (other !== abort) other.abort();
        throw new Error(`${kase.case_id} r${task.repeat}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
      } finally {
        in_flight.delete(abort);
      }
    },
  });

  const summary = write_run_score(run_dir, cases);
  process.stdout.write(`${JSON.stringify(summary, null, 1)}\nRun directory: ${run_dir}\n`);
  if (pool.stopped !== null) fail(`Stopped early: ${pool.stopped}. Resume with --resume ${run_dir}`);
}

main().catch((error: unknown) => fail(`Error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`));

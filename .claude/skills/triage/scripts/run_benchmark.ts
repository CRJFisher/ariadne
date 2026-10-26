#!/usr/bin/env node
/**
 * Replay the triage benchmark through the investigator and grade the verdicts.
 *
 *   node --import tsx .claude/skills/triage/scripts/run_benchmark.ts --model claude-haiku-4-5 --coordinator-model claude-haiku-5-5 [--repeats 2]
 *     [--concurrency 4] [--cases <id,id,...>] [--max-usd <n>] [--resume <run_dir>]
 *
 * Each case replays `--repeats` times. A coordinator session on
 * `--coordinator-model` dispatches each investigation, as the triage skill does;
 * it must run on a different model so the investigator's spend can be read off
 * per model. Records land under
 * `~/.ariadne/triage-entrypoints/benchmark_runs/<started_at>--<model>/`, one file
 * per replay as it finishes, so `--resume` picks up exactly the replays still
 * missing. Dispatch stops at the first account error (spend, rate limit, auth)
 * and once the run's total spend reaches `--max-usd`.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { repo_root } from "@ariadnejs/skill-protocol";

import { load_registry } from "../src/known_issues_registry.js";
import { repos_root, default_store_dir } from "../src/store/store_layout.js";
import {
  benchmark_run_id,
  benchmark_runs_root,
  read_replay_records,
  read_run_config,
  replay_record_path,
  scratch_store_dir,
  write_json,
  write_run_score,
  type BenchmarkRunConfig,
} from "../src/benchmark/benchmark_run_store.js";
import { load_benchmark_suite, type LabelledCase } from "../src/benchmark/load_benchmark_suite.js";
import {
  INVESTIGATOR_DEFINITION_PATH,
  parse_investigator_definition,
  replay_investigation,
} from "../src/benchmark/replay_investigation.js";
import { stage_replay_run } from "../src/benchmark/stage_replay_run.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const SDK_PACKAGE_JSON = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "node_modules",
  "@anthropic-ai",
  "claude-agent-sdk",
  "package.json",
);

const GET_ENTRY_CONTEXT = ".claude/skills/triage/scripts/get_entry_context.ts";

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

/** Every case must replay against the clone and the rules its gold label was graded on. */
function check_replay_inputs(cases: readonly LabelledCase[], snapshot_rules: unknown): void {
  if (JSON.stringify(load_registry()) !== JSON.stringify(snapshot_rules)) {
    fail("The live classifier registry differs from benchmark/v1/registry_snapshot.json; regression verdicts would be graded against rules the investigator never saw.");
  }
  const drifted = new Set<string>();
  for (const { case: kase } of cases) {
    const head = clone_head(path.join(repos_root(default_store_dir()), kase.project));
    if (head === null || !head.startsWith(kase.commit)) drifted.add(`${kase.project} (want ${kase.commit}, have ${head ?? "no clone"})`);
  }
  if (drifted.size > 0) fail(`Clones are not at the benchmark's pinned commits:\n  ${[...drifted].join("\n  ")}`);
}

/** Every pending case must yield the investigator's context before any investigation is paid for. */
function preflight_context(tasks: readonly { labelled: LabelledCase; repeat: number }[], store_dir: string): void {
  const failures: string[] = [];
  for (const { labelled } of tasks.filter((t, i, all) => all.findIndex((u) => u.labelled === t.labelled) === i)) {
    const kase = labelled.case;
    const staged = stage_replay_run(store_dir, kase, 0, path.join(repos_root(default_store_dir()), kase.project));
    try {
      execFileSync(
        process.execPath,
        ["--import", "tsx", GET_ENTRY_CONTEXT, "--project", staged.project, "--run-id", staged.run_id, "--entry", String(staged.entry_index)],
        { cwd: repo_root(), env: { ...process.env, ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE: store_dir }, stdio: ["ignore", "ignore", "pipe"] },
      );
    } catch (err) {
      const stderr = err instanceof Error && "stderr" in err ? String(err.stderr).trim() : String(err);
      failures.push(`${kase.case_id}: ${stderr}`);
    }
  }
  if (failures.length > 0) fail(`get_entry_context.ts fails on ${failures.length} cases:\n  ${failures.join("\n  ")}`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      model: { type: "string" },
      "coordinator-model": { type: "string" },
      repeats: { type: "string", default: "2" },
      concurrency: { type: "string", default: "4" },
      cases: { type: "string" },
      resume: { type: "string" },
      "max-usd": { type: "string" },
    },
  });
  const max_usd = values["max-usd"] === undefined ? Infinity : Number(values["max-usd"]);
  const suite = load_benchmark_suite();
  const definition = parse_investigator_definition(fs.readFileSync(INVESTIGATOR_DEFINITION_PATH, "utf8"));

  let run_dir: string;
  let config: BenchmarkRunConfig;
  if (values.resume !== undefined) {
    run_dir = path.resolve(values.resume);
    config = read_run_config(run_dir);
  } else {
    if (values.model === undefined) fail("--model is required (for example claude-haiku-4-5)");
    const coordinator_model = values["coordinator-model"];
    if (coordinator_model === undefined) fail("--coordinator-model is required and must differ from --model (for example claude-haiku-5-5)");
    const wanted = values.cases?.split(",").map((s) => s.trim());
    const unknown = wanted?.filter((id) => !suite.cases.some((c) => c.case.case_id === id)) ?? [];
    if (unknown.length > 0) fail(`Unknown case ids: ${unknown.join(", ")}`);
    const started_at = new Date().toISOString();
    config = {
      run_id: benchmark_run_id(started_at, values.model),
      model: values.model,
      coordinator_model,
      repeats: Number(values.repeats),
      case_ids: wanted ?? suite.cases.map((c) => c.case.case_id),
      sdk_version: (JSON.parse(fs.readFileSync(SDK_PACKAGE_JSON, "utf8")) as { version: string }).version,
      suite_dir: suite.suite_dir,
      started_at,
    };
    run_dir = path.join(benchmark_runs_root(), config.run_id);
    write_json(path.join(run_dir, "run.json"), config);
  }

  const cases = suite.cases.filter((c) => config.case_ids.includes(c.case.case_id));
  check_replay_inputs(cases, suite.registry_snapshot);

  const store_dir = scratch_store_dir(run_dir);
  const pending = cases.flatMap((labelled) =>
    Array.from({ length: config.repeats }, (_, i) => ({ labelled, repeat: i + 1 })).filter(
      ({ repeat }) => !fs.existsSync(replay_record_path(run_dir, labelled.case.case_id, repeat)),
    ),
  );
  preflight_context(pending, store_dir);
  process.stdout.write(`${config.run_id}: ${pending.length} replays to run on ${config.model}\n`);

  let stopped: string | null = null;
  let done = 0;
  let spent = read_replay_records(run_dir).reduce((t, r) => t + (r.usage === null ? 0 : r.usage.usd + r.usage.coordinator_usd), 0);
  const worker = async (): Promise<void> => {
    while (stopped === null) {
      if (spent >= max_usd) {
        stopped = `spend cap reached ($${spent.toFixed(2)} of $${max_usd})`;
        return;
      }
      const task = pending.shift();
      if (task === undefined) return;
      const kase = task.labelled.case;
      const clone_dir = path.join(repos_root(default_store_dir()), kase.project);
      const staged = stage_replay_run(store_dir, kase, task.repeat, clone_dir);
      try {
        const record = await replay_investigation({
          staged,
          case_id: kase.case_id,
          repeat: task.repeat,
          model: config.model,
          coordinator_model: config.coordinator_model,
          store_dir,
          definition,
        });
        write_json(replay_record_path(run_dir, kase.case_id, task.repeat), record);
        done += 1;
        spent += record.usage === null ? 0 : record.usage.usd + record.usage.coordinator_usd;
        const outcome = record.verdict?.kind ?? `no verdict (${record.error})`;
        process.stdout.write(`[${done}] ${kase.case_id} r${task.repeat}: ${outcome} $${record.usage?.usd.toFixed(4) ?? "?"}\n`);
      } catch (err) {
        // A session that dies before its result leaves no record, so --resume retries it.
        stopped = `${kase.case_id} r${task.repeat}: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  };
  await Promise.all(Array.from({ length: Number(values.concurrency) }, worker));

  const summary = write_run_score(run_dir, cases);
  process.stdout.write(`${JSON.stringify(summary, null, 1)}\nRun directory: ${run_dir}\n`);
  if (stopped !== null) fail(`Stopped early: ${stopped}. Resume with --resume ${run_dir}`);
}

main().catch((error: unknown) => fail(`Error: ${error instanceof Error ? error.stack ?? error.message : String(error)}`));

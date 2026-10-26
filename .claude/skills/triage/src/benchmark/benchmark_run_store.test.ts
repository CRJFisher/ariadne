import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  benchmark_run_id,
  list_benchmark_runs,
  read_replay_records,
  replay_record_path,
  verdict_under_test,
  write_json,
  write_run_score,
  type BenchmarkRunConfig,
} from "./benchmark_run_store.js";
import { load_benchmark_suite } from "./load_benchmark_suite.js";
import type { ReplayRecord } from "./replay_investigation.js";

const record = (verdict: ReplayRecord["verdict"]): ReplayRecord => ({
  case_id: "c1",
  repeat: 1,
  model: "claude-haiku-5-5",
  verdict,
  error: null,
  usage: null,
  tool_calls: [],
  saw_answer_key: false,
  permission_denials: [],
});

describe("benchmark_run_id", () => {
  it("makes the start time path-safe and names the model", () => {
    expect(benchmark_run_id("2026-10-25T14:40:01.123Z", "claude-haiku-5-5")).toEqual(
      "2026-10-25T14-40-01-123Z--claude-haiku-5-5",
    );
  });
});

describe("verdict_under_test", () => {
  it("carries the rule of a regression verdict and its cited file", () => {
    expect(
      verdict_under_test(
        record({
          kind: "fp-classifier-regression",
          should_have_matched_rule_id: "rule-x",
          evidence_excerpt: "e",
          member_evidence: { file: "lib/a.js", line: 3, why: "w" },
        }),
      ),
    ).toEqual({ case_id: "c1", kind: "fp-classifier-regression", rule_id: "rule-x", evidence_file: "lib/a.js" });
  });

  it("grades a record without a verdict as missing", () => {
    expect(verdict_under_test(record(null))).toEqual({ case_id: "c1", kind: null, rule_id: null, evidence_file: null });
  });
});

describe("run listing", () => {
  let root: string;
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("lists runs newest first and reads their replay records", () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "bench-runs-"));
    const config = (started_at: string): BenchmarkRunConfig => ({
      run_id: benchmark_run_id(started_at, "m"),
      model: "m",
      coordinator_model: "c",
      repeats: 1,
      case_ids: ["c1"],
      sdk_version: "0.3.304",
      suite_dir: "/suite",
      started_at,
    });
    const older = path.join(root, "older");
    const newer = path.join(root, "newer");
    write_json(path.join(older, "run.json"), config("2026-10-01T00:00:00.000Z"));
    write_json(path.join(newer, "run.json"), config("2026-10-02T00:00:00.000Z"));
    fs.mkdirSync(path.join(root, "no-config"));
    write_json(replay_record_path(newer, "c1", 1), record(null));

    expect(list_benchmark_runs(root).map((r) => r.run_dir)).toEqual([newer, older]);
    expect(read_replay_records(newer)).toEqual([record(null)]);
    expect(read_replay_records(older)).toEqual([]);
  });
});

describe("write_run_score", () => {
  let run_dir: string;
  afterEach(() => fs.rmSync(run_dir, { recursive: true, force: true }));

  it("grades the run's replays against the suite and rewrites score.json", () => {
    run_dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-score-"));
    const labelled = load_benchmark_suite().cases.filter((c) => c.case.case_id === "Automattic--mongoose__applyStatics__L9");
    const usage = (usd: number, coordinator_usd: number, turns: number): ReplayRecord["usage"] => ({
      usd,
      coordinator_usd,
      turns,
      duration_ms: 1000,
      input_tokens: 10,
      output_tokens: 100,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      turn1_cache_read_input_tokens: 0,
      turn1_cache_creation_input_tokens: 0,
      model_usd: {},
    });
    const novel: ReplayRecord["verdict"] = {
      kind: "fp-novel",
      proposed_root_cause: "require binding",
      evidence_excerpt: "applyStatics(d, schema)",
      member_evidence: { file: "lib/model.js", line: 1044, why: "calls it" },
    };
    write_json(path.join(run_dir, "score.json"), { stale: true });
    write_json(replay_record_path(run_dir, labelled[0].case.case_id, 1), {
      ...record(novel),
      case_id: labelled[0].case.case_id,
      usage: usage(0.03, 0.01, 6),
    });
    write_json(replay_record_path(run_dir, labelled[0].case.case_id, 2), {
      ...record(null),
      case_id: labelled[0].case.case_id,
      repeat: 2,
      usage: usage(0.01, 0.01, 2),
      saw_answer_key: true,
    });

    const score = write_run_score(run_dir, labelled);

    expect(JSON.parse(fs.readFileSync(path.join(run_dir, "score.json"), "utf8"))).toEqual(score);
    expect({
      n: score.n,
      missing_verdicts: score.missing_verdicts,
      kind_accuracy_pct: score.kind_accuracy_pct,
      answer_key_exposures: score.answer_key_exposures,
      efficiency: score.efficiency,
    }).toEqual({
      n: 2,
      missing_verdicts: 1,
      kind_accuracy_pct: 50,
      answer_key_exposures: ["Automattic--mongoose__applyStatics__L9 r2"],
      efficiency: { total_usd: 0.04, coordinator_usd: 0.02, mean_usd_per_replay: 0.02, mean_turns: 4 },
    });
  });
});

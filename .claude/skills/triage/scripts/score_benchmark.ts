#!/usr/bin/env node
/**
 * Grade verdicts against the triage benchmark's gold labels.
 *
 *   node --import tsx .claude/skills/triage/scripts/score_benchmark.ts --run <benchmark_run_dir>
 *   node --import tsx .claude/skills/triage/scripts/score_benchmark.ts --prior latest|all
 *
 * `--run` grades a `run_benchmark.ts` run against the current labels and
 * rewrites its `score.json`. `--prior` grades the pipeline verdicts recorded
 * in the case files: the latest per case, or all of them.
 */

import path from "node:path";
import { parseArgs } from "node:util";

import { write_run_score } from "../src/benchmark/benchmark_run_store.js";
import { load_benchmark_suite } from "../src/benchmark/load_benchmark_suite.js";
import { score_benchmark_verdicts } from "../src/benchmark/score_benchmark_verdicts.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const { values } = parseArgs({ options: { run: { type: "string" }, prior: { type: "string" } } });
const suite = load_benchmark_suite();

if (values.run !== undefined) {
  process.stdout.write(`${JSON.stringify(write_run_score(path.resolve(values.run), suite.cases), null, 1)}\n`);
} else if (values.prior === "latest" || values.prior === "all") {
  const which = values.prior;
  const verdicts = suite.cases.flatMap(({ case: kase }) =>
    (which === "latest" ? kase.prior_verdicts.slice(-1) : kase.prior_verdicts).map((v) => ({
      case_id: kase.case_id,
      kind: v.kind,
      rule_id: v.rule,
      evidence_file: v.evidence?.file ?? null,
    })),
  );
  process.stdout.write(`${JSON.stringify(score_benchmark_verdicts(verdicts, suite.cases), null, 1)}\n`);
} else {
  process.stderr.write("Pass --run <benchmark_run_dir> or --prior latest|all\n");
  process.exit(2);
}

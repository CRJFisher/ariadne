/**
 * The frozen triage benchmark: one `TriageEntry` per case, its gold label, and
 * the classifier registry the labels were graded against.
 *
 * A case names its corpus by `project` and reads source from the local clone
 * under `repos/<project>/`. Some cases were recorded inside a container, so
 * every path that points into *some* machine's `.../triage-entrypoints/repos/<project>/`
 * is rebased onto this machine's clone before anything reads it.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { KnownIssue } from "@ariadnejs/types";

import type { TriageEntry } from "../triage_state_types.js";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The suite every benchmark script reads unless told otherwise. */
export const BENCHMARK_SUITE_DIR = path.join(SKILL_DIR, "benchmark", "v1");

export type VerdictKind = "tp" | "fp-novel" | "fp-classifier-regression" | "uncertain";

export const VERDICT_KINDS: readonly VerdictKind[] = [
  "tp",
  "fp-novel",
  "fp-classifier-regression",
  "uncertain",
];

/** A verdict recorded by an earlier pipeline run, frozen into the case. */
export interface PriorVerdict {
  run_id: string;
  kind: VerdictKind;
  rule: string | null;
  root_cause: string | null;
  evidence: { file: string; line: number; why: string } | null;
  turns: number | null;
  usd: number | null;
}

export interface BenchmarkCase {
  case_id: string;
  strata: string;
  project: string;
  github: string;
  commit: string;
  language: string;
  diagnosis: string;
  member_symbol: { file_path: string; name: string; kind: string; start_line: number };
  entry: TriageEntry;
  prior_verdicts: PriorVerdict[];
}

export interface CallerEvidence {
  file: string;
  line: number;
  snippet: string;
}

export interface GoldLabel {
  case_id: string;
  gold_kind: VerdictKind;
  acceptable_kinds: VerdictKind[];
  gold_rule_id: string | null;
  caller_evidence: CallerEvidence[];
  tp_search_summary: string | null;
  confidence: "high" | "medium" | "low";
  rationale: string;
  prior_verdicts_assessment: string;
}

export interface LabelledCase {
  case: BenchmarkCase;
  label: GoldLabel;
}

export interface BenchmarkSuite {
  suite_dir: string;
  cases: LabelledCase[];
  registry_snapshot: KnownIssue[];
}

/**
 * Rebase every path inside `value` that points into a `repos/<project>/` clone
 * onto `clone_dir`. Strings that do not point into that clone pass through.
 */
export function rebase_clone_paths<T>(value: T, project: string, clone_dir: string): T {
  const marker = `/triage-entrypoints/repos/${project}/`;
  const rebase = (node: unknown): unknown => {
    if (typeof node === "string") {
      const at = node.indexOf(marker);
      return at === -1 ? node : path.join(clone_dir, node.slice(at + marker.length));
    }
    if (Array.isArray(node)) return node.map(rebase);
    if (node !== null && typeof node === "object") {
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, rebase(v)]));
    }
    return node;
  };
  return rebase(value) as T;
}

/** The path of `file` relative to `clone_dir`, whichever machine's clone it names. */
export function clone_relative_path(file: string, project: string, clone_dir: string): string {
  const rebased = rebase_clone_paths(file, project, clone_dir);
  return path.isAbsolute(rebased) ? path.relative(clone_dir, rebased) : rebased;
}

function read_json(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function expect_string(raw: unknown, ctx: string): string {
  if (typeof raw !== "string" || raw.length === 0) throw new Error(`${ctx} must be a non-empty string`);
  return raw;
}

function expect_kind(raw: unknown, ctx: string): VerdictKind {
  if (!VERDICT_KINDS.includes(raw as VerdictKind)) {
    throw new Error(`${ctx} must be one of ${VERDICT_KINDS.join(", ")}; got ${JSON.stringify(raw)}`);
  }
  return raw as VerdictKind;
}

/** Check the fields every consumer of a label relies on; the scorer grades against these. */
export function validate_gold_label(raw: unknown, file: string): GoldLabel {
  const label = raw as GoldLabel;
  expect_string(label.case_id, `${file}: case_id`);
  expect_kind(label.gold_kind, `${file}: gold_kind`);
  if (!Array.isArray(label.acceptable_kinds) || !label.acceptable_kinds.includes(label.gold_kind)) {
    throw new Error(`${file}: acceptable_kinds must be an array containing gold_kind`);
  }
  label.acceptable_kinds.forEach((k, i) => expect_kind(k, `${file}: acceptable_kinds[${i}]`));
  const regression_acceptable = label.acceptable_kinds.includes("fp-classifier-regression");
  if (regression_acceptable !== (label.gold_rule_id !== null)) {
    throw new Error(`${file}: gold_rule_id is required exactly when fp-classifier-regression is acceptable`);
  }
  if (!Array.isArray(label.caller_evidence)) throw new Error(`${file}: caller_evidence must be an array`);
  return label;
}

const DIAGNOSTIC_LISTS = ["grep_call_sites", "grep_call_sites_outside_index", "reference_sites", "ariadne_call_refs"] as const;

/**
 * A case replays through today's `get_entry_context.ts`, so its frozen entry
 * must carry every diagnostics list that script formats. The case's own
 * diagnosis slices the score and names the route on the review page, so it
 * must be the route the investigator is shown.
 */
export function validate_case_entry(kase: BenchmarkCase, file: string): BenchmarkCase {
  const diagnostics = kase.entry?.diagnostics;
  if (diagnostics === undefined) throw new Error(`${file}: entry has no diagnostics`);
  const missing = DIAGNOSTIC_LISTS.filter((list) => !Array.isArray(diagnostics[list]));
  if (missing.length > 0) throw new Error(`${file}: entry diagnostics lack ${missing.join(", ")}`);
  if (kase.diagnosis !== kase.entry.diagnosis) {
    throw new Error(`${file}: diagnosis ${kase.diagnosis} differs from the entry's ${kase.entry.diagnosis}`);
  }
  return kase;
}

/** Load every labelled case of a suite, sorted by case id. */
export function load_benchmark_suite(suite_dir: string = BENCHMARK_SUITE_DIR): BenchmarkSuite {
  const labels_dir = path.join(suite_dir, "labels");
  const cases = fs
    .readdirSync(labels_dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f): LabelledCase => {
      const label = validate_gold_label(read_json(path.join(labels_dir, f)), `labels/${f}`);
      const kase = read_json(path.join(suite_dir, "cases", f)) as BenchmarkCase;
      if (kase.case_id !== label.case_id) {
        throw new Error(`cases/${f} names case ${kase.case_id}, its label names ${label.case_id}`);
      }
      return { case: validate_case_entry(kase, `cases/${f}`), label };
    });
  const snapshot = read_json(path.join(suite_dir, "registry_snapshot.json")) as { rules: KnownIssue[] };
  return { suite_dir, cases, registry_snapshot: snapshot.rules };
}

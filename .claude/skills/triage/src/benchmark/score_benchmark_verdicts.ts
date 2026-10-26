/**
 * Grade investigator verdicts against the benchmark's gold labels.
 *
 * Evidence is graded at file level, not line level: a correct verdict may cite
 * any of several call sites in the same caller file.
 */

import path from "node:path";

import type { BenchmarkCase, GoldLabel, LabelledCase, VerdictKind } from "./load_benchmark_suite.js";

/** One verdict to grade. `kind: null` is a case that produced no valid verdict. */
export interface VerdictUnderTest {
  case_id: string;
  kind: VerdictKind | null;
  rule_id: string | null;
  evidence_file: string | null;
}

export interface VerdictGrade {
  kind_ok: boolean;
  strict_ok: boolean;
  /** Graded only for an accepted regression verdict. */
  rule_ok: boolean | null;
  /** Graded only for a false-positive verdict against a label that cites callers. */
  evidence_ok: boolean | null;
}

export function grade_verdict(verdict: VerdictUnderTest, label: GoldLabel): VerdictGrade {
  const kind_ok = verdict.kind !== null && label.acceptable_kinds.includes(verdict.kind);
  const rule_ok =
    verdict.kind === "fp-classifier-regression" && kind_ok ? verdict.rule_id === label.gold_rule_id : null;
  const is_fp = verdict.kind === "fp-novel" || verdict.kind === "fp-classifier-regression";
  const evidence_ok =
    is_fp && label.caller_evidence.length > 0
      ? label.caller_evidence.some((e) => path.basename(e.file) === path.basename(verdict.evidence_file ?? ""))
      : null;
  return { kind_ok, strict_ok: verdict.kind === label.gold_kind, rule_ok, evidence_ok };
}

export interface BenchmarkScore {
  n: number;
  missing_verdicts: number;
  kind_accuracy_pct: number | null;
  strict_kind_accuracy_pct: number | null;
  rule_id_accuracy_pct: number | null;
  evidence_file_match_pct: number | null;
  /** Verdicts that called a gold false positive `tp`: each hides a real resolver gap. */
  fp_to_tp_errors: number;
  /** Cases whose verdicts disagree on kind across repeats. */
  repeat_disagreements: string[];
  by_slice: Record<string, string>;
  confusion: Record<string, number>;
  misses: { case_id: string; gold: VerdictKind; got: VerdictKind | null; confidence: GoldLabel["confidence"] }[];
}

function pct(hits: number, total: number): number | null {
  return total === 0 ? null : Math.round((1000 * hits) / total) / 10;
}

function increment(counter: Map<string, { ok: number; n: number }>, key: string, ok: boolean): void {
  const slot = counter.get(key) ?? { ok: 0, n: 0 };
  slot.n += 1;
  slot.ok += ok ? 1 : 0;
  counter.set(key, slot);
}

/** Score every verdict; a case may carry several (one per repeat). */
export function score_benchmark_verdicts(
  verdicts: readonly VerdictUnderTest[],
  cases: readonly LabelledCase[],
): BenchmarkScore {
  const by_id = new Map<string, { case: BenchmarkCase; label: GoldLabel }>(cases.map((c) => [c.case.case_id, c]));
  let kind_ok = 0;
  let strict_ok = 0;
  let rule_ok = 0;
  let rule_n = 0;
  let evidence_ok = 0;
  let evidence_n = 0;
  let missing = 0;
  let fp_to_tp = 0;
  const slices = new Map<string, { ok: number; n: number }>();
  const confusion = new Map<string, number>();
  const kinds_by_case = new Map<string, Set<string>>();
  const misses: BenchmarkScore["misses"] = [];

  for (const verdict of verdicts) {
    const labelled = by_id.get(verdict.case_id);
    if (labelled === undefined) throw new Error(`verdict for unknown case ${verdict.case_id}`);
    const { label } = labelled;
    const grade = grade_verdict(verdict, label);
    kind_ok += grade.kind_ok ? 1 : 0;
    strict_ok += grade.strict_ok ? 1 : 0;
    missing += verdict.kind === null ? 1 : 0;
    if (grade.rule_ok !== null) {
      rule_n += 1;
      rule_ok += grade.rule_ok ? 1 : 0;
    }
    if (grade.evidence_ok !== null) {
      evidence_n += 1;
      evidence_ok += grade.evidence_ok ? 1 : 0;
    }
    if (verdict.kind === "tp" && !label.acceptable_kinds.includes("tp")) fp_to_tp += 1;
    increment(slices, `language:${labelled.case.language}`, grade.kind_ok);
    increment(slices, `diagnosis:${labelled.case.diagnosis}`, grade.kind_ok);
    increment(slices, `gold:${label.gold_kind}`, grade.kind_ok);
    const cell = `${label.gold_kind} -> ${verdict.kind}`;
    confusion.set(cell, (confusion.get(cell) ?? 0) + 1);
    const seen = kinds_by_case.get(verdict.case_id) ?? new Set<string>();
    seen.add(String(verdict.kind));
    kinds_by_case.set(verdict.case_id, seen);
    if (!grade.kind_ok) {
      misses.push({ case_id: verdict.case_id, gold: label.gold_kind, got: verdict.kind, confidence: label.confidence });
    }
  }

  return {
    n: verdicts.length,
    missing_verdicts: missing,
    kind_accuracy_pct: pct(kind_ok, verdicts.length),
    strict_kind_accuracy_pct: pct(strict_ok, verdicts.length),
    rule_id_accuracy_pct: pct(rule_ok, rule_n),
    evidence_file_match_pct: pct(evidence_ok, evidence_n),
    fp_to_tp_errors: fp_to_tp,
    repeat_disagreements: [...kinds_by_case].filter(([, kinds]) => kinds.size > 1).map(([id]) => id).sort(),
    by_slice: Object.fromEntries([...slices].sort(([a], [b]) => a.localeCompare(b)).map(([k, s]) => [k, `${s.ok}/${s.n}`])),
    confusion: Object.fromEntries([...confusion].sort(([, a], [, b]) => b - a)),
    misses,
  };
}

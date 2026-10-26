/**
 * Everything a reviewer sees for one case: the entry and its source, every
 * verdict reached on it (the gold label, each benchmark run's replays, and the
 * pipeline verdicts frozen into the case), the distinct verdicts those form,
 * and the rules and evidence they argue from.
 */

import fs from "node:fs";
import path from "node:path";

import type { KnownIssue } from "@ariadnejs/types";

import type { TriageVerdict } from "../../verdict/triage_verdict.js";
import {
  clone_relative_path,
  type LabelledCase,
  type PriorVerdict,
  type VerdictKind,
} from "../load_benchmark_suite.js";
import type { ToolCall } from "../../investigate/run_investigation.js";
import type { ReplayRecord } from "../replay_investigation.js";

export const GOLD_LABEL_SOURCE = "opus-label";

/** The investigator ran on Sonnet until commit 9eeab71f moved it to Haiku on this date. */
const INVESTIGATOR_ON_HAIKU_FROM = "2026-10-13";
const DIAGNOSTIC_LIST_CAP = 30;

export interface SourceLine {
  n: number;
  text: string;
}

export interface Excerpt {
  file: string;
  line: number;
  missing: boolean;
  lines: SourceLine[];
}

export interface VerdictView {
  source: string;
  source_label: string;
  repeat: number | null;
  kind: VerdictKind | null;
  rule_id: string | null;
  explanation: string;
  evidence: { why: string; excerpt: Excerpt } | null;
  usd: number | null;
  turns: number | null;
  tool_calls: ToolCall[];
  error: string | null;
}

export interface CandidateHolder {
  source: string;
  source_label: string;
  count: number;
  of: number;
}

export interface Candidate {
  key: string;
  kind: VerdictKind;
  rule_id: string | null;
  holders: CandidateHolder[];
}

export interface ScopedRule {
  group_id: string;
  title: string;
  description: string;
  /** Named by the gold label or by any verdict on this case. */
  cited: boolean;
  /** Other suite cases whose gold label names this rule. */
  example_case_ids: string[];
}

export interface CappedList<T> {
  total: number;
  items: T[];
}

export interface ReviewCase {
  case_id: string;
  project: string;
  github: string;
  commit: string;
  language: string;
  diagnosis: string;
  strata: string;
  /** Medium-confidence labels and labels with a second acceptable kind. */
  flagged: boolean;
  disagreement: DisagreementId;
  entry: {
    name: string;
    kind: string;
    signature: string | null;
    is_exported: boolean;
    definition: Excerpt;
  };
  label: {
    kind: VerdictKind;
    acceptable_kinds: VerdictKind[];
    rule_id: string | null;
    confidence: string;
    rationale: string;
    tp_search_summary: string | null;
    prior_verdicts_assessment: string;
    caller_evidence: Excerpt[];
  };
  verdicts: VerdictView[];
  historical: VerdictView[];
  candidates: Candidate[];
  rules: ScopedRule[];
  diagnostics: {
    grep_call_sites: CappedList<{ site: string; content: string }>;
    grep_call_sites_outside_index: CappedList<{ site: string; content: string }>;
    reference_sites: CappedList<{ site: string; content: string }>;
    ariadne_call_refs: CappedList<{ site: string; caller: string; resolution: string }>;
  };
}

/** A benchmark run's replays, under the name of the model that produced them. */
export interface ModelRun {
  model: string;
  records: ReplayRecord[];
}

/** `claude-haiku-5-5@low` reads as `Haiku 5.5 (low)`. */
export function model_label(model: string): string {
  const match = model.match(/^claude-([a-z]+)-(\d+)-(\d+)(?:@(\w+))?/);
  if (match === null) return model;
  const [, family, major, minor, effort] = match;
  return `${family[0].toUpperCase()}${family.slice(1)} ${major}.${minor}${effort === undefined ? "" : ` (${effort})`}`;
}

/** The model a recorded pipeline verdict came from, read off its run's start date. */
export function prior_verdict_source(run_id: string): { source: string; source_label: string } {
  const started = run_id.slice(run_id.indexOf("-") + 1, run_id.indexOf("-") + 11);
  return started >= INVESTIGATOR_ON_HAIKU_FROM
    ? { source: "pipeline-haiku-4-5", source_label: "Haiku 4.5 (pipeline run)" }
    : { source: "pipeline-sonnet", source_label: "Sonnet (pipeline run)" };
}

export type DisagreementId = "real-caller" | "rule-or-novel" | "which-rule" | "undecided" | "confirm-label" | "agreed";

export interface DisagreementGroup {
  id: DisagreementId;
  title: string;
  /** What the reviewer has to settle for every case in the group. */
  question: string;
  needs_vote: boolean;
}

/**
 * The shapes a case's verdicts can disagree in, in review order. Each names
 * the step of the verdict definitions the disagreement turns on, so a group of
 * cases is settled by answering one question.
 */
export const DISAGREEMENT_GROUPS: readonly DisagreementGroup[] = [
  {
    id: "real-caller",
    title: "Real entry point or false positive?",
    question:
      "Some verdicts say nothing calls this definition (tp); others found a caller. Decide whether a real in-repo call reaches this exact definition.",
    needs_vote: true,
  },
  {
    id: "rule-or-novel",
    title: "Known rule or new resolver gap?",
    question:
      "Every verdict found a caller. Decide whether an in-scope rule's described intent covers that call pattern (fp-classifier-regression) or no rule targets it (fp-novel).",
    needs_vote: true,
  },
  {
    id: "which-rule",
    title: "Which rule should have caught it?",
    question: "Every verdict says a rule should have caught the caller, but they name different rules.",
    needs_vote: true,
  },
  {
    id: "undecided",
    title: "Some runs could not decide",
    question: "The decided verdicts agree, but at least one run answered uncertain or wrote no valid verdict. Confirm the agreed verdict.",
    needs_vote: true,
  },
  {
    id: "confirm-label",
    title: "Everyone agrees, but the label is flagged",
    question: "Every verdict matches the Opus label, which is medium confidence or lists a second acceptable kind. Confirm it.",
    needs_vote: true,
  },
  {
    id: "agreed",
    title: "Everyone agrees",
    question: "Every verdict matches a high-confidence Opus label.",
    needs_vote: false,
  },
];

/** The disagreement a case's verdicts (the gold label's among them) form. */
export function classify_disagreement(views: readonly VerdictView[], flagged: boolean): DisagreementId {
  const decided = views.filter((v) => v.kind !== null && v.kind !== "uncertain");
  const kinds = new Set(decided.map((v) => v.kind));
  if (kinds.has("tp") && (kinds.has("fp-novel") || kinds.has("fp-classifier-regression"))) return "real-caller";
  if (kinds.has("fp-novel") && kinds.has("fp-classifier-regression")) return "rule-or-novel";
  if (new Set(decided.filter((v) => v.kind === "fp-classifier-regression").map((v) => v.rule_id)).size > 1) return "which-rule";
  if (decided.length < views.length) return "undecided";
  return flagged ? "confirm-label" : "agreed";
}

export function candidate_key(kind: VerdictKind, rule_id: string | null): string {
  return rule_id === null ? kind : `${kind}:${rule_id}`;
}

function verdict_rule(verdict: TriageVerdict): string | null {
  return verdict.kind === "fp-classifier-regression" ? verdict.should_have_matched_rule_id : null;
}

function verdict_explanation(verdict: TriageVerdict): string {
  switch (verdict.kind) {
    case "tp":
      return verdict.member_evidence.why;
    case "fp-novel":
      return `${verdict.proposed_root_cause}\n\n${verdict.evidence_excerpt}`;
    case "fp-classifier-regression":
      return verdict.evidence_excerpt;
    case "uncertain":
      return verdict.reason;
  }
}

/**
 * Group every verdict into the distinct (kind, rule) candidates a reviewer
 * chooses between, each listing who reached it and how often.
 */
export function group_candidates(views: readonly VerdictView[]): Candidate[] {
  const totals = new Map<string, number>();
  for (const v of views) totals.set(v.source, (totals.get(v.source) ?? 0) + 1);
  const candidates = new Map<string, Candidate>();
  for (const v of views) {
    if (v.kind === null) continue;
    const key = candidate_key(v.kind, v.rule_id);
    const candidate = candidates.get(key) ?? { key, kind: v.kind, rule_id: v.rule_id, holders: [] };
    const holder = candidate.holders.find((h) => h.source === v.source);
    if (holder === undefined) {
      candidate.holders.push({ source: v.source, source_label: v.source_label, count: 1, of: totals.get(v.source) ?? 1 });
    } else {
      holder.count += 1;
    }
    candidates.set(key, candidate);
  }
  const held = (c: Candidate): number => c.holders.reduce((t, h) => t + h.count, 0);
  return [...candidates.values()].sort((a, b) => held(b) - held(a) || b.holders.length - a.holders.length);
}

class SourceReader {
  private readonly files = new Map<string, string[] | null>();

  constructor(
    private readonly clone_dir: string,
    private readonly project: string,
  ) {}

  excerpt(file: string, line: number, before: number, after: number): Excerpt {
    const rel = clone_relative_path(file, this.project, this.clone_dir);
    if (!this.files.has(rel)) {
      const abs = path.join(this.clone_dir, rel);
      this.files.set(rel, fs.existsSync(abs) ? fs.readFileSync(abs, "utf8").split("\n") : null);
    }
    const all = this.files.get(rel) ?? null;
    if (all === null) return { file: rel, line, missing: true, lines: [] };
    const from = Math.max(1, line - before);
    const to = Math.min(all.length, line + after);
    const lines: SourceLine[] = [];
    for (let n = from; n <= to; n++) lines.push({ n, text: all[n - 1] });
    return { file: rel, line, missing: false, lines };
  }

  relative(file: string): string {
    return clone_relative_path(file, this.project, this.clone_dir);
  }
}

function capped<T>(items: readonly T[] | undefined): CappedList<T> {
  const all = items ?? [];
  return { total: all.length, items: all.slice(0, DIAGNOSTIC_LIST_CAP) };
}

export interface AssembleInput {
  labelled: LabelledCase;
  clone_dir: string;
  model_runs: readonly ModelRun[];
  rules: readonly KnownIssue[];
  /** Gold rule id per case id, across the whole suite. */
  gold_rules: ReadonlyMap<string, string | null>;
}

export function assemble_review_case(input: AssembleInput): ReviewCase {
  const { case: kase, label } = input.labelled;
  const reader = new SourceReader(input.clone_dir, kase.project);

  const replay_views = input.model_runs.flatMap((run) =>
    run.records
      .filter((r) => r.case_id === kase.case_id)
      .sort((a, b) => a.repeat - b.repeat)
      .map(
        (r): VerdictView => ({
          source: run.model,
          source_label: model_label(run.model),
          repeat: r.repeat,
          kind: r.verdict?.kind ?? null,
          rule_id: r.verdict === null ? null : verdict_rule(r.verdict),
          explanation: r.verdict === null ? "" : verdict_explanation(r.verdict),
          evidence:
            r.verdict === null
              ? null
              : { why: r.verdict.member_evidence.why, excerpt: reader.excerpt(r.verdict.member_evidence.file, r.verdict.member_evidence.line, 4, 4) },
          usd: r.usage?.usd ?? null,
          turns: r.usage?.turns ?? null,
          tool_calls: r.tool_calls,
          error: r.error,
        }),
      ),
  );

  const label_view: VerdictView = {
    source: GOLD_LABEL_SOURCE,
    source_label: "Opus label",
    repeat: null,
    kind: label.gold_kind,
    rule_id: label.gold_kind === "fp-classifier-regression" ? label.gold_rule_id : null,
    explanation: label.rationale,
    evidence: null,
    usd: null,
    turns: null,
    tool_calls: [],
    error: null,
  };

  const historical = kase.prior_verdicts.map((v: PriorVerdict): VerdictView => ({
    ...prior_verdict_source(v.run_id),
    repeat: null,
    kind: v.kind,
    rule_id: v.rule,
    explanation: v.root_cause ?? "",
    evidence: v.evidence === null ? null : { why: v.evidence.why, excerpt: reader.excerpt(v.evidence.file, v.evidence.line, 4, 4) },
    usd: v.usd,
    turns: v.turns,
    tool_calls: [],
    error: null,
  }));

  const candidates = group_candidates([label_view, ...replay_views]);
  const flagged = label.confidence !== "high" || label.acceptable_kinds.length > 1;
  const cited = new Set(
    [label.gold_rule_id, ...replay_views.map((v) => v.rule_id), ...historical.map((v) => v.rule_id)].filter(
      (r): r is string => r !== null,
    ),
  );
  const entry = kase.entry;
  const diag = entry.diagnostics;

  return {
    case_id: kase.case_id,
    project: kase.project,
    github: kase.github,
    commit: kase.commit,
    language: kase.language,
    diagnosis: kase.diagnosis,
    strata: kase.strata,
    flagged,
    disagreement: classify_disagreement([label_view, ...replay_views], flagged),
    entry: {
      name: entry.name,
      kind: entry.kind,
      signature: entry.signature,
      is_exported: entry.is_exported,
      definition: reader.excerpt(entry.file_path, entry.start_line, 4, 30),
    },
    label: {
      kind: label.gold_kind,
      acceptable_kinds: label.acceptable_kinds,
      rule_id: label.gold_rule_id,
      confidence: label.confidence,
      rationale: label.rationale,
      tp_search_summary: label.tp_search_summary,
      prior_verdicts_assessment: label.prior_verdicts_assessment,
      caller_evidence: label.caller_evidence.map((e) => reader.excerpt(e.file, e.line, 6, 6)),
    },
    verdicts: replay_views,
    historical,
    candidates,
    rules: input.rules
      .filter((r) => r.status !== "fixed" && r.languages.some((l) => l === kase.language))
      .map((r) => ({
        group_id: r.group_id,
        title: r.title,
        description: r.description,
        cited: cited.has(r.group_id),
        example_case_ids: [...input.gold_rules]
          .filter(([id, rule]) => rule === r.group_id && id !== kase.case_id)
          .map(([id]) => id),
      })),
    diagnostics: {
      grep_call_sites: capped(diag.grep_call_sites.map((s) => ({ site: `${reader.relative(s.file_path)}:${s.line}`, content: s.content.trim() }))),
      grep_call_sites_outside_index: capped(
        diag.grep_call_sites_outside_index.map((s) => ({ site: `${reader.relative(s.file_path)}:${s.line}`, content: s.content.trim() })),
      ),
      reference_sites: capped(diag.reference_sites.map((s) => ({ site: `${reader.relative(s.file_path)}:${s.line}`, content: s.content.trim() }))),
      ariadne_call_refs: capped(
        diag.ariadne_call_refs.map((r) => ({
          site: `${reader.relative(r.caller_file)}:${r.call_line}`,
          caller: r.caller_function,
          resolution: r.resolved_to.length > 0 ? `resolved to ${r.resolved_to.join(", ")}` : "unresolved",
        })),
      ),
    },
  };
}

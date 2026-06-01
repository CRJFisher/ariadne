/**
 * Pure diff over two `FinalizationOutput`s (schema v5).
 *
 * Surface the cross-run signals the iteration loop cares about:
 *   - Entry-level appearance/disappearance and TP↔uncertain flips on the
 *     `confirmed_unreachable` / `uncertain` partitions.
 *   - Novel-issue diff: which `novel_issue.id`s are added / removed between runs.
 *   - Classifier-regression diff: which wip rule_ids picked up new flagged
 *     entries between runs (curator drift signal).
 *
 * Match key for entries: `(name, file_path_relative, kind, start_line)`
 * exactly, with `(name, file_path_relative, kind)` as a fuzzy fallback to
 * absorb line-shift noise so a mere insertion above a function does not
 * register as "appeared/disappeared".
 */

import type {
  FinalizationOutput,
  PublishedConfirmedUnreachable,
  PublishedUncertain,
} from "../finalize/output.js";

export interface EntryRef {
  name: string;
  file_path: string;
  kind: string;
  start_line: number;
  signature?: string;
}

type Classification = "tp" | "uncertain";

export interface FlippedEntry {
  entry: EntryRef;
  from_classification: Classification;
  to_classification: Classification;
}

export interface ClassifierRegressionDelta {
  rule_id: string;
  flagged_from: number;
  flagged_to: number;
}

export interface DiffSummary {
  totals_from: SetTotals;
  totals_to: SetTotals;
  appearing: EntryRef[];
  disappearing: EntryRef[];
  flipped: FlippedEntry[];
  novel_issues_added: string[];
  novel_issues_removed: string[];
  classifier_regressions_added: string[];
  classifier_regressions_removed: string[];
  classifier_regression_deltas: ClassifierRegressionDelta[];
}

interface SetTotals {
  total_entries: number;
  confirmed_unreachable: number;
  uncertain: number;
  novel_issues: number;
  classifier_regression_rules: number;
}

function totals(output: FinalizationOutput): SetTotals {
  return {
    total_entries: output.confirmed_unreachable.length + output.uncertain.length,
    confirmed_unreachable: output.confirmed_unreachable.length,
    uncertain: output.uncertain.length,
    novel_issues: output.novel_issues.length,
    classifier_regression_rules: output.classifier_regressions.length,
  };
}

function exact_key(e: { name: string; file_path: string; kind: string; start_line: number }): string {
  return `${e.name}\t${e.file_path}\t${e.kind}\t${e.start_line}`;
}

function fuzzy_key(e: { name: string; file_path: string; kind: string }): string {
  return `${e.name}\t${e.file_path}\t${e.kind}`;
}

interface IndexedEntry {
  entry: PublishedConfirmedUnreachable | PublishedUncertain;
  classification: Classification;
}

interface Indexed {
  by_exact: Map<string, IndexedEntry>;
  by_fuzzy: Map<string, IndexedEntry[]>;
}

function index_output(output: FinalizationOutput): Indexed {
  const by_exact: Indexed["by_exact"] = new Map();
  const by_fuzzy: Indexed["by_fuzzy"] = new Map();

  function insert(record: IndexedEntry): void {
    by_exact.set(exact_key(record.entry), record);
    const fk = fuzzy_key(record.entry);
    const list = by_fuzzy.get(fk) ?? [];
    list.push(record);
    by_fuzzy.set(fk, list);
  }

  for (const fp of output.confirmed_unreachable) insert({ entry: fp, classification: "tp" });
  for (const u of output.uncertain) insert({ entry: u, classification: "uncertain" });
  return { by_exact, by_fuzzy };
}

function entry_ref(e: PublishedConfirmedUnreachable | PublishedUncertain): EntryRef {
  return {
    name: e.name,
    file_path: e.file_path,
    kind: e.kind,
    start_line: e.start_line,
    ...(e.signature !== undefined ? { signature: e.signature } : {}),
  };
}

export function diff_runs(from: FinalizationOutput, to: FinalizationOutput): DiffSummary {
  const idx_from = index_output(from);
  const idx_to = index_output(to);

  const appearing: EntryRef[] = [];
  const disappearing: EntryRef[] = [];
  const flipped: FlippedEntry[] = [];

  const matched_in_from = new Set<string>();

  for (const [k, to_record] of idx_to.by_exact.entries()) {
    let from_record = idx_from.by_exact.get(k);
    let from_key = k;
    if (from_record === undefined) {
      // Fuzzy fallback: same name+file+kind, different start_line. Prefer a
      // candidate with the same classification so a TP↔uncertain line shift
      // does not synthesize a flip; only fall back across classifications
      // when no same-classification candidate is available (genuine flip).
      const candidates = (idx_from.by_fuzzy.get(fuzzy_key(to_record.entry)) ?? []).filter(
        (c) => !matched_in_from.has(exact_key(c.entry)),
      );
      const same_classification = candidates.find(
        (c) => c.classification === to_record.classification,
      );
      const candidate = same_classification ?? candidates[0];
      if (candidate !== undefined) {
        from_record = candidate;
        from_key = exact_key(candidate.entry);
      }
    }

    if (from_record === undefined) {
      appearing.push(entry_ref(to_record.entry));
      continue;
    }

    matched_in_from.add(from_key);

    if (from_record.classification !== to_record.classification) {
      flipped.push({
        entry: entry_ref(to_record.entry),
        from_classification: from_record.classification,
        to_classification: to_record.classification,
      });
    }
  }

  for (const [k, from_record] of idx_from.by_exact.entries()) {
    if (matched_in_from.has(k)) continue;
    disappearing.push(entry_ref(from_record.entry));
  }

  return {
    totals_from: totals(from),
    totals_to: totals(to),
    appearing,
    disappearing,
    flipped,
    ...novel_issue_diff(from, to),
    ...classifier_regression_diff(from, to),
  };
}

function novel_issue_diff(
  from: FinalizationOutput,
  to: FinalizationOutput,
): {
  novel_issues_added: string[];
  novel_issues_removed: string[];
} {
  const from_ids = new Set(from.novel_issues.map((i) => i.id));
  const to_ids = new Set(to.novel_issues.map((i) => i.id));
  const novel_issues_added: string[] = [];
  const novel_issues_removed: string[] = [];
  for (const id of to_ids) if (!from_ids.has(id)) novel_issues_added.push(id);
  for (const id of from_ids) if (!to_ids.has(id)) novel_issues_removed.push(id);
  novel_issues_added.sort();
  novel_issues_removed.sort();
  return { novel_issues_added, novel_issues_removed };
}

function classifier_regression_diff(
  from: FinalizationOutput,
  to: FinalizationOutput,
): {
  classifier_regressions_added: string[];
  classifier_regressions_removed: string[];
  classifier_regression_deltas: ClassifierRegressionDelta[];
} {
  const from_by_rule = new Map(from.classifier_regressions.map((r) => [r.rule_id, r]));
  const to_by_rule = new Map(to.classifier_regressions.map((r) => [r.rule_id, r]));
  const classifier_regressions_added: string[] = [];
  const classifier_regressions_removed: string[] = [];
  const classifier_regression_deltas: ClassifierRegressionDelta[] = [];
  for (const id of to_by_rule.keys()) if (!from_by_rule.has(id)) classifier_regressions_added.push(id);
  for (const id of from_by_rule.keys()) if (!to_by_rule.has(id)) classifier_regressions_removed.push(id);
  classifier_regressions_added.sort();
  classifier_regressions_removed.sort();
  const all_ids = new Set<string>([...from_by_rule.keys(), ...to_by_rule.keys()]);
  for (const id of [...all_ids].sort()) {
    const f = from_by_rule.get(id);
    const t = to_by_rule.get(id);
    classifier_regression_deltas.push({
      rule_id: id,
      flagged_from: f?.flagged_entries.length ?? 0,
      flagged_to: t?.flagged_entries.length ?? 0,
    });
  }
  return {
    classifier_regressions_added,
    classifier_regressions_removed,
    classifier_regression_deltas,
  };
}

// Helper used by the CLI for the text output format.
export function format_diff_text(diff: DiffSummary, from_id: string, to_id: string): string {
  const lines: string[] = [];
  lines.push(`Diff: ${from_id} → ${to_id}`);
  lines.push("");
  lines.push("Set-level deltas:");
  lines.push(`  total_entries:           ${diff.totals_from.total_entries} → ${diff.totals_to.total_entries}`);
  lines.push(`  confirmed_unreachable:   ${diff.totals_from.confirmed_unreachable} → ${diff.totals_to.confirmed_unreachable}`);
  lines.push(`  uncertain:               ${diff.totals_from.uncertain} → ${diff.totals_to.uncertain}`);
  lines.push(`  novel_issues:            ${diff.totals_from.novel_issues} → ${diff.totals_to.novel_issues}`);
  lines.push(
    `  classifier_regressions:  ${diff.totals_from.classifier_regression_rules} → ` +
      `${diff.totals_to.classifier_regression_rules} rule(s)`,
  );
  lines.push("");

  if (diff.flipped.length > 0) {
    lines.push("Verdict flips (regression candidates):");
    for (const f of diff.flipped) {
      const arrow = `${f.from_classification.toUpperCase()} → ${f.to_classification.toUpperCase()}`;
      lines.push(`  ${f.entry.file_path}:${f.entry.start_line} ${f.entry.name} — ${arrow}`);
    }
    lines.push("");
  }

  if (diff.appearing.length > 0) {
    lines.push(`Appearing in ${to_id} (${diff.appearing.length}):`);
    for (const e of diff.appearing) lines.push(`  + ${e.file_path}:${e.start_line} ${e.name}`);
    lines.push("");
  }

  if (diff.disappearing.length > 0) {
    lines.push(`Disappearing from ${from_id} (${diff.disappearing.length}):`);
    for (const e of diff.disappearing) lines.push(`  - ${e.file_path}:${e.start_line} ${e.name}`);
    lines.push("");
  }

  if (diff.novel_issues_added.length > 0) {
    lines.push(`Novel issues added: ${diff.novel_issues_added.join(", ")}`);
  }
  if (diff.novel_issues_removed.length > 0) {
    lines.push(`Novel issues removed: ${diff.novel_issues_removed.join(", ")}`);
  }

  if (diff.classifier_regressions_added.length > 0) {
    lines.push(`Classifier regressions added: ${diff.classifier_regressions_added.join(", ")}`);
  }
  if (diff.classifier_regressions_removed.length > 0) {
    lines.push(`Classifier regressions removed: ${diff.classifier_regressions_removed.join(", ")}`);
  }
  const regression_significant = diff.classifier_regression_deltas.filter(
    (d) => d.flagged_from !== d.flagged_to,
  );
  if (regression_significant.length > 0) {
    if (lines[lines.length - 1] !== "") lines.push("");
    lines.push("Classifier-regression deltas:");
    for (const d of regression_significant) {
      lines.push(`  ${d.rule_id}: ${d.flagged_from} → ${d.flagged_to} flagged`);
    }
  }

  return lines.join("\n");
}

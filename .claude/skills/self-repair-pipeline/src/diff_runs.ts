/**
 * Pure diff over two `FinalizationOutput`s.
 *
 * Match key: `(name, file_path_relative, kind, start_line)` (exact),
 * with `(name, file_path_relative, kind)` as a fuzzy fallback to absorb
 * line-shift noise so a mere insertion above a function does not register
 * as "appeared/disappeared".
 */

import type { FalsePositiveEntry, FalsePositiveGroup } from "@ariadnejs/types";
import type { FinalizationOutput } from "./build_finalization_output.js";

export interface EntryRef {
  name: string;
  file_path: string;
  kind: string;
  start_line: number;
  signature?: string;
}

export interface FlippedEntry {
  entry: EntryRef;
  from_classification: "tp" | "fp";
  to_classification: "tp" | "fp";
  from_group_id: string | null;
  to_group_id: string | null;
}

export interface GroupChange {
  entry: EntryRef;
  from_group_id: string;
  to_group_id: string;
}

export interface DiffSummary {
  totals_from: SetTotals;
  totals_to: SetTotals;
  appearing: EntryRef[];
  disappearing: EntryRef[];
  flipped: FlippedEntry[];
  group_id_changes: GroupChange[];
  groups_added: string[];
  groups_removed: string[];
  groups_membership_delta: Record<string, { added: EntryRef[]; removed: EntryRef[] }>;
}

interface SetTotals {
  total_entries: number;
  confirmed_unreachable: number;
  false_positive_entries: number;
  false_positive_groups: number;
}

function totals(output: FinalizationOutput): SetTotals {
  const fp_entries = Object.values(output.false_positive_groups).reduce(
    (sum, g) => sum + g.entries.length,
    0,
  );
  return {
    total_entries: output.confirmed_unreachable.length + fp_entries,
    confirmed_unreachable: output.confirmed_unreachable.length,
    false_positive_entries: fp_entries,
    false_positive_groups: Object.keys(output.false_positive_groups).length,
  };
}

function exact_key(e: { name: string; file_path: string; kind: string; start_line: number }): string {
  return `${e.name}\t${e.file_path}\t${e.kind}\t${e.start_line}`;
}

function fuzzy_key(e: { name: string; file_path: string; kind: string }): string {
  return `${e.name}\t${e.file_path}\t${e.kind}`;
}

interface Indexed {
  by_exact: Map<string, { entry: FalsePositiveEntry; classification: "tp" | "fp"; group_id: string | null }>;
  by_fuzzy: Map<string, Array<{ entry: FalsePositiveEntry; classification: "tp" | "fp"; group_id: string | null }>>;
}

function index_output(output: FinalizationOutput): Indexed {
  const by_exact: Indexed["by_exact"] = new Map();
  const by_fuzzy: Indexed["by_fuzzy"] = new Map();

  function insert(
    entry: FalsePositiveEntry,
    classification: "tp" | "fp",
    group_id: string | null,
  ): void {
    by_exact.set(exact_key(entry), { entry, classification, group_id });
    const fk = fuzzy_key(entry);
    const list = by_fuzzy.get(fk) ?? [];
    list.push({ entry, classification, group_id });
    by_fuzzy.set(fk, list);
  }

  for (const fp of output.confirmed_unreachable) insert(fp, "tp", "confirmed-unreachable");
  for (const [group_id, group] of Object.entries(output.false_positive_groups)) {
    for (const fp of group.entries) insert(fp, "fp", group_id);
  }
  return { by_exact, by_fuzzy };
}

function entry_ref(e: FalsePositiveEntry): EntryRef {
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
  const group_id_changes: GroupChange[] = [];

  const matched_in_from = new Set<string>();

  for (const [k, to_record] of idx_to.by_exact.entries()) {
    let from_record = idx_from.by_exact.get(k);
    let from_key = k;
    if (from_record === undefined) {
      // Fuzzy fallback: same name+file+kind, different start_line.
      const candidates = idx_from.by_fuzzy.get(fuzzy_key(to_record.entry)) ?? [];
      const candidate = candidates.find((c) => !matched_in_from.has(exact_key(c.entry)));
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
        from_group_id: from_record.group_id,
        to_group_id: to_record.group_id,
      });
    } else if (
      from_record.classification === "fp" &&
      from_record.group_id !== to_record.group_id
    ) {
      group_id_changes.push({
        entry: entry_ref(to_record.entry),
        from_group_id: from_record.group_id ?? "",
        to_group_id: to_record.group_id ?? "",
      });
    }
  }

  for (const [k, from_record] of idx_from.by_exact.entries()) {
    if (matched_in_from.has(k)) continue;
    disappearing.push(entry_ref(from_record.entry));
  }

  const from_groups = new Set(Object.keys(from.false_positive_groups));
  const to_groups = new Set(Object.keys(to.false_positive_groups));
  const groups_added: string[] = [];
  const groups_removed: string[] = [];
  for (const g of to_groups) if (!from_groups.has(g)) groups_added.push(g);
  for (const g of from_groups) if (!to_groups.has(g)) groups_removed.push(g);
  groups_added.sort();
  groups_removed.sort();

  const groups_membership_delta: DiffSummary["groups_membership_delta"] = {};
  for (const g of from_groups) {
    if (!to_groups.has(g)) continue;
    const from_members = new Map(
      from.false_positive_groups[g].entries.map((e) => [exact_key(e), e]),
    );
    const to_members = new Map(
      to.false_positive_groups[g].entries.map((e) => [exact_key(e), e]),
    );
    const added: EntryRef[] = [];
    const removed: EntryRef[] = [];
    for (const [k, e] of to_members) if (!from_members.has(k)) added.push(entry_ref(e));
    for (const [k, e] of from_members) if (!to_members.has(k)) removed.push(entry_ref(e));
    if (added.length > 0 || removed.length > 0) {
      groups_membership_delta[g] = { added, removed };
    }
  }

  return {
    totals_from: totals(from),
    totals_to: totals(to),
    appearing,
    disappearing,
    flipped,
    group_id_changes,
    groups_added,
    groups_removed,
    groups_membership_delta,
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
  lines.push(`  false_positive_entries:  ${diff.totals_from.false_positive_entries} → ${diff.totals_to.false_positive_entries}`);
  lines.push(`  false_positive_groups:   ${diff.totals_from.false_positive_groups} → ${diff.totals_to.false_positive_groups}`);
  lines.push("");

  if (diff.flipped.length > 0) {
    lines.push("Verdict flips (regression candidates):");
    for (const f of diff.flipped) {
      const arrow = `${f.from_classification.toUpperCase()} (${f.from_group_id ?? ""}) → ${f.to_classification.toUpperCase()} (${f.to_group_id ?? ""})`;
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

  if (diff.group_id_changes.length > 0) {
    lines.push("FP entries that changed group_id:");
    for (const c of diff.group_id_changes) {
      lines.push(`  ${c.entry.file_path}:${c.entry.start_line} ${c.entry.name}: ${c.from_group_id} → ${c.to_group_id}`);
    }
    lines.push("");
  }

  if (diff.groups_added.length > 0) lines.push(`Groups added: ${diff.groups_added.join(", ")}`);
  if (diff.groups_removed.length > 0) lines.push(`Groups removed: ${diff.groups_removed.join(", ")}`);

  return lines.join("\n");
}

// Suppress unused warning for FalsePositiveGroup type (re-exported for callers via types only).
export type { FalsePositiveGroup };

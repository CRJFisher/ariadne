import { build_signature } from "@ariadnejs/core";
import type {
  CallGraph,
  CallableNode,
  ClassifiedEntryPoint,
  EntryPointClassification,
} from "@ariadnejs/types";
import { build_symbol_ref } from "./resolve_symbol_ref";

/**
 * Suppressed entry data: a known false positive paired with its node and
 * classification verdict. Sorted alphabetically by file path + line for
 * deterministic output (tree size is irrelevant — these are not entry points
 * worth ranking).
 */
export interface SuppressedEntryData {
  readonly node: CallableNode;
  readonly classification: SuppressedClassification;
}

/**
 * Classifications that can appear in the suppressed bucket. True positives
 * never get suppressed, so they're excluded at the type level — that lets
 * the switch in `format_classification_tag` enumerate exactly the four
 * variants it needs to handle and lean on TS exhaustiveness for safety.
 */
export type SuppressedClassification = Exclude<
  EntryPointClassification,
  { readonly kind: "true_entry_point" }
>;

/**
 * Format a classification verdict as a `[label: detail]` tag.
 *
 * Framework-invoked rules carry both a `group_id` (registry rule identity) and
 * a `framework` (human-readable label) — those produce the canonical
 * `[group_id: framework]` form. Other kinds substitute available metadata
 * (protocol name, indirect-reachability `via.type`) so callers always see a
 * consistent two-part tag — except `test_only`, whose classification type
 * carries no extra field and renders as bare `[test_only]`. The bare form is
 * intentional, not an oversight.
 */
export function format_classification_tag(
  classification: SuppressedClassification
): string {
  switch (classification.kind) {
    case "framework_invoked":
      return `[${classification.group_id}: ${classification.framework}]`;
    case "dunder_protocol":
      return `[dunder_protocol: ${classification.protocol}]`;
    case "test_only":
      // Classification type carries no detail; bare tag is canonical here.
      return "[test_only]";
    case "indirect_only":
      return `[indirect_only: ${classification.via.type}]`;
  }
}

/**
 * Sort suppressed entries deterministically by (file_path, start_line, name).
 */
export function sort_suppressed(
  entries: SuppressedEntryData[]
): SuppressedEntryData[] {
  return [...entries].sort((a, b) => {
    const file_cmp = a.node.location.file_path.localeCompare(
      b.node.location.file_path
    );
    if (file_cmp !== 0) return file_cmp;
    const line_cmp = a.node.location.start_line - b.node.location.start_line;
    if (line_cmp !== 0) return line_cmp;
    return a.node.name.localeCompare(b.node.name);
  });
}

/**
 * Format the suppressed section appended when `show_suppressed: true`.
 *
 * Example:
 * ```
 * ============================================================
 * Suppressed (known false positives):
 *
 * - __str__(self): unknown [dunder_protocol: __str__]
 *   Location: src/foo.py:12
 *   Ref: src/foo.py:12#__str__
 *
 * Total: 1 suppressed
 * ```
 */
export function format_suppressed_section(
  entries: SuppressedEntryData[]
): string {
  const sep = "=".repeat(60);
  const lines: string[] = ["", sep, "Suppressed (known false positives):", ""];

  if (entries.length === 0) {
    lines.push("(none)");
    return lines.join("\n");
  }

  for (const entry of entries) {
    const signature = build_signature(entry.node.definition, entry.node.location);
    const location = `${entry.node.location.file_path}:${entry.node.location.start_line}`;
    const symbol_ref = build_symbol_ref(entry.node);
    const tag = format_classification_tag(entry.classification);

    lines.push(`- ${signature} ${tag}`);
    lines.push(`  Location: ${location}`);
    lines.push(`  Ref: ${symbol_ref}`);
    lines.push("");
  }

  lines.push(`Total: ${entries.length} suppressed`);

  return lines.join("\n");
}

/**
 * Build suppressed-entry data from classified entry points and the call graph.
 *
 * Suppressed entries' nodes live on `call_graph.nodes` (the full callable set)
 * even though their `symbol_id` is filtered out of `call_graph.entry_points`.
 * Entries whose node cannot be resolved are silently skipped — this only
 * happens if the classification result references a stale symbol, which the
 * cache invalidation in `Project` should make impossible.
 */
export function build_suppressed_entries(
  known_false_positives: readonly ClassifiedEntryPoint[],
  call_graph: CallGraph
): SuppressedEntryData[] {
  const entries: SuppressedEntryData[] = [];
  for (const fp of known_false_positives) {
    const node = call_graph.nodes.get(fp.symbol_id);
    if (!node) continue;
    const classification = fp.classification;
    // The core contract is that `known_false_positives` never contains
    // `true_entry_point` (those go in `true_entry_points`). Guarding here
    // narrows the type for the consumer and keeps render code total.
    if (classification.kind === "true_entry_point") continue;
    entries.push({ node, classification });
  }
  return sort_suppressed(entries);
}

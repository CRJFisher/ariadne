#!/usr/bin/env tsx
/**
 * Renders per-language `unsupported_features.{lang}.md` references from the
 * canonical known-issues registry.
 *
 * Output directory: `packages/core/src/index_single_file/query_code_tree/queries/`.
 *
 * The renderer is deterministic so a golden-file test can pin its output.
 * The registry's array order is preserved — entries are listed per-language in
 * the order they appear in `registry.json`.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { load_registry } from "../src/known_issues_registry.js";
import type {
  ClassifierSpec,
  KnownIssue,
  KnownIssueLanguage,
  PredicateExpr,
} from "../src/types.js";

// ===== Paths =====

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, "..");
const REPO_ROOT = path.resolve(SKILL_ROOT, "..", "..", "..");
const QUERIES_DIR = path.resolve(
  REPO_ROOT,
  "packages",
  "core",
  "src",
  "index_single_file",
  "query_code_tree",
  "queries",
);

export const LANGUAGES: readonly KnownIssueLanguage[] = [
  "typescript",
  "javascript",
  "python",
  "rust",
] as const;

// ===== Pure rendering =====

export interface RenderOutput {
  language: KnownIssueLanguage;
  file_name: string;
  content: string;
}

export function render_all(registry: KnownIssue[]): RenderOutput[] {
  return LANGUAGES.map((language) => ({
    language,
    file_name: `unsupported_features.${language}.md`,
    content: render_language(language, registry),
  }));
}

export function render_language(language: KnownIssueLanguage, registry: KnownIssue[]): string {
  const entries = registry.filter((e) => e.languages.includes(language));
  const header: string[] = [];
  header.push(`# Unsupported features — ${language}`);
  header.push("");
  header.push(
    "Canonical list of known Ariadne failure modes that affect this language. " +
      "Generated from `.claude/skills/self-repair-pipeline/known_issues/registry.json` by " +
      "`.claude/skills/self-repair-pipeline/scripts/render_unsupported_features.ts`. " +
      "Do not edit by hand — edit the registry and re-render.",
  );
  header.push("");
  header.push(`Entries: ${entries.length}`);
  if (entries.length === 0) {
    return header.join("\n") + "\n\n_No known failure modes for this language._\n";
  }
  const body = entries.map(render_entry).join("\n");
  return header.join("\n") + "\n\n" + body;
}

function render_entry(entry: KnownIssue): string {
  const lines: string[] = [];
  lines.push(`## \`${entry.group_id}\` — ${entry.title}`);
  lines.push("");
  lines.push(entry.description);
  lines.push("");
  lines.push(...render_fields_table(entry));
  lines.push("");
  if (entry.examples.length > 0) {
    lines.push("**Examples**");
    lines.push("");
    for (const ex of entry.examples) {
      lines.push(`- \`${ex.file}\`:${ex.line} — \`${ex.snippet.replace(/\n/g, " ").replace(/`/g, "\\`")}\``);
    }
    lines.push("");
  }
  if (entry.classifier.kind === "predicate") {
    lines.push("**Predicate**");
    lines.push("");
    lines.push("```");
    lines.push(render_predicate_expr(entry.classifier.expression, 0));
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}

function render_fields_table(entry: KnownIssue): string[] {
  const rows: Array<[string, string]> = [
    ["Field", "Value"],
    ["Status", `\`${entry.status}\``],
    ["Languages", entry.languages.map((l) => `\`${l}\``).join(", ")],
    ["Backlog task", entry.backlog_task ? `\`${entry.backlog_task}\`` : "_none_"],
    ["Classifier", render_classifier_short(entry.classifier)],
  ];
  const cells = rows.map(([k, v]) => [escape_table_cell(k), escape_table_cell(v)] as const);
  const width_0 = Math.max(3, ...cells.map(([k]) => k.length));
  const width_1 = Math.max(3, ...cells.map(([, v]) => v.length));
  const fmt = (a: string, b: string): string =>
    `| ${a.padEnd(width_0)} | ${b.padEnd(width_1)} |`;
  const [head, ...data] = cells;
  return [
    fmt(head[0], head[1]),
    `| ${"-".repeat(width_0)} | ${"-".repeat(width_1)} |`,
    ...data.map(([a, b]) => fmt(a, b)),
  ];
}

function escape_table_cell(cell: string): string {
  return cell.replace(/\|/g, "\\|");
}

function render_classifier_short(classifier: ClassifierSpec): string {
  switch (classifier.kind) {
    case "none":
      return "_none — known, no automated classifier_";
    case "builtin":
      return `builtin \`${classifier.function_name}\` (min_confidence ${classifier.min_confidence})`;
    case "predicate":
      return `predicate, axis ${classifier.axis} (min_confidence ${classifier.min_confidence})`;
  }
}

function render_predicate_expr(expr: PredicateExpr, depth: number): string {
  const indent = "  ".repeat(depth);
  switch (expr.op) {
    case "all":
    case "any": {
      const header = `${indent}${expr.op}:`;
      const children = expr.of.map((child) => render_predicate_expr(child, depth + 1)).join("\n");
      return `${header}\n${children}`;
    }
    case "not":
      return `${indent}not:\n${render_predicate_expr(expr.of, depth + 1)}`;
    case "diagnosis_eq":
    case "language_eq":
    case "resolution_failure_reason_eq":
    case "receiver_kind_eq":
      return `${indent}${expr.op} ${expr.value}`;
    case "decorator_matches":
    case "grep_line_regex":
      return `${indent}${expr.op} ${expr.pattern}`;
    case "has_capture_at_grep_hit":
    case "missing_capture_at_grep_hit":
      return `${indent}${expr.op} ${expr.capture_name}`;
    case "syntactic_feature_eq":
      return `${indent}syntactic_feature_eq ${expr.name}=${expr.value}`;
  }
}

// ===== IO =====

export function write_outputs(outputs: RenderOutput[], target_dir: string = QUERIES_DIR): string[] {
  fs.mkdirSync(target_dir, { recursive: true });
  const written: string[] = [];
  for (const o of outputs) {
    const p = path.join(target_dir, o.file_name);
    fs.writeFileSync(p, o.content, "utf8");
    written.push(p);
  }
  return written;
}

export function get_queries_dir(): string {
  return QUERIES_DIR;
}

// ===== Main =====

function main(): void {
  const registry = load_registry();
  const outputs = render_all(registry);
  const written = write_outputs(outputs);
  for (const p of written) {
     
    console.log(`wrote ${path.relative(REPO_ROOT, p)}`);
  }
}

// Treat this file as executable when invoked directly via tsx.
const argv_entry = process.argv[1];
if (argv_entry && pathToFileURL(path.resolve(argv_entry)).href === import.meta.url) {
  main();
}

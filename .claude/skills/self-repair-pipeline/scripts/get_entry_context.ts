#!/usr/bin/env npx tsx
/**
 * Self-service context script for triage-investigator sub-agents.
 *
 * Each sub-agent runs this script to get its complete investigation prompt.
 * The script discovers the active triage state, loads the entry by index,
 * maps the diagnosis to a prompt template, formats diagnostics into
 * readable text, substitutes placeholders, and outputs the prompt to stdout.
 *
 * Usage:
 *   node --import tsx .claude/skills/self-repair-pipeline/scripts/get_entry_context.ts --entry 62
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { discover_state_file, get_triage_dir } from "../src/discover_state.js";
import type { TriageState, TriageEntry } from "../src/triage_state_types.js";
import type { GrepHit, CallRefDiagnostic, EntryPointDiagnostics, AnalysisResult } from "../src/types.js";

const THIS_FILE = fileURLToPath(import.meta.url);
const THIS_DIR = path.dirname(THIS_FILE);
const SKILL_DIR = path.resolve(THIS_DIR, "..");
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || path.resolve(SKILL_DIR, "../../../..");

// ===== Diagnosis → Template Routing =====

const DIAGNOSIS_TEMPLATE_MAP: Record<string, string> = {
  "callers-not-in-registry": "prompt_callers_not_in_registry.md",
  "callers-in-registry-unresolved": "prompt_resolution_failure.md",
  "callers-in-registry-wrong-target": "prompt_wrong_target.md",
};
const DEFAULT_TEMPLATE = "prompt_generic.md";

// ===== CLI Argument Parsing =====

function parse_args(argv: string[]): { entry_index: number } {
  const args = argv.slice(2);
  let entry_index: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--entry") {
      entry_index = parseInt(args[++i], 10);
    }
  }

  if (entry_index === null || isNaN(entry_index)) {
    console.error("Usage: get_entry_context.ts --entry <index>");
    process.exit(1);
  }

  return { entry_index };
}

// ===== Diagnostics Formatting =====

export function format_grep_hits(hits: GrepHit[]): string {
  if (hits.length === 0) return "(none found)";
  return hits
    .map((h) => `  ${h.file_path}:${h.line}  ${h.content.trim()}`)
    .join("\n");
}

export function format_call_refs(refs: CallRefDiagnostic[]): string {
  if (refs.length === 0) return "(none found)";
  return refs
    .map((r) => {
      const resolved = r.resolved_to.length > 0
        ? `resolved to: ${r.resolved_to.join(", ")}`
        : "unresolved";
      return `  ${r.caller_file}:${r.call_line} (${r.call_type} call from ${r.caller_function}, resolution_count=${r.resolution_count}, ${resolved})`;
    })
    .join("\n");
}

// ===== Template Substitution =====

export function substitute_template(
  template: string,
  entry: TriageEntry,
  diagnostics: EntryPointDiagnostics,
  output_path: string,
): string {
  const replacements: Record<string, string> = {
    "{{entry.name}}": entry.name,
    "{{entry.kind}}": entry.kind,
    "{{entry.file_path}}": entry.file_path,
    "{{entry.start_line}}": String(entry.start_line),
    "{{entry.signature}}": entry.signature ?? "(none)",
    "{{entry.is_exported}}": String(entry.is_exported),
    "{{entry.access_modifier}}": entry.access_modifier ?? "(none)",
    "{{entry.diagnosis}}": entry.diagnosis,
    "{{output_path}}": output_path,
    "{{entry.diagnostics.grep_call_sites_formatted}}": format_grep_hits(diagnostics.grep_call_sites),
    "{{entry.diagnostics.ariadne_call_refs_formatted}}": format_call_refs(diagnostics.ariadne_call_refs),
  };

  let result = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, value);
  }
  return result;
}

// ===== Diagnostics Loading =====

/**
 * Get diagnostics for an entry, preferring state-embedded diagnostics,
 * falling back to loading from the analysis file.
 */
function load_diagnostics(entry: TriageEntry, state: TriageState): EntryPointDiagnostics {
  if (entry.diagnostics !== null) {
    return entry.diagnostics;
  }

  // Fallback: load from analysis file
  const raw = fs.readFileSync(state.analysis_file, "utf8");
  const analysis = JSON.parse(raw) as AnalysisResult;
  const enriched = analysis.entry_points.find(
    (ep) => ep.name === entry.name && ep.file_path === entry.file_path && ep.start_line === entry.start_line,
  );
  if (!enriched) {
    console.error(`Warning: Could not find entry ${entry.name} in analysis file, using empty diagnostics`);
    return { grep_call_sites: [], ariadne_call_refs: [], diagnosis: entry.diagnosis as EntryPointDiagnostics["diagnosis"] };
  }
  return enriched.diagnostics;
}

// ===== Main =====

function main(): void {
  const cli = parse_args(process.argv);

  // Discover state file
  const triage_dir = get_triage_dir(PROJECT_DIR);
  const state_path = discover_state_file(triage_dir);
  if (!state_path) {
    console.error("No active triage state file found");
    process.exit(1);
  }

  // Load state
  const state = JSON.parse(fs.readFileSync(state_path, "utf8")) as TriageState;

  // Find entry
  const entry = state.entries.find((e) => e.entry_index === cli.entry_index);
  if (!entry) {
    console.error(`Entry index ${cli.entry_index} not found in state file`);
    process.exit(1);
  }

  // Load diagnostics
  const diagnostics = load_diagnostics(entry, state);

  // Select template
  const template_name = DIAGNOSIS_TEMPLATE_MAP[entry.diagnosis] ?? DEFAULT_TEMPLATE;
  const template_path = path.join(SKILL_DIR, "templates", template_name);
  if (!fs.existsSync(template_path)) {
    console.error(`Template not found: ${template_path}`);
    process.exit(1);
  }
  const template = fs.readFileSync(template_path, "utf8");

  // Build output path for the sub-agent to write results to
  const output_path = path.join(triage_dir, "results", `${entry.entry_index}.json`);

  // Substitute and output
  const prompt = substitute_template(template, entry, diagnostics, output_path);
  process.stdout.write(prompt);
}

// Only run main() when executed directly
const this_file = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === this_file) {
  main();
}

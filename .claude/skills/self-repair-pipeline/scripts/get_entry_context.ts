#!/usr/bin/env node
/**
 * Self-service context script for triage-investigator sub-agents.
 *
 * Each sub-agent runs this script to get its complete investigation prompt.
 * The script discovers the active triage state, loads the entry by index,
 * selects diagnosis-specific hints, formats diagnostics into readable text,
 * substitutes placeholders into the single prompt template, and outputs
 * the prompt to stdout.
 *
 * Usage:
 *   node --import tsx .claude/skills/self-repair-pipeline/scripts/get_entry_context.ts --project mocha --entry 62
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse_project_arg, parse_run_id_arg } from "../src/cli_args.js";
import { require_run, results_dir_for } from "../src/triage_state_paths.js";
import type { TriageState, TriageEntry } from "../src/triage_state_types.js";
import type {
  GrepHit,
  CallRefDiagnostic,
  EntryPointDiagnostics,
  ClassifierHint,
} from "@ariadnejs/types";
import "../src/guard_tsx_invocation.js";

const USAGE = "Usage: get_entry_context.ts --project <name> --entry <index> [--run-id <id>]";

const THIS_FILE = fileURLToPath(import.meta.url);
const THIS_DIR = path.dirname(THIS_FILE);
const SKILL_DIR = path.resolve(THIS_DIR, "..");
const TEMPLATE_PATH = path.join(SKILL_DIR, "templates", "prompt.md");

// ===== Diagnosis-Specific Hints =====

export interface DiagnosisHints {
  title: string;
  summary: string;
  investigation_guide: string;
  classification_hint: string;
}

const GENERIC_HINTS: DiagnosisHints = {
  title: "General Entry Point Analysis",
  summary:
    "No textual callers were found by grep, or this entry did not match a specific diagnosis category. A broad investigation is needed to determine whether Ariadne missed real callers.",
  investigation_guide: [
    "1. **Read the definition**:",
    "",
    "   - Read `{{entry.file_path}}` around line {{entry.start_line}} to understand the callable",
    "   - Understand its purpose from context, comments, and naming",
    "",
    "2. **Search for callers using varied patterns**:",
    "",
    "   - For functions: `Grep` for `{{entry.name}}(` excluding the definition file",
    "   - For methods: `Grep` for `.{{entry.name}}(` to catch any receiver",
    "   - For constructors: `Grep` for `new ClassName(` patterns",
    "   - Search for dynamic references: string literals, decorator usage, configuration files",
    "   - Check test files: `Grep` for `{{entry.name}}` in `**/*.test.ts` and `**/*.spec.ts`",
    "",
    "3. **Check for indirect invocation patterns**:",
    "",
    "   - Is the function passed as a callback? Search for the function name without parentheses",
    "   - Is it registered in a map/object/array? Search in configuration-like structures",
    "   - Is it invoked via reflection or string-based dispatch?",
    "   - Is it a method on a class used via interface/base class typing?",
    "",
    "4. **Cross-reference the pre-gathered Ariadne call references** in your prompt:",
    "",
    "   - The `Pre-Gathered Evidence → Ariadne call references` block lists every call site Ariadne saw, with `resolution_count`, `resolved_to`, `call_type`, and `caller_function` — this is Ariadne's view of the callers, no live query needed",
    "",
    "5. **Classify the entry**:",
    "   - If no real callers exist anywhere in the codebase → `ariadne_correct: true`, `group_id: \"confirmed-unreachable\"`",
    "   - If real callers exist that Ariadne missed → `ariadne_correct: false`, `group_id` = kebab-case detection gap",
  ].join("\n"),
  classification_hint:
    "kebab-case detection gap (e.g., `\"dynamic-dispatch\"`, `\"callback-registration\"`, `\"framework-lifecycle\"`).",
};

const DIAGNOSIS_HINTS: Record<string, DiagnosisHints> = {
  "callers-not-in-registry": {
    title: "Callers Not in Registry",
    summary:
      "Textual grep found call sites for this function, but the calling files are not in Ariadne's file registry. The calls exist in the codebase but Ariadne never indexed the files containing them.",
    investigation_guide: [
      "1. **Examine the grep call sites** listed above. For each hit:",
      "",
      "   - Read the file at the call site to confirm it is an actual invocation (not a comment, string, or name collision)",
      "   - Note the file path — is it a test file, config file, script, or source file?",
      "",
      "2. **Check if calling files are in the project scope**:",
      "",
      "   - Use `Glob` to verify the calling files exist in the repository",
      "   - Check if the calling files are in directories that Ariadne excludes (e.g., `node_modules/`, `dist/`, `build/`, `.git/`)",
      "   - Check if the calling files use a supported language/extension",
      "",
      "3. **Determine why the calling files were not indexed**:",
      "",
      "   - Are they in an excluded folder pattern?",
      "   - Are they a file type Ariadne does not index (e.g., `.json`, `.yaml`, `.html`, `.vue` template section)?",
      "   - Are they generated files in an output directory?",
      "   - Are they in a separate package/workspace not included in the analysis scope?",
      "",
      "4. **Cross-reference the pre-gathered Ariadne call references** in your prompt:",
      "",
      "   - The `Pre-Gathered Evidence → Ariadne call references` block is Ariadne's view of the callers — if it is empty for this entry, that confirms the registry gap, no live query needed",
      "",
      "5. **Classify the entry**:",
      "   - If real callers exist in unindexed files → `ariadne_correct: false` (Ariadne has a file coverage gap)",
      "   - If all grep hits are false matches (comments, strings, different functions with the same name) and no other callers exist → `ariadne_correct: true`",
    ].join("\n"),
    classification_hint:
      "kebab-case detection gap (e.g., `\"unindexed-test-files\"`, `\"cross-package-call\"`, `\"template-file-call\"`).",
  },
  "callers-in-registry-unresolved": {
    title: "Resolution Failure",
    summary:
      "Ariadne's file registry contains files with call references matching this function's name, but the resolution phase failed to resolve them to this definition. The calls are indexed but not linked.",
    investigation_guide: [
      "1. **Examine the Ariadne call references** listed above. For each reference:",
      "",
      "   - Note the `resolution_count` — if 0, the call was detected but resolution produced no targets",
      "   - Note the `resolved_to` list — if empty, the reference is unresolved",
      "   - Note the `call_type` — method calls, function calls, and constructor calls use different resolution strategies",
      "",
      "2. **Read the source code at the call sites**:",
      "",
      "   - Read the caller file at the call line to understand the invocation pattern",
      "   - Identify the receiver expression (for method calls) or import path (for function calls)",
      "   - Check if the call uses patterns that complicate resolution:",
      "     - Aliased imports (`import { foo as bar }`)",
      "     - Destructured assignments (`const { method } = object`)",
      "     - Re-exports through barrel files (`export { foo } from './module'`)",
      "     - Generic type parameters affecting method dispatch",
      "     - Prototype chain or mixin patterns",
      "",
      "3. **Read the definition site**:",
      "",
      "   - Read `{{entry.file_path}}` around line {{entry.start_line}}",
      "   - Check how the function is defined and exported",
      "   - For methods: check the class hierarchy and whether the method is inherited or overridden",
      "",
      "4. **Cross-reference the pre-gathered Ariadne call references** in your prompt:",
      "",
      "   - The `Pre-Gathered Evidence → Ariadne call references` block lists every reference Ariadne resolved (or failed to resolve) — compare its `resolution_count` and `resolved_to` against the grep evidence to confirm the resolver, not the call detector, is at fault",
      "",
      "5. **Identify the resolution failure pattern**:",
      "",
      "   - Is this a name resolution failure (Ariadne cannot find the symbol by name)?",
      "   - Is this a scope resolution failure (Ariadne finds the name but in the wrong scope)?",
      "   - Is this a type resolution failure (method call on an untyped or dynamically-typed receiver)?",
      "   - Is this an import resolution failure (import path not followed correctly)?",
      "",
      "6. **Classify the entry**:",
      "   - If real callers exist and resolution genuinely failed → `ariadne_correct: false` with a group_id describing the resolution gap",
      "   - If the unresolved references are not actually calling this function (name collision) and no other callers exist → `ariadne_correct: true`",
    ].join("\n"),
    classification_hint:
      "kebab-case resolution gap (e.g., `\"aliased-import-resolution\"`, `\"barrel-reexport\"`, `\"prototype-method-dispatch\"`, `\"generic-type-erasure\"`).",
  },
  "callers-in-registry-wrong-target": {
    title: "Wrong Resolution Target",
    summary:
      "Ariadne found call references matching this function's name and resolved them, but they resolved to a different symbol. The resolution phase linked the call to the wrong definition.",
    investigation_guide: [
      "1. **Examine the Ariadne call references** listed above. For each reference:",
      "",
      "   - Note the `resolved_to` list — these are the symbols the call resolved to (not this entry)",
      "   - Note the `call_type` — method calls are most prone to wrong-target resolution",
      "   - Compare the resolved targets with the entry under investigation",
      "",
      "2. **Read the source at the call sites**:",
      "",
      "   - Read the caller file at the call line to understand the invocation",
      "   - Identify the receiver type (for method calls) or the import source (for function calls)",
      "   - Determine which definition the call SHOULD resolve to",
      "",
      "3. **Read the resolved-to definitions**:",
      "",
      "   - For each symbol in `resolved_to`, find and read its definition",
      "   - Compare it with the entry under investigation at `{{entry.file_path}}:{{entry.start_line}}`",
      "   - Determine why Ariadne chose the wrong target:",
      "     - Same method name on different classes (class hierarchy confusion)?",
      "     - Function shadowing (local definition shadows imported one)?",
      "     - Overloaded names across modules?",
      "     - Interface vs implementation mismatch?",
      "",
      "4. **Read the entry definition**:",
      "",
      "   - Read `{{entry.file_path}}` around line {{entry.start_line}}",
      "   - For methods: check the class hierarchy — is this an override, implementation, or base method?",
      "",
      "5. **Cross-reference the pre-gathered Ariadne call references** in your prompt:",
      "",
      "   - The `Pre-Gathered Evidence → Ariadne call references` block already lists every call site Ariadne saw with its `resolved_to` targets — confirm whether those targets point at this entry or somewhere else",
      "",
      "6. **Classify the entry**:",
      "   - If real callers exist but resolved to wrong target → `ariadne_correct: false` with a group_id describing the mismatch",
      "   - If the resolved targets are correct and this entry truly has no callers → `ariadne_correct: true`",
    ].join("\n"),
    classification_hint:
      "kebab-case mismatch type (e.g., `\"class-hierarchy-dispatch\"`, `\"interface-impl-mismatch\"`, `\"module-shadow-resolution\"`, `\"overloaded-name-collision\"`).",
  },
};

// ===== CLI Argument Parsing =====

function parse_args(argv: string[]): { project: string; entry_index: number } {
  const project = parse_project_arg(argv, USAGE);
  const args = argv.slice(2);
  let entry_index: number | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--entry") entry_index = parseInt(args[++i], 10);
  }
  if (entry_index === null || isNaN(entry_index)) {
    process.stderr.write(`${USAGE}\n`);
    process.exit(1);
  }
  return { project, entry_index };
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

/**
 * Render sub-threshold classifier hints as a markdown block. Returns an empty
 * string when there are no hints so the enclosing template contributes nothing
 * (including no trailing heading) for the common case.
 */
export function format_classifier_hints(hints: readonly ClassifierHint[]): string {
  if (hints.length === 0) return "";
  const bullets = hints
    .map((h) => `- ${h.group_id} (confidence ${h.confidence.toFixed(2)}): ${h.reasoning}`)
    .join("\n");
  return [
    "",
    "### Classifier hints (sub-threshold matches)",
    "",
    "Predicate classifiers from the known-issues registry matched this entry but did not reach the `min_confidence` threshold for auto-classification. Weigh these before starting the investigation — a hint often names the exact detection gap.",
    "",
    bullets,
    "",
  ].join("\n");
}

// ===== Template Substitution =====

export function substitute_template(
  template: string,
  entry: TriageEntry,
  diagnostics: EntryPointDiagnostics,
  output_path: string,
): string {
  const hints = DIAGNOSIS_HINTS[entry.diagnosis] ?? GENERIC_HINTS;

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
    "{{classifier_hints}}": format_classifier_hints(entry.classifier_hints),
    "{{diagnosis.title}}": hints.title,
    "{{diagnosis.summary}}": hints.summary,
    "{{diagnosis.investigation_guide}}": hints.investigation_guide,
    "{{diagnosis.classification_hint}}": hints.classification_hint,
  };

  let result = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, value);
  }
  return result;
}

// ===== Main =====

function main(): void {
  const cli = parse_args(process.argv);
  const run_id_opt = parse_run_id_arg(process.argv);
  const { run_id, state_path } = require_run(cli.project, run_id_opt);

  const state = JSON.parse(fs.readFileSync(state_path, "utf8")) as TriageState;

  const entry = state.entries.find((e) => e.entry_index === cli.entry_index);
  if (!entry) {
    console.error(`Entry index ${cli.entry_index} not found in state file`);
    process.exit(1);
  }

  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");

  const output_path = path.join(results_dir_for(cli.project, run_id), `${entry.entry_index}.json`);

  const prompt = substitute_template(template, entry, entry.diagnostics, output_path);
  process.stdout.write(prompt);
}

const this_file = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === this_file) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

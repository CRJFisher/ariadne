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
 * Pass `--run-id` with either selector. It is structurally required by the
 * member-symbol mode below; with `--entry` the pipeline passes it too, because
 * an index means nothing without the run that issued it and this script also
 * derives the verdict's output path from the run it resolves.
 *
 * The entry is selected one of two ways:
 * - `--entry <index>` — the run-local positional index, used by
 *   triage-investigator dispatch (the triage orchestrator holds indices).
 * - `--file <path> --name <name> --kind <kind> --line <n>` — the stable
 *   `member_symbol` identity `(file_path, name, kind, start_line)`, used by
 *   classifier-author dispatch (prioritize holds member symbols from
 *   `PlanTaskEvidence`, never entry indices). `file_path` is project-relative,
 *   as published; the lookup relativizes state entries before matching. This
 *   mode requires `--run-id`: `start_line` is run-specific, so the LATEST-run
 *   fallback would silently resolve against the wrong run.
 *
 * Usage:
 *   node --import tsx .claude/skills/triage/scripts/get_entry_context.ts --project mocha --run-id <id> --entry 62
 *   node --import tsx .claude/skills/triage/scripts/get_entry_context.ts --project mocha --run-id <id> \
 *     --file lib/interfaces/bdd.js --name bddInterface --kind function --line 12
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse_project_arg, parse_run_id_arg } from "../src/cli_args.js";
import {
  relativize,
  require_run,
  results_dir_for,
} from "../src/store/paths.js";
import type { RunManifest, TriageEntry, TriageState } from "../src/triage_state_types.js";
import type {
  AnalysisResult,
  EnrichedEntryPoint,
  GrepHit,
  ReferenceSiteDiagnostic,
  CallRefDiagnostic,
  ClassifierHint,
  KnownIssuesRegistry,
} from "@ariadnejs/types";
import type { MemberSymbol } from "@ariadnejs/skill-protocol";
import {
  build_dispense_payload,
  type DispensePayload,
} from "../src/dispense/dispense_payload.js";
import { load_registry } from "../src/known_issues_registry.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE = [
  "Usage: get_entry_context.ts --project <name> --entry <index> [--run-id <id>] [--enriched]",
  "       get_entry_context.ts --project <name> --file <path> --name <name> --kind <kind> --line <n> --run-id <id> [--enriched]",
  "  --enriched: emit the full EnrichedEntryPoint JSON (samples/*.json seed for the classifier-author) instead of the investigation prompt.",
].join("\n");

const THIS_FILE = fileURLToPath(import.meta.url);
const THIS_DIR = path.dirname(THIS_FILE);
const SKILL_DIR = path.resolve(THIS_DIR, "..");
const TEMPLATE_PATH = path.join(SKILL_DIR, "templates", "prompt.md");

// ===== Diagnosis-Specific Hints =====

export interface DiagnosisHints {
  title: string;
  summary: string;
  investigation_guide: string;
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
    "5. **Emit a verdict** using the schema in the **Output** section below: `tp` when no real callers exist, `fp-classifier-regression` when an in-scope rule's classifier should have caught the real caller, `fp-novel` for a detection gap no in-scope rule covers, or `uncertain` when you cannot reduce to a single kind.",
  ].join("\n"),
};

const DIAGNOSIS_HINTS: Record<string, DiagnosisHints> = {
  "callers-outside-indexed-corpus": {
    title: "Callers Outside the Indexed Corpus",
    summary:
      "The caller exists, in a file that was discovered but never indexed — held out by a project-config `exclude`, left outside a `--folders` scope, or dropped by an indexing error. This is a statement about coverage, not about the member.",
    investigation_guide: [
      "1. **Read the out-of-index hits** in the evidence block. Each names a file the walk found and the index did not.",
      "",
      "2. **Decide which kind of gap it is**:",
      "",
      "   - A config `exclude` naming that directory — the exclude is deleting real call edges, and detection warns about this at startup when the directory is a test tree",
      "   - A `--folders` scope that does not reach it",
      "   - An indexing error — detection logs `failed to index` with the file name",
      "",
      "3. **Emit a verdict**: a real caller in an unindexed file is `fp-novel` with the coverage gap as the root cause. Fix the corpus, not the member.",
    ].join("\n"),
  },
  "references-without-call-syntax": {
    title: "Reached Without Call Syntax",
    summary:
      "Nothing calls this member with parens, but the indexed corpus does reference it — a getter read, a callback handed to an invoker, a dict or list registration value. The reference sites are in the evidence block; `grep_call_sites` is empty by construction, because these forms carry no `name(`.",
    investigation_guide: [
      "1. **Read the reference sites** above. Each carries the reference kind, the access type and the receiver form.",
      "",
      "2. **Decide whether the reference is an invocation route**:",
      "",
      "   - A callback passed to an invoker that later calls it ⇒ the member IS reached",
      "   - A registration value in a table dispatched through a computed key ⇒ reached",
      "   - A property read that never invokes ⇒ genuinely unreached",
      "",
      "3. **This is the classifier-author surface.** If the shape is a permanent limitation of static analysis, say so — the route is deterministic and a rule can be written for it.",
      "",
      "4. **Emit a verdict**: reached-by-reference ⇒ `fp-novel` naming the invocation route; never invoked ⇒ `tp`.",
    ].join("\n"),
  },
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
      "5. **Emit a verdict** using the schema in the **Output** section below: real callers in unindexed files ⇒ `fp-novel` (or `fp-classifier-regression` if an in-scope rule should have caught it); all grep hits false with no other callers ⇒ `tp`.",
    ].join("\n"),
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
      "     - Re-exports through barrel files (`export { foo } from './module.js'`)",
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
      "6. **Emit a verdict** using the schema in the **Output** section below: resolution genuinely failed ⇒ `fp-novel` (or `fp-classifier-regression` if an in-scope rule should have caught it); name collision with no other callers ⇒ `tp`.",
    ].join("\n"),
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
      "6. **Emit a verdict** using the schema in the **Output** section below: real callers resolved to the wrong target ⇒ `fp-novel` (or `fp-classifier-regression` if an in-scope rule should have caught it); resolved targets are correct and no other callers exist ⇒ `tp`.",
    ].join("\n"),
  },
};

// ===== CLI Argument Parsing =====

export type EntrySelector =
  | { by: "index"; entry_index: number }
  | { by: "member_symbol"; member: MemberSymbol };

const MEMBER_SYMBOL_KINDS: readonly MemberSymbol["kind"][] = [
  "function",
  "method",
  "constructor",
];

function is_member_symbol_kind(value: string): value is MemberSymbol["kind"] {
  return (MEMBER_SYMBOL_KINDS as readonly string[]).includes(value);
}

/**
 * Parse the entry selector from the argv tail (`process.argv.slice(2)`).
 * Exactly one selector mode must be present: `--entry <index>`, or the four
 * member-symbol flags together (plus `--run-id` — `start_line` is
 * run-specific, so resolving a member symbol against the LATEST-run fallback
 * would silently look in the wrong run). Throws on an invalid combination —
 * the CLI wrapper decides how to exit.
 */
export function parse_entry_selector(args: readonly string[]): EntrySelector {
  // A next token that is itself a flag counts as a missing value, so an
  // unsubstituted placeholder fails as "missing --x" instead of silently
  // consuming the following flag.
  const flag_value = (flag: string): string | null => {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === flag) {
        const value = args[i + 1];
        if (value !== undefined && value.length > 0 && !value.startsWith("--")) {
          return value;
        }
      }
    }
    return null;
  };
  const strict_int = (raw: string, flag: string): number => {
    if (!/^\d+$/.test(raw)) throw new Error(`${flag} requires an integer`);
    return parseInt(raw, 10);
  };

  const entry_raw = flag_value("--entry");
  const member_flags: [string, string | null][] = [
    ["--file", flag_value("--file")],
    ["--name", flag_value("--name")],
    ["--kind", flag_value("--kind")],
    ["--line", flag_value("--line")],
  ];
  const present_count = member_flags.filter(([, value]) => value !== null).length;

  if (entry_raw !== null && present_count > 0) {
    throw new Error(
      "provide either --entry or the member-symbol flags (--file --name --kind --line), not both",
    );
  }

  if (entry_raw !== null) {
    return { by: "index", entry_index: strict_int(entry_raw, "--entry") };
  }

  if (present_count === 0) {
    throw new Error(
      "an entry selector is required: --entry <index>, or --file <path> --name <name> --kind <kind> --line <n> --run-id <id>",
    );
  }
  if (present_count < 4) {
    const missing = member_flags
      .filter(([, value]) => value === null)
      .map(([flag]) => flag);
    throw new Error(
      `the member-symbol selector requires all four flags; missing ${missing.join(" ")}`,
    );
  }
  if (flag_value("--run-id") === null) {
    throw new Error(
      "the member-symbol selector requires --run-id (start_line is run-specific; the LATEST-run fallback would resolve against the wrong run)",
    );
  }

  const [[, file_path], [, name], [, kind_raw], [, line_raw]] = member_flags;
  const start_line = strict_int(line_raw as string, "--line");
  if (!is_member_symbol_kind(kind_raw as string)) {
    throw new Error(`--kind must be one of ${MEMBER_SYMBOL_KINDS.join(", ")}`);
  }
  return {
    by: "member_symbol",
    member: {
      file_path: file_path as string,
      name: name as string,
      kind: kind_raw as MemberSymbol["kind"],
      start_line,
    },
  };
}

function parse_args(argv: string[]): {
  project: string;
  selector: EntrySelector;
  enriched: boolean;
} {
  const project = parse_project_arg(argv, USAGE);
  const enriched = argv.includes("--enriched");
  try {
    return { project, selector: parse_entry_selector(argv.slice(2)), enriched };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n${USAGE}\n`);
    process.exit(2);
  }
}

// ===== Entry Resolution =====

/** The (file, name) core of the member identity, shared by the resolver and
 * the near-miss diagnostics so the match key is single-sourced. */
function member_file_and_name_match(
  entry: TriageEntry,
  member: MemberSymbol,
  project_path: string,
): boolean {
  return (
    entry.name === member.name &&
    relativize(entry.file_path, project_path) === member.file_path
  );
}

/**
 * Resolve the selector against a run's triage state. Member-symbol matching
 * relativizes each entry's `file_path` against the state's `project_path`
 * before comparing — published member symbols carry project-relative paths
 * while state entries may hold absolute ones.
 *
 * Returns every match: an index lookup yields at most one; a member-symbol
 * lookup can in principle collide, and the caller fails loud on more than
 * one rather than picking arbitrarily.
 */
export function find_entries_by_selector(
  state: Pick<TriageState, "entries" | "project_path">,
  selector: EntrySelector,
): TriageEntry[] {
  if (selector.by === "index") {
    return state.entries.filter((e) => e.entry_index === selector.entry_index);
  }
  const member = selector.member;
  return state.entries.filter(
    (e) =>
      member_file_and_name_match(e, member, state.project_path) &&
      e.kind === member.kind &&
      e.start_line === member.start_line,
  );
}

function describe_selector(selector: EntrySelector): string {
  if (selector.by === "index") return `Entry index ${selector.entry_index}`;
  const member = selector.member;
  return `Member symbol ${member.kind} ${member.name} at ${member.file_path}:${member.start_line}`;
}

/**
 * Build the fail-loud error text for a resolution that did not yield exactly
 * one entry, or return null when it did. The zero-match diagnostics are
 * tiered by which identity field diverged: same (file, name, kind) at other
 * lines points at run drift (`start_line` is run-specific); same (file, name)
 * under another kind points at the selector's `--kind`; no near entry at all
 * points at a run/selector mismatch.
 */
export function resolution_failure_message(
  state: Pick<TriageState, "entries" | "project_path">,
  selector: EntrySelector,
  matches: readonly TriageEntry[],
): string | null {
  if (matches.length === 1) return null;
  if (matches.length > 1) {
    return `Ambiguous selector: ${matches.length} entries match ${describe_selector(selector)} (entry indices ${matches
      .map((e) => e.entry_index)
      .join(", ")}). Use --entry <index> to disambiguate.`;
  }

  const head = `${describe_selector(selector)} not found in state file`;
  if (selector.by === "index") return head;

  const member = selector.member;
  const same_file_and_name = state.entries.filter((e) =>
    member_file_and_name_match(e, member, state.project_path),
  );
  const same_kind = same_file_and_name.filter((e) => e.kind === member.kind);
  if (same_kind.length > 0) {
    return `${head}\nEntries matching (file, name, kind) exist at start_line ${same_kind
      .map((e) => e.start_line)
      .join(", ")} — the member symbol and --run-id likely come from different runs (start_line is run-specific).`;
  }
  if (same_file_and_name.length > 0) {
    return `${head}\nEntries matching (file, name) exist with kind ${[
      ...new Set(same_file_and_name.map((e) => e.kind)),
    ].join(", ")} — the selector's --kind does not match this run's entry.`;
  }
  return `${head}\nThe member symbol and --run-id must come from the same triage run.`;
}

// ===== Diagnostics Formatting =====

export function format_grep_hits(hits: GrepHit[]): string {
  if (hits.length === 0) return "(none found)";
  return hits
    .map((h) => `  ${h.file_path}:${h.line}  ${h.content.trim()}`)
    .join("\n");
}

/**
 * Non-call reference sites. The three extra fields are the whole reason this
 * channel is richer than a grep hit: they say HOW the name was reached, which
 * is what decides whether the reference is an invocation route.
 */
export function format_reference_sites(sites: ReferenceSiteDiagnostic[]): string {
  if (sites.length === 0) return "(none found)";
  return sites
    .map((s) => {
      const receiver = s.receiver_kind === null ? "" : `, receiver: ${s.receiver_kind}`;
      const access = s.access_type === null ? "" : `, access: ${s.access_type}`;
      return `  ${s.file_path}:${s.line}  [${s.reference_kind}${access}${receiver}]  ${s.content.trim()}`;
    })
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
    "Builtin classifiers from the known-issues registry matched this entry but did not reach the `min_confidence` threshold for auto-classification. Weigh these before starting the investigation — a hint often names the exact detection gap.",
    "",
    bullets,
    "",
  ].join("\n");
}

// ===== Template Substitution =====

export interface SubstituteTemplateInput {
  template: string;
  payload: DispensePayload;
  output_path: string;
}

export function substitute_template(input: SubstituteTemplateInput): string {
  const entry = input.payload.entry_context;
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
    "{{output_path}}": input.output_path,
    "{{entry.diagnostics.grep_call_sites_formatted}}": format_grep_hits(
      entry.diagnostics.grep_call_sites,
    ),
    "{{entry.diagnostics.ariadne_call_refs_formatted}}": format_call_refs(
      entry.diagnostics.ariadne_call_refs,
    ),
    "{{entry.diagnostics.grep_call_sites_outside_index_formatted}}": format_grep_hits(
      entry.diagnostics.grep_call_sites_outside_index,
    ),
    "{{entry.diagnostics.reference_sites_formatted}}": format_reference_sites(
      entry.diagnostics.reference_sites,
    ),
    "{{classifier_hints}}": format_classifier_hints(entry.classifier_hints),
    "{{diagnosis.title}}": hints.title,
    "{{diagnosis.summary}}": hints.summary,
    "{{diagnosis.investigation_guide}}": hints.investigation_guide,
    "{{relevant_registry_slice}}": JSON.stringify(
      input.payload.relevant_registry_slice,
      null,
      2,
    ),
  };

  let result = input.template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, value);
  }
  return result;
}

// ===== Enriched Emit =====

/**
 * Find `entry`'s full `EnrichedEntryPoint` in a source `AnalysisResult`, matching
 * on the member identity `(file_path, name, kind, start_line)`. The analysis's
 * `entry_points` carry the fields the lossy TriageEntry drops (`tree_size`,
 * `definition_features`).
 */
export function find_enriched_entry_point(
  analysis: AnalysisResult,
  entry: TriageEntry,
): EnrichedEntryPoint | undefined {
  return analysis.entry_points.find(
    (ep: EnrichedEntryPoint) =>
      ep.file_path === entry.file_path &&
      ep.name === entry.name &&
      ep.kind === entry.kind &&
      ep.start_line === entry.start_line,
  );
}

/**
 * Resolve `entry` to its full `EnrichedEntryPoint` (via the manifest's
 * `source_analysis_path`) and print it as JSON.
 */
export function emit_enriched_entry_point(manifest_path: string, entry: TriageEntry): void {
  const manifest = JSON.parse(fs.readFileSync(manifest_path, "utf8")) as RunManifest;
  const analysis = JSON.parse(
    fs.readFileSync(manifest.source_analysis_path, "utf8"),
  ) as AnalysisResult;
  const match = find_enriched_entry_point(analysis, entry);
  if (match === undefined) {
    console.error(
      `--enriched: no EnrichedEntryPoint in ${manifest.source_analysis_path} matches ` +
        `${entry.kind} "${entry.name}" at ${entry.file_path}:${entry.start_line}`,
    );
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(match, null, 2) + "\n");
}

// ===== Main =====

async function main(): Promise<void> {
  const cli = parse_args(process.argv);
  const run_id_opt = parse_run_id_arg(process.argv);
  const { run_id, state_path, manifest_path } = require_run(cli.project, run_id_opt);

  const state = JSON.parse(fs.readFileSync(state_path, "utf8")) as TriageState;

  const matches = find_entries_by_selector(state, cli.selector);
  const failure = resolution_failure_message(state, cli.selector, matches);
  if (failure !== null) {
    console.error(failure);
    process.exit(1);
  }
  const entry = matches[0];

  // `--enriched`: emit the full EnrichedEntryPoint (with `tree_size` and
  // `definition_features`, the fields the lossy TriageEntry drops) that
  // `auto_classify` feeds to a builtin check. The classifier-author persists
  // these as `samples/*.json` so `reconcile_registry --stage` can execute the
  // drafted check against the exact shape it runs against in production.
  if (cli.enriched) {
    emit_enriched_entry_point(manifest_path, entry);
    return;
  }

  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");

  const output_path = path.join(results_dir_for(cli.project, run_id), `${entry.entry_index}.json`);

  const registry: KnownIssuesRegistry = load_registry();

  const payload = build_dispense_payload({
    entry,
    registry,
  });

  const prompt = substitute_template({ template, payload, output_path });
  process.stdout.write(prompt);
}

const this_file = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === this_file) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  });
}

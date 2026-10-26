#!/usr/bin/env node
/**
 * Print one triage entry's investigation context: the same bounded bundle a
 * triage investigation receives as its first message (`render_entry_context`),
 * or with `--enriched` the entry's full `EnrichedEntryPoint` JSON. The
 * classifier-author and classifier-fixer agents read entries through it.
 *
 * Pass `--run-id` with either selector. It is structurally required by the
 * member-symbol mode below; with `--entry` it names the run the index belongs
 * to, because an index means nothing without the run that issued it.
 *
 * The entry is selected one of two ways:
 * - `--entry <index>` — the run-local positional index, as a triage run's
 *   state and its `drift_evidence` rows record it.
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
import { relativize, require_run } from "../src/store/paths.js";
import type { RunManifest, TriageEntry, TriageState } from "../src/triage_state_types.js";
import type { AnalysisResult, EnrichedEntryPoint } from "@ariadnejs/types";
import type { MemberSymbol } from "@ariadnejs/skill-protocol";
import { build_dispense_payload } from "../src/dispense/dispense_payload.js";
import { render_entry_context } from "../src/dispense/render_entry_context.js";
import { load_registry } from "../src/known_issues_registry.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE = [
  "Usage: get_entry_context.ts --project <name> --entry <index> [--run-id <id>] [--enriched]",
  "       get_entry_context.ts --project <name> --file <path> --name <name> --kind <kind> --line <n> --run-id <id> [--enriched]",
  "  --enriched: emit the full EnrichedEntryPoint JSON (samples/*.json seed for the classifier-author) instead of the investigation context.",
].join("\n");

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
  const { state_path, manifest_path } = require_run(cli.project, run_id_opt);

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

  const payload = build_dispense_payload({ entry, registry: load_registry() });
  process.stdout.write(render_entry_context(payload, state.project_path));
}

const this_file = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === this_file) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  });
}

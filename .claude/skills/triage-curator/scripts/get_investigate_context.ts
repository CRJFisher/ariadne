#!/usr/bin/env node
/**
 * Hydrates the context for the `triage-curator-investigator` sub-agent.
 *
 * Two modes:
 *
 *   residual  (default)  The group was not auto-classified. Hydrate the full
 *                        group, current registry, and signal inventory.
 *
 *   promoted  (--promoted) The group WAS auto-classified but QA found the
 *                          classifier is mis-matching enough members to
 *                          warrant re-investigation. Adds the existing
 *                          registry entry, the QA outliers, and source
 *                          excerpts for the outlier entries.
 *
 * Usage:
 *   node --import tsx get_investigate_context.ts --group <id> --run <path>
 *   node --import tsx get_investigate_context.ts --group <id> --run <path> --promoted
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse_known_issues_registry_json } from "@ariadnejs/types";
import { error_code } from "../src/errors.js";
import {
  derive_run_id,
  get_registry_file_path,
  run_output_dir,
} from "../src/paths.js";
import { read_source_excerpt } from "../src/source_excerpt.js";
import {
  ARIADNE_ROOT_CAUSE_CATEGORIES,
  SIGNAL_CHECK_OPS,
  type KnownIssue,
  type QaOutlier,
  type QaResponse,
  type TriageResultsFile,
} from "../src/types.js";
import { SIGNAL_LIBRARY_GAP_PARENT_TASK_ID } from "../src/apply_proposals.js";
import "../src/require_node_import_tsx.js";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(THIS_DIR, "..");
const SIGNAL_INVENTORY_PATH = path.join(SKILL_DIR, "reference", "signal_inventory.md");

interface CliArgs {
  group_id: string;
  run_path: string;
  promoted: boolean;
}

function parse_argv(argv: string[]): CliArgs {
  let group_id: string | null = null;
  let run_path: string | null = null;
  let promoted = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--group":
        group_id = argv[++i];
        break;
      case "--run":
        run_path = argv[++i];
        break;
      case "--promoted":
        promoted = true;
        break;
      case "--help":
      case "-h":
        process.stdout.write(
          "Usage: get_investigate_context --group <id> --run <path> [--promoted]\n",
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (group_id === null || group_id.length === 0) {
    throw new Error("--group <id> is required");
  }
  if (run_path === null || run_path.length === 0) {
    throw new Error("--run <path> is required");
  }
  return { group_id, run_path, promoted };
}

async function read_optional_file(file_path: string): Promise<string | null> {
  try {
    return await fs.readFile(file_path, "utf8");
  } catch (err) {
    if (error_code(err) === "ENOENT") return null;
    throw err;
  }
}

interface PromotedContext {
  registry_entry: KnownIssue;
  qa_outliers: QaOutlier[];
  qa_notes: string;
  outlier_source_excerpts: Array<{ entry_index: number; excerpt: string }>;
}

async function load_promoted_context(
  group_id: string,
  triage: TriageResultsFile,
  run_path: string,
  registry: KnownIssue[],
): Promise<PromotedContext> {
  const registry_entry = registry.find((e) => e.group_id === group_id);
  if (registry_entry === undefined) {
    throw new Error(
      `--promoted: no registry entry for group_id "${group_id}"; promoted groups must have been auto-classified`,
    );
  }

  const run_id = derive_run_id(run_path);
  const qa_file = path.join(run_output_dir(run_id), "qa", `${group_id}.json`);
  const qa = JSON.parse(await fs.readFile(qa_file, "utf8")) as QaResponse;

  const group = triage.false_positive_groups[group_id];
  const outlier_source_excerpts = await Promise.all(
    qa.outliers.map(async (o) => {
      const entry = group.entries[o.entry_index];
      if (entry === undefined) {
        return { entry_index: o.entry_index, excerpt: "<entry_index out of range>" };
      }
      return {
        entry_index: o.entry_index,
        excerpt: await read_source_excerpt(entry.file_path, entry.start_line, triage.project_path),
      };
    }),
  );

  return {
    registry_entry,
    qa_outliers: qa.outliers,
    qa_notes: qa.notes,
    outlier_source_excerpts,
  };
}

async function main(): Promise<void> {
  const { group_id, run_path, promoted } = parse_argv(process.argv.slice(2));

  const triage_raw = await fs.readFile(run_path, "utf8");
  const triage = JSON.parse(triage_raw) as TriageResultsFile;

  const group = triage.false_positive_groups[group_id];
  if (group === undefined) {
    throw new Error(`group_id "${group_id}" not found in ${run_path}`);
  }

  const registry_path = get_registry_file_path();
  const registry_raw = await fs.readFile(registry_path, "utf8");
  const registry = parse_known_issues_registry_json(registry_raw) as unknown as KnownIssue[];

  const signal_inventory = await read_optional_file(SIGNAL_INVENTORY_PATH);

  const writable_paths = [registry_path];

  const base = {
    group_id,
    run_path,
    mode: promoted ? "promoted" as const : "residual" as const,
    group,
    registry,
    signal_inventory_path: SIGNAL_INVENTORY_PATH,
    signal_inventory,
    writable_paths,
    signal_check_ops: SIGNAL_CHECK_OPS,
    ariadne_root_cause_categories: ARIADNE_ROOT_CAUSE_CATEGORIES,
    signal_library_gap_parent_task_id: SIGNAL_LIBRARY_GAP_PARENT_TASK_ID,
    authoring_rules: {
      signal_check_ops: SIGNAL_CHECK_OPS,
      ariadne_root_cause_categories: ARIADNE_ROOT_CAUSE_CATEGORIES,
      combinator_values: ["all", "any"] as const,
      response_group_id_rule:
        `response.group_id must equal '${group_id}' (the dispatch group). ` +
        "To extend an existing registry entry, set response.retargets_to='<existing_group_id>' " +
        "and keep response.group_id unchanged.",
      retarget_rules:
        "response.retargets_to is optional. When set, it MUST name an existing " +
        "registry group_id. The authored classifier file then shadows that entry's " +
        "classifier. When retargeting, positive_examples and negative_examples must be " +
        "empty — their indices would reference the source group, not the target.",
      positive_example_rules:
        "classifier_spec.positive_examples indices must satisfy 0 <= i < group.entries.length " +
        `(= ${group.entries.length} for this group). Same rule for negative_examples. ` +
        "When retargeting (response.retargets_to set), leave both arrays empty.",
      kind_none_rule:
        "If proposed_classifier.kind === 'none', you must either populate signal_library_gap " +
        "(signals_needed + title + description) naming the missing signal, or emit a session " +
        "log with failure_category set. Silent dead-ends (kind='none', no gap, no failure) are rejected.",
      ariadne_bug_rule:
        "Whenever proposed_classifier.kind === 'builtin', ariadne_bug MUST be populated. " +
        "The classifier is a workaround; the ariadne_bug names the resolver-level root cause " +
        "to fix. Search the backlog first (mcp__backlog__task_search) and set " +
        "ariadne_bug.existing_task_id if a matching task already exists.",
      ariadne_bug_existing_task_id_format:
        "ariadne_bug.existing_task_id, when non-null, MUST match /^TASK-[0-9]+(\\.[0-9]+)*$/ " +
        "(e.g. 'TASK-205' or 'TASK-190.16.3'). Lowercase or missing prefix is rejected.",
      signal_library_gap_rule:
        "signal_library_gap.signals_needed MUST be non-empty when signal_library_gap is non-null. " +
        "If no signals are missing, set signal_library_gap to null. One gap per coherent missing " +
        "capability — list all related new ops in signals_needed[], not one task per op name.",
      spec_function_name_rule:
        "classifier_spec.function_name MUST equal proposed_classifier.function_name. " +
        "Mismatched names are rejected before render.",
      example_uniqueness_rule:
        "Entries in positive_examples and negative_examples must be unique integers " +
        "(duplicates are rejected) and in-range vs group.entries.length.",
      common_mistakes: [
        "Using an op not in signal_check_ops — e.g. 'any' as a top-level combinator. " +
          "The combinator field goes on the classifier_spec itself (combinator: 'all' | 'any'), " +
          "NOT nested inside checks[].",
        "Renaming response.group_id to target an existing registry entry. Use retargets_to instead.",
        "Listing positive_examples that reference indices >= group.entries.length.",
        "Emitting kind='none' with a null signal_library_gap when the investigation never tried " +
          "to land a classifier. Record a failure_category in the session log instead.",
        "Proposing a working classifier without populating ariadne_bug. The classifier routes around " +
          "the bug; the bug must still be filed (or attached to an existing_task_id).",
        "Emitting proposed_classifier: { kind: 'none' } for the promoted 'keep' action. " +
          "Keep uses proposed_classifier: null (existing entry retained), not kind: 'none' (retire).",
      ],
    },
  };

  const out = promoted
    ? {
        ...base,
        ...(await load_promoted_context(group_id, triage, run_path, registry)),
      }
    : base;

  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(
    `get_investigate_context failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

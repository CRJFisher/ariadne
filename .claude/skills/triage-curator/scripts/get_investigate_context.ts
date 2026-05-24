#!/usr/bin/env node
/**
 * Hydrates the context for the `triage-curator-investigator` sub-agent.
 *
 * The dispatch source under v4 is a `novel_issue` record consolidated by the
 * triage-entrypoints per-entry triage + coordinator. The investigator gets the issue's
 * canonical name, root_cause hint, and citation excerpts, plus the current
 * registry slice and the signal inventory, and authors a `BuiltinClassifierSpec`
 * + `ariadne_bug` proposal.
 *
 * Usage:
 *   node --import tsx get_investigate_context.ts --novel-issue <id> --run <path>
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { parse_known_issues_registry_json } from "@ariadnejs/types";
import { error_code } from "../src/errors.js";
import { read_v4_triage_results } from "../src/parse_triage_results.js";
import { get_registry_file_path } from "../src/paths.js";
import {
  ARIADNE_ROOT_CAUSE_CATEGORIES,
  SIGNAL_CHECK_OPS,
  type NovelIssue,
  type TriageResultsFile,
} from "../src/types.js";
import { SIGNAL_LIBRARY_GAP_PARENT_TASK_ID } from "../src/apply_proposals.js";
import "../src/require_node_import_tsx.js";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(THIS_DIR, "..");
const SIGNAL_INVENTORY_PATH = path.join(SKILL_DIR, "reference", "signal_inventory.md");

interface CliArgs {
  novel_issue_id: string;
  run_path: string;
}

function parse_argv(argv: string[]): CliArgs {
  let novel_issue_id: string | null = null;
  let run_path: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--novel-issue":
        novel_issue_id = argv[++i];
        break;
      case "--run":
        run_path = argv[++i];
        break;
      case "--help":
      case "-h":
        process.stdout.write(
          "Usage: get_investigate_context --novel-issue <id> --run <path>\n",
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (novel_issue_id === null || novel_issue_id.length === 0) {
    throw new Error("--novel-issue <id> is required");
  }
  if (run_path === null || run_path.length === 0) {
    throw new Error("--run <path> is required");
  }
  return { novel_issue_id, run_path };
}

async function read_optional_file(file_path: string): Promise<string | null> {
  try {
    return await fs.readFile(file_path, "utf8");
  } catch (err) {
    if (error_code(err) === "ENOENT") return null;
    throw err;
  }
}

function find_novel_issue(
  triage: TriageResultsFile,
  novel_issue_id: string,
): NovelIssue {
  const issue = triage.novel_issues.find((i) => i.id === novel_issue_id);
  if (issue === undefined) {
    throw new Error(`novel_issue '${novel_issue_id}' not found in triage results`);
  }
  return issue;
}

async function main(): Promise<void> {
  const { novel_issue_id, run_path } = parse_argv(process.argv.slice(2));

  const triage = await read_v4_triage_results(run_path);

  const novel_issue = find_novel_issue(triage, novel_issue_id);

  const registry_path = get_registry_file_path();
  const registry_raw = await fs.readFile(registry_path, "utf8");
  const registry = parse_known_issues_registry_json(registry_raw);

  const signal_inventory = await read_optional_file(SIGNAL_INVENTORY_PATH);

  const writable_paths = [registry_path];

  const out = {
    novel_issue_id,
    run_path,
    mode: "promote-novel" as const,
    novel_issue,
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
        `response.group_id must equal '${novel_issue_id}' (the dispatched novel-issue id). ` +
        "To extend an existing registry entry, set response.retargets_to='<existing_group_id>' " +
        "and keep response.group_id unchanged.",
      retarget_rules:
        "response.retargets_to is optional. When set, it MUST name an existing " +
        "registry group_id. The authored classifier file then shadows that entry's " +
        "classifier. When retargeting, positive_examples and negative_examples must be " +
        "empty — their indices would reference the source citations, not the target.",
      positive_example_rules:
        "classifier_spec.positive_examples indices must satisfy 0 <= i < citations.length " +
        `(= ${novel_issue.citations.length} for this novel issue). Same rule for ` +
        "negative_examples. When retargeting (response.retargets_to set), leave both arrays empty.",
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
        "(duplicates are rejected) and in-range vs citations.length.",
    },
  };

  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(
    `get_investigate_context failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

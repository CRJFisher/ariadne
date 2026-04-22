#!/usr/bin/env node
/**
 * Step 4.25 — validate every investigator response written under
 * <run>/investigate/ and <run>/investigate_promoted/ BEFORE Step 4.5
 * rendering and finalize. Exits non-zero when any response has a validation
 * issue so the orchestrator halts cleanly.
 *
 * Usage:
 *   node --import tsx validate_responses.ts --run <path>
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { parse_investigate_response } from "../src/apply_proposals.js";
import { error_code } from "../src/errors.js";
import {
  get_registry_file_path,
  run_output_dir,
} from "../src/paths.js";
import { parse_investigator_session_log } from "../src/session_log.js";
import type {
  FalsePositiveGroup,
  InvestigateResponse,
  InvestigatorSessionLog,
  KnownIssue,
  TriageResultsFile,
} from "../src/types.js";
import {
  validate_response,
  validate_run_coherence,
  type RunCoherenceInput,
  type ValidationIssue,
} from "../src/validate_investigate_responses.js";
import "../src/require_node_import_tsx.js";

interface CliArgs {
  run_path: string;
}

function parse_argv(argv: string[]): CliArgs {
  let run_path: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--run":
        run_path = argv[++i];
        break;
      case "--help":
      case "-h":
        process.stdout.write("Usage: validate_responses --run <path>\n");
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (run_path === null || run_path.length === 0) {
    throw new Error("--run <path> is required");
  }
  return { run_path };
}

function derive_run_id(run_path: string): string {
  return path.basename(run_path, ".json");
}

async function load_json<T>(file_path: string): Promise<T> {
  return JSON.parse(await fs.readFile(file_path, "utf8")) as T;
}

async function read_dir_safe(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch (err) {
    if (error_code(err) === "ENOENT") return [];
    throw err;
  }
}

async function load_session_log(
  dir: string,
  group_id: string,
): Promise<InvestigatorSessionLog | null> {
  const session_path = path.join(dir, `${group_id}.session.json`);
  try {
    const raw = JSON.parse(await fs.readFile(session_path, "utf8"));
    const parsed = parse_investigator_session_log(raw);
    if ("error" in parsed) return null;
    return parsed;
  } catch (err) {
    if (error_code(err) === "ENOENT") return null;
    throw err;
  }
}

interface DirValidation {
  issues: ValidationIssue[];
  coherence_inputs: RunCoherenceInput[];
}

async function validate_dir(
  dir: string,
  triage_groups: Record<string, FalsePositiveGroup>,
  registry: KnownIssue[],
): Promise<DirValidation> {
  const entries = await read_dir_safe(dir);
  const issues: ValidationIssue[] = [];
  const coherence_inputs: RunCoherenceInput[] = [];
  for (const file of entries) {
    if (!file.endsWith(".json") || file.endsWith(".session.json")) continue;
    const dispatch_group_id = path.basename(file, ".json");
    const response_path = path.join(dir, file);
    let response_raw: unknown;
    try {
      response_raw = JSON.parse(await fs.readFile(response_path, "utf8"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      issues.push({
        group_id: dispatch_group_id,
        response_path,
        code: "shape_error",
        message: `unreadable JSON (${msg})`,
      });
      coherence_inputs.push({ dispatch_group_id, response_path, parsed: null });
      continue;
    }
    const session_log = await load_session_log(dir, dispatch_group_id);
    const source_group = triage_groups[dispatch_group_id] ?? null;
    issues.push(
      ...validate_response({
        dispatch_group_id,
        response_path,
        response_raw,
        source_group,
        registry,
        session_log,
      }),
    );
    const parsed_or_err = parse_investigate_response(response_raw);
    const parsed: InvestigateResponse | null =
      "error" in parsed_or_err ? null : parsed_or_err;
    coherence_inputs.push({ dispatch_group_id, response_path, parsed });
  }
  return { issues, coherence_inputs };
}

async function main(): Promise<void> {
  const { run_path } = parse_argv(process.argv.slice(2));
  const run_id = derive_run_id(run_path);
  const output_dir = run_output_dir(run_id);
  const investigate_dir = path.join(output_dir, "investigate");
  const investigate_promoted_dir = path.join(output_dir, "investigate_promoted");

  const triage = await load_json<TriageResultsFile>(run_path);
  const registry = await load_json<KnownIssue[]>(get_registry_file_path());

  const residual = await validate_dir(investigate_dir, triage.false_positive_groups, registry);
  const promoted = await validate_dir(investigate_promoted_dir, triage.false_positive_groups, registry);
  const coherence_inputs = [...residual.coherence_inputs, ...promoted.coherence_inputs];
  const issues = [
    ...residual.issues,
    ...promoted.issues,
    ...validate_run_coherence(coherence_inputs),
  ];

  const ok = issues.length === 0;
  const validation_path = path.join(output_dir, "validation.json");
  await fs.writeFile(
    validation_path,
    JSON.stringify({ run_id, ok, issues }, null, 2) + "\n",
    "utf8",
  );
  process.stdout.write(JSON.stringify({ run_id, ok, issues }, null, 2) + "\n");
  if (!ok) process.exit(1);
}

main().catch((err) => {
  process.stderr.write(
    `validate_responses failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

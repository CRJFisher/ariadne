#!/usr/bin/env node
/**
 * Validates a single investigator-authored response JSON against the curator's
 * shape and per-response rules.
 *
 * Called by the `triage-curator-investigator` sub-agent inside its
 * propose → validate → iterate loop: on a clean exit the agent emits the
 * response; on a non-zero exit it reads `issues[]` from stdout, adjusts the
 * spec or moves unfittable entries into `rejected_members`, and re-runs.
 *
 * Cross-response coherence (e.g. two responses targeting the same classifier
 * file) is intentionally NOT checked here — by construction the agent cannot
 * see sibling responses. That check runs once at finalize time.
 *
 * Usage:
 *   node --import tsx validate_responses.ts \
 *     --response <response.json> --run <run-path>
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { parse_known_issues_registry_json } from "@ariadnejs/types";
import { error_code } from "../src/errors.js";
import { read_v4_triage_results } from "../src/parse_triage_results.js";
import { get_registry_file_path } from "../src/paths.js";
import { parse_investigator_session_log } from "../src/session_log.js";
import type { InvestigatorSessionLog } from "../src/types.js";
import {
  validate_response,
  type ValidationIssue,
} from "../src/validate_investigate_responses.js";
import "../src/require_node_import_tsx.js";

interface CliArgs {
  response_path: string;
  run_path: string;
}

function parse_argv(argv: string[]): CliArgs {
  let response_path: string | null = null;
  let run_path: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--response":
        response_path = argv[++i];
        break;
      case "--run":
        run_path = argv[++i];
        break;
      case "--help":
      case "-h":
        process.stdout.write(
          "Usage: validate_responses --response <response.json> --run <run-path>\n",
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (response_path === null || response_path.length === 0) {
    throw new Error("--response <path> is required");
  }
  if (run_path === null || run_path.length === 0) {
    throw new Error("--run <path> is required");
  }
  return { response_path, run_path };
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

async function validate_single_response(
  response_path: string,
  run_path: string,
): Promise<ValidationIssue[]> {
  const triage = await read_v4_triage_results(run_path);
  const registry = parse_known_issues_registry_json(
    await fs.readFile(get_registry_file_path(), "utf8"),
  );

  const dispatch_group_id = path.basename(response_path, ".json");
  const investigate_dir = path.dirname(response_path);

  let response_raw: unknown;
  try {
    response_raw = JSON.parse(await fs.readFile(response_path, "utf8"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return [
      {
        group_id: dispatch_group_id,
        response_path,
        code: "shape_error",
        message: `unreadable JSON (${msg})`,
      },
    ];
  }

  const session_log = await load_session_log(investigate_dir, dispatch_group_id);
  // Under v4 the dispatch source is a `novel_issue`; the entry count for
  // index-range validation is its citation count. null when the issue cannot
  // be resolved in the run artifact (e.g. response filename mismatches).
  const novel_issue = triage.novel_issues.find((i) => i.id === dispatch_group_id) ?? null;
  const source_entry_count = novel_issue === null ? null : novel_issue.citations.length;
  return validate_response({
    dispatch_group_id,
    response_path,
    response_raw,
    source_entry_count,
    registry,
    session_log,
  });
}

async function main(): Promise<void> {
  const { response_path, run_path } = parse_argv(process.argv.slice(2));
  const issues = await validate_single_response(response_path, run_path);
  const ok = issues.length === 0;
  process.stdout.write(
    JSON.stringify({ response_path, ok, issues }, null, 2) + "\n",
  );
  if (!ok) process.exit(1);
}

main().catch((err) => {
  process.stderr.write(
    `validate_responses failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Validate a `refactor-consolidator`'s `consolidation.json` against the
 * investigated row-id set and the permanent-limitation reroutes. Prioritize runs
 * this as step 4.5 (right after the consolidator writes the map) and re-runs it
 * as an export precondition, so a dropped/double-assigned/unknown row, a dangling
 * `plan_path`, a duplicate slug, or a permanent-rerouted id in a cluster is caught
 * before human copy-paste into `--id` flags.
 *
 * Inputs:
 *   --consolidation <path>  the consolidator's consolidation.json
 *   --groups <path>         the investigated groups.json (step 4 persists this):
 *                           `[{ fault_area, plan_path, row_ids }]`; the union of
 *                           every group's row_ids is the set the clusters partition.
 *   --reroutes <path>       optional reroutes.json (item 4): rows a verdict moved
 *                           into the permanent set, which must appear in no cluster.
 *
 * Exit codes: usage error → 2 (with USAGE); a validation failure → 1; ok → 0.
 *
 * **Script invocation:** always `node --import tsx`. Never `pnpm exec tsx`.
 */

import * as fs from "node:fs";
import { readFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import {
  validate_consolidation,
  type ValidateConsolidationResult,
} from "../src/reconcile/validate_consolidation.js";
import {
  permanent_rerouted_ids,
  type PermanentLimitationReroute,
} from "../src/reconcile/permanent_reroute.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE =
  "Usage: validate_consolidation --consolidation <path> --groups <path> [--reroutes <path>]\n";

interface CliArgs {
  consolidation_path: string;
  groups_path: string;
  reroutes_path: string | null;
}

class UsageError extends Error {}

function parse_argv(argv: string[]): CliArgs {
  let consolidation_path: string | null = null;
  let groups_path: string | null = null;
  let reroutes_path: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--consolidation":
        consolidation_path = argv[++i] ?? null;
        break;
      case "--groups":
        groups_path = argv[++i] ?? null;
        break;
      case "--reroutes":
        reroutes_path = argv[++i] ?? null;
        break;
      case "--help":
      case "-h":
        process.stdout.write(USAGE);
        process.exit(0);
        break;
      default:
        throw new UsageError(`Unknown argument: ${arg}`);
    }
  }
  if (consolidation_path === null || consolidation_path.length === 0) {
    throw new UsageError("--consolidation <path> is required");
  }
  if (groups_path === null || groups_path.length === 0) {
    throw new UsageError("--groups <path> is required");
  }
  return { consolidation_path, groups_path, reroutes_path };
}

interface GroupRecord {
  row_ids: string[];
}

async function read_json<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function run(argv: string[]): Promise<ValidateConsolidationResult> {
  const { consolidation_path, groups_path, reroutes_path } = parse_argv(argv);

  const groups = await read_json<GroupRecord[]>(groups_path);
  const investigated_row_ids = groups.flatMap((g) => g.row_ids);

  const reroutes =
    reroutes_path === null ? [] : await read_json<PermanentLimitationReroute[]>(reroutes_path);

  let consolidation_raw: unknown;
  try {
    consolidation_raw = await read_json<unknown>(consolidation_path);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      issues: [{ code: "shape_error", path: "$", message: `unreadable JSON (${msg})` }],
    };
  }

  return validate_consolidation(consolidation_raw, {
    investigated_row_ids,
    permanent_rerouted_ids: permanent_rerouted_ids(reroutes),
    plan_path_exists: (plan_path) => fs.existsSync(expand_home(plan_path)),
  });
}

/** Node does not expand `~`; the consolidator's plan_paths are tilde-rooted. */
function expand_home(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      if (!result.ok) process.exit(1);
    })
    .catch((err) => {
      if (err instanceof UsageError) {
        process.stderr.write(`${err.message}\n${USAGE}`);
        process.exit(2);
      }
      process.stderr.write(
        `validate_consolidation failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
      );
      process.exit(1);
    });
}

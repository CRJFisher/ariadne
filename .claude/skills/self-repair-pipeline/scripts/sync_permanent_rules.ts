#!/usr/bin/env node
/**
 * Authoritative owner of the builtins-regen contract.
 *
 * Reads the full skill registry at
 * `.claude/skills/self-repair-pipeline/known_issues/registry.json`, filters to
 * `status === "permanent" && classifier.kind !== "none"`, and writes:
 *
 *   1. `packages/core/src/classify_entry_points/registry.permanent.json` — the
 *      slice the core loader bundles. Stored as JSON so diffs are stable and
 *      the file ships unchanged in `dist/` via the core's `copy-permanent-registry`
 *      step.
 *   2. `packages/core/src/classify_entry_points/builtins/index.ts` — the
 *      orchestrator's `BUILTIN_CHECKS` map. Re-rendered via
 *      `render_builtins_barrel` so the import header always tracks the
 *      registry's current `function_name` set.
 *
 * CI invokes `pnpm sync-permanent-rules` followed by `git diff --exit-code`
 * over the generated paths so a registry edit without a regen fails fast.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION,
  type KnownIssue,
  type KnownIssuesRegistryFile,
  type PredicateExpr,
} from "@ariadnejs/types";
import { load_registry } from "../src/known_issues_registry.js";
import { render_builtins_barrel } from "../src/auto_classify/render_builtins_barrel.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// scripts/ → skill root → ../.. (skills) → ../.. (.claude) → ../.. (repo root)
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..");

const CLASSIFY_DIR = path.join(
  REPO_ROOT,
  "packages",
  "core",
  "src",
  "classify_entry_points",
);

/** Absolute on-disk path of the bundled permanent-slice JSON. */
export const PERMANENT_JSON_PATH = path.join(CLASSIFY_DIR, "registry.permanent.json");
/** Absolute on-disk path of the regenerated builtins barrel. */
export const BARREL_PATH = path.join(CLASSIFY_DIR, "builtins", "index.ts");

interface SyncResult {
  permanent_count: number;
  builtin_count: number;
}

/**
 * Regenerate the permanent slice JSON and the builtins barrel from the full
 * skill registry. Returns counts of what was written so callers can log.
 *
 * The barrel contains every `kind: "builtin"` rule's function regardless of
 * `status` — wip-status builtins must still resolve in `BUILTIN_CHECKS` when
 * the skill runs the full registry against `enrich_call_graph`. The slice
 * (`registry.permanent.json`) gates which rules ship in core's default flow.
 */
export async function sync_permanent_rules(): Promise<SyncResult> {
  const registry = load_registry();
  const permanent = filter_permanent_slice(registry);
  await write_permanent_json(permanent);
  await write_builtins_barrel(registry);
  return {
    permanent_count: permanent.length,
    builtin_count: registry.filter((r) => r.classifier.kind === "builtin").length,
  };
}

function filter_permanent_slice(registry: readonly KnownIssue[]): KnownIssue[] {
  return registry.filter(
    (issue) => issue.status === "permanent" && issue.classifier.kind !== "none",
  );
}

/**
 * Serialize the permanent slice as `{ schema_version, rules }` JSON. The
 * runtime regex-compile step in `validate_registry` mutates predicate nodes
 * with `compiled_pattern: RegExp`; those would serialize as `{}` and pollute
 * the wire format, so they are stripped before stringification.
 */
async function write_permanent_json(permanent: KnownIssue[]): Promise<void> {
  const wire_rules = permanent.map(strip_runtime_only_fields);
  const file: KnownIssuesRegistryFile = {
    schema_version: KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION,
    rules: wire_rules,
  };
  const body = JSON.stringify(file, null, 2) + "\n";
  await fs.writeFile(PERMANENT_JSON_PATH, body, "utf8");
}

async function write_builtins_barrel(rules: readonly KnownIssue[]): Promise<void> {
  const body = render_builtins_barrel(rules);
  await fs.mkdir(path.dirname(BARREL_PATH), { recursive: true });
  await fs.writeFile(BARREL_PATH, body, "utf8");
}

/** Drop runtime-only injections (e.g. `compiled_pattern`) before serializing. */
function strip_runtime_only_fields(issue: KnownIssue): KnownIssue {
  if (issue.classifier.kind !== "predicate") return issue;
  return {
    ...issue,
    classifier: {
      ...issue.classifier,
      expression: strip_compiled_pattern(issue.classifier.expression),
    },
  };
}

function strip_compiled_pattern(expr: PredicateExpr): PredicateExpr {
  switch (expr.op) {
    case "all":
    case "any":
      return { op: expr.op, of: expr.of.map(strip_compiled_pattern) };
    case "not":
      return { op: "not", of: strip_compiled_pattern(expr.of) };
    case "decorator_matches":
    case "grep_line_regex":
      return { op: expr.op, pattern: expr.pattern };
    case "grep_hit_neighbourhood_matches":
      return { op: expr.op, pattern: expr.pattern, window: expr.window };
    default:
      return expr;
  }
}

async function main(): Promise<void> {
  const { permanent_count, builtin_count } = await sync_permanent_rules();
  console.log(`sync-permanent-rules: ${permanent_count} permanent rules → registry.permanent.json`);
  console.log(`sync-permanent-rules: ${builtin_count} builtin rules → builtins/index.ts`);
}

const invoked_directly =
  import.meta.url === `file://${process.argv[1]}` ||
  fileURLToPath(import.meta.url) === process.argv[1];
if (invoked_directly) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`sync-permanent-rules: ${message}`);
    process.exit(1);
  });
}

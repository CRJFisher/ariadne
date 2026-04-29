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
 *      the file ships unchanged in `dist/` via the core's copy step.
 *   2. `packages/core/src/classify_entry_points/builtins/index.ts` — the
 *      orchestrator's `BUILTIN_CHECKS` map. Re-rendered via
 *      `render_builtins_barrel` so the import header always tracks the
 *      registry's current `function_name` set.
 *
 * Pre-commit hooks and CI both invoke `pnpm sync-permanent-rules` followed by
 * `git diff --exit-code packages/core/src/classify_entry_points/` to fail loud
 * when the slice or barrel drifts from the registry.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION,
  type KnownIssue,
  type KnownIssuesRegistryFile,
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

const PERMANENT_JSON_PATH = path.join(CLASSIFY_DIR, "registry.permanent.json");
const BARREL_PATH = path.join(CLASSIFY_DIR, "builtins", "index.ts");

async function main(): Promise<void> {
  const registry = load_registry();

  const permanent = filter_permanent_slice(registry);
  await write_permanent_json(permanent);
  // The barrel contains every `kind: "builtin"` rule's function, regardless
  // of `status`. Wip rules also need their classifiers in `BUILTIN_CHECKS`
  // so the orchestrator's lookup succeeds when the skill runs the full
  // registry against `enrich_call_graph`. The slice (registry.permanent.json)
  // is what gates which rules ship in core's default classification flow.
  await write_builtins_barrel(registry);

  const builtin_count = registry.filter((r) => r.classifier.kind === "builtin").length;
  console.error(`sync-permanent-rules: ${permanent.length} permanent rules → registry.permanent.json`);
  console.error(`sync-permanent-rules: ${builtin_count} builtin rules → builtins/index.ts`);
}

function filter_permanent_slice(registry: readonly KnownIssue[]): KnownIssue[] {
  return registry.filter(
    (issue) => issue.status === "permanent" && issue.classifier.kind !== "none",
  );
}

/**
 * Serialize the permanent slice as `{ schema_version, rules }` JSON.
 * `JSON.stringify` preserves field order from the source registry, so as long
 * as the input registry is stable the output diffs cleanly.
 */
async function write_permanent_json(permanent: KnownIssue[]): Promise<void> {
  const file: KnownIssuesRegistryFile = {
    schema_version: KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION,
    rules: permanent,
  };
  const body = JSON.stringify(file, null, 2) + "\n";
  await fs.writeFile(PERMANENT_JSON_PATH, body, "utf8");
}

async function write_builtins_barrel(permanent: KnownIssue[]): Promise<void> {
  const body = render_builtins_barrel(permanent);
  await fs.mkdir(path.dirname(BARREL_PATH), { recursive: true });
  await fs.writeFile(BARREL_PATH, body, "utf8");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`sync-permanent-rules: ${message}`);
  process.exit(1);
});

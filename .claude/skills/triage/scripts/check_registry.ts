#!/usr/bin/env node
/**
 * Lint lens for the classifier registry (`known_issues/registry.json`).
 *
 * Strict-parses the registry and layers the cross-checks the skill-side loader
 * cannot run on its own — `function_name` membership in core's `BUILTIN_CHECKS`
 * (the loader only regex-validates the name shape, because `@ariadnejs/core` is
 * not a dependency of the loader module) and the two evidence/status gates the
 * loader leaves open:
 *
 *   1. every `classifier.function_name` resolves to a real `BuiltinCheckFn` in
 *      `@ariadnejs/core`'s `BUILTIN_CHECKS` — a name with no backing check is a
 *      dead rule that can never fire;
 *   2. a present `observed_count` is `>= 1` — the loader admits `0`, but a rule
 *      that has never been observed is a speculative classifier;
 *   3. a `fixed` row carries no `drift_detected` — drift review is a live-rule
 *      signal, so it is dead metadata on a retired row (the loader enforces the
 *      analogous `permanent` case but not `fixed`).
 *
 * The structural schema (shape, enums, uniqueness, kebab-case ids, the wip
 * evidence gate, the permanent no-drift/no-backlog gates) is delegated to
 * `validate_registry` from the skill's own loader — this script never re-derives
 * it. It lives beside `reconcile_registry.ts` (the registry's write path) so both
 * reach the loader and `@ariadnejs/core` by in-skill relative and workspace
 * imports rather than a forbidden cross-skill sibling path.
 *
 * Exit codes: usage error → 2 (with USAGE); a validation failure → 1; ok → 0.
 *
 * Usage:
 *   node --import tsx check_registry.ts [--file <path>]
 *
 * `--file` overrides the canonical registry path (for a seeded fixture); omit it
 * to lint the live registry.
 */

import * as fs from "node:fs";
import { pathToFileURL } from "node:url";

import { BUILTIN_CHECKS } from "@ariadnejs/core";
import { parse_known_issues_registry_json, type KnownIssue } from "@ariadnejs/types";
import { known_issues_registry_path } from "@ariadnejs/skill-protocol";

import { validate_registry } from "../src/known_issues_registry.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE = "Usage: check_registry --file <path>  (omit --file to lint the live registry)\n";

class UsageError extends Error {}

interface CliArgs {
  file_path: string;
}

interface RegistryCheckResult {
  registry_path: string;
  ok: boolean;
  checked: number;
  issues: string[];
}

function parse_argv(argv: string[]): CliArgs {
  let file_path: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--file": {
        const value = argv[++i];
        if (value === undefined || value.startsWith("--")) {
          throw new UsageError("--file expects a path");
        }
        file_path = value;
        break;
      }
      case "--help":
      case "-h":
        process.stdout.write(USAGE);
        process.exit(0);
        break;
      default:
        throw new UsageError(`Unknown argument: ${arg}`);
    }
  }
  return { file_path: file_path ?? known_issues_registry_path() };
}

export function check_registry(file_path: string): RegistryCheckResult {
  const issues: string[] = [];
  const raw = fs.readFileSync(file_path, "utf8");

  let rules: KnownIssue[];
  try {
    rules = parse_known_issues_registry_json(raw);
    validate_registry(rules);
  } catch (err) {
    // A structural failure short-circuits the per-row lens: the rows are not
    // narrowed, so the layered checks below cannot run safely.
    return {
      registry_path: file_path,
      ok: false,
      checked: 0,
      issues: [err instanceof Error ? err.message : String(err)],
    };
  }

  for (const rule of rules) {
    const at = `group_id="${rule.group_id}"`;
    const function_name = rule.classifier.function_name;
    if (!Object.prototype.hasOwnProperty.call(BUILTIN_CHECKS, function_name)) {
      issues.push(
        `${at}: classifier.function_name "${function_name}" is not a registered BUILTIN_CHECKS check`,
      );
    }
    if (rule.observed_count !== undefined && rule.observed_count < 1) {
      issues.push(
        `${at}: observed_count=${rule.observed_count} — a present observed_count must be >= 1 (no never-observed classifiers)`,
      );
    }
    if (rule.status === "fixed" && rule.drift_detected === true) {
      issues.push(
        `${at}: a fixed row must not carry drift_detected=true (drift review is a live-rule signal)`,
      );
    }
  }

  return { registry_path: file_path, ok: issues.length === 0, checked: rules.length, issues };
}

function main(): void {
  const { file_path } = parse_argv(process.argv.slice(2));
  const result = check_registry(file_path);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (!result.ok) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`${err.message}\n${USAGE}`);
      process.exit(2);
    }
    process.stderr.write(
      `check_registry failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    process.exit(1);
  }
}

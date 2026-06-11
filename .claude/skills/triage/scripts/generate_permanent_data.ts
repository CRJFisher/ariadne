#!/usr/bin/env node
/**
 * Regenerate core's bundled permanent slice
 * (`packages/core/src/classify_entry_points/permanent_data.ts`) from the
 * source known-issues registry. The apply-half of the `wip → permanent`
 * lifecycle transition: `reconcile_registry.ts --promote` invokes it after
 * flipping a rule's status, and `permanent_data.sync.test.ts` asserts the
 * committed slice byte-equals this script's output thereafter.
 *
 * The render itself is `render_permanent_slice_module` in `@ariadnejs/types`
 * (shared with the sync test); this script is the thin I/O half: read the
 * registry, render, write. It writes `permanent_data.ts` — a TypeScript
 * module, not the registry — so the registry write-boundary fence does not
 * apply to its output path.
 *
 * **Script invocation:** always `node --import tsx`. Never `pnpm exec tsx`.
 *
 * Usage:
 *   node --import tsx generate_permanent_data.ts [--dry-run]
 */

import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { atomic_write_file } from "@ariadnejs/skill-fs";
import { known_issues_registry_path, repo_root } from "@ariadnejs/skill-protocol";
import {
  KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION,
  parse_known_issues_registry_json,
  render_permanent_slice_module,
} from "@ariadnejs/types";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE = "Usage: generate_permanent_data [--dry-run]\n";

/** Absolute path of the generated core slice. */
export function permanent_slice_output_path(): string {
  return path.join(
    repo_root(),
    "packages",
    "core",
    "src",
    "classify_entry_points",
    "permanent_data.ts",
  );
}

export interface GenerateSummary {
  dry_run: boolean;
  output_path: string;
  /** True when the freshly rendered slice differs from the file on disk. */
  changed: boolean;
}

export interface GenerateOptions {
  dry_run: boolean;
  /** Source registry to read; defaults to the repo's known-issues registry. Injected by tests. */
  source_registry_path?: string;
  /** Slice module to write; defaults to core's `permanent_data.ts`. Injected by tests. */
  output_path?: string;
}

export async function generate_permanent_data(
  opts: GenerateOptions,
): Promise<GenerateSummary> {
  const source = opts.source_registry_path ?? known_issues_registry_path();
  const raw = await readFile(source, "utf8");
  const rules = parse_known_issues_registry_json(raw);
  const rendered = render_permanent_slice_module(
    KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION,
    rules,
  );

  const output_path = opts.output_path ?? permanent_slice_output_path();
  const on_disk = await readFile(output_path, "utf8").catch(() => null);
  const changed = on_disk !== rendered;

  if (!opts.dry_run && changed) {
    await atomic_write_file(output_path, rendered);
  }

  return { dry_run: opts.dry_run, output_path, changed };
}

function parse_argv(argv: string[]): { dry_run: boolean } {
  let dry_run = false;
  for (const arg of argv) {
    switch (arg) {
      case "--dry-run":
        dry_run = true;
        break;
      case "--help":
      case "-h":
        process.stdout.write(USAGE);
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { dry_run };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generate_permanent_data(parse_argv(process.argv.slice(2)))
    .then((summary) => process.stdout.write(JSON.stringify(summary, null, 2) + "\n"))
    .catch((err) => {
      process.stderr.write(
        `generate_permanent_data failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
      );
      process.exit(1);
    });
}

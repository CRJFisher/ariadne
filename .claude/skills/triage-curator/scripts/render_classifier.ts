#!/usr/bin/env node
/**
 * Thin CLI wrapper around `render_classifier(spec)`. Reads an
 * InvestigateResponse JSON file whose `classifier_spec` is a
 * `BuiltinClassifierSpec`, invokes the pure renderer, and either:
 *
 *   - writes the source to `<out_dir>/check_<target_group_id>.ts` when
 *     `--out <dir>` is supplied (Step 4.5 happy-path; self-directing filename
 *     derived from `response.retargets_to ?? response.group_id`);
 *
 *   - prints the source to stdout when `--out` is omitted (kept for ad-hoc
 *     invocations and test ergonomics).
 *
 * Exit codes:
 *   0 — wrote valid source (or printed to stdout)
 *   1 — IO failure, missing spec, or renderer threw (unknown SignalCheck op,
 *       etc.). stderr carries the reason; in `--out` mode the target file is
 *       NOT created on failure.
 *
 * Usage:
 *   node --import tsx render_classifier.ts --response <response.json> --out <dir>
 *   node --import tsx render_classifier.ts --response <response.json>
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { render_classifier } from "../src/render_classifier.js";
import type { BuiltinClassifierSpec } from "../src/types.js";
import "../src/require_node_import_tsx.js";

interface CliArgs {
  response_path: string;
  out_dir: string | null;
}

function parse_argv(argv: string[]): CliArgs {
  let response_path: string | null = null;
  let out_dir: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--response":
        response_path = argv[++i];
        break;
      case "--out":
        out_dir = argv[++i];
        break;
      case "--help":
      case "-h":
        process.stdout.write(
          "Usage: render_classifier --response <response.json> [--out <dir>]\n",
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
  return { response_path, out_dir };
}

interface MinimalResponse {
  group_id?: unknown;
  retargets_to?: unknown;
  classifier_spec?: BuiltinClassifierSpec | null;
}

function derive_target_group_id(response: MinimalResponse, response_path: string): string {
  if (typeof response.retargets_to === "string" && response.retargets_to.length > 0) {
    return response.retargets_to;
  }
  if (typeof response.group_id === "string" && response.group_id.length > 0) {
    return response.group_id;
  }
  throw new Error(`response at ${response_path} has no group_id — cannot derive target path`);
}

async function main(): Promise<void> {
  const { response_path, out_dir } = parse_argv(process.argv.slice(2));
  const raw = await fs.readFile(response_path, "utf8");
  const parsed = JSON.parse(raw) as MinimalResponse;
  if (parsed.classifier_spec === null || parsed.classifier_spec === undefined) {
    throw new Error(
      `response at ${response_path} has no classifier_spec — nothing to render`,
    );
  }
  // Render first; if this throws, no file is written.
  const source = render_classifier(parsed.classifier_spec);
  if (out_dir === null) {
    process.stdout.write(source);
    return;
  }
  const target_group_id = derive_target_group_id(parsed, response_path);
  const target_path = path.join(out_dir, `check_${target_group_id}.ts`);
  await fs.mkdir(out_dir, { recursive: true });
  await fs.writeFile(target_path, source, "utf8");
  process.stdout.write(`${target_path}\n`);
}

main().catch((err) => {
  process.stderr.write(
    `render_classifier failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

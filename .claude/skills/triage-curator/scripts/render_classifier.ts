#!/usr/bin/env node
/**
 * Thin CLI wrapper around `render_classifier(spec)`. Reads an
 * InvestigateResponse JSON file whose `classifier_spec` is a
 * `BuiltinClassifierSpec`, invokes the pure renderer, and prints the resulting
 * TypeScript module body to stdout.
 *
 * Step 4.5 of the triage-curator pipeline. The main agent pipes stdout into the
 * target `check_<group_id>.ts` path via the `Write` tool.
 *
 * Exit codes:
 *   0 — printed valid source
 *   1 — IO failure, missing spec, or renderer threw (unknown SignalCheck op,
 *       etc.). stderr carries the reason.
 *
 * Usage:
 *   node --import tsx render_classifier.ts --response <path-to-investigate-response-json>
 */

import * as fs from "node:fs/promises";

import { render_classifier } from "../src/render_classifier.js";
import type { BuiltinClassifierSpec } from "../src/types.js";
import "../src/require_node_import_tsx.js";

interface CliArgs {
  response_path: string;
}

function parse_argv(argv: string[]): CliArgs {
  let response_path: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--response":
        response_path = argv[++i];
        break;
      case "--help":
      case "-h":
        process.stdout.write(
          "Usage: render_classifier --response <path-to-investigate-response-json>\n",
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
  return { response_path };
}

async function main(): Promise<void> {
  const { response_path } = parse_argv(process.argv.slice(2));
  const raw = await fs.readFile(response_path, "utf8");
  const parsed = JSON.parse(raw) as { classifier_spec?: BuiltinClassifierSpec | null };
  if (parsed.classifier_spec === null || parsed.classifier_spec === undefined) {
    throw new Error(
      `response at ${response_path} has no classifier_spec — nothing to render`,
    );
  }
  const source = render_classifier(parsed.classifier_spec);
  process.stdout.write(source);
}

main().catch((err) => {
  process.stderr.write(
    `render_classifier failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Folder preview for first-time project-config setup.
 *
 * Usage:
 *   node --import tsx preview_folders.ts --path <abs_path> [--max-depth <n>]
 */

import * as fs from "fs/promises";
import * as path from "path";

import { DEFAULT_MAX_DEPTH, preview_folders } from "../src/preview_folders.js";
import "../src/guard_tsx_invocation.js";

interface CliArgs {
  project_path: string;
  max_depth: number;
}

function parse_args(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let project_path: string | null = null;
  let max_depth = DEFAULT_MAX_DEPTH;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--path" && args[i + 1]) {
      project_path = args[++i];
    } else if (arg === "--max-depth" && args[i + 1]) {
      const n = parseInt(args[++i], 10);
      if (isNaN(n) || n < 1) {
        process.stderr.write("Error: --max-depth must be a positive integer\n");
        process.exit(1);
      }
      max_depth = n;
    }
  }

  if (!project_path) {
    process.stderr.write(
      `Usage: preview_folders.ts --path <abs_path> [--max-depth <n> (default: ${DEFAULT_MAX_DEPTH})]\n`,
    );
    process.exit(1);
  }

  return { project_path: path.resolve(project_path), max_depth };
}

async function main(): Promise<void> {
  const cli = parse_args(process.argv);
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(cli.project_path);
  } catch {
    process.stderr.write(`Error: path does not exist: ${cli.project_path}\n`);
    process.exit(1);
  }
  if (!stat.isDirectory()) {
    process.stderr.write(`Error: path is not a directory: ${cli.project_path}\n`);
    process.exit(1);
  }
  const result = await preview_folders({
    project_path: cli.project_path,
    max_depth: cli.max_depth,
  });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});

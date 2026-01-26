#!/usr/bin/env node
import { start_server } from "./start_server";

export interface CliOptions {
  project_path?: string;
  watch?: boolean;
}

/**
 * Parse CLI arguments.
 * Supports:
 *   --project-path <path>, -p <path>, --project-path=<path>
 *   --watch, --no-watch
 */
export function parse_cli_args(argv: string[] = process.argv.slice(2)): CliOptions {
  const result: CliOptions = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    // Project path flags
    if (arg === "--project-path" || arg === "-p") {
      result.project_path = argv[i + 1];
      i++; // Skip the next argument (the path value)
    } else if (arg?.startsWith("--project-path=")) {
      result.project_path = arg.split("=")[1];
    }

    // Watch control flags
    if (arg === "--watch") {
      result.watch = true;
    } else if (arg === "--no-watch") {
      result.watch = false;
    }
  }

  return result;
}

const cli_options = parse_cli_args();
start_server({
  project_path: cli_options.project_path,
  watch: cli_options.watch,
}).catch(console.error);
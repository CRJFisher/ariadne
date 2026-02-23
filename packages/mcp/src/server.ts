#!/usr/bin/env node
import { start_server } from "./start_server";

export interface CliOptions {
  project_path?: string;
  watch?: boolean;
  toolsets?: string[];
}

/**
 * Parse CLI arguments.
 * Supports:
 *   --project-path <path>, -p <path>, --project-path=<path>
 *   --watch, --no-watch
 *   --toolsets=core,topology (comma-separated tool group names)
 */
export function parse_cli_args(argv: string[] = process.argv.slice(2)): CliOptions {
  const result: CliOptions = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    // Project path flags
    if (arg === "--project-path" || arg === "-p") {
      result.project_path = argv[i + 1];
      i++;
    } else if (arg?.startsWith("--project-path=")) {
      result.project_path = arg.split("=")[1];
    }

    // Watch control flags
    if (arg === "--watch") {
      result.watch = true;
    } else if (arg === "--no-watch") {
      result.watch = false;
    }

    // Toolsets flag
    if (arg?.startsWith("--toolsets=")) {
      result.toolsets = arg.split("=")[1].split(",").filter(Boolean);
    } else if (arg === "--toolsets") {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        result.toolsets = next.split(",").filter(Boolean);
        i++;
      }
    }
  }

  return result;
}

/**
 * Resolve toolsets from CLI > env var > default (all).
 */
export function resolve_toolsets(cli_toolsets?: string[]): string[] {
  if (cli_toolsets && cli_toolsets.length > 0) {
    return cli_toolsets;
  }
  const env_toolsets = process.env.ARIADNE_TOOLSETS;
  if (env_toolsets) {
    return env_toolsets.split(",").filter(Boolean);
  }
  return [];
}

const cli_options = parse_cli_args();
start_server({
  project_path: cli_options.project_path,
  watch: cli_options.watch,
  toolsets: resolve_toolsets(cli_options.toolsets),
}).catch(console.error);
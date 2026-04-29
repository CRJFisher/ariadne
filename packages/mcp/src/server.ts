#!/usr/bin/env node
import { start_server } from "./start_server";

export interface CliOptions {
  project_path?: string;
  watch?: boolean;
  toolsets?: string[];
  show_suppressed?: boolean;
}

/**
 * Parse CLI arguments.
 * Supports:
 *   --project-path <path>, -p <path>, --project-path=<path>
 *   --watch, --no-watch
 *   --toolsets=core,topology (comma-separated tool group names)
 *   --show-suppressed, --no-show-suppressed
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

    // Suppressed-section visibility flag (server-level, applies to every
    // list_entrypoints call). Triage workflows enable this via .mcp.json;
    // everyday agents leave it off and see the clean default output.
    if (arg === "--show-suppressed") {
      result.show_suppressed = true;
    } else if (arg === "--no-show-suppressed") {
      result.show_suppressed = false;
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

/**
 * Resolve show_suppressed from CLI > env var > default (false).
 *
 * Env var accepts truthy strings: "1", "true", "yes" (case-insensitive).
 * Anything else — including unset — resolves to false.
 */
export function resolve_show_suppressed(cli_value?: boolean): boolean {
  if (cli_value !== undefined) {
    return cli_value;
  }
  const env = process.env.ARIADNE_SHOW_SUPPRESSED;
  if (env === undefined) return false;
  const normalized = env.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

const cli_options = parse_cli_args();
start_server({
  project_path: cli_options.project_path,
  watch: cli_options.watch,
  toolsets: resolve_toolsets(cli_options.toolsets),
  show_suppressed: resolve_show_suppressed(cli_options.show_suppressed),
}).catch(console.error);

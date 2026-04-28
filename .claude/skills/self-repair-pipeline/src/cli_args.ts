/**
 * Generic argv shaping helpers shared by every Phase 2-5 script.
 *
 * Pure: no I/O, no path resolution. The path-aware `require_run` helper
 * lives in `triage_state_paths.ts`; pull this module's parsers in tandem
 * to wire up a typical script CLI.
 */

/**
 * Extract the required `--project <name>` from argv, or exit(1) with the usage string.
 */
export function parse_project_arg(argv: readonly string[], usage: string): string {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project") {
      const value = args[i + 1];
      if (value !== undefined && value.length > 0) return value;
    }
  }
  process.stderr.write(`${usage}\n`);
  process.exit(1);
}

/** Extract optional `--run-id <id>` from argv. Returns null when absent or empty. */
export function parse_run_id_arg(argv: readonly string[]): string | null {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--run-id") {
      const value = args[i + 1];
      if (value !== undefined && value.length > 0) return value;
    }
  }
  return null;
}

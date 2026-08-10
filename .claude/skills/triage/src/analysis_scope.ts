/**
 * The project config's answer to "what do we index, and what counts as a
 * candidate?" — read once, here, by both harness scripts.
 *
 * `detect_entrypoints` and `prepare_triage` index the same project and must
 * reach the same corpus and the same candidate gate. They used to each parse
 * the config themselves and drifted: one honoured `include_tests`, the other
 * hard-coded `false`. Sharing the reader makes the agreement structural.
 *
 * The axes are deliberately separate:
 *   - `folders` / `exclude` decide the CORPUS — which files are indexed at all,
 *     and therefore which call edges exist.
 *   - `include_tests` decides CANDIDACY — which indexed callables may be
 *     reported as entry points. It never removes a file, so it never deletes
 *     an edge.
 *   - `max_files` refuses a corpus too large to hold, rather than indexing an
 *     arbitrary part of one.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Refuse a corpus larger than this unless a config raises it deliberately.
 *
 * microsoft/TypeScript discovers ~38k source files, ~18k of them generated
 * compiler baselines, and indexing them all exhausts the V8 heap after an
 * hour. The default lives here, with the reader, so every script that indexes
 * through this scope gets the same ceiling — a cap one phase applies and the
 * next does not is the drift this module exists to prevent.
 */
export const DEFAULT_MAX_FILES = 20_000;

export interface AnalysisScope {
  folders: string[] | undefined;
  exclude: string[];
  include_tests: boolean;
  max_files: number;
}

export function read_analysis_scope(parsed: Record<string, unknown>): AnalysisScope {
  return {
    folders: Array.isArray(parsed.folders) ? (parsed.folders as string[]) : undefined,
    exclude: Array.isArray(parsed.exclude) ? (parsed.exclude as string[]) : [],
    include_tests:
      typeof parsed.include_tests === "boolean" ? parsed.include_tests : false,
    max_files:
      typeof parsed.max_files === "number" && Number.isInteger(parsed.max_files) && parsed.max_files > 0
        ? parsed.max_files
        : DEFAULT_MAX_FILES,
  };
}

export function load_analysis_scope(config_path: string | null): AnalysisScope {
  if (config_path === null) {
    return { folders: undefined, exclude: [], include_tests: false, max_files: DEFAULT_MAX_FILES };
  }
  const raw = fs.readFileSync(path.resolve(config_path), "utf-8");
  return read_analysis_scope(JSON.parse(raw) as Record<string, unknown>);
}

/**
 * Directory names that some supported language's test-file detection treats as
 * a test tree. The union across languages, not any one language's rule: JS/TS
 * adds `__tests__`, Rust adds `benches`, and the config carries no language, so
 * the warning covers the union and words itself conditionally.
 */
const TEST_TREE_DIRECTORY_NAMES: readonly string[] = [
  "tests",
  "test",
  "__tests__",
  "benches",
  "fixtures",
  "__fixtures__",
];

/**
 * Excludes that name a test tree, which cost call edges and usually buy
 * nothing.
 *
 * `exclude` is a corpus exclusion: it stops the file being indexed, so every
 * call it makes into production code disappears from the graph. Where the
 * project's language classifies the directory as tests, `include_tests: false`
 * already suppresses its callables, and the exclude is pure loss.
 */
export function test_tree_excludes(exclude: readonly string[]): string[] {
  return exclude.filter((entry) =>
    entry
      .split("/")
      .some((segment) => TEST_TREE_DIRECTORY_NAMES.includes(segment)),
  );
}

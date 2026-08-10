/**
 * The unindexed-test grep pass — the only diagnostic that touches the
 * filesystem outside the indexed source set. It lives apart from
 * `extract_entry_point_diagnostics` so that pass stays synchronous and free of
 * FS I/O; callers chain this one after extraction to populate
 * `grep_call_sites_unindexed_tests`.
 */

import type { EnrichedEntryPoint, FilePath } from "@ariadnejs/types";
import type { Project } from "../project/project";
import { find_source_files } from "../project/file_loading";
import { detect_language } from "../detect_language";
import { build_code_ranges, is_code_column } from "./qualify_grep_hits";
import * as path from "node:path";
import * as fs from "node:fs/promises";

/**
 * Build the constructor → class name map keyed by `file_path:start_line`. The
 * unindexed-test grep pass uses this to grep for `ClassName(` instead of
 * `__init__()` — same heuristic as the in-source grep pass.
 */
export function build_class_name_by_constructor_position(
  project: Project,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const class_def of project.definitions.get_class_definitions()) {
    for (const ctor of class_def.constructors ?? []) {
      const key = `${ctor.location.file_path}:${ctor.location.start_line}`;
      out.set(key, class_def.name as string);
    }
  }
  return out;
}

// Common conventions for test-directory siting. Kept narrow on purpose —
// project-specific patterns should extend this list via a config entry, not
// by broadening the default.
export const UNINDEXED_TEST_DIR_SEGMENTS: readonly string[] = [
  "/test/",
  "/tests/",
  "/__tests__/",
  "/spec/",
];

const TEST_FILE_EXTENSIONS: readonly string[] = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rs",
];

export async function attach_unindexed_test_grep_hits(
  entry_points: EnrichedEntryPoint[],
  project_path: string,
  indexed_source_files: ReadonlyMap<string, string>,
  class_name_by_constructor_position: ReadonlyMap<string, string>,
  ignore_patterns: readonly string[],
): Promise<void> {
  const test_files = await collect_unindexed_test_files(
    project_path,
    indexed_source_files,
    ignore_patterns,
  );
  if (test_files.size === 0) return;

  // Per-identifier inverted index over the out-of-index files. Comment and
  // string occurrences are skipped by the same rule the indexed channel uses —
  // otherwise a bare `# TODO: cover pool_shrink() one day` in an unindexed file
  // reads as the entry's only caller and routes it to `coverage_config`.
  const grep_index = new Map<string, { file_path: string; line: number; content: string }[]>();
  const pattern = /(?<![A-Za-z0-9_$])([A-Za-z_$][\w$]*)\s*\(/g;
  for (const [file_path, content] of test_files) {
    const language = detect_language(file_path);
    if (language === null) continue;
    const lines = content.split("\n");
    const code_ranges = build_code_ranges(lines, language);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const line_code_ranges = code_ranges[i];
      if (line_code_ranges.length === 0) continue;
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      let trimmed: string | null = null;
      while ((m = pattern.exec(line)) !== null) {
        if (!is_code_column(line_code_ranges, m.index)) continue;
        const name = m[1];
        let hits = grep_index.get(name);
        if (!hits) {
          hits = [];
          grep_index.set(name, hits);
        }
        if (trimmed === null) trimmed = line.trim();
        hits.push({ file_path, line: i + 1, content: trimmed });
      }
    }
  }

  for (const entry of entry_points) {
    // Constructors are grepped by class name, not __init__/constructor —
    // mirror the behaviour of the primary grep pass.
    let grep_name: string;
    if (entry.kind === "constructor") {
      const key = `${entry.file_path}:${entry.start_line}`;
      grep_name = class_name_by_constructor_position.get(key) ?? entry.name;
    } else {
      grep_name = entry.name;
    }
    if (grep_name === "<anonymous>") continue;
    const hits = grep_index.get(grep_name);
    if (!hits) continue;
    entry.diagnostics.grep_call_sites_unindexed_tests = hits.map((h) => ({
      file_path: h.file_path as FilePath,
      line: h.line,
      content: h.content,
      captures: [],
    }));
    // Callers exist only in unindexed test dirs when this pass found hits and
    // the indexed-source grep pass found none → the `coverage_config` signal.
    entry.diagnostics.callers_only_in_unindexed_tests =
      entry.diagnostics.grep_call_sites.length === 0;
  }
}

export async function collect_unindexed_test_files(
  project_path: string,
  indexed_source_files: ReadonlyMap<string, string>,
  ignore_patterns: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  // Reuse core's gitignore-aware walker so test-dir discovery honours the
  // same exclusion rules as primary indexing (`.gitignore` + `options.exclude`
  // + `IGNORED_DIRECTORIES`). Output is then narrowed to test directories
  // and to files not already indexed.
  let candidates: string[];
  try {
    candidates = await find_source_files(
      project_path,
      project_path,
      [...ignore_patterns],
    );
  } catch {
    return out;
  }
  for (const full of candidates) {
    if (indexed_source_files.has(full)) continue;
    if (!TEST_FILE_EXTENSIONS.some((ext) => full.endsWith(ext))) continue;
    const rel = `/${path.relative(project_path, full)}/`;
    if (!UNINDEXED_TEST_DIR_SEGMENTS.some((seg) => rel.includes(seg))) continue;
    try {
      const content = await fs.readFile(full, "utf-8");
      out.set(full, content);
    } catch {
      // silently skip unreadable
    }
  }
  return out;
}

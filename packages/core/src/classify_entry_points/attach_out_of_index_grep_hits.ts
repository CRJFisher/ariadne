/**
 * The out-of-index grep pass — the only diagnostic that touches the filesystem
 * outside the indexed source set. It lives apart from
 * `extract_entry_point_diagnostics` so that pass stays synchronous and free of
 * FS I/O; callers chain this one after extraction to populate
 * `grep_call_sites_outside_index` and settle each entry's diagnosis.
 *
 * The file set is exactly *discovered minus indexed*: everything the walker
 * finds that never reached a registry, whether held out by a project-config
 * `exclude`, left outside a `--folders` scope, or dropped by an indexing
 * error. Keying on that residue rather than on a list of test-directory names
 * is what lets a caller Ariadne never looked at state itself as one, instead
 * of arriving as `no-textual-callers` and reading like a genuine entry point.
 */

import type { EnrichedEntryPoint, FilePath } from "@ariadnejs/types";
import type { Project } from "../project/project";
import { log_warn } from "../logging";
import { find_source_files } from "../project/file_loading";
import { detect_language } from "../detect_language";
import { build_code_ranges, is_code_column } from "./qualify_grep_hits";
import { compute_diagnosis, MAX_GREP_HITS } from "./extract_entry_point_diagnostics";
import * as fs from "node:fs/promises";

/**
 * Build the constructor → class name map keyed by `file_path:start_line`. The
 * out-of-index grep pass uses this to grep for `ClassName(` instead of
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

export interface OutOfIndexGrepInput {
  readonly entry_points: EnrichedEntryPoint[];
  readonly project_path: string;
  /** The indexed corpus — `Project.get_file_contents()`. */
  readonly indexed_source_files: ReadonlyMap<string, string>;
  /** Files read but dropped by an indexing error, from `load_project`. */
  readonly dropped_files: ReadonlySet<string>;
  readonly class_name_by_constructor_position: ReadonlyMap<string, string>;
  /** Gitignore patterns only — a config `exclude` must NOT narrow this walk. */
  readonly gitignore_patterns: readonly string[];
}

export async function attach_out_of_index_grep_hits(
  input: OutOfIndexGrepInput,
): Promise<void> {
  const {
    entry_points,
    project_path,
    indexed_source_files,
    dropped_files,
    class_name_by_constructor_position,
    gitignore_patterns,
  } = input;

  const out_of_index = await collect_files_outside_index(
    project_path,
    indexed_source_files,
    dropped_files,
    gitignore_patterns,
  );

  const grep_index = build_out_of_index_grep_index(out_of_index);

  for (const entry of entry_points) {
    // Constructors are grepped by class name, not __init__/constructor —
    // mirror the behaviour of the primary grep pass.
    const grep_name =
      entry.kind === "constructor"
        ? class_name_by_constructor_position.get(
            `${entry.file_path}:${entry.start_line}`,
          ) ?? entry.name
        : entry.name;

    const hits = (grep_index.get(grep_name) ?? []).slice(0, MAX_GREP_HITS);
    entry.diagnostics.grep_call_sites_outside_index = hits.map((h) => ({
      file_path: h.file_path as FilePath,
      line: h.line,
      content: h.content,
      captures: [],
    }));

    // The diagnosis is settled here, at the end of the chain, because this is
    // the pass that completes the evidence. Deciding it during extraction
    // would decide it before the out-of-index channel exists.
    entry.diagnostics.diagnosis = compute_diagnosis(entry.diagnostics);
  }
}

interface OutOfIndexHit {
  readonly file_path: string;
  readonly line: number;
  readonly content: string;
}

/**
 * A line this long is minified or generated, not written. Such a file is one
 * enormous line, so every identifier in it matches and each match is reported
 * as a caller of whatever it happens to name — django's bundled
 * `jquery.min.js` alone attributed thousands of them. The hits are also
 * useless as evidence: a `GrepHit`'s content is its line, and that line is the
 * whole file.
 */
const MINIFIED_LINE_LENGTH = 2_000;

function is_minified(lines: readonly string[]): boolean {
  return lines.some((line) => line.length > MINIFIED_LINE_LENGTH);
}

/**
 * Per-identifier inverted index over the out-of-index files, qualified by the
 * same comment and string rules the indexed channel uses — otherwise a bare
 * `# cover pool_shrink() one day` in a held-out file reads as the entry's only
 * caller and routes it to `coverage_config`.
 */
function build_out_of_index_grep_index(
  files: ReadonlyMap<string, string>,
): Map<string, OutOfIndexHit[]> {
  const grep_index = new Map<string, OutOfIndexHit[]>();
  const pattern = /(?<![A-Za-z0-9_$])([A-Za-z_$][\w$]*)\s*\(/g;

  const minified: string[] = [];
  for (const [file_path, content] of files) {
    const language = detect_language(file_path);
    if (language === null) continue;
    const lines = content.split("\n");
    if (is_minified(lines)) {
      minified.push(file_path);
      continue;
    }
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
  if (minified.length > 0) {
    // Loud, not silent: these files are outside the index and now outside the
    // compensation too, so a caller inside one is invisible to both.
    log_warn(
      `out-of-index grep skipped ${minified.length} minified file(s): ${minified
        .slice(0, 5)
        .join(", ")}`,
    );
  }
  return grep_index;
}

/**
 * Discovered minus indexed.
 *
 * The walk is rooted at the project and carries only gitignore patterns, so a
 * `--folders`-scoped-out directory is still discovered; `IGNORED_DIRECTORIES`
 * bounds it internally so `node_modules` and `dist` never enter the grep. A
 * config `exclude` is deliberately NOT threaded in: those files are exactly
 * the residue this pass exists to find. Files the loader dropped are added
 * back, because rolling their partial state out removed them from the indexed
 * map without putting them back on the walker's list.
 */
export async function collect_files_outside_index(
  project_path: string,
  indexed_source_files: ReadonlyMap<string, string>,
  dropped_files: ReadonlySet<string>,
  gitignore_patterns: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let candidates: string[];
  try {
    candidates = await find_source_files(project_path, project_path, [
      ...gitignore_patterns,
    ]);
  } catch {
    return out;
  }

  const residue = new Set(candidates.filter((f) => !indexed_source_files.has(f)));
  for (const dropped of dropped_files) {
    residue.add(dropped);
  }

  for (const full of residue) {
    if (detect_language(full) === null) continue;
    try {
      out.set(full, await fs.readFile(full, "utf-8"));
    } catch {
      // A file that cannot be read holds no evidence either way.
    }
  }
  return out;
}

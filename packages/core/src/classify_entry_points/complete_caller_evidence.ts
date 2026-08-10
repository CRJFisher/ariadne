/**
 * Completes each entry's caller evidence and settles its diagnosis — the only
 * diagnostic that touches the filesystem outside the indexed source set. It
 * lives apart from `extract_entry_point_diagnostics` so that pass stays
 * synchronous and free of FS I/O; callers chain this one after extraction to
 * populate `grep_call_sites_outside_index` and decide the final diagnosis.
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
import { for_each_call_occurrence } from "./qualify_grep_hits";
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

export interface OutsideIndexGrepInput {
  readonly entry_points: EnrichedEntryPoint[];
  readonly project_path: string;
  /** The indexed corpus — `Project.get_file_contents()`. */
  readonly indexed_source_files: ReadonlyMap<FilePath, string>;
  /** Files read but dropped by an indexing error, from `load_project`. */
  readonly dropped_files: ReadonlySet<FilePath>;
  readonly class_name_by_constructor_position: ReadonlyMap<string, string>;
  /** Gitignore patterns only — a config `exclude` must NOT narrow this walk. */
  readonly gitignore_patterns: readonly string[];
}

export async function complete_caller_evidence(
  input: OutsideIndexGrepInput,
): Promise<void> {
  const {
    entry_points,
    project_path,
    indexed_source_files,
    dropped_files,
    class_name_by_constructor_position,
    gitignore_patterns,
  } = input;

  const outside_index = await collect_paths_outside_index(
    project_path,
    indexed_source_files,
    dropped_files,
    gitignore_patterns,
  );

  const grep_index = await build_outside_index_grep_index(outside_index);

  for (const entry of entry_points) {
    // Constructors are grepped by class name, not __init__/constructor —
    // mirror the behaviour of the primary grep pass.
    const grep_name =
      entry.kind === "constructor"
        ? class_name_by_constructor_position.get(
            `${entry.file_path}:${entry.start_line}`,
          ) ?? entry.name
        : entry.name;

    const hits = grep_index.get(grep_name) ?? [];
    entry.diagnostics.grep_call_sites_outside_index = hits.map((h) => ({
      file_path: h.file_path,
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

interface OutsideIndexHit {
  readonly file_path: FilePath;
  readonly line: number;
  readonly content: string;
}

/**
 * Per-identifier inverted index over the files outside the index, qualified by
 * the same rules the indexed channel uses — otherwise a bare
 * `# cover pool_shrink() one day` in a held-out file reads as the entry's only
 * caller and routes it to `coverage_config`.
 *
 * These files carry no definition records, so the empty declaration-key set is
 * the honest input: only the textual declaration-header rule protects this
 * channel, and a held-out stub redeclaring a name is caught by that rather than
 * by the exact rule the indexed corpus enjoys.
 */
async function build_outside_index_grep_index(
  paths: readonly FilePath[],
): Promise<Map<string, OutsideIndexHit[]>> {
  const grep_index = new Map<string, OutsideIndexHit[]>();
  const no_declaration_records: ReadonlySet<string> = new Set();

  let skipped_lines = 0;
  for (const file_path of paths) {
    const language = detect_language(file_path);
    if (language === null) continue;
    let content: string;
    try {
      content = await fs.readFile(file_path, "utf-8");
    } catch {
      // A file that cannot be read holds no evidence either way.
      continue;
    }
    skipped_lines += for_each_call_occurrence(
      file_path,
      content.split("\n"),
      language,
      no_declaration_records,
      ({ name, line, content: hit_content }) => {
        let hits = grep_index.get(name);
        if (!hits) {
          hits = [];
          grep_index.set(name, hits);
        }
        // Capped as hits arrive, not when they are read: a ubiquitous name in a
        // large residue would otherwise hold tens of thousands of records to
        // serve the ten an investigator reads.
        if (hits.length < MAX_GREP_HITS) {
          hits.push({ file_path, line, content: hit_content });
        }
      },
    );
  }
  if (skipped_lines > 0) {
    // Loud, not silent: a caller on one of these lines is outside the index and
    // now outside the compensation too, so it is invisible to both.
    log_warn(
      `grep outside the index skipped ${skipped_lines} generated line(s)`,
    );
  }
  return grep_index;
}

/**
 * Discovered minus indexed.
 *
 * The walk is rooted at the project and carries only gitignore patterns, so a
 * `--folders`-scoped-out directory is still discovered; `IGNORED_DIRECTORIES`
 * bounds it internally, which keeps `node_modules`, `dist`, `build`, `tmp`,
 * `temp` and `fixtures` out of the grep — a caller under one of those is
 * invisible to both the index and this compensation. A config `exclude` is
 * deliberately NOT threaded in: those files are exactly the residue this pass
 * exists to find.
 *
 * Files the loader dropped are unioned back. The walk usually rediscovers them
 * on its own, since it filters more loosely than discovery did; the union is
 * load-bearing only when `load_project` was given explicit `files` (that branch
 * skips `should_ignore_path`) or an out-of-tree `folders` entry.
 */
export async function collect_paths_outside_index(
  project_path: string,
  indexed_source_files: ReadonlyMap<FilePath, string>,
  dropped_files: ReadonlySet<FilePath>,
  gitignore_patterns: readonly string[],
): Promise<FilePath[]> {
  let candidates: FilePath[];
  try {
    candidates = await find_source_files(project_path, project_path, [
      ...gitignore_patterns,
    ]);
  } catch (error) {
    // A walk that cannot run yields no compensation at all, and every entry
    // then reads as having no callers anywhere. Say so rather than looking
    // healthy.
    log_warn(
      `walk outside the index of ${project_path} failed, so no compensation was computed: ${
        error instanceof Error ? error.message : error
      }`,
    );
    return [];
  }

  const residue = new Set(candidates.filter((f) => !indexed_source_files.has(f)));
  for (const dropped of dropped_files) {
    residue.add(dropped);
  }

  // Paths only. The contents are read one file at a time while indexing and
  // discarded, so the residue of a large repository never sits in memory whole
  // — it is exactly the corpus the loader refused, and the cap that protects
  // the loader does not apply here.
  return [...residue];
}

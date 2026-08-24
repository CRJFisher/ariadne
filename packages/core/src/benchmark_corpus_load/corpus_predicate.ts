/**
 * Which files a row is about.
 *
 * A corpus-derived constant without its input is not a measurement, and this
 * is not pedantry: microsoft/vscode has at least four defensible file counts
 * at one commit, and two of them answer the ten-minute question in opposite
 * directions. The tree under `src/` costs 510.3 s of CPU; the repository root,
 * which is what `load_project({project_path})` discovers when no folder filter
 * is given, holds half again as many files and costs 1,653.9 s. Rows for the
 * two are never compared.
 *
 * So every row names a predicate, and discovery here is the same walk
 * `load_project` performs — `parse_gitignore` then `find_source_files` — so a
 * recorded file count is the count the load actually ingested rather than one
 * produced by a second, differently-behaved walk.
 *
 * A predicate names an extension set as well as a folder. Ariadne's walk over
 * `src/vs/base` discovers 483 files, four of them `.js`, and two of those —
 * `browser/dompurify/dompurify.js` and `common/marked/marked.js` — sort inside
 * the first 200 and displace two `.ts` files. Measured, the two 200-file sets
 * index and drop identically (191 and 9) and diverge on everything else:
 * 5,070 nodes and 1,728 raw entry points against 4,917 and 1,673. A folder
 * alone therefore does not identify a file set, and the extension set is part
 * of the predicate rather than a flag beside it.
 */

import * as path from "path";
import type { FilePath } from "@ariadnejs/types";
import { find_source_files, parse_gitignore } from "../project/file_loading";

/**
 * The two pinned predicates, plus two folder forms. `folder:` walks a subtree
 * exactly as `load_project` would; `folder-ts:` restricts that walk to `.ts`
 * — not `.tsx` — which is the predicate AC #3's smoke run is stated in.
 */
export type CorpusPredicateName =
  | "src"
  | "repository-root"
  | `folder:${string}`
  | `folder-ts:${string}`;

/** The two predicates whose file counts are pinned by measurement. */
export type PinnedCorpusPredicateName = "src" | "repository-root";

export interface CorpusPredicate {
  readonly name: CorpusPredicateName;
  /**
   * Folders under the corpus root to walk. Empty means the root itself, which
   * is what `load_project` does with no `folders` filter.
   */
  readonly folders: readonly string[];
  /**
   * Extensions the predicate admits, lowercase and dot-led. Empty admits
   * everything `find_source_files` returns.
   */
  readonly extensions: readonly string[];
  readonly description: string;
}

export const CORPUS_PREDICATES: Readonly<
  Record<PinnedCorpusPredicateName, CorpusPredicate>
> = {
  src: {
    name: "src",
    folders: ["src"],
    extensions: [],
    description:
      "Ariadne's discovery walk over the corpus's `src/` folder, gitignore applied.",
  },
  "repository-root": {
    name: "repository-root",
    folders: [],
    extensions: [],
    description:
      "Ariadne's discovery walk over the whole repository, gitignore applied — what `load_project({project_path})` selects with no folder filter.",
  },
};

/**
 * A file count that has been measured, pinned to everything that produced it.
 *
 * The four counts for microsoft/vscode at f3fa55c3 are recorded together
 * because quoting any one of them alone has already caused an argument: two of
 * them are `find` results over `.ts` files and two are Ariadne's own walk, and
 * they differ by up to 49%.
 */
export interface PinnedCorpusCount {
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly predicate: string;
  readonly file_count: number;
  readonly note: string;
}

export const PINNED_CORPUS_COUNTS: readonly PinnedCorpusCount[] = [
  {
    corpus: "microsoft/vscode",
    corpus_commit: "f3fa55c3",
    predicate: "src",
    file_count: 8494,
    note: "Ariadne's discovery walk over `src/`. Every phase-2 and phase-3 number in TASK-381 refers to this corpus. 510.3 s of CPU.",
  },
  {
    corpus: "microsoft/vscode",
    corpus_commit: "f3fa55c3",
    predicate: "repository-root",
    file_count: 12654,
    note: "`find_source_files` at the repository root — what `load_project({project_path})` discovers with no folder filter. 1,653.9 s of CPU.",
  },
  {
    corpus: "microsoft/vscode",
    corpus_commit: "f3fa55c3",
    predicate: "shell: `.ts` under `src/` excluding `.d.ts`",
    file_count: 8451,
    note: "Not a predicate the harness runs; recorded so a count quoted from a shell one-liner can be told apart from Ariadne's walk.",
  },
  {
    corpus: "microsoft/vscode",
    corpus_commit: "f3fa55c3",
    predicate: "shell: `.ts` under `src/` including `.d.ts`",
    file_count: 8648,
    note: "Not a predicate the harness runs; recorded for the same reason.",
  },
];

const FOLDER_PREFIX = "folder:";
const FOLDER_TS_PREFIX = "folder-ts:";

/**
 * The predicate a name selects. The folder forms build one on the spot so a
 * narrower walk is still a named, recordable predicate rather than an
 * unlabelled ad-hoc file list.
 */
export function resolve_corpus_predicate(
  name: CorpusPredicateName,
): CorpusPredicate {
  if (name === "src" || name === "repository-root") {
    return CORPUS_PREDICATES[name];
  }
  if (name.startsWith(FOLDER_TS_PREFIX)) {
    const folder = name.slice(FOLDER_TS_PREFIX.length);
    assert_folder_is_named(folder, name);
    return {
      name,
      folders: [folder],
      extensions: [".ts"],
      description: `Ariadne's discovery walk over \`${folder}\`, restricted to \`.ts\`, gitignore applied.`,
    };
  }
  if (name.startsWith(FOLDER_PREFIX)) {
    const folder = name.slice(FOLDER_PREFIX.length);
    assert_folder_is_named(folder, name);
    return {
      name,
      folders: [folder],
      extensions: [],
      description: `Ariadne's discovery walk over \`${folder}\`, gitignore applied.`,
    };
  }
  throw new Error(
    `Unknown corpus predicate "${name}" — use "src", "repository-root", "folder:<relative path>", or "folder-ts:<relative path>"`,
  );
}

function assert_folder_is_named(folder: string, name: string): void {
  if (folder === "") {
    throw new Error(
      `A folder predicate needs a path: "folder:src/vs/base", not "${name}"`,
    );
  }
}

/**
 * Reject a predicate name read off argv or off disk.
 *
 * The template-literal union documents the shape; it does nothing at runtime,
 * and an unchecked cast turns a typo into a string that silently never equals
 * anything in `check_rows_comparable`.
 */
export function parse_corpus_predicate_name(
  value: unknown,
): CorpusPredicateName {
  if (typeof value !== "string") {
    throw new Error(`Corpus predicate must be a string, got ${typeof value}`);
  }
  const name = value as CorpusPredicateName;
  resolve_corpus_predicate(name);
  return name;
}

/** Everything a row needs to name the file set it measured. */
export interface CorpusIdentity {
  /** Stable name, e.g. "microsoft/vscode". Joins a row to `PINNED_CORPUS_COUNTS`. */
  readonly corpus_name: string;
  /** Absolute, resolved path to the corpus root. A reproduction aid, not identity. */
  readonly corpus_root: string;
  /** The corpus's own commit, supplied by the caller — never inferred. */
  readonly corpus_commit: string;
  readonly predicate: CorpusPredicateName;
}

/**
 * What the arm's file set turned out to be. Separate from `CorpusIdentity`
 * because identity decides comparability and these are results.
 */
export interface FileCounts {
  /** What the predicate's walk found, before any slice. */
  readonly discovered: number;
  /** What this arm handed to the loader. */
  readonly offered: number;
  /** What the loader indexed. */
  readonly indexed: number;
  /** What the loader read but could not index. */
  readonly dropped: number;
}

/**
 * Every file the predicate selects, sorted by path.
 *
 * Sorting is what makes a slice reproducible: `find_source_files` returns
 * directory-walk order, which depends on the filesystem, so a "first 200
 * files" slice taken from it would name a different 200 files on another
 * machine.
 */
export async function discover_corpus(
  corpus_root: string,
  predicate: CorpusPredicateName,
): Promise<FilePath[]> {
  const root = path.resolve(corpus_root);
  const gitignore_patterns = await parse_gitignore(root);
  const resolved = resolve_corpus_predicate(predicate);
  const discovered = new Set<FilePath>();

  const walk_roots =
    resolved.folders.length === 0
      ? [root]
      : resolved.folders.map((folder) => path.resolve(root, folder));

  for (const walk_root of walk_roots) {
    for (const file of await find_source_files(
      walk_root,
      root,
      gitignore_patterns,
    )) {
      if (admits(resolved, file)) {
        discovered.add(file);
      }
    }
  }

  return [...discovered].sort(compare_paths);
}

function admits(predicate: CorpusPredicate, file: FilePath): boolean {
  if (predicate.extensions.length === 0) return true;
  const lowered = file.toLowerCase();
  return predicate.extensions.some((extension) => lowered.endsWith(extension));
}

/**
 * Order by UTF-16 code unit, stated explicitly rather than left to the default
 * comparator, so nobody later "fixes" it into a locale-aware compare and moves
 * every committed slice and fingerprint at once.
 */
export function compare_paths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

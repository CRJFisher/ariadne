#!/usr/bin/env npx tsx
/**
 * Stop hook: blocks when repo docs cite source paths that no longer exist.
 *
 * Catches the rot class the compiler cannot see: `.claude/rules/*.md` layout
 * tables citing `.ts` files that were moved or deleted, and
 * `ARIADNE_FAULT_AREA_FOLDER` values (valid `Record` keys) whose path values
 * point at deleted core modules.
 *
 * Only backtick spans and untagged fenced (tree) blocks are scanned, and only
 * tokens with a `packages/` or `.claude/` prefix — prose mentions and
 * language-tagged code examples are out of scope. A line carrying
 * `<!-- doc-path-truth:ignore -->` is exempt, for deliberately cited
 * counter-example paths.
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { ARIADNE_FAULT_AREA_FOLDER } from "@ariadnejs/types";
import {
  create_logger,
  parse_stdin,
  get_project_dir,
  get_changed_files,
  type ChangedFiles,
} from "./utils.js";

const log = create_logger("doc-path-truth");

export const IGNORE_MARKER = "<!-- doc-path-truth:ignore -->";

const RULES_DIR = ".claude/rules";
const FAULT_AREA_SOURCE = "packages/types/src/ariadne_fault_area.ts";

// The char class excludes < > { } * and whitespace, so placeholder tokens
// (`check_<group_id>.ts`), brace templates, and globs never become candidates.
const CANDIDATE_PATH_RE = /^(?:packages|\.claude)\/[A-Za-z0-9_./-]+\.ts$/;

const SRC_TS_RE = /^packages\/[^/]+\/src\/.+\.ts$/;

// Rules also cite .claude-prefixed .ts files (hooks, skill sources), so
// moving one must trigger the scan in the same session that broke it.
const CLAUDE_TS_RE = /^\.claude\/.+\.ts$/;

export interface PathCitation {
  source: string;
  cited_path: string;
}

/**
 * A rule or the fault-area map can only go stale when a rule file or a
 * cited-prefix source file changed (a `.ts` move/split is what stales a
 * layout). Fails closed when git enumeration failed — the fallback uniquely
 * reports source changes with an empty `all_files` list.
 */
export function should_run(changed: ChangedFiles): boolean {
  const git_enumeration_failed =
    changed.has_source_changes && changed.all_files.length === 0;
  return (
    git_enumeration_failed ||
    changed.all_files.some(
      (f) =>
        f.startsWith(`${RULES_DIR}/`) || SRC_TS_RE.test(f) || CLAUDE_TS_RE.test(f),
    )
  );
}

export function extract_cited_paths(markdown: string): string[] {
  const cited = new Set<string>();
  let in_fence = false;
  let fence_is_scannable = false;

  for (const line of markdown.split("\n")) {
    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      if (!in_fence) {
        in_fence = true;
        // Untagged and `text` fences hold layout trees; language-tagged
        // fences hold code examples whose paths are illustrative.
        const info = fence[1].trim();
        fence_is_scannable = info === "" || info === "text";
      } else {
        in_fence = false;
      }
      continue;
    }

    if (line.includes(IGNORE_MARKER)) continue;

    if (in_fence) {
      if (!fence_is_scannable) continue;
      for (const token of line.split(/[\s│├└─]+/)) {
        if (CANDIDATE_PATH_RE.test(token)) cited.add(token);
      }
    } else {
      for (const span of line.matchAll(/`([^`]+)`/g)) {
        const token = span[1].trim();
        if (CANDIDATE_PATH_RE.test(token)) cited.add(token);
      }
    }
  }

  return [...cited];
}

export function collect_rule_citations(
  rules: { rule_path: string; markdown: string }[],
): PathCitation[] {
  return rules.flatMap(({ rule_path, markdown }) =>
    extract_cited_paths(markdown).map((cited_path) => ({
      source: rule_path,
      cited_path,
    })),
  );
}

export function collect_fault_area_citations(
  folder_map: Record<string, string>,
): PathCitation[] {
  return Object.entries(folder_map)
    .filter(([, folder]) => folder !== "")
    .map(([area, folder]) => ({
      source: `${FAULT_AREA_SOURCE} (ARIADNE_FAULT_AREA_FOLDER.${area})`,
      cited_path: folder,
    }));
}

export function find_missing_citations(
  citations: PathCitation[],
  path_exists: (repo_relative: string) => boolean,
): PathCitation[] {
  return citations.filter((c) => !path_exists(c.cited_path));
}

export function build_block_reason(missing: PathCitation[]): string {
  const lines = missing.map(
    (m) =>
      `${m.source} references ${m.cited_path} which does not exist — update the layout/map or restore the file`,
  );
  lines.push(
    `A line deliberately citing a counter-example path can be exempted with ${IGNORE_MARKER}`,
  );
  return lines.join("\n");
}

function main(): void {
  log("Hook started");
  parse_stdin();

  const project_dir = get_project_dir();
  const changed = get_changed_files(project_dir);
  if (!should_run(changed)) {
    log("No rule or package-source changes, skipping");
    return;
  }

  const rules_dir = path.join(project_dir, RULES_DIR);
  const rules = fs
    .readdirSync(rules_dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({
      rule_path: `${RULES_DIR}/${f}`,
      markdown: fs.readFileSync(path.join(rules_dir, f), "utf8"),
    }));

  const citations = [
    ...collect_rule_citations(rules),
    ...collect_fault_area_citations(ARIADNE_FAULT_AREA_FOLDER),
  ];
  const missing = find_missing_citations(citations, (repo_relative) =>
    fs.existsSync(path.join(project_dir, repo_relative)),
  );

  if (missing.length > 0) {
    log(`Found ${missing.length} missing cited path(s)`);
    console.log(
      JSON.stringify({ decision: "block", reason: build_block_reason(missing) }),
    );
    return;
  }

  log(`All ${citations.length} cited paths exist`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    log(`Fatal error: ${error}`);
    console.log(
      JSON.stringify({
        decision: "block",
        reason: `doc-path-truth failed: ${error}`,
      }),
    );
  }
  process.exit(0);
}

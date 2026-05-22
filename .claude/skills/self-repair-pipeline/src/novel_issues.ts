/**
 * Per-run `novel_issues.json` storage contract.
 *
 * The triage dispatcher is the single writer: each absorbed
 * `fp-novel-new` / `fp-novel-cited` verdict produces a new file value (via
 * `register_issue` or `add_citation`) which the dispatcher persists with
 * `write_novel_issues`. Sub-agents never write this file directly.
 *
 * Mutators are pure (`add_citation`, `register_issue`) and return new
 * `NovelIssuesFile` values; I/O lives only in `read_novel_issues` and
 * `write_novel_issues`.
 */

import * as fs from "node:fs/promises";

import { atomic_write_file } from "./atomic_write.js";
import {
  assert_keys,
  describe,
  expect_object,
  parse_non_empty_string,
} from "./strict_parse.js";

export interface NovelIssueCitation {
  entry_index: number;
  evidence_excerpt: string;
}

export interface NovelIssue {
  id: string;
  canonical_name: string;
  root_cause: string;
  citations: NovelIssueCitation[];
}

export interface NovelIssuesFile {
  issues: NovelIssue[];
}

/**
 * Read and validate the per-run novel-issues file. Returns
 * `{ issues: [] }` if the file does not exist (first-write case).
 *
 * Throws on malformed JSON or shape violations — silent coercion would hide
 * dispatcher bugs that corrupt the file. Duplicate `id`s are rejected because
 * `add_citation` resolves by `findIndex` and would silently ignore the second.
 */
export async function read_novel_issues(path: string): Promise<NovelIssuesFile> {
  let raw: string;
  try {
    raw = await fs.readFile(path, "utf8");
  } catch (err) {
    if (is_enoent(err)) return { issues: [] };
    throw err;
  }
  const parsed: unknown = JSON.parse(raw);
  return parse_novel_issues_file(parsed);
}

/**
 * Atomically write the per-run novel-issues file. Uses temp+rename via
 * `atomic_write_file` so concurrent readers see either the prior or new file,
 * never a partial write.
 */
export async function write_novel_issues(
  path: string,
  data: NovelIssuesFile,
): Promise<void> {
  await atomic_write_file(path, `${JSON.stringify(data, null, 2)}\n`);
}

/**
 * Idempotently append a citation to an existing issue. Citations are deduped
 * by `entry_index` — re-applying the same verdict (e.g. a retry) yields the
 * same file value, so the dispatcher can safely replay absorbs.
 *
 * Throws if the target id is not registered. Pure: returns a new file value.
 */
export function add_citation(
  file: NovelIssuesFile,
  novel_issue_id: string,
  citation: NovelIssueCitation,
): NovelIssuesFile {
  const idx = file.issues.findIndex((i) => i.id === novel_issue_id);
  if (idx === -1) {
    throw new Error(
      `add_citation: novel_issue_id '${novel_issue_id}' is not registered`,
    );
  }
  const issue = file.issues[idx];
  const already = issue.citations.some(
    (c) => c.entry_index === citation.entry_index,
  );
  if (already) return file;
  const next_issue: NovelIssue = {
    ...issue,
    citations: [...issue.citations, citation],
  };
  const next_issues = [...file.issues];
  next_issues[idx] = next_issue;
  return { issues: next_issues };
}

export interface RegisterIssueInput {
  canonical_name: string;
  root_cause: string;
  initial_citation: NovelIssueCitation;
}

/**
 * Register a new novel issue. The id is derived from `canonical_name` by
 * slug-cleaning to `[a-z0-9-]+`; if the slug collides with an existing id, a
 * numeric suffix (`-2`, `-3`, ...) is appended. Deterministic given the input
 * file value.
 *
 * Pure: returns the new file value plus the freshly registered issue (so the
 * caller can echo the assigned id back to the investigator).
 */
export function register_issue(
  file: NovelIssuesFile,
  input: RegisterIssueInput,
): { file: NovelIssuesFile; issue: NovelIssue } {
  if (input.canonical_name.length === 0) {
    throw new Error("register_issue: canonical_name must be non-empty");
  }
  if (input.root_cause.length === 0) {
    throw new Error("register_issue: root_cause must be non-empty");
  }
  const slug = slugify(input.canonical_name);
  if (slug.length === 0) {
    throw new Error(
      `register_issue: canonical_name '${input.canonical_name}' contains no slug-safe characters`,
    );
  }
  const existing_ids = new Set(file.issues.map((i) => i.id));
  const id = assign_unique_id(slug, existing_ids);
  const issue: NovelIssue = {
    id,
    canonical_name: input.canonical_name,
    root_cause: input.root_cause,
    citations: [input.initial_citation],
  };
  return {
    file: { issues: [...file.issues, issue] },
    issue,
  };
}

// ===== Internal: parsing =====

function parse_novel_issues_file(raw: unknown): NovelIssuesFile {
  const obj = expect_object(raw, "novel_issues");
  assert_keys(obj, ["issues"], "novel_issues");
  const issues_raw = obj["issues"];
  if (!Array.isArray(issues_raw)) {
    throw new Error(`novel_issues.issues: expected array, got ${describe(issues_raw)}`);
  }
  const issues = issues_raw.map((entry, idx) =>
    parse_novel_issue(entry, `novel_issues.issues[${idx}]`),
  );
  const seen = new Set<string>();
  for (const issue of issues) {
    if (seen.has(issue.id)) {
      throw new Error(`novel_issues: duplicate id '${issue.id}'`);
    }
    seen.add(issue.id);
  }
  return { issues };
}

function parse_novel_issue(raw: unknown, ctx: string): NovelIssue {
  const obj = expect_object(raw, ctx);
  assert_keys(obj, ["id", "canonical_name", "root_cause", "citations"], ctx);
  const id = parse_non_empty_string(obj["id"], `${ctx}.id`);
  const canonical_name = parse_non_empty_string(
    obj["canonical_name"],
    `${ctx}.canonical_name`,
  );
  const root_cause = parse_non_empty_string(obj["root_cause"], `${ctx}.root_cause`);
  const citations_raw = obj["citations"];
  if (!Array.isArray(citations_raw)) {
    throw new Error(`${ctx}.citations: expected array, got ${describe(citations_raw)}`);
  }
  const citations = citations_raw.map((entry, idx) =>
    parse_citation(entry, `${ctx}.citations[${idx}]`),
  );
  return { id, canonical_name, root_cause, citations };
}

function parse_citation(raw: unknown, ctx: string): NovelIssueCitation {
  const obj = expect_object(raw, ctx);
  assert_keys(obj, ["entry_index", "evidence_excerpt"], ctx);
  const entry_index = obj["entry_index"];
  if (typeof entry_index !== "number" || !Number.isInteger(entry_index) || entry_index < 0) {
    throw new Error(
      `${ctx}.entry_index: must be a non-negative integer, got ${describe(entry_index)}`,
    );
  }
  const evidence_excerpt = parse_non_empty_string(
    obj["evidence_excerpt"],
    `${ctx}.evidence_excerpt`,
  );
  return { entry_index, evidence_excerpt };
}

function is_enoent(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if (!("code" in err)) return false;
  return (err as { code: unknown }).code === "ENOENT";
}

// ===== Internal: id assignment =====

/** Slugify `canonical_name` to `[a-z0-9-]+`. May return an empty string when
 * the name contains no slug-safe characters; callers must reject that case. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assign_unique_id(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

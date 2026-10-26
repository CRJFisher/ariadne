/**
 * The investigator's three tools — `read`, `grep`, `submit_verdict` — served
 * from one in-process SDK MCP server named `triage`.
 *
 * The server name, tool names, descriptions and schemas are part of the shared
 * prompt-cache prefix, so they are constants: nothing about the entry or the
 * run appears in them. The per-investigation state (the repository root, the
 * in-scope rule ids, the verdict sink) lives in the handlers' closure.
 *
 * `read` and `grep` resolve every path against the repository root and refuse
 * anything outside it, so an investigation sees the target's source and
 * nothing else on the machine.
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { parse_triage_verdict, type TriageVerdict } from "../verdict/triage_verdict.js";

export const INVESTIGATION_SERVER_NAME = "triage";
export const INVESTIGATION_TOOL_NAMES: readonly string[] = ["read", "grep", "submit_verdict"].map(
  (name) => `mcp__${INVESTIGATION_SERVER_NAME}__${name}`,
);

export const READ_LINE_CAP = 200;
export const GREP_MATCH_CAP = 100;
const LINE_CHAR_CAP = 400;
const GREP_TIMEOUT_MS = 30_000;
const WALK_SKIPPED_DIRS: ReadonlySet<string> = new Set([".git", "node_modules"]);

export type ToolOutcome = { ok: true; text: string } | { ok: false; text: string };

function clip(line: string): string {
  return line.length > LINE_CHAR_CAP ? `${line.slice(0, LINE_CHAR_CAP)}…` : line;
}

/** The repository-relative path `requested` names, or null when it leaves the root. */
export function resolve_in_root(root: string, requested: string): string | null {
  const absolute = path.resolve(root, requested);
  const relative = path.relative(root, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  if (!fs.existsSync(absolute)) return relative;
  const real_relative = path.relative(fs.realpathSync(root), fs.realpathSync(absolute));
  return real_relative.startsWith("..") || path.isAbsolute(real_relative) ? null : relative;
}

export interface ReadArgs {
  path: string;
  offset?: number;
  limit?: number;
}

export function read_window(root: string, args: ReadArgs): ToolOutcome {
  const relative = resolve_in_root(root, args.path);
  if (relative === null) return { ok: false, text: `${args.path} is outside the repository.` };
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return { ok: false, text: `${relative} does not exist.` };
  if (fs.statSync(absolute).isDirectory()) return { ok: false, text: `${relative} is a directory; grep with path "${relative}" to search it.` };
  const lines = fs.readFileSync(absolute, "utf8").split("\n");
  const first = Math.max(1, args.offset ?? 1);
  const count = Math.min(READ_LINE_CAP, Math.max(1, args.limit ?? READ_LINE_CAP));
  const window = lines.slice(first - 1, first - 1 + count);
  if (window.length === 0) return { ok: false, text: `${relative} has ${lines.length} lines; offset ${first} is past the end.` };
  const last = first + window.length - 1;
  const numbered = window.map((line, i) => `${first + i}\t${clip(line)}`);
  const footer = last < lines.length ? [`(lines ${first}-${last} of ${lines.length}; pass offset ${last + 1} to continue)`] : [];
  return { ok: true, text: [...numbered, ...footer].join("\n") };
}

export interface GrepArgs {
  pattern: string;
  path?: string;
  glob?: string;
  ignore_case?: boolean;
}

function is_git_work_tree(root: string): boolean {
  return spawnSync("git", ["-C", root, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8" }).stdout.trim() === "true";
}

function git_pathspec(scope: string | null, glob: string | undefined): string[] {
  if (glob === undefined) return scope === null ? [] : [scope];
  const pattern = glob.includes("/") ? glob : `**/${glob}`;
  return [`:(glob)${scope === null ? "" : `${scope}/`}${pattern}`];
}

/** Keeps the first `GREP_MATCH_CAP` matches and counts the rest. */
class MatchCollector {
  private readonly shown: string[] = [];
  private hidden = 0;

  add(line: string): void {
    if (this.shown.length < GREP_MATCH_CAP) this.shown.push(clip(line));
    else this.hidden += 1;
  }

  summary(): string {
    if (this.shown.length === 0) return "(no matches)";
    return this.hidden > 0
      ? [...this.shown, `… ${this.hidden} more matches; narrow with path or glob`].join("\n")
      : this.shown.join("\n");
  }
}

function git_grep(root: string, args: GrepArgs, scope: string | null): Promise<ToolOutcome> {
  const argv = ["-C", root, "grep", "--untracked", "-n", "-I", "-P", ...(args.ignore_case === true ? ["-i"] : []), "-e", args.pattern, "--", ...git_pathspec(scope, args.glob)];
  return new Promise((resolve) => {
    const child = spawn("git", argv, { stdio: ["ignore", "pipe", "pipe"], timeout: GREP_TIMEOUT_MS });
    const matches = new MatchCollector();
    let pending = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      const parts = (pending + chunk).split("\n");
      pending = parts.pop() ?? "";
      for (const part of parts) matches.add(as_grep_line(part));
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    child.on("close", (code) => {
      if (pending.length > 0) matches.add(as_grep_line(pending));
      if (code === 0 || code === 1) resolve({ ok: true, text: matches.summary() });
      else resolve({ ok: false, text: `grep failed: ${stderr.trim() || `exit ${code}`}` });
    });
  });
}

/** git prints `path:line:text`; the tool's contract is `path:line: text`. */
function as_grep_line(raw: string): string {
  const match = /^([^:]+):(\d+):(.*)$/.exec(raw);
  return match === null ? raw : `${match[1]}:${match[2]}: ${match[3]}`;
}

function glob_regex(glob: string): RegExp {
  const source = glob
    .split("**/")
    .map((part) => part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]"))
    .join("(?:.*/)?");
  return new RegExp(glob.includes("/") ? `^${source}$` : `(?:^|/)${source}$`);
}

/** A repository that is not a git work tree is searched by walking it. */
function walk_grep(root: string, args: GrepArgs, scope: string | null): ToolOutcome {
  let regex: RegExp;
  try {
    regex = new RegExp(args.pattern, args.ignore_case === true ? "i" : "");
  } catch (err) {
    return { ok: false, text: `grep failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  const glob = args.glob === undefined ? null : glob_regex(args.glob);
  const matches = new MatchCollector();
  const visit = (relative: string): void => {
    const absolute = path.join(root, relative);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) {
        if (!WALK_SKIPPED_DIRS.has(name)) visit(path.join(relative, name));
      }
      return;
    }
    if (glob !== null && !glob.test(relative)) return;
    const content = fs.readFileSync(absolute);
    if (content.includes(0)) return;
    content.toString("utf8").split("\n").forEach((line, i) => {
      if (regex.test(line)) matches.add(`${relative}:${i + 1}: ${line}`);
    });
  };
  visit(scope ?? "");
  return { ok: true, text: matches.summary() };
}

export async function grep_repository(root: string, args: GrepArgs): Promise<ToolOutcome> {
  const scope = args.path === undefined || args.path === "." || args.path === "" ? null : resolve_in_root(root, args.path);
  if (scope === null && args.path !== undefined && args.path !== "." && args.path !== "") {
    return { ok: false, text: `${args.path} is outside the repository.` };
  }
  if (scope !== null && !fs.existsSync(path.join(root, scope))) return { ok: false, text: `${scope} does not exist.` };
  return is_git_work_tree(root) ? git_grep(root, args, scope) : walk_grep(root, args, scope);
}

export interface SubmittedVerdict {
  kind: TriageVerdict["kind"];
  member_evidence: { file: string; line: number; why: string };
  evidence_excerpt?: string;
  proposed_root_cause?: string;
  should_have_matched_rule_id?: string;
  reason?: string;
}

const KIND_FIELDS: Record<TriageVerdict["kind"], readonly (keyof SubmittedVerdict)[]> = {
  tp: [],
  "fp-novel": ["proposed_root_cause", "evidence_excerpt"],
  "fp-classifier-regression": ["should_have_matched_rule_id", "evidence_excerpt"],
  uncertain: ["reason"],
};

/**
 * Validate a submitted verdict into the strict `TriageVerdict` shape. Fields
 * another kind uses are dropped, so a verdict that over-supplies is accepted
 * as its kind; a missing field, a rule outside the entry's scope, or evidence
 * that names no line of the repository is rejected with the reason.
 */
export function accept_verdict(
  root: string,
  submitted: SubmittedVerdict,
  in_scope_rule_ids: readonly string[],
): { verdict: TriageVerdict } | { error: string } {
  const evidence_file = resolve_in_root(root, submitted.member_evidence.file);
  if (evidence_file === null || !fs.existsSync(path.join(root, evidence_file)) || fs.statSync(path.join(root, evidence_file)).isDirectory()) {
    return { error: `member_evidence.file ${submitted.member_evidence.file} is not a file in the repository.` };
  }
  const line_count = fs.readFileSync(path.join(root, evidence_file), "utf8").split("\n").length;
  if (submitted.member_evidence.line > line_count) {
    return { error: `member_evidence.line ${submitted.member_evidence.line} is past the end of ${evidence_file} (${line_count} lines).` };
  }
  if (
    submitted.kind === "fp-classifier-regression" &&
    submitted.should_have_matched_rule_id !== undefined &&
    !in_scope_rule_ids.includes(submitted.should_have_matched_rule_id)
  ) {
    return {
      error: `should_have_matched_rule_id ${submitted.should_have_matched_rule_id} is not an in-scope rule; in scope: ${in_scope_rule_ids.join(", ") || "none"}.`,
    };
  }
  const raw: Record<string, unknown> = {
    kind: submitted.kind,
    member_evidence: { ...submitted.member_evidence, file: evidence_file },
  };
  for (const field of KIND_FIELDS[submitted.kind]) {
    if (submitted[field] !== undefined) raw[field] = submitted[field];
  }
  try {
    return { verdict: parse_triage_verdict(raw) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

const text_result = (outcome: ToolOutcome) => ({
  content: [{ type: "text" as const, text: outcome.text }],
  ...(outcome.ok ? {} : { isError: true }),
});

export interface InvestigationToolsInput {
  root: string;
  in_scope_rule_ids: readonly string[];
  on_verdict: (verdict: TriageVerdict) => void;
}

export function investigation_tools_server(input: InvestigationToolsInput): McpSdkServerConfigWithInstance {
  let recorded = false;
  return createSdkMcpServer({
    name: INVESTIGATION_SERVER_NAME,
    alwaysLoad: true,
    tools: [
      tool(
        "read",
        `Read a window of a repository file, with line numbers. Returns at most ${READ_LINE_CAP} lines.`,
        {
          path: z.string().describe("File path relative to the repository root"),
          offset: z.number().int().min(1).optional().describe("First line to return (default 1)"),
          limit: z.number().int().min(1).max(READ_LINE_CAP).optional().describe(`Lines to return (default ${READ_LINE_CAP})`),
        },
        async (args) => text_result(read_window(input.root, args)),
      ),
      tool(
        "grep",
        `Search repository files with a Perl-compatible regular expression. Returns path:line: text, at most ${GREP_MATCH_CAP} matches.`,
        {
          pattern: z.string().describe("Perl-compatible regular expression"),
          path: z.string().optional().describe("File or directory to search, relative to the repository root (default: everything)"),
          glob: z.string().optional().describe("Only files matching this glob, e.g. *.py or src/**/*.ts"),
          ignore_case: z.boolean().optional(),
        },
        async (args) => text_result(await grep_repository(input.root, args)),
      ),
      tool(
        "submit_verdict",
        "Record the verdict for the entry under investigation. Rejects a malformed verdict with the reason.",
        {
          kind: z.enum(["tp", "fp-novel", "fp-classifier-regression", "uncertain"]),
          member_evidence: z.object({
            file: z.string().describe("Path relative to the repository root"),
            line: z.number().int().min(1),
            why: z.string(),
          }),
          evidence_excerpt: z.string().optional().describe("fp-novel, fp-classifier-regression: the calling line(s)"),
          proposed_root_cause: z.string().optional().describe("fp-novel: why Ariadne missed the caller"),
          should_have_matched_rule_id: z.string().optional().describe("fp-classifier-regression: an in-scope rule's group_id"),
          reason: z.string().optional().describe("uncertain: one sentence"),
        },
        async (args) => {
          if (recorded) return text_result({ ok: false, text: "A verdict is already recorded. Reply done." });
          const accepted = accept_verdict(input.root, args, input.in_scope_rule_ids);
          if ("error" in accepted) return text_result({ ok: false, text: accepted.error });
          recorded = true;
          input.on_verdict(accepted.verdict);
          return text_result({ ok: true, text: "Verdict recorded. Reply done." });
        },
      ),
    ],
  });
}

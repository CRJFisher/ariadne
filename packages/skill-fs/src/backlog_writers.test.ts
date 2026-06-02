/**
 * Structural enforcement of the write-boundary contract documented in
 * `.claude/rules/backlog-firewall.md`. The user's `backlog/` directory is
 * the human-owned planning surface; the self-healing pipeline (`triage`,
 * `plan`) is read-only against it. The sole sanctioned programmatic writer
 * is the human-invoked export adapter. Pipeline code that writes a
 * `backlog/`-shaped path — or that names a *mutating* `mcp__backlog__*` tool
 * an agent could be told to call — silently re-opens that boundary; this
 * test fails the build before such a regression lands.
 *
 * Detection is syntactic and per-file. We walk every `.ts` file under the
 * workspace, parse with the TypeScript compiler, and flag two kinds:
 *   - "raw-write": a call to a write function (the byte-writers plus the
 *     destructive `rename`/`rm`/`mkdir`/`cp`/`truncate`/`createWriteStream`
 *     — see `WRITE_FUNCTIONS`) whose path argument resolves to a
 *     `backlog/`-shaped path.
 *   - "mutating-tool": any string-literal-like node containing an
 *     `mcp__backlog__<name>` token whose `<name>` is not on the read-only
 *     allowlist (deny-by-default — a future mutator is caught with no edit).
 *
 * --- Provenance ---------------------------------------------------------
 * This file is a deliberate structural twin of `registry_writers.test.ts`.
 * The AST-walk + arg-resolution machinery (`walk_ts_sources`,
 * `collect_workspace_sources`, `callee_name`, `find_local_initializer`,
 * the `scan_file` skeleton) is cloned, not shared: extracting it into a
 * non-test module would pull the `typescript` compiler into this package's
 * runtime dependency graph (it is a published-style workspace package whose
 * only runtime dep is `@ariadnejs/types`). A change to the cloned machinery
 * here should be mirrored in `registry_writers.test.ts`, and vice versa.
 * The two are *meant* to diverge at exactly three seams: the path predicate
 * (`arg_targets_backlog` vs `arg_targets_registry`), the second-pass token
 * scan (mutating `mcp__backlog__*` tools vs the registry serializer), and
 * the allowlist. The third write-firewall is the point at which extracting
 * a parameterized scanner becomes real de-duplication rather than
 * speculative generality.
 * ----------------------------------------------------------------------
 */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// packages/skill-fs/src/ → packages/skill-fs → packages → repo root
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");

/**
 * Write primitives whose first argument is a filesystem path. The backlog
 * firewall covers the destructive primitives (`rename`, `rm`, `mkdir`, …) in
 * addition to the byte-writers, because a backlog write is just as easily a
 * `mkdir backlog/tasks` + `rename tmp → backlog/tasks/x.md` as a `writeFile`.
 * The `backlog/`-shaped-path gate (below) keeps this set from producing false
 * positives: legitimate pipeline `rename`/`rm`/`mkdir` calls target
 * `~/.ariadne/…` run directories, never `backlog/`.
 */
const WRITE_FUNCTIONS: ReadonlySet<string> = new Set([
  "atomic_write_file",
  "writeFile",
  "writeFileSync",
  "appendFile",
  "appendFileSync",
  "rename",
  "renameSync",
  "rm",
  "rmSync",
  "unlink",
  "unlinkSync",
  "mkdir",
  "mkdirSync",
  "cp",
  "cpSync",
  "copyFile",
  "copyFileSync",
  "truncate",
  "truncateSync",
  "createWriteStream",
]);

/**
 * The sole site permitted to write `backlog/` by any means — raw filesystem
 * write or mutating `mcp__backlog__*` tool. The export adapter is the
 * human-invoked bridge from the plan engine's task-DB into the user's
 * backlog. It is named pre-emptively (the file lands with TASK-190.22.11),
 * mirroring `registry_writers.test.ts` pre-allowing the fix-sequencer
 * reconciler before its scaffolding exists.
 */
const ALLOWED_BACKLOG_WRITERS: ReadonlySet<string> = new Set([
  ".claude/skills/plan/scripts/export_to_backlog.ts",
]);

/**
 * Read-only `mcp__backlog__*` tools, permitted in any pipeline code as a
 * dedup signal (TASK-190.22.10). The mutating-tool scan is deny-by-default:
 * every `mcp__backlog__<name>` token whose `<name>` is NOT in this set is a
 * violation. The asymmetry is deliberate — a read mis-listed as a mutation
 * is a safe, noisy false positive someone fixes; a mutation mis-listed as a
 * read is a silent breach. So the open read-allowlist (rather than a closed
 * mutator denylist) also catches any mutator added to the backlog MCP server
 * in the future with no change to this test.
 */
const READ_ONLY_BACKLOG_TOOLS: ReadonlySet<string> = new Set([
  "task_search",
  "task_view",
  "task_list",
  "document_view",
  "document_list",
  "document_search",
  "milestone_list",
  "definition_of_done_defaults_get",
  "get_task_creation_guide",
  "get_task_execution_guide",
  "get_task_finalization_guide",
  "get_workflow_overview",
]);

const SCAN_ROOTS: readonly string[] = [
  ".claude/skills",
  "packages",
];

const EXCLUDED_DIRS: ReadonlySet<string> = new Set([
  "node_modules",
  "dist",
  ".pnpm",
  ".vite",
]);

function walk_ts_sources(dir: string, acc: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk_ts_sources(full, acc);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts")) continue;
    if (entry.name.endsWith(".test.ts")) continue;
    if (entry.name.endsWith(".d.ts")) continue;
    acc.push(full);
  }
}

function collect_workspace_sources(): string[] {
  const out: string[] = [];
  for (const root of SCAN_ROOTS) {
    walk_ts_sources(path.join(REPO_ROOT, root), out);
  }
  return out;
}

type ViolationKind = "raw-write" | "mutating-tool";

interface WriteCall {
  file: string;
  line: number;
  callee: string;
  arg_text: string;
  kind: ViolationKind;
}

/**
 * Returns the rightmost identifier in a call expression's callee chain.
 * `atomic_write_file(...)` → "atomic_write_file"; `fs.writeFile(...)` →
 * "writeFile"; `fs.promises.rename(...)` → "rename"; `path.join(...)` →
 * "join".
 */
function callee_name(callee: ts.Expression): string | null {
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return null;
}

/**
 * Which argument positions of a write function carry the path being written.
 * Most write to their first arg. `rename(src, dest)` mutates `backlog/` at
 * either endpoint (moving a task in OR out is a mutation), so both count.
 * `cp`/`copyFile(src, dest)` only *write* their destination — the source is
 * a read, which is permitted — so only the second arg counts.
 */
function target_arg_indices(callee: string): readonly number[] {
  if (callee === "rename" || callee === "renameSync") return [0, 1];
  if (
    callee === "cp" ||
    callee === "cpSync" ||
    callee === "copyFile" ||
    callee === "copyFileSync"
  ) {
    return [1];
  }
  return [0];
}

const BACKLOG_PATH_SEGMENT = /(^|[/\\])backlog[/\\]/i;

/**
 * A single literal targets `backlog/` when it contains a `backlog/` path
 * segment (`"backlog/tasks/x.md"`, `"/repo/backlog/drafts"`). The trailing
 * separator is required so a bare word "backlog" in prose does not match —
 * only an actual path segment does.
 */
function is_backlog_path(text: string): boolean {
  return BACKLOG_PATH_SEGMENT.test(text);
}

/**
 * A `path.join("…", "backlog", "tasks", …)` argument targets backlog when it
 * is the exact segment `"backlog"` (the dominant idiom, where each path
 * segment is its own literal) or already carries a `backlog/` segment. The
 * exact-match guard is what keeps `path.join(home, ".ariadne", "backlog-cache")`
 * — segment `"backlog-cache"` — from being mistaken for a backlog write.
 */
function is_backlog_join_segment(text: string): boolean {
  return text === "backlog" || is_backlog_path(text);
}

/**
 * Decide whether `expr` targets a `backlog/`-shaped path. Accepted shapes,
 * all purely syntactic:
 *   1. A string/template literal carrying a `backlog/` segment.
 *   2. A `path.join(...)` / `path.resolve(...)` any of whose args (string
 *      literal or nested expression) reconstruct a `backlog/` segment — the
 *      pipeline's dominant path-building idiom, which no single string
 *      literal would catch.
 *   3. A `+` concatenation either side of which carries a `backlog/` segment
 *      (`repo + "/backlog/tasks/" + id`).
 *   4. An identifier resolved to its same-file `const … = expr;` initializer.
 *
 * Deliberately does NOT match on an identifier or property *name* containing
 * "backlog": `backlog_task`, `exported_backlog_task`, `backlog_task_id` are
 * domain nouns throughout the plan engine, so a name heuristic (the registry
 * twin's `/registry/i` branch) would be a false-positive bomb here. Only the
 * resolved path *value* decides.
 *
 * `seen` guards against a self-referential or cyclic local binding
 * (`const x = x;`, `const a = b; const b = a;`): without it the identifier
 * recursion never terminates and a single such file anywhere in the tree
 * would crash the whole scan — a firewall that fails open on malformed input.
 */
function arg_targets_backlog(
  expr: ts.Expression,
  source: ts.SourceFile,
  seen: ReadonlySet<string> = new Set(),
): boolean {
  if (ts.isStringLiteralLike(expr)) {
    return is_backlog_path(expr.text);
  }
  if (ts.isTemplateExpression(expr)) {
    if (is_backlog_path(expr.head.text)) return true;
    return expr.templateSpans.some((s) => is_backlog_path(s.literal.text));
  }
  if (ts.isCallExpression(expr)) {
    const name = callee_name(expr.expression);
    if (name === "join" || name === "resolve") {
      return expr.arguments.some(
        (a) =>
          (ts.isStringLiteralLike(a) && is_backlog_join_segment(a.text)) ||
          (!ts.isStringLiteralLike(a) && arg_targets_backlog(a, source, seen)),
      );
    }
    return false;
  }
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return (
      arg_targets_backlog(expr.left, source, seen) ||
      arg_targets_backlog(expr.right, source, seen)
    );
  }
  if (ts.isIdentifier(expr)) {
    if (seen.has(expr.text)) return false;
    const initializer = find_local_initializer(source, expr.text);
    if (initializer !== null) {
      return arg_targets_backlog(initializer, source, new Set([...seen, expr.text]));
    }
  }
  return false;
}

/**
 * Best-effort same-file lookup of a `const <name> = <expr>;` initializer.
 * Defeats the trivial "split the path into a local var across lines" bypass
 * (`const p = path.join(root, "backlog", id); await writeFile(p, body)`).
 * Does not chase imports — a deliberate scoping decision shared with the
 * registry twin; cross-module path helpers are a documented gap in
 * `.claude/rules/backlog-firewall.md`.
 */
function find_local_initializer(
  source: ts.SourceFile,
  name: string,
): ts.Expression | null {
  let found: ts.Expression | null = null;
  source.forEachChild(function visit(node) {
    if (found !== null) return;
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.name.text === name &&
          decl.initializer !== undefined
        ) {
          found = decl.initializer;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  });
  return found;
}

const MCP_BACKLOG_TOKEN = /mcp__backlog__(\w+)/g;

/**
 * The string payload of a string-literal-like node, including the parts of a
 * template literal. Comments are intentionally excluded — a tool name in a
 * comment cannot be invoked, and JSDoc that mentions `backlog/` must not trip
 * the scan.
 */
function string_node_text(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
    return node.text;
  }
  return null;
}

function scan_file(abs_path: string): WriteCall[] {
  const source_text = fs.readFileSync(abs_path, "utf8");
  const source = ts.createSourceFile(
    abs_path,
    source_text,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  const hits: WriteCall[] = [];
  function visit(node: ts.Node): void {
    // Pass 1: a write function whose first arg resolves to a backlog path.
    if (ts.isCallExpression(node)) {
      const name = callee_name(node.expression);
      if (name !== null && WRITE_FUNCTIONS.has(name)) {
        for (const index of target_arg_indices(name)) {
          const target = node.arguments[index];
          if (target !== undefined && arg_targets_backlog(target, source)) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            hits.push({
              file: abs_path,
              line: line + 1,
              callee: name,
              arg_text: target.getText(source),
              kind: "raw-write",
            });
          }
        }
      }
    }
    // Pass 2: a string-literal-like node naming a mutating `mcp__backlog__*`
    // tool. These names reach the runtime as prompt/grant strings an agent
    // could be told to call, so any non-read-only token is a violation.
    const text = string_node_text(node);
    if (text !== null) {
      for (const match of text.matchAll(MCP_BACKLOG_TOKEN)) {
        const tool = match[1];
        if (!READ_ONLY_BACKLOG_TOOLS.has(tool)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          hits.push({
            file: abs_path,
            line: line + 1,
            callee: `mcp__backlog__${tool}`,
            arg_text: `mcp__backlog__${tool}`,
            kind: "mutating-tool",
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return hits;
}

describe("backlog-writer boundary (AST scan over the workspace)", () => {
  it("only the allowlisted export adapter writes a backlog-shaped path or names a mutating mcp__backlog__* tool", () => {
    const all_sources = collect_workspace_sources();
    // Guard against a silent no-op: if `REPO_ROOT` ever resolves wrong (a moved
    // file, a change to the `../../..` hop), `collect_workspace_sources()`
    // returns [] and the scan passes green while inspecting nothing. Anchor on
    // a stable non-test source that must be in the walked set.
    const scanned = new Set(all_sources.map((f) => path.relative(REPO_ROOT, f)));
    expect(scanned.has("packages/skill-fs/src/atomic_update_registry.ts")).toBe(true);

    const violations: WriteCall[] = [];
    for (const file of all_sources) {
      const rel = path.relative(REPO_ROOT, file);
      if (ALLOWED_BACKLOG_WRITERS.has(rel)) continue;
      violations.push(...scan_file(file));
    }
    if (violations.length > 0) {
      const message = violations
        .map(
          (v) =>
            `${path.relative(REPO_ROOT, v.file)}:${v.line}  [${v.kind}]  ${v.callee}(${v.arg_text})`,
        )
        .join("\n");
      throw new Error(
        "Backlog write-boundary violation:\n" +
          message +
          "\n\nThe self-healing pipeline (`triage`, `plan`) must never write the " +
          "user's `backlog/`. Route proposed work through the plan engine's " +
          "task-DB (`~/.ariadne/plan/`); the human-invoked export adapter " +
          "(`.claude/skills/plan/scripts/export_to_backlog.ts`) is the sole " +
          "sanctioned writer. If a new site is contractually permitted, add it " +
          "to `ALLOWED_BACKLOG_WRITERS` (raw writes / mutating tools) or " +
          "`READ_ONLY_BACKLOG_TOOLS` (a new read-only tool) in this test and " +
          "document the reason in `.claude/rules/backlog-firewall.md`.",
      );
    }
    expect(violations).toEqual([]);
  });

  it("negative control: synthetic violations of every branch are flagged (scanner is not silently no-op)", async () => {
    // Defends against a refactor that breaks one branch of the scan while the
    // live workspace contains no real violations — the main test would still
    // pass with zero hits. This control writes a known-bad file exercising
    // each detection branch and asserts every branch fires.
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "backlog-scan-control-"));
    try {
      const bad = path.join(tmp, "bad_writer.ts");
      await fsp.writeFile(
        bad,
        [
          'import { writeFile, rename } from "node:fs/promises";',
          'import * as path from "node:path";',
          "async function go(repo: string, body: string) {",
          // string-literal path → is_backlog_path branch
          '  await writeFile("backlog/tasks/x.md", body);',
          // path.join idiom → join-segment branch
          '  await writeFile(path.join(repo, "backlog", "tasks", "y.md"), body);',
          // destructive primitive, dest is the SECOND arg → target_arg_indices
          '  await rename("/tmp/z.md", "backlog/drafts/z.md");',
          // const-initializer laundering → find_local_initializer branch
          '  const target = path.join(repo, "backlog", "tasks", "w.md");',
          "  await writeFile(target, body);",
          // string concatenation → BinaryExpression branch
          '  await writeFile(repo + "/backlog/tasks/" + id + ".md", body);',
          // nested path.join → join-arg recursion branch
          '  await writeFile(path.join(path.join(repo, "backlog"), "n.md"), body);',
          // mutating tool named in prose → mutating-tool branch
          '  const prompt = "call mcp__backlog__task_create to file it";',
          "  return prompt;",
          "}",
          // self-referential binding must NOT crash the scan (cycle guard)
          "function cyclic(b: string) {",
          "  const a = a;",
          "  return writeFile(a, b);",
          "}",
          "",
        ].join("\n"),
        "utf8",
      );
      const hits = scan_file(bad);
      const raw_writes = hits.filter((h) => h.kind === "raw-write");
      const mutating = hits.filter((h) => h.kind === "mutating-tool");
      // Six independent raw-write branches must each fire (string literal,
      // path.join, rename-dest, const launder, string concat, nested join).
      expect(raw_writes.length).toBe(6);
      expect(mutating.length).toBe(1);
      expect(mutating[0].callee).toBe("mcp__backlog__task_create");
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true });
    }
  });

  it("negative control: benign backlog-named identifiers and read-only tools are NOT flagged", async () => {
    // Proves the scanner does not over-fire: a `backlog_task` parameter is a
    // domain noun, not a write target; a `~/.ariadne/plan/` path is not
    // backlog-shaped; and `mcp__backlog__task_search` is a permitted read.
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "backlog-scan-benign-"));
    try {
      const ok = path.join(tmp, "ok_reader.ts");
      await fsp.writeFile(
        ok,
        [
          'import { writeFile } from "node:fs/promises";',
          'import * as path from "node:path";',
          "async function ok(backlog_task: string, body: string) {",
          '  await writeFile(path.join("/home/u/.ariadne/plan", "t.json"), body);',
          '  const hint = "dedup via mcp__backlog__task_search first";',
          "  return backlog_task + hint;",
          "}",
          "",
        ].join("\n"),
        "utf8",
      );
      expect(scan_file(ok)).toEqual([]);
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true });
    }
  });
});

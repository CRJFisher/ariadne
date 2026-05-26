/**
 * Structural enforcement of the write-boundary contract documented in
 * `.claude/rules/classifier-lifecycle.md`. `registry.json` is mutated by
 * exactly three writers (curator, reconciler, human); they reach the file
 * through `@ariadnejs/skill-fs`'s `atomic_update_registry` which holds the
 * `.lock` sidecar over read-mutate-write. Bypassing the lock with a direct
 * `atomic_write_file`/`writeFile` against a registry-shaped path
 * silently re-introduces last-writer-wins data loss; this test fails the
 * build before such a regression lands.
 *
 * Detection is syntactic and per-file: we walk every `.ts` file under the
 * workspace, parse with the TypeScript compiler, and for each call to a
 * named write function check whether its first argument resolves to a
 * registry-shaped target (local const initialised from
 * `get_registry_file_path()`, an identifier or property access whose name
 * carries `registry`, or a string-literal path containing `registry.json`).
 * Pure AST inspection — no data-flow analysis across modules.
 *
 * Allowlist below names the few sites that are contractually permitted to
 * call a raw writer against the registry: `atomic_update_registry` itself
 * (where the wrapping is legal under the lock) and the upcoming
 * fix-sequencer reconciler (TASK-190.18.3). The curator's
 * `apply_proposals.ts` upsert + link paths intentionally do NOT appear —
 * those now route through `atomic_update_registry`.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// packages/skill-fs/src/ → packages/skill-fs → packages → repo root
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");

const WRITE_FUNCTIONS: ReadonlySet<string> = new Set([
  "atomic_write_file",
  "writeFile",
  "writeFileSync",
  "appendFile",
  "appendFileSync",
]);

const ALLOWED_REGISTRY_WRITERS: ReadonlySet<string> = new Set([
  // The atomic-update helper wraps the only legal direct write of the
  // registry — its body holds the lock and writes via `atomic_write_file`.
  "packages/skill-fs/src/atomic_update_registry.ts",
  // Future home of the fix-sequencer reconciler (TASK-190.18.3). It writes
  // `status: wip → fixed` rows; the file does not exist yet but is allowed
  // pre-emptively so the test stays green when the scaffolding lands.
  ".claude/skills/fix-sequencer/scripts/reconcile_registry_with_completed_nodes.ts",
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

interface WriteCall {
  file: string;
  line: number;
  callee: string;
  arg_text: string;
}

/**
 * Returns the rightmost identifier in a call expression's callee chain.
 * `atomic_write_file(...)` → "atomic_write_file"; `fs.writeFile(...)` →
 * "writeFile"; `fs.promises.writeFile(...)` → "writeFile".
 */
function callee_name(callee: ts.Expression): string | null {
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return null;
}

/**
 * Decide whether `expr` targets a registry-shaped path. Three accepted
 * shapes, all purely syntactic:
 *   1. A direct call to `get_registry_file_path(...)`.
 *   2. An identifier/property access whose final name carries `registry`
 *      (e.g. `registry_path`, `opts.registry_path`, `REGISTRY_PATH`).
 *   3. A string literal or template head containing `registry.json`.
 * Also resolves an `Identifier` to its same-file `const ... = expr;`
 * initializer when present, so `const x = get_registry_file_path(); ...
 * atomic_write_file(x, ...)` cannot bypass the check by splitting the
 * call across lines.
 */
function arg_targets_registry(
  expr: ts.Expression,
  source: ts.SourceFile,
): boolean {
  if (ts.isStringLiteralLike(expr)) {
    return /registry[^/]*\.json/i.test(expr.text);
  }
  if (ts.isTemplateExpression(expr)) {
    const head_text = expr.head.text;
    if (/registry[^/]*\.json/i.test(head_text)) return true;
    return expr.templateSpans.some((s) => /registry[^/]*\.json/i.test(s.literal.text));
  }
  if (ts.isNoSubstitutionTemplateLiteral(expr)) {
    return /registry[^/]*\.json/i.test(expr.text);
  }
  if (ts.isCallExpression(expr)) {
    const name = callee_name(expr.expression);
    return name === "get_registry_file_path";
  }
  if (ts.isPropertyAccessExpression(expr)) {
    return /registry/i.test(expr.name.text);
  }
  if (ts.isIdentifier(expr)) {
    if (/registry/i.test(expr.text)) return true;
    const initializer = find_local_initializer(source, expr.text);
    if (initializer !== null) {
      return arg_targets_registry(initializer, source);
    }
  }
  return false;
}

/**
 * Best-effort same-file lookup of a `const <name> = <expr>;` initializer.
 * Defeats the trivial "split path into a local var across lines" bypass.
 * Does not chase imports — that is a deliberate scoping decision.
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
    if (ts.isCallExpression(node)) {
      const name = callee_name(node.expression);
      if (name !== null && WRITE_FUNCTIONS.has(name) && node.arguments.length > 0) {
        const first_arg = node.arguments[0];
        if (arg_targets_registry(first_arg, source)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          hits.push({
            file: abs_path,
            line: line + 1,
            callee: name,
            arg_text: first_arg.getText(source),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return hits;
}

describe("registry-writer boundary (AST scan over the workspace)", () => {
  it("only the allowlisted files call a raw write function against a registry-shaped path", () => {
    const all_sources = collect_workspace_sources();
    const violations: WriteCall[] = [];
    for (const file of all_sources) {
      const rel = path.relative(REPO_ROOT, file);
      const hits = scan_file(file);
      if (hits.length === 0) continue;
      if (ALLOWED_REGISTRY_WRITERS.has(rel)) continue;
      violations.push(...hits);
    }
    if (violations.length > 0) {
      const message = violations
        .map(
          (v) =>
            `${path.relative(REPO_ROOT, v.file)}:${v.line}  ${v.callee}(${v.arg_text}, …)`,
        )
        .join("\n");
      throw new Error(
        "Registry write-boundary violation:\n" +
          message +
          "\n\nUse `atomic_update_registry(path, mutator)` from `@ariadnejs/skill-fs` " +
          "instead; the helper holds the `.lock` sidecar over the read-mutate-write " +
          "cycle. If a new site is contractually permitted to write the registry " +
          "directly, add it to `ALLOWED_REGISTRY_WRITERS` in this test and document " +
          "the reason in `.claude/rules/classifier-lifecycle.md`.",
      );
    }
    expect(violations).toEqual([]);
  });
});

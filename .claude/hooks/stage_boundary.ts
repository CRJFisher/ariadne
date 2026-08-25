/**
 * Stage-boundary invariants for packages/core/src, enforced at Stop by
 * stage_boundary_stop.ts. Pure logic: every function takes explicit inputs
 * ({ path, content } records) so tests need no git state or filesystem.
 *
 * Two deterministic invariants:
 * - Stage check: a pipeline stage never value-imports a later stage or the
 *   project orchestrator; registries never import call_resolution.
 * - Barrel check: an index.ts re-exports only its own directory subtree; a
 *   barrel with zero exports and zero importers is dead.
 *
 * The paired rule .claude/rules/stage-boundaries.md restates this contract;
 * STAGE_ORDER here is the source of truth.
 */

import * as path from "path";
import ts from "typescript";

export const CORE_SRC = "packages/core/src";

// project is the orchestrator and benchmark_corpus_load is the measurement
// harness over it: both sit above every stage, may value-import any of them,
// and are imported by none. The Infinity sentinel encodes both directions in
// one comparison.
export const STAGE_ORDER: Record<string, number> = {
  index_single_file: 1,
  resolve_references: 2,
  trace_call_graph: 3,
  classify_entry_points: 3,
  project: Number.POSITIVE_INFINITY,
  benchmark_corpus_load: Number.POSITIVE_INFINITY,
};

const REGISTRIES_PREFIX = `${CORE_SRC}/resolve_references/registries/`;
const CALL_RESOLUTION_PREFIX = `${CORE_SRC}/resolve_references/call_resolution/`;
const PACKAGE_ENTRY_BARREL = `${CORE_SRC}/index.ts`;

// The two back-edges 362.6 documented as out of scope ("candidates for a
// follow-up that lifts those shared primitives out of the orchestrator
// folder"). Grandfathered so sessions editing these files are not blocked on
// pre-existing edges; any new cross-stage edge still blocks. Remove each entry
// when the lift lands.
export const GRANDFATHERED_EDGES: ReadonlySet<string> = new Set([
  `${CORE_SRC}/trace_call_graph/trace_call_graph.ts → ../project/detect_test_file`,
  `${CORE_SRC}/classify_entry_points/complete_caller_evidence.ts → ../project/file_loading`,
]);

export interface SourceFile {
  path: string; // repo-relative, posix separators
  content: string;
}

export interface ModuleEdge {
  specifier: string;
  line: number; // 1-based
  is_export_from: boolean;
  is_value: boolean; // false when the statement is fully erased at compile time
}

export type Violation =
  | {
      kind: "stage_import";
      file: string;
      line: number;
      specifier: string;
      importer_stage: number;
      target_stage: number;
    }
  | { kind: "registries_import"; file: string; line: number; specifier: string }
  | { kind: "barrel_escape"; file: string; line: number; specifier: string }
  | { kind: "dead_barrel"; file: string };

function parse(file: SourceFile): ts.SourceFile {
  return ts.createSourceFile(
    file.path,
    file.content,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS
  );
}

function import_carries_value(clause: ts.ImportClause | undefined): boolean {
  // A bare `import "./x"` has no clause but still executes the module.
  if (!clause) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name) return true;
  const bindings = clause.namedBindings;
  if (!bindings) return true;
  if (ts.isNamespaceImport(bindings)) return true;
  if (bindings.elements.length === 0) return true;
  return bindings.elements.some((e) => !e.isTypeOnly);
}

function export_carries_value(stmt: ts.ExportDeclaration): boolean {
  if (stmt.isTypeOnly) return false;
  const clause = stmt.exportClause;
  if (!clause) return true; // export * from
  if (ts.isNamespaceExport(clause)) return true; // export * as ns from
  if (clause.elements.length === 0) return true;
  return clause.elements.some((e) => !e.isTypeOnly);
}

/**
 * Static import / export-from statements only. Dynamic import() expressions
 * are out of scope: this is a text-level statement pass, not a call analysis.
 */
export function extract_module_edges(file: SourceFile): ModuleEdge[] {
  const sf = parse(file);
  const edges: ModuleEdge[] = [];
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      edges.push({
        specifier: stmt.moduleSpecifier.text,
        line: sf.getLineAndCharacterOfPosition(stmt.getStart(sf)).line + 1,
        is_export_from: false,
        is_value: import_carries_value(stmt.importClause),
      });
    } else if (
      ts.isExportDeclaration(stmt) &&
      stmt.moduleSpecifier !== undefined &&
      ts.isStringLiteral(stmt.moduleSpecifier)
    ) {
      edges.push({
        specifier: stmt.moduleSpecifier.text,
        line: sf.getLineAndCharacterOfPosition(stmt.getStart(sf)).line + 1,
        is_export_from: true,
        is_value: export_carries_value(stmt),
      });
    }
  }
  return edges;
}

function has_exports(file: SourceFile): boolean {
  const sf = parse(file);
  return sf.statements.some(
    (stmt) =>
      ts.isExportDeclaration(stmt) ||
      ts.isExportAssignment(stmt) ||
      (ts.canHaveModifiers(stmt) &&
        (ts.getModifiers(stmt) ?? []).some(
          (m) => m.kind === ts.SyntaxKind.ExportKeyword
        ))
  );
}

/**
 * Resolve a relative specifier against its importer to an extension-stripped
 * repo path, or null when out of scope (bare/cross-package specifiers, and
 * targets that leave packages/core/src).
 */
function resolve_relative(
  importer_path: string,
  specifier: string
): string | null {
  if (!specifier.startsWith(".")) return null;
  const joined = path.posix.normalize(
    path.posix.join(path.posix.dirname(importer_path), specifier)
  );
  const stripped = joined.replace(/\.(js|ts|jsx|tsx|mjs|cjs)$/, "");
  if (stripped !== CORE_SRC && !stripped.startsWith(`${CORE_SRC}/`)) return null;
  return stripped;
}

/**
 * Stage of a repo path by its top-level directory under packages/core/src.
 * Cross-cutting dirs (logging, persistence), root files, and unknown dirs
 * have no stage (null) and are exempt from the direction rule.
 */
function stage_of(repo_path: string): number | null {
  if (!repo_path.startsWith(`${CORE_SRC}/`)) return null;
  const top = repo_path.slice(CORE_SRC.length + 1).split("/")[0];
  return STAGE_ORDER[top] ?? null;
}

function is_test_file(repo_path: string): boolean {
  return repo_path.endsWith(".test.ts");
}

/**
 * Value-import direction rule over the changed files. Test files are exempt:
 * tests legitimately reach across stages to build fixtures.
 */
export function check_stage(changed: SourceFile[]): Violation[] {
  const violations: Violation[] = [];
  for (const file of changed) {
    if (!file.path.startsWith(`${CORE_SRC}/`) || is_test_file(file.path)) continue;
    const importer_stage = stage_of(file.path);
    for (const edge of extract_module_edges(file)) {
      if (!edge.is_value) continue;
      if (GRANDFATHERED_EDGES.has(`${file.path} → ${edge.specifier}`)) continue;
      const target = resolve_relative(file.path, edge.specifier);
      if (target === null) continue;
      if (
        file.path.startsWith(REGISTRIES_PREFIX) &&
        `${target}/`.startsWith(CALL_RESOLUTION_PREFIX)
      ) {
        violations.push({
          kind: "registries_import",
          file: file.path,
          line: edge.line,
          specifier: edge.specifier,
        });
        continue;
      }
      const target_stage = stage_of(target);
      if (
        importer_stage !== null &&
        target_stage !== null &&
        importer_stage < target_stage
      ) {
        violations.push({
          kind: "stage_import",
          file: file.path,
          line: edge.line,
          specifier: edge.specifier,
          importer_stage,
          target_stage,
        });
      }
    }
  }
  return violations;
}

/**
 * Barrel invariants over the changed index.ts files. The all_core corpus is
 * consulted only for the dead-barrel importer scan; pass [] when no changed
 * file is an index.ts. Importers include test files: a barrel used only by
 * tests is alive.
 */
export function check_barrels(
  changed: SourceFile[],
  all_core: SourceFile[]
): Violation[] {
  const violations: Violation[] = [];
  for (const file of changed) {
    if (
      !file.path.startsWith(`${CORE_SRC}/`) ||
      path.posix.basename(file.path) !== "index.ts"
    ) {
      continue;
    }
    const barrel_dir = path.posix.dirname(file.path);
    for (const edge of extract_module_edges(file)) {
      if (!edge.is_export_from) continue;
      const target = resolve_relative(file.path, edge.specifier);
      if (target === null) continue;
      if (target !== barrel_dir && !target.startsWith(`${barrel_dir}/`)) {
        violations.push({
          kind: "barrel_escape",
          file: file.path,
          line: edge.line,
          specifier: edge.specifier,
        });
      }
    }
    // The package entry barrel is referenced from package.json, not imports.
    if (file.path === PACKAGE_ENTRY_BARREL) continue;
    if (has_exports(file)) continue;
    const has_importer = all_core.some(
      (other) =>
        other.path !== file.path &&
        extract_module_edges(other).some((edge) => {
          const target = resolve_relative(other.path, edge.specifier);
          return target === barrel_dir || target === `${barrel_dir}/index`;
        })
    );
    if (!has_importer) {
      violations.push({ kind: "dead_barrel", file: file.path });
    }
  }
  return violations;
}

export function check_boundaries(
  changed: SourceFile[],
  all_core: SourceFile[]
): Violation[] {
  return [...check_stage(changed), ...check_barrels(changed, all_core)];
}

export function format_violation(violation: Violation): string {
  switch (violation.kind) {
    case "stage_import": {
      const target_name =
        violation.target_stage === Number.POSITIVE_INFINITY
          ? "project (the orchestrator)"
          : `later stage ${violation.target_stage}`;
      return (
        `${violation.file}:${violation.line} value-imports "${violation.specifier}" — ` +
        `stage ${violation.importer_stage} must not import ${target_name}; ` +
        `use import type or move the code to the owning stage`
      );
    }
    case "registries_import":
      return (
        `${violation.file}:${violation.line} value-imports "${violation.specifier}" — ` +
        `registries never import call_resolution`
      );
    case "barrel_escape":
      return (
        `${violation.file}:${violation.line} re-exports "${violation.specifier}" — ` +
        `an index.ts re-exports only its own directory subtree`
      );
    case "dead_barrel":
      return `${violation.file} has zero exports and zero importers — delete this dead barrel`;
  }
}

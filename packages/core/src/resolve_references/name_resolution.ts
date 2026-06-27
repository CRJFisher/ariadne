/**
 * Name Resolution (Phase 1)
 *
 * Pure functions for resolving symbol names in scopes.
 * Implements lexical scoping with import shadowing and local definition override.
 */

import type {
  SymbolId,
  FilePath,
  ScopeId,
  SymbolName,
  Language,
} from "@ariadnejs/types";
import type { FileSystemFolder } from "./file_folders";
import type { DefinitionRegistry } from "./registries/definition";
import type { ScopeRegistry } from "./registries/scope";
import type { ExportRegistry } from "./registries/export";
import type { ImportGraph } from "../project/import_graph";
import type { NameResolutionResult } from "./resolution_state";

/**
 * Context bundle for name resolution.
 * Groups related parameters for cleaner function signatures.
 */
export interface NameResolutionContext {
  readonly languages: ReadonlyMap<FilePath, Language>;
  readonly definitions: DefinitionRegistry;
  readonly scopes: ScopeRegistry;
  readonly exports: ExportRegistry;
  readonly imports: ImportGraph;
  readonly root_folder: FileSystemFolder;
}

/**
 * PHASE 1: Resolve all symbol names in scopes for a set of files.
 *
 * Name Resolution (scope-based):
 *   1. Get root scope from ScopeRegistry
 *   2. Call resolve_scope_recursive to resolve all names
 *   3. Return scope-based resolutions
 *
 * Pure function: computes new resolutions from scratch for the given files.
 * The caller is responsible for removing old resolutions before applying.
 *
 * @param file_ids - Files that need resolution updates
 * @param context - Resolution context with all required registries
 * @returns Name resolution result to be applied to state
 */
export function resolve_names(
  file_ids: Set<FilePath>,
  context: NameResolutionContext
): NameResolutionResult {
  if (file_ids.size === 0) {
    return {
      resolutions_by_scope: new Map(),
      scope_to_file: new Map(),
    };
  }

  const all_resolutions_by_scope = new Map<
    ScopeId,
    ReadonlyMap<SymbolName, SymbolId>
  >();
  const all_scope_to_file = new Map<ScopeId, FilePath>();

  // Process each file
  for (const file_id of file_ids) {
    // Get root scope for file
    const root_scope = context.scopes.get_file_root_scope(file_id);
    if (!root_scope) {
      continue; // File has no scope tree
    }

    // Get language for this file
    const language = context.languages.get(file_id);
    if (!language) {
      continue; // File not indexed
    }

    // Resolve recursively from root
    const file_result = resolve_scope_recursive(
      root_scope.id,
      new Map(), // Empty parent resolutions at root
      file_id,
      context
    );

    // Collect results
    for (const [scope_id, scope_resolutions] of file_result.resolutions_by_scope) {
      all_resolutions_by_scope.set(scope_id, scope_resolutions);
    }
    for (const [scope_id, file_path] of file_result.scope_to_file) {
      all_scope_to_file.set(scope_id, file_path);
    }
  }

  return {
    resolutions_by_scope: all_resolutions_by_scope,
    scope_to_file: all_scope_to_file,
  };
}

/**
 * Result from resolving a single scope tree.
 */
interface ScopeTreeResolutionResult {
  readonly resolutions_by_scope: Map<ScopeId, Map<SymbolName, SymbolId>>;
  readonly scope_to_file: Map<ScopeId, FilePath>;
}

/**
 * Recursively resolve all symbols in a scope and its children.
 * Implements lexical scoping with proper shadowing.
 *
 * Algorithm (over a base map inherited from the parent scope):
 * 1. Add import resolutions (can shadow inherited)
 * 2. Add local definitions (shadows everything, minus the self-initializer carve-out)
 * 3. Hoist function declarations out of descendant block scopes
 * 4. Store this scope's resolutions
 * 5. Recurse to children
 *
 * @param scope_id - Current scope to resolve
 * @param parent_resolutions - Resolutions inherited from parent scope
 * @param file_path - File containing this scope
 * @param context - Resolution context
 * @returns Resolution result for this scope and all children
 */
function resolve_scope_recursive(
  scope_id: ScopeId,
  parent_resolutions: ReadonlyMap<SymbolName, SymbolId>,
  file_path: FilePath,
  context: NameResolutionContext
): ScopeTreeResolutionResult {
  const result: ScopeTreeResolutionResult = {
    resolutions_by_scope: new Map(),
    scope_to_file: new Map(),
  };
  const scope_resolutions = new Map(parent_resolutions);

  // Step 1: Add import resolutions (can shadow parent)
  const import_defs = context.imports.get_scope_imports(scope_id);

  for (const imp_def of import_defs) {
    let resolved: SymbolId | null = null;

    if (imp_def.import_kind === "namespace") {
      // Namespace: return import's own symbol_id
      resolved = imp_def.symbol_id;
    } else {
      // Named/default: resolve via export chain
      // Use pre-resolved path from ImportGraph (cached for performance)
      const source_file = context.imports.get_resolved_import_path(
        imp_def.symbol_id
      );

      if (!source_file) {
        // Import path couldn't be resolved - skip this import
        continue;
      }

      // Get the imported symbol name (original_name for aliased imports, else name)
      const import_name = (imp_def.original_name ||
        imp_def.name) as SymbolName;

      // Resolve export chain with languages and root_folder
      resolved = context.exports.resolve_export_chain(
        source_file,
        import_name,
        imp_def.import_kind,
        context.languages,
        context.root_folder
      );

      // Explicit-named-import fallback: `is_exported` governs only the
      // *implicit* public surface (wildcard / namespace / re-export). An
      // explicit `from ._lib import _make_block` names its target directly, so
      // it binds to any module-level definition in the source file — even one
      // the export registry rejects for is_exported=false (Python single-
      // underscore names, Rust non-`pub` items). Restricted to the source
      // file's module scope so it cannot bind to a nested-scope definition,
      // and to `named` imports so default/namespace/wildcard stay gated. Runs
      // before the submodule fallback below, so a real module-level definition
      // takes precedence over a same-named sibling submodule.
      if (!resolved && imp_def.import_kind === "named") {
        const root_scope = context.scopes.get_file_root_scope(source_file);
        if (root_scope) {
          resolved =
            context.definitions
              .get_scope_definitions(root_scope.id)
              .get(import_name) ?? null;
        }
      }
    }

    // Submodule fallback: if export chain failed for a named import,
    // check if the imported name refers to a submodule file
    if (!resolved) {
      const submodule_path = context.imports.get_submodule_import_path(
        imp_def.symbol_id
      );
      if (submodule_path) {
        resolved = imp_def.symbol_id;
      }
    }

    if (resolved) {
      scope_resolutions.set(imp_def.name, resolved);
    }
  }

  // Step 2: Add local definitions (OVERRIDES everything)
  const local_defs = context.definitions.get_scope_definitions(scope_id);

  for (const [name, symbol_id] of local_defs) {
    // Self-initializer carve-out: a `let x = … x(…)` binding does not yet
    // exist while its own initializer evaluates (Rust/JS bring the name into
    // scope only after the initializer), so the call inside that initializer
    // must resolve to the binding already in scope — typically an import of
    // the same name (or an inherited outer local). Keep that shadowed binding
    // instead of layering the not-yet-live local over it. Narrowed to the
    // self-initializer case (`initialized_from_call === name`): every other
    // shadow still overrides, so ordinary lexical shadowing is unchanged.
    //
    // Resolution is scope-keyed, not position-keyed (one binding per name per
    // scope), so this drops the local from the scope map for the *whole* scope:
    // later references to the local also resolve to the shadowed binding. That
    // is acceptable because a self-initializer local is a leaf value in the
    // shapes this targets (serde `let has_flatten = has_flatten(fields)`), and
    // the call edge — what entry-point detection needs — is what we recover.
    if (scope_resolutions.has(name) && is_self_initializer(symbol_id, name, context)) {
      continue;
    }
    scope_resolutions.set(name, symbol_id);
  }

  // Step 3: Hoist function declarations out of descendant block scopes.
  // A `function`/`fn` declared inside a nested block (if/for/match/try/…) is
  // recorded under that block's scope, yet it is lexically reachable from
  // sibling scopes under the same function or module: JS hoists function
  // declarations to the enclosing function scope; a Rust block item reaches
  // sibling statements in the same body. Without this, a sibling scope misses
  // the definition (`name_not_in_scope`). Layer such functions in without
  // overriding a closer binding already in scope (so a same-named import or
  // outer local still wins, keeping valid shadowing intact). This deliberately
  // over-approximates toward reachability — the safe direction for entry-point
  // detection — but only for a name with no competing binding, which in valid
  // code is never referenced from a scope that cannot reach it.
  for (const [name, symbol_id] of collect_hoisted_functions(scope_id, context)) {
    if (!scope_resolutions.has(name)) {
      scope_resolutions.set(name, symbol_id);
    }
  }

  // Step 4: Store this scope's resolutions
  result.resolutions_by_scope.set(scope_id, scope_resolutions);
  result.scope_to_file.set(scope_id, file_path);

  // Step 5: Recurse to children
  const scope = context.scopes.get_scope(scope_id);
  if (scope && scope.child_ids) {
    for (const child_id of scope.child_ids) {
      const child_result = resolve_scope_recursive(
        child_id,
        scope_resolutions, // Pass down as parent
        file_path,
        context
      );

      // Merge child results
      for (const [child_scope_id, child_resolutions] of child_result.resolutions_by_scope) {
        result.resolutions_by_scope.set(child_scope_id, child_resolutions);
      }
      for (const [child_scope_id, child_file] of child_result.scope_to_file) {
        result.scope_to_file.set(child_scope_id, child_file);
      }
    }
  }

  return result;
}

/**
 * True when `symbol_id` is a `let`/`const` binding whose initializer calls a
 * function of the same name — a self-initializer such as
 * `let has_flatten = has_flatten(fields)`. The binding is not yet in scope
 * while its initializer runs, so the call inside it resolves to the shadowed
 * outer binding (e.g. an import), not the local.
 *
 * Reads `initialized_from_call`, which the per-language capture handlers
 * (JS/TS/Rust) populate; the same field also drives return-type inference in
 * `registries/type.ts`.
 */
function is_self_initializer(
  symbol_id: SymbolId,
  name: SymbolName,
  context: NameResolutionContext
): boolean {
  const def = context.definitions.get(symbol_id);
  return (
    (def?.kind === "variable" || def?.kind === "constant") &&
    def.initialized_from_call === name
  );
}

/**
 * Collect `function` definitions declared in descendant block scopes that
 * hoist into `scope_id`. Descends only through `block` scopes and stops at any
 * nested function/method/constructor/class scope — those open their own
 * hoisting domain. The result maps each hoisted name to its definition; when a
 * name is declared in blocks at different depths, the shallower (closer to
 * `scope_id`) definition wins.
 */
function collect_hoisted_functions(
  scope_id: ScopeId,
  context: NameResolutionContext
): Map<SymbolName, SymbolId> {
  const hoisted = new Map<SymbolName, SymbolId>();
  const scope = context.scopes.get_scope(scope_id);
  if (!scope?.child_ids) {
    return hoisted;
  }

  for (const child_id of scope.child_ids) {
    const child = context.scopes.get_scope(child_id);
    if (child?.type !== "block") {
      continue; // a non-block scope opens its own hoisting domain
    }

    for (const [name, symbol_id] of context.definitions.get_scope_definitions(
      child_id
    )) {
      if (context.definitions.get(symbol_id)?.kind === "function") {
        hoisted.set(name, symbol_id);
      }
    }

    for (const [name, symbol_id] of collect_hoisted_functions(child_id, context)) {
      if (!hoisted.has(name)) {
        hoisted.set(name, symbol_id); // a shallower block's definition wins
      }
    }
  }

  return hoisted;
}

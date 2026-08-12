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
import type { DefinitionRegistry } from "./registries/definition";
import type { ScopeRegistry } from "./registries/scope";
import type { ExportRegistry } from "./registries/export";
import type { ImportGraph } from "./import_resolution/import_graph";
import type { NameResolutionResult } from "./resolution_state";
import type { ModuleResolutionContext } from "./import_resolution";

/** Registries and language map consulted while resolving names in a scope tree. */
export interface NameResolutionContext {
  readonly languages: ReadonlyMap<FilePath, Language>;
  readonly definitions: DefinitionRegistry;
  readonly scopes: ScopeRegistry;
  readonly exports: ExportRegistry;
  readonly imports: ImportGraph;
  readonly resolution: ModuleResolutionContext;
}

/**
 * Resolve every name in scope, per file, into a scope-keyed resolution map.
 *
 * Computes resolutions from scratch for the given files; the caller removes
 * stale resolutions before applying the result.
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

  for (const file_id of file_ids) {
    const root_scope = context.scopes.get_file_root_scope(file_id);
    if (!root_scope) {
      continue;
    }

    const language = context.languages.get(file_id);
    if (!language) {
      continue;
    }

    const file_result = resolve_scope_recursive(
      root_scope.id,
      new Map(),
      file_id,
      context
    );

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

interface ScopeTreeResolutionResult {
  readonly resolutions_by_scope: Map<ScopeId, Map<SymbolName, SymbolId>>;
  readonly scope_to_file: Map<ScopeId, FilePath>;
}

/**
 * Resolve a scope and its descendants over a base map inherited from the
 * parent scope. Later steps shadow earlier ones: imports shadow inherited
 * names, local definitions shadow imports (minus the self-initializer
 * carve-out), and hoisted functions fill only names with no closer binding.
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

  const import_defs = context.imports.get_scope_imports(scope_id);

  // @language rust,python
  // A wildcard import (`use m::*`, `from m import *`) binds every public name
  // of its module into this scope under no name of its own. Layered first so an
  // explicit import (below) and a local definition both shadow it. JS/TS is
  // excluded: its only wildcard form, `export * from`, binds nothing locally —
  // that surface is served by the ExportRegistry fan-out instead.
  const language = context.languages.get(file_path);
  if (language === "rust" || language === "python") {
    for (const imp_def of import_defs) {
      if (imp_def.import_kind !== "wildcard") {
        continue;
      }
      const source_file = context.imports.get_resolved_import_path(
        imp_def.symbol_id
      );
      if (!source_file) {
        continue;
      }
      for (const [name, symbol_id] of context.exports.resolve_all_exports(
        source_file,
        context.languages,
        context.resolution
      )) {
        scope_resolutions.set(name, symbol_id);
      }
    }
  }

  // Names bound to a CommonJS default-export class by the import pass below; the
  // local-definition pass must not revert them to the raw import symbol.
  const require_default_rebinds = new Set<SymbolName>();

  for (const imp_def of import_defs) {
    let resolved: SymbolId | null = null;

    // Wildcard surfaces are layered above; the wildcard's own name never binds.
    if (imp_def.import_kind === "wildcard") {
      continue;
    }

    if (imp_def.import_kind === "namespace") {
      resolved = imp_def.symbol_id;

      // @language javascript
      // A CommonJS `const X = require('./mod')` binds the whole `module.exports`
      // value. When that module's sole export is a default class
      // (`module.exports = Class`), X *is* the class: rebind X to the class
      // symbol so static, instance, and constructor dispatch resolve through the
      // ordinary class machinery. An object module (`module.exports = { a, b }`)
      // has named exports and no sole default, so it stays a namespace import
      // and keeps its member-lookup dispatch. Gated to `require` so an ESM
      // `import * as X` — a genuine namespace object — is never rebound.
      if (imp_def.is_commonjs_require) {
        const source_file = context.imports.get_resolved_import_path(
          imp_def.symbol_id
        );
        if (source_file) {
          const sole_default = context.exports.resolve_sole_default_export(
            source_file,
            context.languages,
            context.resolution
          );
          if (
            sole_default &&
            context.definitions.get(sole_default)?.kind === "class"
          ) {
            resolved = sole_default;
            // `const X = require()` also surfaces `X` as a scope-level import
            // definition, so the local-definition pass below would otherwise
            // revert this rebind to the import symbol. Record the name to keep
            // the class binding.
            require_default_rebinds.add(imp_def.name);
          }
        }
      }
    } else {
      const source_file = context.imports.get_resolved_import_path(
        imp_def.symbol_id
      );

      if (!source_file) {
        continue;
      }

      // Aliased imports carry the source-module name in original_name.
      const import_name = (imp_def.original_name ||
        imp_def.name) as SymbolName;

      resolved = context.exports.resolve_export_chain(
        source_file,
        import_name,
        imp_def.import_kind,
        context.languages,
        context.resolution
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

    // When the export chain yields nothing, the imported name may name a
    // submodule file rather than an exported symbol — Python
    // `from pkg import mod`, Rust `use crate::parent::child`.
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
    // Preserve a CommonJS `const X = require()` rebind to the default-export
    // class over the same-named import definition in this scope.
    if (require_default_rebinds.has(name)) {
      continue;
    }
    scope_resolutions.set(name, symbol_id);
  }

  // @language javascript,rust
  // Hoist function declarations out of descendant block scopes.
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

  result.resolutions_by_scope.set(scope_id, scope_resolutions);
  result.scope_to_file.set(scope_id, file_path);

  const scope = context.scopes.get_scope(scope_id);
  if (scope && scope.child_ids) {
    for (const child_id of scope.child_ids) {
      const child_result = resolve_scope_recursive(
        child_id,
        scope_resolutions,
        file_path,
        context
      );

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

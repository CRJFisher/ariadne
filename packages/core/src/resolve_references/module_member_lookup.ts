import type { SymbolId, SymbolName, FilePath, Language, ScopeId } from "@ariadnejs/types";
import type { DefinitionRegistry } from "./registries/definition";
import type { ExportRegistry } from "./registries/export";
import type { ModuleResolutionContext } from "./import_resolution";

/**
 * Resolve a member a module provides — reached as `ns.member` through a
 * namespace import, as `import { member }` / `from m import member` through a
 * named or default one, or as `new ns.Member()` — to the definition the module
 * ultimately holds for it.
 *
 * One lookup serves every import form, so the answer never depends on which
 * form named the member. Two tiers: the export chain, followed through
 * re-exports and wildcard edges (`export * from`, `pub use m::*`, a Python
 * star import) to the terminal definition; then a definition at the module's
 * own top level — an exported one in a language with export markers, any one
 * in Python, which has none, so `ns._private()` and an explicitly imported
 * `_private` name are the real edges they are.
 */
export function resolve_module_member(
  source_file: FilePath,
  name: SymbolName,
  import_kind: "named" | "default" | "namespace",
  exports: ExportRegistry,
  definitions: DefinitionRegistry,
  languages: ReadonlyMap<FilePath, Language>,
  modules: ModuleResolutionContext
): SymbolId | null {
  const exported = exports.resolve_export_chain(
    source_file,
    name,
    import_kind,
    languages,
    modules
  );
  if (exported) {
    return exported;
  }
  // A module with no export marker — Python — provides every top-level name;
  // one with markers provides only what it exports.
  const every_top_level_name = languages.get(source_file) === "python";
  // Python rebinds a module-level name freely — a version guard, an `@overload`
  // group, a fallback reassignment — and the last binding is the one that
  // survives, the rule `DefinitionRegistry.by_scope` and `ExportRegistry` both
  // follow. So the scan runs to the end and the last match answers, rather than
  // stopping at a definition the module has already overwritten.
  let found: SymbolId | null = null;
  for (const def of definitions.get_exportable_definitions_in_file(source_file)) {
    // Re-exports were followed by the chain above; only a definition the
    // module itself makes in a module scope can answer here.
    if (def.kind === "import" || def.name !== name) continue;
    if (!is_module_scope(def.defining_scope_id)) continue;
    // The export surface keys a renamed export under its export name and a
    // default export in the default slot alone, so a definition the module does
    // not offer under `name` is not a member of it under that name.
    if (def.export?.is_default === true) {
      if (import_kind !== "default") continue;
    } else if (def.export?.export_name && def.export.export_name !== name) {
      continue;
    }
    if (def.is_exported || every_top_level_name) {
      found = def.symbol_id;
    }
  }
  return found;
}

/**
 * A scope id leads with its type, and a file's root scope is always a module
 * scope. The constraint is what keeps the Python "any top-level name" tier from
 * admitting a definition nested in a function or class body, which the module
 * offers under no name at all. A TypeScript `namespace` body is also a module
 * scope, but its members are recorded `is_exported: false` and never reach
 * here; `resolve_namespace_scope_member` serves those, against the namespace
 * the call actually addressed.
 */
function is_module_scope(scope_id: ScopeId): boolean {
  return scope_id.startsWith("module:");
}

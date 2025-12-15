/**
 * Registry Integration Test Helpers
 *
 * Helper functions specifically for registry integration tests.
 * Extends the base fixture helpers with registry-specific utilities.
 */

import type {
  FilePath,
  SymbolId,
  ScopeId,
  SymbolName,
  SymbolReference,
  Location,
  AnyDefinition,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../src/index_single_file/index_single_file";
import { DefinitionRegistry } from "../../src/resolve_references/registries/registries.definition";
import { TypeRegistry } from "../../src/resolve_references/registries/registries.type";
import { ScopeRegistry } from "../../src/resolve_references/registries/registries.scope";
import { ExportRegistry } from "../../src/resolve_references/registries/registries.export";
import { ResolutionRegistry } from "../../src/resolve_references/resolve_references";
import { ImportGraph } from "../../src/project/import_graph";
import { load_fixture } from "./fixture_helpers";

/**
 * Registry collection returned by build_registries
 */
export interface Registries {
  definitions: DefinitionRegistry;
  types: TypeRegistry;
  scopes: ScopeRegistry;
  exports: ExportRegistry;
  imports: ImportGraph;
  resolutions: ResolutionRegistry;
}

/**
 * Build all registries from semantic index fixtures
 *
 * This is the main helper for registry integration tests. It takes one or more
 * semantic indexes (usually loaded from JSON fixtures) and builds all the
 * registries needed for resolution.
 *
 * @example
 * ```typescript
 * const utils = load_fixture("typescript/integration/utils.json");
 * const main = load_fixture("typescript/integration/main_uses_types.json");
 *
 * const { definitions, types, resolutions } = build_registries([utils, main]);
 *
 * const helper = find_definition_in_scope(definitions, utils.root_scope_id, "helper");
 * ```
 *
 * @param indices - Array of SemanticIndex objects (from fixtures)
 * @returns Object containing all registries
 */
export function build_registries(indices: SemanticIndex[]): Registries {
  const definitions = new DefinitionRegistry();
  const types = new TypeRegistry();
  const scopes = new ScopeRegistry();
  const exports = new ExportRegistry();
  const imports = new ImportGraph();
  const resolutions = new ResolutionRegistry();

  // Populate registries from each index
  for (const index of indices) {
    const file_path = index.file_path;

    // Collect all definitions
    const all_definitions: AnyDefinition[] = [
      ...Array.from(index.functions.values()),
      ...Array.from(index.classes.values()),
      ...Array.from(index.variables.values()),
      ...Array.from(index.interfaces.values()),
      ...Array.from(index.enums.values()),
      ...Array.from(index.namespaces.values()),
      ...Array.from(index.types.values()),
      ...Array.from(index.imported_symbols.values()),
    ];

    // Update registries
    definitions.update_file(file_path, all_definitions);
    types.update_file(file_path, index, definitions, resolutions);
    scopes.update_file(file_path, index.scopes);
    exports.update_file(file_path, definitions);

    // Update import graph (simplified for tests)
    const import_statements = extract_imports_from_index(index);
    imports.update_file(file_path, import_statements);
  }

  return { definitions, types, scopes, exports, imports, resolutions };
}

/**
 * Find a definition by name in a specific scope
 *
 * @example
 * ```typescript
 * const helper = find_definition_in_scope(definitions, utils.root_scope_id, "helper");
 * expect(helper).toBeDefined();
 * expect(helper.kind).toBe("function");
 * ```
 *
 * @param definitions - DefinitionRegistry to search
 * @param scope_id - Scope ID to search in
 * @param name - Symbol name to find
 * @returns Definition if found, undefined otherwise
 */
export function find_definition_in_scope(
  definitions: DefinitionRegistry,
  scope_id: ScopeId,
  name: SymbolName,
): AnyDefinition | undefined {
  const scope_defs = definitions.get_scope_definitions(scope_id);
  const symbol_id = scope_defs.get(name);
  if (!symbol_id) {
    return undefined;
  }
  return definitions.get(symbol_id);
}

/**
 * Find a reference by name in a semantic index
 *
 * Optionally filter by scope_id.
 *
 * @example
 * ```typescript
 * const call_ref = find_reference(main, "helper");
 * expect(call_ref).toBeDefined();
 * expect(call_ref.type).toBe("call");
 * ```
 *
 * @param index - SemanticIndex to search
 * @param name - Symbol name to find
 * @param scope_id - Optional scope ID to filter by
 * @returns SymbolReference if found, undefined otherwise
 */
export function find_reference(
  index: SemanticIndex,
  name: SymbolName,
  scope_id?: ScopeId,
): SymbolReference | undefined {
  return index.references.find(
    (r) => r.name === name && (!scope_id || r.scope_id === scope_id),
  );
}

/**
 * Find all references by name in a semantic index
 *
 * Returns all matching references, not just the first one.
 *
 * @param index - SemanticIndex to search
 * @param name - Symbol name to find
 * @param scope_id - Optional scope ID to filter by
 * @returns Array of matching SymbolReferences
 */
export function find_references(
  index: SemanticIndex,
  name: SymbolName,
  scope_id?: ScopeId,
): SymbolReference[] {
  return index.references.filter(
    (r) => r.name === name && (!scope_id || r.scope_id === scope_id),
  );
}

/**
 * Load fixture and build registries in one step
 *
 * Convenience function that combines fixture loading and registry building.
 *
 * @example
 * ```typescript
 * const { indices, registries } = load_and_build(
 *   "typescript/integration/utils.json",
 *   "typescript/integration/main_uses_types.json"
 * );
 *
 * const [utils, main] = indices;
 * const { definitions, resolutions } = registries;
 * ```
 *
 * @param fixture_paths - Paths to fixture files (relative to fixtures directory)
 * @returns Object with loaded indices and built registries
 */
export function load_and_build(
  ...fixture_paths: string[]
): { indices: SemanticIndex[]; registries: Registries } {
  const indices = fixture_paths.map(load_fixture);
  const registries = build_registries(indices);
  return { indices, registries };
}

/**
 * Extract Import[] from SemanticIndex
 * Helper for build_registries
 */
function extract_imports_from_index(index: SemanticIndex): any[] {
  const imports_by_source = new Map<FilePath, any>();

  // Get language from index, with fallback
  const language = index.language || "typescript";

  for (const imp_def of index.imported_symbols.values()) {
    let source_path = imp_def.import_path as string;

    // Basic path resolution (tests use simplified paths)
    if (source_path.startsWith("./")) {
      source_path = source_path.slice(2);
    }

    // Add extension if missing
    if (
      !source_path.includes(".") &&
      !source_path.startsWith("@") &&
      !source_path.includes("/node_modules/")
    ) {
      // Use actual extension from the index file path
      const ext = index.file_path.split(".").pop() || "ts";
      source_path = `${source_path}.${ext}`;
    }

    const source = source_path as FilePath;

    if (!imports_by_source.has(source)) {
      imports_by_source.set(source, {
        kind: "named",
        source,
        imports: [],
        location: imp_def.location,
        language: language, // Use the language from the index
        node_type: "import_statement",
        modifiers: [],
      });
    }
  }

  return Array.from(imports_by_source.values());
}

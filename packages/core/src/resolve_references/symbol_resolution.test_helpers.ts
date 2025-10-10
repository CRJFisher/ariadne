/**
 * Shared Test Utilities for Symbol Resolution Tests
 *
 * This file contains shared test helpers and utilities used across all
 * symbol resolution test files (TypeScript, JavaScript, Python, Rust, etc.)
 */

import type {
  FilePath,
  SymbolId,
  ScopeId,
  SymbolName,
  SymbolReference,
  LexicalScope,
  FunctionDefinition,
  ClassDefinition,
  VariableDefinition,
  ImportDefinition,
  TypeMemberInfo,
  ModulePath,
  LocationKey,
  InterfaceDefinition,
  EnumDefinition,
  NamespaceDefinition,
  TypeAliasDefinition,
  AnyDefinition,
  Location,
  DecoratorDefinition,
  SymbolKind,
  ExportableDefinition,
  ResolvedSymbols,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import { SemanticIndex } from "../index_single_file/semantic_index";
import type { FileSystemFolder } from "./types";
import { DefinitionRegistry } from "../project/definition_registry";
import { TypeRegistry } from "../project/type_registry";
import { ScopeRegistry } from "../project/scope_registry";
import { ExportRegistry } from "../project/export_registry";
import { ImportGraph } from "../project/import_graph";
import { resolve_symbols } from "./symbol_resolution";

// ============================================================================
// Test Helper: Create Semantic Index with Smart Defaults
// ============================================================================
//
// This helper provides a declarative API for creating test indices with minimal boilerplate.
// Instead of manually constructing full Maps of definitions with all required fields,
// tests can specify only the essential information using simple specs:
//
// Example - Before refactoring:
//   classes: new Map([[id, { kind: "class", symbol_id: id, name, defining_scope_id,
//     location: { file_path, start_line, start_column, end_line, end_column },
//     methods: [], properties: [], extends: [], decorators: [], constructor: [], is_exported: false }]])
//
// Example - After refactoring:
//   classes: [{ id, name, scope, location: { line: 1, col: 0 } }]
//
// Benefits:
// - 80-90% reduction in test setup code
// - Sensible defaults for all optional fields
// - Automatic creation of module scope if not specified
// - Automatic type_members generation for classes/interfaces with methods
// - Automatic type_bindings generation for variables with type_binding specified
//

export type TestClassSpec = {
  id: SymbolId;
  name: SymbolName;
  scope: ScopeId;
  location?: { line: number; col: number; end_line?: number; end_col?: number };
  methods?: Array<{
    id: SymbolId;
    name: SymbolName;
    location?: {
      line: number;
      col: number;
      end_line?: number;
      end_col?: number;
    };
  }>;
  properties?: Array<{
    symbol_id: SymbolId;
    name: SymbolName;
    kind: "property";
    location: Location;
    decorators: DecoratorDefinition[];
    type: SymbolName;
    initial_value: string;
    defining_scope_id: ScopeId;
    is_exported: boolean;
  }>;
  is_exported?: boolean;
};

export type TestFunctionSpec = {
  id: SymbolId;
  name: SymbolName;
  scope: ScopeId;
  location?: { line: number; col: number; end_line?: number; end_col?: number };
  is_exported?: boolean;
};

export type TestVariableSpec = {
  id: SymbolId;
  name: SymbolName;
  scope: ScopeId;
  location?: { line: number; col: number; end_line?: number; end_col?: number };
  type_binding?: SymbolName;
  is_exported?: boolean;
};

export type TestImportSpec = {
  id: SymbolId;
  name: SymbolName;
  import_path: ModulePath;
  scope: ScopeId;
  location?: { line: number; col: number };
  import_kind?: "named" | "default" | "namespace";
};

export type TestInterfaceSpec = {
  id: SymbolId;
  name: SymbolName;
  scope: ScopeId;
  location?: { line: number; col: number; end_line?: number; end_col?: number };
  methods?: Array<{
    id: SymbolId;
    name: SymbolName;
    location?: {
      line: number;
      col: number;
      end_line?: number;
      end_col?: number;
    };
  }>;
  is_exported?: boolean;
};

export type TestScopeSpec = {
  id: ScopeId;
  type?: "module" | "function" | "class" | "block";
  parent?: ScopeId | null;
  name?: SymbolName | null;
  location?: { line: number; col: number; end_line?: number; end_col?: number };
  children?: ScopeId[];
};

/**
 * Infer language from file path extension
 */
function infer_language_from_path(
  file_path: FilePath,
): "typescript" | "javascript" | "python" | "rust" {
  if (file_path.endsWith(".py")) {
    return "python";
  } else if (file_path.endsWith(".rs")) {
    return "rust";
  } else if (
    file_path.endsWith(".js") ||
    file_path.endsWith(".jsx") ||
    file_path.endsWith(".mjs") ||
    file_path.endsWith(".cjs")
  ) {
    return "javascript";
  } else {
    // Default to TypeScript for .ts, .tsx, and unknown extensions
    return "typescript";
  }
}

/**
 * Build scope_to_definitions map from all definitions
 * Mimics the behavior of build_scope_to_definitions in semantic_index.ts
 */
function build_test_scope_to_definitions(definitions: {
  functions: Map<SymbolId, FunctionDefinition>;
  classes: Map<SymbolId, ClassDefinition>;
  variables: Map<SymbolId, VariableDefinition>;
  interfaces: Map<SymbolId, InterfaceDefinition>;
  imports: Map<SymbolId, ImportDefinition>;
  enums: Map<SymbolId, EnumDefinition>;
  namespaces: Map<SymbolId, NamespaceDefinition>;
  types: Map<SymbolId, TypeAliasDefinition>;
}): Map<ScopeId, Map<SymbolKind, AnyDefinition[]>> {
  const index = new Map<ScopeId, Map<SymbolKind, AnyDefinition[]>>();

  const add_to_index = (def: AnyDefinition) => {
    // Ensure scope map exists
    if (!index.has(def.defining_scope_id)) {
      index.set(def.defining_scope_id, new Map());
    }

    const scope_map = index.get(def.defining_scope_id)!;
    const existing = scope_map.get(def.kind) || [];
    existing.push(def);
    scope_map.set(def.kind, existing);
  };

  // Add all definition types
  definitions.functions.forEach(add_to_index);
  definitions.classes.forEach(add_to_index);
  definitions.variables.forEach(add_to_index);
  definitions.interfaces.forEach(add_to_index);
  definitions.enums.forEach(add_to_index);
  definitions.namespaces.forEach(add_to_index);
  definitions.types.forEach(add_to_index);
  definitions.imports.forEach(add_to_index);

  return index;
}

/**
 * Build exported symbols map from definitions with is_exported: true
 * Mimics the behavior of build_exported_symbols_map in semantic_index.ts
 */
function build_test_exported_symbols_map(definitions: {
  functions: Map<SymbolId, FunctionDefinition>;
  classes: Map<SymbolId, ClassDefinition>;
  variables: Map<SymbolId, VariableDefinition>;
  interfaces: Map<SymbolId, InterfaceDefinition>;
  enums: Map<SymbolId, EnumDefinition>;
  namespaces: Map<SymbolId, NamespaceDefinition>;
  types: Map<SymbolId, TypeAliasDefinition>;
  imports?: Map<SymbolId, ImportDefinition>;
}): Map<SymbolName, ExportableDefinition> {
  const map = new Map<SymbolName, ExportableDefinition>();

  const add_to_map = (def: ExportableDefinition) => {
    // Only add exported symbols
    if (!("is_exported" in def) || !def.is_exported) {
      return;
    }

    // Get the effective export name (alias or original name)
    const export_name =
      ("export" in def && def.export?.export_name) || def.name;

    map.set(export_name, def);
  };

  // Add all exportable definition types
  definitions.functions.forEach(add_to_map);
  definitions.classes.forEach(add_to_map);
  definitions.variables.forEach(add_to_map);
  definitions.interfaces.forEach(add_to_map);
  definitions.enums.forEach(add_to_map);
  definitions.namespaces.forEach(add_to_map);
  definitions.types.forEach(add_to_map);
  // Add re-exported imports
  if (definitions.imports) {
    definitions.imports.forEach(add_to_map);
  }

  return map;
}

export function create_test_index(
  file_path: FilePath,
  options: {
    // High-level specs that auto-generate full definitions
    classes?: TestClassSpec[];
    functions?: TestFunctionSpec[];
    variables?: TestVariableSpec[];
    imports?: TestImportSpec[];
    interfaces?: TestInterfaceSpec[];
    scopes?: TestScopeSpec[];
    references?: SymbolReference[];
    exported_symbols?: Map<SymbolName, ExportableDefinition>;

    // Low-level overrides for full control
    functions_raw?: Map<SymbolId, FunctionDefinition>;
    classes_raw?: Map<SymbolId, ClassDefinition>;
    variables_raw?: Map<SymbolId, VariableDefinition>;
    interfaces_raw?: Map<SymbolId, InterfaceDefinition>;
    scopes_raw?: Map<ScopeId, LexicalScope>;
    imports_raw?: Map<SymbolId, ImportDefinition>;
    type_bindings_raw?: Map<LocationKey, SymbolName>;
    type_members_raw?: Map<SymbolId, TypeMemberInfo>;
    scope_to_definitions_raw?: Map<
      ScopeId,
      ReadonlyMap<SymbolKind, AnyDefinition[]>
    >;

    // Misc options
    language?: "typescript" | "javascript" | "python" | "rust";
    root_scope_id?: ScopeId;
  } = {},
): SemanticIndex {
  // Infer language from file extension if not explicitly provided
  const language = options.language || infer_language_from_path(file_path);
  const root_scope_id =
    options.root_scope_id || (`scope:${file_path}:module` as ScopeId);

  // Build scopes from specs
  const scopes = options.scopes_raw || new Map<ScopeId, LexicalScope>();
  if (options.scopes) {
    for (const spec of options.scopes) {
      const loc = spec.location || {
        line: 1,
        col: 0,
        end_line: 100,
        end_col: 0,
      };
      scopes.set(spec.id, {
        id: spec.id,
        type: spec.type || "module",
        parent_id: spec.parent !== undefined ? spec.parent : null,
        name: spec.name !== undefined ? spec.name : null,
        location: {
          file_path,
          start_line: loc.line,
          start_column: loc.col,
          end_line: loc.end_line || loc.line + 10,
          end_column: loc.end_col || 100,
        },
        child_ids: spec.children || [],
      });
    }
  }

  // Ensure root scope exists
  if (!scopes.has(root_scope_id)) {
    scopes.set(root_scope_id, {
      id: root_scope_id,
      type: "module",
      parent_id: null,
      name: null,
      location: {
        file_path,
        start_line: 1,
        start_column: 0,
        end_line: 100,
        end_column: 0,
      },
      child_ids: [],
    });
  }

  // Build classes from specs
  const classes = options.classes_raw || new Map<SymbolId, ClassDefinition>();
  const type_members =
    options.type_members_raw || new Map<SymbolId, TypeMemberInfo>();

  if (options.classes) {
    for (const spec of options.classes) {
      const loc = spec.location || {
        line: 1,
        col: 0,
        end_line: 1,
        end_col: 50,
      };
      const methods =
        spec.methods?.map((m) => {
          const mloc = m.location || {
            line: loc.line,
            col: loc.col + 10,
            end_line: loc.line,
            end_col: loc.col + 40,
          };
          return {
            kind: "method" as const,
            is_exported: false,
            symbol_id: m.id,
            name: m.name,
            defining_scope_id: spec.scope,
            location: {
              file_path,
              start_line: mloc.line,
              start_column: mloc.col,
              end_line: mloc.end_line || mloc.line,
              end_column: mloc.end_col || mloc.col + 30,
            },
            parameters: [],
            parent_class: spec.id,
            body_scope_id: `test:method:scope:${m.name}` as any,
          };
        }) || [];

      classes.set(spec.id, {
        kind: "class",
        symbol_id: spec.id,
        name: spec.name,
        defining_scope_id: spec.scope,
        location: {
          file_path,
          start_line: loc.line,
          start_column: loc.col,
          end_line: loc.end_line || loc.line,
          end_column: loc.end_col || loc.col + 50,
        },
        methods,
        properties: spec.properties || [],
        extends: [],
        decorators: [],
        constructor: [],
        is_exported: spec.is_exported || false,
      });

      // Build type members
      const method_map = new Map<SymbolName, SymbolId>();
      for (const method of methods) {
        method_map.set(method.name, method.symbol_id);
      }
      type_members.set(spec.id, {
        methods: method_map,
        properties: new Map(),
        constructor: undefined,
        extends: [],
      });
    }
  }

  // Build functions from specs
  const functions =
    options.functions_raw || new Map<SymbolId, FunctionDefinition>();
  if (options.functions) {
    for (const spec of options.functions) {
      const loc = spec.location || {
        line: 1,
        col: 0,
        end_line: 1,
        end_col: 40,
      };
      functions.set(spec.id, {
        kind: "function",
        symbol_id: spec.id,
        name: spec.name,
        defining_scope_id: spec.scope,
        location: {
          file_path,
          start_line: loc.line,
          start_column: loc.col,
          end_line: loc.end_line || loc.line,
          end_column: loc.end_col || loc.col + 40,
        },
        signature: { parameters: [] },
        is_exported: spec.is_exported || false,
        body_scope_id: `test:function:scope:${spec.name}` as any,
      });
    }
  }

  // Build variables from specs
  const variables =
    options.variables_raw || new Map<SymbolId, VariableDefinition>();
  const type_bindings =
    options.type_bindings_raw || new Map<LocationKey, SymbolName>();

  if (options.variables) {
    for (const spec of options.variables) {
      const loc = spec.location || {
        line: 1,
        col: 0,
        end_line: 1,
        end_col: 10,
      };
      const var_location = {
        file_path,
        start_line: loc.line,
        start_column: loc.col,
        end_line: loc.end_line || loc.line,
        end_column: loc.end_col || loc.col + 10,
      };

      variables.set(spec.id, {
        kind: "variable",
        symbol_id: spec.id,
        name: spec.name,
        defining_scope_id: spec.scope,
        location: var_location,
        is_exported: spec.is_exported || false,
      });

      if (spec.type_binding) {
        type_bindings.set(location_key(var_location), spec.type_binding);
      }
    }
  }

  // Build imports from specs
  const imports = options.imports_raw || new Map<SymbolId, ImportDefinition>();
  if (options.imports) {
    for (const spec of options.imports) {
      const loc = spec.location || { line: 1, col: 9 };
      imports.set(spec.id, {
        kind: "import",
        symbol_id: spec.id,
        name: spec.name,
        defining_scope_id: spec.scope,
        location: {
          file_path,
          start_line: loc.line,
          start_column: loc.col,
          end_line: loc.line,
          end_column: loc.col + spec.name.length,
        },
        import_path: spec.import_path,
        import_kind: spec.import_kind || "named",
        original_name: undefined,
      });
    }
  }

  // Build interfaces from specs
  const interfaces =
    options.interfaces_raw || new Map<SymbolId, InterfaceDefinition>();
  if (options.interfaces) {
    for (const spec of options.interfaces) {
      const loc = spec.location || {
        line: 1,
        col: 0,
        end_line: 1,
        end_col: 50,
      };
      const methods =
        spec.methods?.map((m) => {
          const mloc = m.location || {
            line: loc.line,
            col: loc.col + 20,
            end_line: loc.line,
            end_col: loc.col + 40,
          };
          return {
            kind: "method" as const,
            is_exported: false,
            symbol_id: m.id,
            name: m.name,
            defining_scope_id: spec.scope,
            location: {
              file_path,
              start_line: mloc.line,
              start_column: mloc.col,
              end_line: mloc.end_line || mloc.line,
              end_column: mloc.end_col || mloc.col + 20,
            },
            parameters: [],
            parent_class: spec.id,
            body_scope_id: `test:method:scope:${m.name}` as any,
          };
        }) || [];

      interfaces.set(spec.id, {
        kind: "interface",
        symbol_id: spec.id,
        name: spec.name,
        defining_scope_id: spec.scope,
        location: {
          file_path,
          start_line: loc.line,
          start_column: loc.col,
          end_line: loc.end_line || loc.line,
          end_column: loc.end_col || loc.col + 50,
        },
        methods,
        properties: [],
        extends: [],
        is_exported: spec.is_exported || false,
      });

      // Build type members for interface
      const method_map = new Map<SymbolName, SymbolId>();
      for (const method of methods) {
        method_map.set(method.name, method.symbol_id);
      }
      type_members.set(spec.id, {
        methods: method_map,
        properties: new Map(),
        constructor: undefined,
        extends: [],
      });
    }
  }

  // Build exported_symbols map automatically if not provided
  const exported_symbols =
    options.exported_symbols ||
    build_test_exported_symbols_map({
      functions,
      classes,
      variables,
      interfaces,
      enums: new Map(),
      namespaces: new Map(),
      types: new Map(),
      imports,
    });

  // Build scope_to_definitions map automatically if not provided
  const scope_to_definitions =
    options.scope_to_definitions_raw ||
    build_test_scope_to_definitions({
      functions,
      classes,
      variables,
      interfaces,
      imports,
      enums: new Map(),
      namespaces: new Map(),
      types: new Map(),
    });

  return {
    file_path,
    language,
    root_scope_id,
    scopes,
    functions,
    classes,
    variables,
    interfaces,
    enums: new Map(),
    namespaces: new Map(),
    types: new Map(),
    imported_symbols: imports,
    exported_symbols,
    references: options.references || [],
    scope_to_definitions,
    type_bindings,
    type_members,
    type_alias_metadata: new Map(),
  };
}
/**
 * Build file system tree from a list of file paths
 *
 * Constructs a FileSystemFolder tree structure from an array of absolute file paths.
 * This helper is primarily used in tests to create the root_folder parameter required
 * by resolve_symbols().
 *
 * @param file_paths - Array of absolute file paths
 * @returns Root of the file system tree
 *
 * @example
 * ```typescript
 * const file_paths = [
 *   '/tmp/ariadne-test/utils.ts' as FilePath,
 *   '/tmp/ariadne-test/main.ts' as FilePath,
 *   '/tmp/ariadne-test/nested/helper.ts' as FilePath
 * ];
 *
 * const root_folder = build_file_tree(file_paths);
 * // Creates tree:
 * // /
 * //   tmp/
 *  //     ariadne-test/
 * //       - utils.ts
 * //       - main.ts
 * //       nested/
 * //         - helper.ts
 * ```
 */

export function build_file_tree(file_paths: FilePath[]): FileSystemFolder {
  // Start with root folder
  const root: FileSystemFolder = {
    path: "/" as FilePath,
    folders: new Map(),
    files: new Set(),
  };

  for (const file_path of file_paths) {
    // Split path into parts, removing empty strings
    const parts = file_path.split("/").filter((p) => p);
    let current = root as any; // Need mutable version for building

    // Navigate/create folders for all parts except the last (which is the file)
    for (let i = 0; i < parts.length - 1; i++) {
      const folder_name = parts[i];
      if (!current.folders.has(folder_name)) {
        const folder_path = "/" + parts.slice(0, i + 1).join("/");
        const new_folder = {
          path: folder_path as FilePath,
          folders: new Map(),
          files: new Set(),
        };
        current.folders.set(folder_name, new_folder);
      }
      current = current.folders.get(folder_name);
    }

    // Add the file to the final folder
    const filename = parts[parts.length - 1];
    current.files.add(filename);
  }

  return root;
}

/**
 * Test helper to call resolve_symbols with registries
 *
 * This helper creates all necessary registries from semantic indices and calls
 * resolve_symbols with the new signature that accepts registry parameters.
 * It provides backwards compatibility for existing tests during the migration
 * to the Project coordination layer.
 *
 * @param indices - Map of file_path → SemanticIndex
 * @param root_folder - Root of the file system tree
 * @returns ResolvedSymbols from resolve_symbols
 */
export function resolve_symbols_with_registries(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  root_folder: FileSystemFolder,
): ResolvedSymbols {
  // Create registry instances
  const definitions = new DefinitionRegistry();
  const types = new TypeRegistry();
  const scopes = new ScopeRegistry();
  const exports = new ExportRegistry();
  const imports = new ImportGraph();

  // Populate registries from indices
  for (const [file_path, index] of indices) {
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

    // Update definition registry
    definitions.update_file(file_path, all_definitions);

    // Update type registry
    types.update_file(file_path, index);

    // Update scope registry
    scopes.update_file(file_path, index.scopes);

    // Update export registry
    const exported_symbol_ids = new Set(
      Array.from(index.exported_symbols.values()).map((def) => def.symbol_id),
    );
    exports.update_file(file_path, exported_symbol_ids);

    // Update import graph (simplified - extract from imported_symbols)
    const import_statements = extract_imports_from_imported_symbols(
      index.imported_symbols,
      file_path,
    );
    imports.update_file(file_path, import_statements);
  }

  // Call resolve_symbols with registries
  return resolve_symbols(
    indices,
    definitions,
    types,
    scopes,
    exports,
    imports,
    root_folder,
  );
}

/**
 * Extract Import[] from ImportDefinition map
 * Helper for resolve_symbols_with_registries
 */
function extract_imports_from_imported_symbols(
  imported_symbols: ReadonlyMap<SymbolId, ImportDefinition>,
  current_file: FilePath,
): any[] {
  const imports_by_source = new Map<FilePath, any>();

  for (const imp_def of imported_symbols.values()) {
    let source_path = imp_def.import_path as string;

    // Basic path resolution
    if (source_path.startsWith("./")) {
      source_path = source_path.slice(2);
    }

    if (
      !source_path.includes(".") &&
      !source_path.startsWith("@") &&
      !source_path.includes("/node_modules/")
    ) {
      const ext = current_file.split(".").pop() || "ts";
      source_path = `${source_path}.${ext}`;
    }

    const source = source_path as FilePath;

    if (!imports_by_source.has(source)) {
      imports_by_source.set(source, {
        kind: "named",
        source,
        imports: [],
        location: imp_def.location,
        language: "typescript",
        node_type: "import_statement",
        modifiers: [],
      });
    }
  }

  return Array.from(imports_by_source.values());
}

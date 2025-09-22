/**
 * Shared Test Utilities for Symbol Resolution
 *
 * Common test helpers and factories to eliminate duplication across
 * symbol resolution test files. Provides consistent test data creation
 * and assertion utilities.
 */

import type {
  FilePath,
  SymbolId,
  SymbolName,
  Location,
  Language,
  Import,
  Export,
  SymbolDefinition,
  NamedImport,
  DefaultImport,
  NamespaceImport,
  SideEffectImport,
  NamedExport,
  DefaultExport,
  NamespaceExport,
  ReExport,
  ScopeId,
  TypeId,
} from "@ariadnejs/types";
import {
  primitive_type_id,
  builtin_type_id,
  defined_type_id,
  TypeCategory,
  function_symbol,
  class_symbol,
  method_symbol,
  variable_symbol,
} from "@ariadnejs/types";
import { SemanticIndex } from "../semantic_index/semantic_index";
import type { CallReference } from "../semantic_index/references/call_references";
import type { LocalTypeInfo } from "../semantic_index/type_members";

// ============================================================================
// Basic Factories
// ============================================================================

/**
 * Create a test location with sensible defaults
 */
export function create_test_location(
  file_path: FilePath | string,
  line: number = 1,
  column: number = 0,
  end_line?: number,
  end_column?: number
): Location {
  return {
    file_path: file_path as FilePath,
    line,
    column,
    end_line: end_line ?? line,
    end_column: end_column ?? column + 10,
  };
}

/**
 * Create a test file path
 */
export function create_test_file_path(path: string): FilePath {
  return path as FilePath;
}

/**
 * Create a test symbol name
 */
export function create_test_symbol_name(name: string): SymbolName {
  return name as SymbolName;
}

/**
 * Create a test symbol ID using the proper factory functions
 */
export function create_test_symbol_id(
  kind: "function" | "class" | "method" | "variable",
  name: string,
  file: string = "test.ts",
  line: number = 1,
  column: number = 0
): SymbolId {
  const location = create_test_location(file, line, column);
  const symbol_name = create_test_symbol_name(name);

  switch (kind) {
    case "function":
      return function_symbol(symbol_name, location);
    case "class":
      return class_symbol(symbol_name, location);
    case "method":
      return method_symbol(symbol_name, "TestClass", location);
    case "variable":
      return variable_symbol(symbol_name, location);
    default:
      throw new Error(`Unknown symbol kind: ${kind}`);
  }
}

/**
 * Create a test scope ID
 */
export function create_test_scope_id(scope: string): ScopeId {
  return scope as ScopeId;
}

// ============================================================================
// Symbol Definition Factories
// ============================================================================

/**
 * Create a comprehensive symbol definition with sensible defaults
 */
export function create_test_symbol_definition(props: {
  id?: SymbolId;
  kind: string;
  name: string;
  file?: string;
  line?: number;
  column?: number;
  scope_id?: ScopeId;
  is_exported?: boolean;
  is_imported?: boolean;
  return_type_hint?: SymbolName;
  extends_class?: SymbolName;
  implements_interfaces?: readonly SymbolName[];
  members?: readonly SymbolId[];
  static_members?: readonly SymbolId[];
  is_static?: boolean;
}): SymbolDefinition {
  const location = create_test_location(
    props.file || "test.ts",
    props.line || 1,
    props.column || 0
  );

  const symbol_id = props.id || create_test_symbol_id(
    props.kind as any,
    props.name,
    props.file,
    props.line,
    props.column
  );

  return {
    id: symbol_id,
    kind: props.kind as any,
    name: create_test_symbol_name(props.name),
    location,
    scope_id: props.scope_id || create_test_scope_id("global"),
    is_hoisted: false,
    is_exported: props.is_exported || false,
    is_imported: props.is_imported || false,
    return_type_hint: props.return_type_hint,
    extends_class: props.extends_class,
    implements_interfaces: props.implements_interfaces,
    members: props.members,
    static_members: props.static_members,
    is_static: props.is_static,
  };
}

/**
 * Create a test function symbol
 */
export function create_test_function_symbol(
  name: string,
  file: string = "test.ts",
  return_type?: string,
  is_exported: boolean = false
): SymbolDefinition {
  return create_test_symbol_definition({
    kind: "function",
    name,
    file,
    is_exported,
    return_type_hint: return_type as SymbolName,
  });
}

/**
 * Create a test class symbol
 */
export function create_test_class_symbol(
  name: string,
  file: string = "test.ts",
  extends_class?: string,
  implements_interfaces?: string[],
  members?: SymbolId[],
  is_exported: boolean = false
): SymbolDefinition {
  return create_test_symbol_definition({
    kind: "class",
    name,
    file,
    is_exported,
    extends_class: extends_class as SymbolName,
    implements_interfaces: implements_interfaces as SymbolName[],
    members,
  });
}

/**
 * Create a test method symbol
 */
export function create_test_method_symbol(
  name: string,
  class_name: string = "TestClass",
  file: string = "test.ts",
  is_static: boolean = false,
  return_type?: string
): SymbolDefinition {
  return create_test_symbol_definition({
    kind: "method",
    name,
    file,
    is_static,
    return_type_hint: return_type as SymbolName,
  });
}

// ============================================================================
// Import/Export Factories
// ============================================================================

/**
 * Create a named import with sensible defaults
 */
export function create_test_named_import(
  name: string,
  source: string,
  alias?: string,
  file: string = "test.ts",
  language: Language = "typescript"
): NamedImport {
  return {
    kind: "named",
    imports: [{
      name: create_test_symbol_name(name),
      alias: alias ? create_test_symbol_name(alias) : undefined,
      is_type_only: false,
    }],
    source: create_test_file_path(source),
    location: create_test_location(file),
    modifiers: [],
    language,
    node_type: "import_statement",
  };
}

/**
 * Create a default import
 */
export function create_test_default_import(
  name: string,
  source: string,
  file: string = "test.ts",
  language: Language = "typescript"
): DefaultImport {
  return {
    kind: "default",
    name: create_test_symbol_name(name),
    source: create_test_file_path(source),
    location: create_test_location(file),
    modifiers: [],
    language,
    node_type: "import_statement",
  };
}

/**
 * Create a namespace import
 */
export function create_test_namespace_import(
  namespace_name: string,
  source: string,
  file: string = "test.ts",
  language: Language = "typescript"
): NamespaceImport {
  return {
    kind: "namespace",
    namespace_name: namespace_name as any,
    source: create_test_file_path(source),
    location: create_test_location(file),
    modifiers: [],
    language,
    node_type: "import_statement",
  };
}

/**
 * Create a side-effect import
 */
export function create_test_side_effect_import(
  source: string,
  file: string = "test.ts",
  language: Language = "typescript"
): SideEffectImport {
  return {
    kind: "side_effect",
    source: create_test_file_path(source),
    location: create_test_location(file),
    modifiers: [],
    language,
    node_type: "import_statement",
  };
}

/**
 * Create a named export
 */
export function create_test_named_export(
  local_name: string,
  export_name?: string,
  symbol_id?: SymbolId,
  file: string = "test.ts",
  language: Language = "typescript"
): NamedExport {
  return {
    kind: "named",
    symbol: symbol_id || create_test_symbol_id("function", local_name, file),
    symbol_name: create_test_symbol_name(local_name),
    location: create_test_location(file),
    exports: [{
      local_name: create_test_symbol_name(local_name),
      export_name: export_name ? create_test_symbol_name(export_name) : create_test_symbol_name(local_name),
      is_type_only: false,
    }],
    modifiers: [],
    language,
    node_type: "export_statement",
  };
}

/**
 * Create a default export
 */
export function create_test_default_export(
  name: string,
  symbol_id?: SymbolId,
  file: string = "test.ts",
  language: Language = "typescript",
  is_declaration: boolean = false
): DefaultExport {
  return {
    kind: "default",
    symbol: symbol_id || create_test_symbol_id("class", name, file),
    symbol_name: create_test_symbol_name(name),
    location: create_test_location(file),
    is_declaration,
    modifiers: [],
    language,
    node_type: "export_statement",
  };
}

// ============================================================================
// Semantic Index Factories
// ============================================================================

/**
 * Create a semantic index with all optional fields
 */
export function create_test_semantic_index(props: {
  file_path: string;
  language: Language;
  imports?: Import[];
  exports?: Export[];
  symbols?: Map<SymbolId, SymbolDefinition>;
  calls?: CallReference[];
  local_types?: LocalTypeInfo[];
}): SemanticIndex {
  return {
    file_path: create_test_file_path(props.file_path),
    language: props.language,
    imports: props.imports || [],
    exports: props.exports || [],
    symbols: props.symbols || new Map(),
    scopes: new Map() as ReadonlyMap<ScopeId, LexicalScope>,
    references: {
      calls: props.calls || [],
      member_accesses: [],
      returns: [],
      type_annotations: [],
    },
    local_types: props.local_types || [],
  };
}

/**
 * Create a simple JavaScript/TypeScript file index
 */
export function create_test_js_file(
  file_path: string,
  exports: string[] = [],
  imports: Array<{ name: string; source: string; alias?: string }> = [],
  functions: string[] = []
): SemanticIndex {
  const symbols = new Map<SymbolId, SymbolDefinition>();

  // Add function symbols
  functions.forEach(func_name => {
    const symbol = create_test_function_symbol(func_name, file_path, undefined, exports.includes(func_name));
    symbols.set(symbol.id, symbol);
  });

  // Add export symbols if not already added
  exports.forEach(export_name => {
    if (!functions.includes(export_name)) {
      const symbol = create_test_function_symbol(export_name, file_path, undefined, true);
      symbols.set(symbol.id, symbol);
    }
  });

  const export_list = exports.map(name =>
    create_test_named_export(name, name, Array.from(symbols.values()).find(s => s.name === name)?.id, file_path)
  );

  const import_list = imports.map(imp =>
    create_test_named_import(imp.name, imp.source, imp.alias, file_path)
  );

  return create_test_semantic_index({
    file_path,
    language: file_path.endsWith(".ts") ? "typescript" : "javascript",
    imports: import_list,
    exports: export_list,
    symbols,
  });
}

/**
 * Create a simple Python file index
 */
export function create_test_python_file(
  file_path: string,
  exports: string[] = [],
  imports: Array<{ name: string; source: string }> = [],
  functions: string[] = []
): SemanticIndex {
  const symbols = new Map<SymbolId, SymbolDefinition>();

  functions.forEach(func_name => {
    const symbol = create_test_function_symbol(func_name, file_path, undefined, exports.includes(func_name));
    symbols.set(symbol.id, symbol);
  });

  const export_list = exports.map(name =>
    create_test_named_export(name, name, Array.from(symbols.values()).find(s => s.name === name)?.id, file_path, "python")
  );

  const import_list = imports.map(imp =>
    create_test_named_import(imp.name, imp.source, undefined, file_path, "python")
  );

  return create_test_semantic_index({
    file_path,
    language: "python",
    imports: import_list,
    exports: export_list,
    symbols,
  });
}

/**
 * Create a simple Rust file index
 */
export function create_test_rust_file(
  file_path: string,
  exports: string[] = [],
  imports: Array<{ name: string; source: string }> = [],
  functions: string[] = []
): SemanticIndex {
  const symbols = new Map<SymbolId, SymbolDefinition>();

  functions.forEach(func_name => {
    const symbol = create_test_function_symbol(func_name, file_path, undefined, exports.includes(func_name));
    symbols.set(symbol.id, symbol);
  });

  const export_list = exports.map(name =>
    create_test_named_export(name, name, Array.from(symbols.values()).find(s => s.name === name)?.id, file_path, "rust")
  );

  const import_list = imports.map(imp =>
    create_test_named_import(imp.name, imp.source, undefined, file_path, "rust")
  );

  return create_test_semantic_index({
    file_path,
    language: "rust",
    imports: import_list,
    exports: export_list,
    symbols,
  });
}

// ============================================================================
// Type System Factories
// ============================================================================

/**
 * Create a test type ID
 */
export function create_test_type_id(
  category: "primitive" | "builtin" | "class" | "interface",
  name: string,
  file?: string
): TypeId {
  switch (category) {
    case "primitive":
      return primitive_type_id(name as any);
    case "builtin":
      return builtin_type_id(name as any);
    case "class":
      return defined_type_id(TypeCategory.CLASS, name as SymbolName, create_test_location(file || "test.ts"));
    case "interface":
      return defined_type_id(TypeCategory.INTERFACE, name as SymbolName, create_test_location(file || "test.ts"));
    default:
      throw new Error(`Unknown type category: ${category}`);
  }
}

// ============================================================================
// Project Factories
// ============================================================================

/**
 * Create a simple multi-file project for testing
 */
export function create_test_project(files: Array<{
  path: string;
  language: Language;
  exports?: string[];
  imports?: Array<{ name: string; source: string; alias?: string }>;
  functions?: string[];
}>): Map<FilePath, SemanticIndex> {
  const indices = new Map<FilePath, SemanticIndex>();

  files.forEach(file => {
    let index: SemanticIndex;

    switch (file.language) {
      case "javascript":
      case "typescript":
        index = create_test_js_file(
          file.path,
          file.exports,
          file.imports,
          file.functions
        );
        break;
      case "python":
        index = create_test_python_file(
          file.path,
          file.exports,
          file.imports || [],
          file.functions
        );
        break;
      case "rust":
        index = create_test_rust_file(
          file.path,
          file.exports,
          file.imports || [],
          file.functions
        );
        break;
      default:
        throw new Error(`Unsupported language: ${file.language}`);
    }

    indices.set(index.file_path, index);
  });

  return indices;
}

/**
 * Create a cross-language project for integration testing
 */
export function create_test_cross_language_project(): Map<FilePath, SemanticIndex> {
  return create_test_project([
    {
      path: "src/utils.js",
      language: "javascript",
      exports: ["processData", "formatOutput"],
      functions: ["processData", "formatOutput"],
    },
    {
      path: "src/main.ts",
      language: "typescript",
      imports: [
        { name: "processData", source: "./utils.js" },
        { name: "formatOutput", source: "./utils.js" },
      ],
      exports: ["Application"],
      functions: ["run"],
    },
    {
      path: "src/consumer.js",
      language: "javascript",
      imports: [
        { name: "Application", source: "./main.ts" },
      ],
      functions: ["startApp"],
    },
    {
      path: "src/helpers.py",
      language: "python",
      exports: ["calculate", "validate"],
      functions: ["calculate", "validate"],
    },
    {
      path: "src/core.rs",
      language: "rust",
      exports: ["process", "transform"],
      functions: ["process", "transform"],
    },
  ]);
}

// ============================================================================
// Performance Testing Helpers
// ============================================================================

/**
 * Create a large project for performance testing
 */
export function create_test_large_project(
  file_count: number,
  functions_per_file: number = 5,
  interconnected: boolean = true
): Map<FilePath, SemanticIndex> {
  const indices = new Map<FilePath, SemanticIndex>();

  for (let i = 0; i < file_count; i++) {
    const file_path = `src/file${i}.ts`;
    const functions = Array.from({ length: functions_per_file }, (_, j) => `func${i}_${j}`);

    const imports = interconnected && i > 0 ? [
      { name: `func${i-1}_0`, source: `./file${i-1}.ts` }
    ] : [];

    const exports = functions.slice(0, Math.ceil(functions_per_file / 2)); // Export half

    const index = create_test_js_file(file_path, exports, imports, functions);
    indices.set(index.file_path, index);
  }

  return indices;
}

/**
 * Time a function execution
 */
export function time_execution<T>(fn: () => T): { result: T; duration: number } {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  return { result, duration: end - start };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that two maps have the same key-value pairs
 */
export function assert_maps_equal<K, V>(
  actual: Map<K, V>,
  expected: Map<K, V>,
  message?: string
): void {
  const prefix = message ? `${message}: ` : "";

  if (actual.size !== expected.size) {
    throw new Error(`${prefix}Map sizes differ. Expected ${expected.size}, got ${actual.size}`);
  }

  for (const [key, expectedValue] of expected) {
    if (!actual.has(key)) {
      throw new Error(`${prefix}Expected key ${String(key)} not found in actual map`);
    }

    const actualValue = actual.get(key);
    if (actualValue !== expectedValue) {
      throw new Error(`${prefix}Value mismatch for key ${String(key)}. Expected ${String(expectedValue)}, got ${String(actualValue)}`);
    }
  }
}

/**
 * Assert that a map contains specific key-value pairs
 */
export function assert_map_contains<K, V>(
  map: Map<K, V>,
  expected: Array<[K, V]>,
  message?: string
): void {
  const prefix = message ? `${message}: ` : "";

  for (const [key, value] of expected) {
    if (!map.has(key)) {
      throw new Error(`${prefix}Expected key ${String(key)} not found in map`);
    }

    const actualValue = map.get(key);
    if (actualValue !== value) {
      throw new Error(`${prefix}Value mismatch for key ${String(key)}. Expected ${String(value)}, got ${String(actualValue)}`);
    }
  }
}

/**
 * Assert that an array contains specific elements
 */
export function assert_array_contains<T>(
  array: T[],
  expected: T[],
  message?: string
): void {
  const prefix = message ? `${message}: ` : "";

  for (const item of expected) {
    if (!array.includes(item)) {
      throw new Error(`${prefix}Expected item ${String(item)} not found in array`);
    }
  }
}

/**
 * Create a minimal mock for file system operations
 */
export function create_fs_mock(existing_files: string[]) {
  return {
    existsSync: (path: string) => existing_files.includes(path),
    statSync: (path: string) => ({
      isFile: () => existing_files.includes(path),
      isDirectory: () => !existing_files.includes(path) && existing_files.some(f => f.startsWith(path + "/")),
    }),
  };
}
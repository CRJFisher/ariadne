/**
 * Test Mock Factories - Comprehensive mock data creation for symbol resolution tests
 *
 * This module provides factories to create mock SemanticIndex data and other structures
 * that match the actual implementation structure, solving ReadonlyMap mutation issues
 * and providing consistent test data across all symbol resolution tests.
 */

import type {
  FilePath,
  Language,
  SymbolId,
  SymbolDefinition,
  SymbolName,
  ScopeId,
  LexicalScope,
  Location,
  LocationKey,
  TypeId,
  Import,
  Export,
} from "@ariadnejs/types";
import {
  function_symbol,
  class_symbol,
  method_symbol,
  variable_symbol,
  property_symbol,
  location_key,
} from "@ariadnejs/types";
import type { SemanticIndex, ProjectSemanticIndex } from "../semantic_index/semantic_index";
import type { ProcessedReferences } from "../semantic_index/references";
import type { CallReference } from "../semantic_index/references/call_references";
import type { MemberAccessReference } from "../semantic_index/references/member_access_references";
import type { ReturnReference } from "../semantic_index/references/return_references";
import type { TypeAnnotationReference } from "../semantic_index/references/type_annotation_references/type_annotation_references";
import type { LocalTypeInfo } from "../semantic_index/type_members";
import type { LocalTypeAnnotation } from "../semantic_index/references/type_annotation_references";
import type { LocalTypeTracking } from "../semantic_index/references/type_tracking";
import type { LocalTypeFlowData } from "../semantic_index/references/type_flow_references";
import type {
  ResolutionInput,
  FunctionResolutionMap,
  TypeResolutionMap,
  MethodResolutionMap,
} from "./types";

// ============================================================================
// Location Helpers
// ============================================================================

/**
 * Create a Location object for testing
 */
export function mock_location(
  file_path: FilePath,
  line: number = 1,
  column: number = 0,
  end_line?: number,
  end_column?: number
): Location {
  return {
    file_path,
    line,
    column,
    end_line: end_line ?? line,
    end_column: end_column ?? column + 1,
  };
}

/**
 * Create a LocationKey for testing
 */
export function mock_location_key(
  file_path: FilePath,
  line: number = 1,
  column: number = 0
): LocationKey {
  return location_key(mock_location(file_path, line, column));
}

// ============================================================================
// Symbol Factories
// ============================================================================

/**
 * Create a mock SymbolDefinition for testing
 */
export function mock_symbol_definition(
  name: SymbolName,
  kind: SymbolDefinition["kind"],
  location: Location,
  options: Partial<SymbolDefinition> = {}
): SymbolDefinition {
  let symbol_id: SymbolId;

  switch (kind) {
    case "function":
      symbol_id = function_symbol(name, location);
      break;
    case "class":
      symbol_id = class_symbol(name, location);
      break;
    case "method":
      symbol_id = method_symbol(name, location);
      break;
    case "variable":
      symbol_id = variable_symbol(name, location);
      break;
    default:
      symbol_id = variable_symbol(name, location);
  }

  return {
    id: symbol_id,
    name,
    kind,
    location,
    scope_id: `scope:global:${location.file_path}:0:0` as ScopeId,
    is_hoisted: kind === "function",
    is_exported: false,
    is_imported: false,
    ...options,
  };
}

/**
 * Create a mock LexicalScope for testing
 */
export function mock_lexical_scope(
  scope_id: ScopeId,
  type: LexicalScope["type"],
  location: Location,
  options: Partial<LexicalScope> = {}
): LexicalScope {
  return {
    id: scope_id,
    parent_id: null,
    name: null,
    type,
    location,
    child_ids: [],
    symbols: new Map(),
    ...options,
  };
}

// ============================================================================
// Reference Factories
// ============================================================================

/**
 * Create a mock CallReference for testing
 */
export function mock_call_reference(
  name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  options: Partial<CallReference> = {}
): CallReference {
  return {
    name,
    location,
    scope_id,
    call_type: "function",
    ...options,
  } as CallReference;
}

/**
 * Create a mock MemberAccessReference for testing
 */
export function mock_member_access_reference(
  member_name: SymbolName,
  location: Location,
  scope_id: ScopeId,
  options: Partial<MemberAccessReference> = {}
): MemberAccessReference {
  return {
    member_name,
    location,
    scope_id,
    access_type: "property",
    object: {},
    is_optional_chain: false,
    ...options,
  } as MemberAccessReference;
}

/**
 * Create a mock ReturnReference for testing
 */
export function mock_return_reference(
  expression: string,
  location: Location,
  scope_id: ScopeId,
  function_scope_id: ScopeId,
  options: Partial<ReturnReference> = {}
): ReturnReference {
  return {
    expression,
    location,
    scope_id,
    function_scope_id,
    ...options,
  } as ReturnReference;
}

/**
 * Create a mock TypeAnnotationReference for testing
 */
export function mock_type_annotation_reference(
  annotation: string,
  location: Location,
  scope_id: ScopeId,
  options: Partial<TypeAnnotationReference> = {}
): TypeAnnotationReference {
  return {
    annotation,
    location,
    scope_id,
    language: "typescript",
    node_type: "type_annotation",
    modifiers: [],
    ...options,
  } as TypeAnnotationReference;
}

// ============================================================================
// Import/Export Factories
// ============================================================================

/**
 * Create a mock Import for testing
 */
export function mock_import(
  source: FilePath,
  location: Location,
  imports: Array<{ name: SymbolName; is_type_only: boolean }>,
  options: Partial<Import> = {}
): Import {
  return {
    kind: "named",
    source,
    location,
    imports,
    language: "typescript",
    node_type: "import_statement",
    modifiers: [],
    ...options,
  } as Import;
}

/**
 * Create a mock Export for testing
 */
export function mock_export(
  name: SymbolName,
  symbol: SymbolId,
  location: Location,
  options: Partial<Export> = {}
): Export {
  return {
    symbol,
    symbol_name: name,
    location,
    kind: "named",
    exports: [{ local_name: name, is_type_only: false }],
    language: "typescript",
    node_type: "export_statement",
    modifiers: [],
    ...options,
  } as Export;
}

// ============================================================================
// Type System Factories
// ============================================================================

/**
 * Create a mock LocalTypeInfo for testing
 */
export function mock_local_type_info(
  type_name: SymbolName,
  location: Location,
  options: Partial<LocalTypeInfo> = {}
): LocalTypeInfo {
  return {
    type_name,
    location,
    kind: "class",
    direct_members: new Map(),
    ...options,
  };
}

/**
 * Create a mock LocalTypeAnnotation for testing
 */
export function mock_local_type_annotation(
  annotation_text: string,
  location: Location,
  scope_id: ScopeId,
  annotates_location: Location,
  options: Partial<LocalTypeAnnotation> = {}
): LocalTypeAnnotation {
  return {
    annotation_text,
    location,
    scope_id,
    annotates_location,
    annotation_kind: "variable",
    ...options,
  };
}

/**
 * Create a mock LocalTypeTracking for testing
 */
export function mock_local_type_tracking(): LocalTypeTracking {
  return {
    annotations: [],
    declarations: [],
    assignments: [],
  };
}

/**
 * Create a mock LocalTypeFlowData for testing
 */
export function mock_local_type_flow(): LocalTypeFlowData {
  return {
    constructor_calls: [],
    assignments: [],
    returns: [],
    call_assignments: [],
  };
}

// ============================================================================
// SemanticIndex Factory
// ============================================================================

export interface SemanticIndexOptions {
  language?: Language;
  symbols?: Map<SymbolId, SymbolDefinition>;
  scopes?: Map<ScopeId, LexicalScope>;
  imports?: Import[];
  exports?: Export[];
  calls?: CallReference[];
  member_accesses?: MemberAccessReference[];
  returns?: ReturnReference[];
  type_annotations?: TypeAnnotationReference[];
  local_types?: LocalTypeInfo[];
  local_type_annotations?: LocalTypeAnnotation[];
  local_type_tracking?: LocalTypeTracking;
  local_type_flow?: LocalTypeFlowData;
  file_symbols_by_name?: Map<FilePath, Map<SymbolName, SymbolId>>;
}

/**
 * Create a comprehensive mock SemanticIndex for testing
 * This matches the exact structure from semantic_index.ts
 */
export function mock_semantic_index(
  file_path: FilePath,
  options: SemanticIndexOptions = {}
): SemanticIndex {
  const language = options.language || "typescript";
  const root_scope_id = `scope:global:${file_path}:0:0` as ScopeId;

  // Create default root scope
  const root_scope = mock_lexical_scope(
    root_scope_id,
    "module",
    mock_location(file_path, 0, 0)
  );

  const scopes = options.scopes || new Map([[root_scope_id, root_scope]]);
  const symbols = options.symbols || new Map();

  // Create ProcessedReferences that match the actual structure
  const references: ProcessedReferences = {
    calls: options.calls || [],
    member_accesses: options.member_accesses || [],
    returns: options.returns || [],
    type_annotations: options.type_annotations || [],
  };

  return {
    file_path,
    language,
    root_scope_id,
    scopes,
    symbols,
    references,
    imports: options.imports || [],
    exports: options.exports || [],
    file_symbols_by_name: options.file_symbols_by_name || new Map(),
    local_types: options.local_types || [],
    local_type_annotations: options.local_type_annotations || [],
    local_type_tracking: options.local_type_tracking || mock_local_type_tracking(),
    local_type_flow: options.local_type_flow || mock_local_type_flow(),
  };
}

// ============================================================================
// ProjectSemanticIndex Factory
// ============================================================================

/**
 * Create a mock ProjectSemanticIndex for testing
 */
export function mock_project_semantic_index(
  files: Map<FilePath, SemanticIndex>
): ProjectSemanticIndex {
  const global_symbols = new Map<SymbolId, SymbolDefinition>();
  const import_graph = new Map<FilePath, FilePath[]>();
  const export_graph = new Map<FilePath, Map<SymbolName, SymbolId>>();

  // Extract global symbols from exported symbols
  for (const [file_path, index] of files) {
    const file_exports = new Map<SymbolName, SymbolId>();

    for (const export_entry of index.exports) {
      file_exports.set(export_entry.symbol_name, export_entry.symbol);

      // Add to global symbols if it's exported
      const symbol = index.symbols.get(export_entry.symbol);
      if (symbol && symbol.is_exported) {
        global_symbols.set(symbol.id, symbol);
      }
    }

    export_graph.set(file_path, file_exports);

    // Build import graph
    const imported_files = index.imports.map((imp: Import) => imp.source);
    import_graph.set(file_path, imported_files);
  }

  return {
    files,
    global_symbols,
    import_graph,
    export_graph,
  };
}

// ============================================================================
// Resolution Result Factories
// ============================================================================

/**
 * Create a mock ResolutionInput for testing
 */
export function mock_resolution_input(
  files: Map<FilePath, SemanticIndex>
): ResolutionInput {
  return {
    indices: files,
  };
}

/**
 * Create an empty ImportResolutionMap for testing
 */
export function mock_import_resolution_map(): ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>> {
  return new Map();
}

/**
 * Create an empty FunctionResolutionMap for testing
 */
export function mock_function_resolution_map(): FunctionResolutionMap {
  return {
    function_calls: new Map(),
    calls_to_function: new Map(),
  };
}

/**
 * Create an empty TypeResolutionMap for testing
 */
export function mock_type_resolution_map(): TypeResolutionMap {
  return {
    symbol_types: new Map(),
    reference_types: new Map(),
    type_members: new Map(),
    constructors: new Map(),
    inheritance_hierarchy: new Map(),
    interface_implementations: new Map(),
  };
}

/**
 * Create an empty MethodResolutionMap for testing
 */
export function mock_method_resolution_map(): MethodResolutionMap {
  return {
    method_calls: new Map(),
    constructor_calls: new Map(),
    calls_to_method: new Map(),
  };
}

// ============================================================================
// ReadonlyMap/ReadonlySet Utilities
// ============================================================================

/**
 * Convert a mutable Map to ReadonlyMap for type safety in tests
 */
export function to_readonly_map<K, V>(map: Map<K, V>): ReadonlyMap<K, V> {
  return map as ReadonlyMap<K, V>;
}

/**
 * Convert a mutable Set to ReadonlySet for type safety in tests
 */
export function to_readonly_set<T>(set: Set<T>): ReadonlySet<T> {
  return set as ReadonlySet<T>;
}

/**
 * Create a ReadonlyMap from entries for testing
 */
export function readonly_map_from_entries<K, V>(entries: [K, V][]): ReadonlyMap<K, V> {
  const map = new Map<K, V>();
  for (const [key, value] of entries) {
    map.set(key, value);
  }
  return to_readonly_map(map);
}

/**
 * Create a ReadonlySet from items for testing
 */
export function readonly_set_from_items<T>(items: T[]): ReadonlySet<T> {
  const set = new Set<T>();
  for (const item of items) {
    set.add(item);
  }
  return to_readonly_set(set);
}

/**
 * Create a mutable builder for nested ReadonlyMap structures
 * Allows safe incremental building of complex map hierarchies
 */
export class ReadonlyMapBuilder<K, V> {
  private map = new Map<K, V>();

  set(key: K, value: V): this {
    this.map.set(key, value);
    return this;
  }

  build(): ReadonlyMap<K, V> {
    return to_readonly_map(this.map);
  }

  /**
   * Build and return the underlying mutable Map for interfaces that expect Map
   */
  build_mutable(): Map<K, V> {
    return this.map;
  }
}

/**
 * Create a builder for nested ReadonlyMap structures like Map<TypeId, ReadonlyMap<SymbolName, SymbolId>>
 */
export class NestedReadonlyMapBuilder<K, V1, V2> {
  private map = new Map<K, ReadonlyMap<V1, V2>>();

  set_nested(key: K, nested_entries: [V1, V2][]): this {
    const nested_map = readonly_map_from_entries(nested_entries);
    this.map.set(key, nested_map);
    return this;
  }

  set_nested_builder(key: K, builder: ReadonlyMapBuilder<V1, V2>): this {
    this.map.set(key, builder.build());
    return this;
  }

  build(): ReadonlyMap<K, ReadonlyMap<V1, V2>> {
    return to_readonly_map(this.map);
  }

  /**
   * Build as Map<K, Map<V1, V2>> for interfaces that expect mutable nested maps
   */
  build_mutable_nested(): Map<K, Map<V1, V2>> {
    const mutable_map = new Map<K, Map<V1, V2>>();
    for (const [key, readonly_nested] of this.map) {
      // Convert ReadonlyMap back to Map for the interface
      const mutable_nested = new Map<V1, V2>();
      for (const [nested_key, nested_value] of readonly_nested) {
        mutable_nested.set(nested_key, nested_value);
      }
      mutable_map.set(key, mutable_nested);
    }
    return mutable_map;
  }
}

/**
 * Helper to create type-safe mock data for TypeResolutionMap interfaces
 * Handles the complex nested ReadonlyMap structures safely
 */
export function create_type_resolution_builder() {
  return {
    symbol_types: new ReadonlyMapBuilder<SymbolId, TypeId>(),
    reference_types: new ReadonlyMapBuilder<LocationKey, TypeId>(),
    type_members: new NestedReadonlyMapBuilder<TypeId, SymbolName, SymbolId>(),
    constructors: new ReadonlyMapBuilder<TypeId, SymbolId>(),
    inheritance_hierarchy: new ReadonlyMapBuilder<TypeId, readonly TypeId[]>(),
    interface_implementations: new ReadonlyMapBuilder<TypeId, readonly TypeId[]>(),
  };
}

/**
 * Helper to create mock data for import resolution that handles ReadonlyMap correctly
 */
export function create_import_resolution_builder() {
  return {
    imports: new NestedReadonlyMapBuilder<FilePath, SymbolName, SymbolId>(),
    unresolved_imports: new ReadonlyMapBuilder<LocationKey, SymbolName>(),
  };
}

/**
 * Helper to update a ReadonlyMap immutably for testing
 * Creates a new ReadonlyMap with the specified changes
 */
export function update_readonly_map<K, V>(
  original: ReadonlyMap<K, V>,
  updates: [K, V][]
): ReadonlyMap<K, V> {
  const new_map = new Map<K, V>();

  // Copy existing entries
  for (const [key, value] of original) {
    new_map.set(key, value);
  }

  // Apply updates
  for (const [key, value] of updates) {
    new_map.set(key, value);
  }

  return to_readonly_map(new_map);
}

/**
 * Helper to update nested ReadonlyMap structures immutably
 */
export function update_nested_readonly_map<K, V1, V2>(
  original: ReadonlyMap<K, ReadonlyMap<V1, V2>>,
  key: K,
  nested_updates: [V1, V2][]
): ReadonlyMap<K, ReadonlyMap<V1, V2>> {
  const new_map = new Map<K, ReadonlyMap<V1, V2>>();

  // Copy existing entries
  for (const [existing_key, existing_nested] of original) {
    if (existing_key === key) {
      // Update this nested map
      const updated_nested = update_readonly_map(existing_nested, nested_updates);
      new_map.set(existing_key, updated_nested);
    } else {
      // Keep unchanged
      new_map.set(existing_key, existing_nested);
    }
  }

  // If key didn't exist, create new nested map
  if (!original.has(key)) {
    const new_nested = readonly_map_from_entries(nested_updates);
    new_map.set(key, new_nested);
  }

  return to_readonly_map(new_map);
}

// ============================================================================
// Common Test Scenarios
// ============================================================================

/**
 * Create a typical function definition with call scenario
 */
export function create_function_scenario(file_path: FilePath): {
  index: SemanticIndex;
  function_symbol: SymbolDefinition;
  call_reference: CallReference;
} {
  const func_location = mock_location(file_path, 1, 0);
  const call_location = mock_location(file_path, 5, 0);
  const root_scope_id = `scope:global:${file_path}:0:0` as ScopeId;

  const function_symbol = mock_symbol_definition(
    "testFunction" as SymbolName,
    "function",
    func_location,
    { scope_id: root_scope_id }
  );

  const call_reference = mock_call_reference(
    "testFunction" as SymbolName,
    call_location,
    root_scope_id
  );

  const symbols = new Map([[function_symbol.id, function_symbol]]);

  const index = mock_semantic_index(file_path, {
    symbols,
    calls: [call_reference],
  });

  return { index, function_symbol, call_reference };
}

/**
 * Create a typical class with method scenario
 */
export function create_class_method_scenario(file_path: FilePath): {
  index: SemanticIndex;
  class_symbol: SymbolDefinition;
  method_symbol: SymbolDefinition;
  member_access: MemberAccessReference;
} {
  const class_location = mock_location(file_path, 1, 0);
  const method_location = mock_location(file_path, 2, 2);
  const access_location = mock_location(file_path, 10, 0);
  const root_scope_id = `scope:global:${file_path}:0:0` as ScopeId;

  const class_symbol = mock_symbol_definition(
    "TestClass" as SymbolName,
    "class",
    class_location,
    { scope_id: root_scope_id }
  );

  const method_symbol = mock_symbol_definition(
    "testMethod" as SymbolName,
    "method",
    method_location,
    { scope_id: `scope:class:${file_path}:1:0` as ScopeId }
  );

  const member_access = mock_member_access_reference(
    "testMethod" as SymbolName,
    access_location,
    root_scope_id
  );

  const symbols = new Map([
    [class_symbol.id, class_symbol],
    [method_symbol.id, method_symbol],
  ]);

  const index = mock_semantic_index(file_path, {
    symbols,
    member_accesses: [member_access],
  });

  return { index, class_symbol, method_symbol, member_access };
}

/**
 * Create a typical import/export scenario
 */
export function create_import_export_scenario(): {
  exporter_index: SemanticIndex;
  importer_index: SemanticIndex;
  exported_symbol: SymbolDefinition;
  import_ref: Import;
  export_ref: Export;
} {
  const exporter_file = "exporter.ts" as FilePath;
  const importer_file = "importer.ts" as FilePath;

  const export_location = mock_location(exporter_file, 1, 0);
  const import_location = mock_location(importer_file, 1, 0);

  const exported_symbol = mock_symbol_definition(
    "exportedFunction" as SymbolName,
    "function",
    export_location,
    { is_exported: true }
  );

  const export_ref = mock_export(
    "exportedFunction" as SymbolName,
    exported_symbol.id,
    export_location
  );

  const import_ref = mock_import(
    "./exporter" as FilePath,
    import_location,
    [{ name: "exportedFunction" as SymbolName, is_type_only: false }]
  );

  const exporter_symbols = new Map([[exported_symbol.id, exported_symbol]]);
  const exporter_index = mock_semantic_index(exporter_file, {
    symbols: exporter_symbols,
    exports: [export_ref],
  });

  const importer_index = mock_semantic_index(importer_file, {
    imports: [import_ref],
  });

  return {
    exporter_index,
    importer_index,
    exported_symbol,
    import_ref,
    export_ref,
  };
}
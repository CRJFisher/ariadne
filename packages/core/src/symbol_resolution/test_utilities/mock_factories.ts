/**
 * Mock Factory Functions for Type Resolution Testing
 *
 * Provides basic mock data generators for testing the type resolution pipeline.
 * Simplified to work with actual codebase interfaces.
 */

import type {
  FilePath,
  SymbolId,
  TypeId,
  SymbolName,
  Location,
  LocationKey,
  Language,
  ScopeId,
  SymbolDefinition,
  LexicalScope,
  ScopeType,
  SymbolKind,
} from "@ariadnejs/types";
import {
  function_symbol,
  class_symbol,
  location_key,
} from "@ariadnejs/types";
import type {
  FunctionResolutionMap,
  TypeResolutionMap,
} from "../types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";

// Configuration options for mock generation
export interface MockSemanticIndexOptions {
  file_path?: FilePath;
  type_count?: number;
  language?: Language;
}

export interface MockFactories {
  // Basic SemanticIndex mocks
  createMockSemanticIndex(options?: MockSemanticIndexOptions): SemanticIndex;

  // Function resolution mocks
  createMockFunctionResolution(): FunctionResolutionMap;

  // Type resolution mocks
  createMockTypeResolution(): TypeResolutionMap;

  // Basic data mocks
  createMockLocation(file?: FilePath, line?: number): Location;
  createMockSymbolDefinition(name?: SymbolName, kind?: SymbolKind): SymbolDefinition;
  createMockLexicalScope(type?: ScopeType): LexicalScope;
}

class MockFactoriesImpl implements MockFactories {
  private file_counter = 0;
  private symbol_counter = 0;

  createMockSemanticIndex(options: MockSemanticIndexOptions = {}): SemanticIndex {
    const {
      file_path = `/test/file${++this.file_counter}.ts` as FilePath,
      type_count = 2,
      language = "typescript" as Language,
    } = options;

    // Create a minimal semantic index with basic structure
    const symbols = new Map<SymbolId, SymbolDefinition>();
    const scopes = new Map<ScopeId, LexicalScope>();

    // Add a basic scope
    const global_scope = this.createMockLexicalScope("global");
    const scope_id = `scope_${file_path}_global` as ScopeId;
    scopes.set(scope_id, global_scope);

    // Add some basic symbols
    for (let i = 0; i < type_count; i++) {
      const symbol_name = `TestSymbol${i}` as SymbolName;
      const location = this.createMockLocation(file_path, i + 1);
      const symbol_id = function_symbol(symbol_name, location);
      const symbol_def = this.createMockSymbolDefinition(symbol_name, "class");
      symbols.set(symbol_id, symbol_def);
    }

    return {
      symbols,
      scopes,
      member_access_chains: [],
      variable_assignments: [],
      type_annotations: [],
      type_flows: [],
      returns: [],
      imports: [],
      exports: [],
      file_symbols_by_name: new Map([[file_path, new Map()]]),
      local_types: {
        constructor_calls: [],
        assignments: [],
        returns: [],
        call_assignments: [],
      },
    };
  }

  createMockFunctionResolution(): FunctionResolutionMap {
    const function_calls = new Map<LocationKey, SymbolId>();
    const calls_to_function = new Map<SymbolId, readonly Location[]>();
    const closure_calls = new Map<LocationKey, SymbolId>();
    const higher_order_calls = new Map<LocationKey, SymbolId>();
    const function_pointer_calls = new Map<LocationKey, SymbolId>();

    // Add some basic mock data
    const file_path = `/test/mock.ts` as FilePath;
    const location = this.createMockLocation(file_path, 10);
    const func_name = `mockFunction${++this.symbol_counter}` as SymbolName;
    const func_id = function_symbol(func_name, location);
    const call_key = location_key(location);

    function_calls.set(call_key, func_id);
    calls_to_function.set(func_id, [location]);

    return {
      function_calls,
      calls_to_function,
      closure_calls,
      higher_order_calls,
      function_pointer_calls,
    };
  }

  createMockTypeResolution(): TypeResolutionMap {
    const symbol_types = new Map<SymbolId, TypeId>();
    const reference_types = new Map<LocationKey, TypeId>();
    const type_definitions = new Map<FilePath, readonly any[]>();
    const type_members = new Map<TypeId, Map<SymbolName, any>>();
    const type_flow_edges = [] as any[];

    // Add some basic mock data
    const file_path = `/test/types.ts` as FilePath;
    const location = this.createMockLocation(file_path, 5);
    const type_name = `MockType${++this.symbol_counter}` as SymbolName;
    const type_id = `type:${type_name}:${file_path}` as TypeId;
    const symbol_id = class_symbol(type_name, location);

    symbol_types.set(symbol_id, type_id);
    type_definitions.set(file_path, []);
    type_members.set(type_id, new Map());

    return {
      symbol_types,
      reference_types,
      type_definitions,
      type_members,
      type_flow_edges,
    };
  }

  createMockLocation(
    file: FilePath = "/test/mock.ts" as FilePath,
    line: number = 1
  ): Location {
    return {
      file_path: file,
      start_line: line,
      start_column: 0,
      end_line: line,
      end_column: 10,
    };
  }

  createMockSymbolDefinition(
    name: SymbolName = `symbol${++this.symbol_counter}` as SymbolName,
    kind: SymbolKind = "function"
  ): SymbolDefinition {
    return {
      id: function_symbol(name, this.createMockLocation()),
      name,
      kind,
      location: this.createMockLocation(),
      type_parameters: [],
      modifiers: [],
    };
  }

  createMockLexicalScope(type: ScopeType = "function"): LexicalScope {
    return {
      id: `scope_${++this.symbol_counter}` as ScopeId,
      parent_id: undefined,
      type,
      symbols: new Map(),
      location: this.createMockLocation(),
    };
  }
}

// Export singleton instance
export const mockFactories: MockFactories = new MockFactoriesImpl();
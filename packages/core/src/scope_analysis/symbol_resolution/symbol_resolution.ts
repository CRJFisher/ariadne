/**
 * Symbol Resolution - Configuration-driven generic processor
 */

import {
  SymbolId,
  Language,
  FileAnalysis,
  ScopeTree,
  Import,
  Export,
  FunctionCall,
  MethodCall,
  ConstructorCall,
  FunctionDefinition,
  MethodDefinition,
  ClassDefinition,
  function_symbol,
  method_symbol,
  class_symbol,
  CallInfo,
  FilePath,
  create_readonly_map,
  create_readonly_array,
} from "@ariadnejs/types";

import { resolve_function_call } from "./function_resolution/function_resolution";
import { resolve_method_call } from "./class_resolution/method_resolution/method_resolution";
import { resolve_constructor_call } from "./class_resolution/constructor_resolution/constructor_resolution";

/**
 * File resolution context for symbol resolution
 */
export interface FileResolutionContext {
  scope_tree: ScopeTree;
  imports_by_file: ReadonlyMap<FilePath, readonly Import[]>;
  exports_by_file: ReadonlyMap<FilePath, readonly Export[]>;
  language: Language;
  definitions_by_file: ReadonlyMap<
    FilePath,
    {
      functions: ReadonlyMap<SymbolId, FunctionDefinition>;
      classes: ReadonlyMap<SymbolId, ClassDefinition>;
      methods: ReadonlyMap<SymbolId, MethodDefinition>;
    }
  >;
}

/**
 * Result of symbol resolution - maps definitions to all their calls
 */
export interface ResolutionResult {
  function_calls: ReadonlyMap<FunctionDefinition, readonly FunctionCall[]>;
  function_call_defs: ReadonlyMap<FunctionCall, FunctionDefinition>;
  method_calls: ReadonlyMap<MethodDefinition, readonly MethodCall[]>;
  method_call_defs: ReadonlyMap<MethodCall, MethodDefinition>;
  constructor_calls: ReadonlyMap<ClassDefinition, readonly ConstructorCall[]>;
  constructor_call_defs: ReadonlyMap<ConstructorCall, ClassDefinition>;
  unresolved_calls: readonly CallInfo[];
}

/**
 * Index of definitions by file and symbol
 */
interface DefinitionIndex {
  readonly by_file: ReadonlyMap<
    FilePath,
    {
      readonly functions: ReadonlyMap<SymbolId, FunctionDefinition>;
      readonly classes: ReadonlyMap<SymbolId, ClassDefinition>;
      readonly methods: ReadonlyMap<SymbolId, MethodDefinition>;
    }
  >;
}

/**
 * Cross-file resolution context
 */
interface CrossFileContext {
  readonly imports_by_file: ReadonlyMap<FilePath, readonly Import[]>;
  readonly exports_by_file: ReadonlyMap<FilePath, readonly Export[]>;
  readonly definitions: DefinitionIndex;
}

/**
 * Resolve all symbols in the provided file analyses using configuration-driven patterns
 */
export function resolve_references_to_symbols(
  analyses: readonly FileAnalysis[]
): ResolutionResult {
  const cross_file_context = build_cross_file_context(analyses);

  // Process each file's calls
  const results = new Array<ResolutionResult>();
  for (const analysis of analyses) {
    results.push(resolve_file_calls(analysis, cross_file_context));
  }

  // Combine
  return {
    function_calls: combine_maps(results.map((r) => r.function_calls)),
    function_call_defs: combine_maps(results.map((r) => r.function_call_defs)),
    method_calls: combine_maps(results.map((r) => r.method_calls)),
    method_call_defs: combine_maps(results.map((r) => r.method_call_defs)),
    constructor_calls: combine_maps(results.map((r) => r.constructor_calls)),
    constructor_call_defs: combine_maps(
      results.map((r) => r.constructor_call_defs)
    ),
    unresolved_calls: results.flatMap((r) => r.unresolved_calls),
  };
}

/**
 * Build an index of all definitions organized by file and symbol
 */
function build_definition_index(
  analyses: readonly FileAnalysis[]
): DefinitionIndex {
  const by_file = new Map<
    FilePath,
    {
      functions: Map<SymbolId, FunctionDefinition>;
      classes: Map<SymbolId, ClassDefinition>;
      methods: Map<SymbolId, MethodDefinition>;
    }
  >();

  for (const analysis of analyses) {
    const functions = new Map<SymbolId, FunctionDefinition>();
    const classes = new Map<SymbolId, ClassDefinition>();
    const methods = new Map<SymbolId, MethodDefinition>();

    // Index functions by their symbols
    for (const func of analysis.functions) {
      const symbol = function_symbol(func.name, func.location);
      functions.set(symbol, func);
    }

    // Index classes and their methods by their symbols
    for (const cls of analysis.classes) {
      const classSymbol = class_symbol(cls.name, cls.location);
      classes.set(classSymbol, cls);

      for (const method of cls.methods) {
        const methodSymbol = method_symbol(
          method.name,
          cls.name,
          method.location
        );
        methods.set(methodSymbol, method);
      }
    }

    by_file.set(analysis.file_path, { functions, classes, methods });
  }

  return { by_file };
}

/**
 * Build cross-file resolution context
 */
function build_cross_file_context(
  analyses: readonly FileAnalysis[]
): CrossFileContext {
  const imports_by_file = new Map<FilePath, readonly Import[]>();
  const exports_by_file = new Map<FilePath, readonly Export[]>();

  for (const analysis of analyses) {
    imports_by_file.set(analysis.file_path, analysis.imports);
    exports_by_file.set(analysis.file_path, analysis.exports);
  }

  const definitions = build_definition_index(analyses);

  return {
    imports_by_file,
    exports_by_file,
    definitions,
  };
}

/**
 * Resolve all calls in a single file analysis
 */
function resolve_file_calls(
  analysis: FileAnalysis,
  cross_file_context: CrossFileContext
): ResolutionResult {
  const language = analysis.language;

  const context: FileResolutionContext = {
    scope_tree: analysis.scopes,
    imports_by_file: cross_file_context.imports_by_file,
    exports_by_file: cross_file_context.exports_by_file,
    language,
    definitions_by_file: cross_file_context.definitions.by_file,
  };

  const function_def_calls = new Map<FunctionDefinition, FunctionCall[]>();
  const function_call_defs = new Map<FunctionCall, FunctionDefinition>();
  const method_def_calls = new Map<MethodDefinition, MethodCall[]>();
  const method_call_defs = new Map<MethodCall, MethodDefinition>();
  const constructor_def_calls = new Map<ClassDefinition, ConstructorCall[]>();
  const constructor_call_defs = new Map<ConstructorCall, ClassDefinition>();
  const unresolved_calls = new Array<CallInfo>();

  // Resolve function calls
  for (const call of analysis.function_calls) {
    const resolved = resolve_function_call(call, context);
    if (resolved) {
      const calls = function_def_calls.get(resolved) || [];
      calls.push(call);
      function_def_calls.set(resolved, calls);
      function_call_defs.set(call, resolved);
    } else {
      unresolved_calls.push(call);
    }
  }

  // Resolve method calls
  for (const call of analysis.method_calls) {
    const resolved = resolve_method_call(call, context);
    if (resolved) {
      const calls = method_def_calls.get(resolved) || [];
      calls.push(call);
      method_def_calls.set(resolved, calls);
      method_call_defs.set(call, resolved);
    } else {
      unresolved_calls.push(call);
    }
  }

  // Resolve constructor calls
  for (const call of analysis.constructor_calls) {
    const resolved = resolve_constructor_call(call, context);
    if (resolved) {
      const calls = constructor_def_calls.get(resolved) || [];
      calls.push(call);
      constructor_def_calls.set(resolved, calls);
      constructor_call_defs.set(call, resolved);
    } else {
      unresolved_calls.push(call);
    }
  }

  return {
    function_calls: create_readonly_map(function_def_calls),
    function_call_defs: create_readonly_map(function_call_defs),
    method_calls: create_readonly_map(method_def_calls),
    method_call_defs: create_readonly_map(method_call_defs),
    constructor_calls: create_readonly_map(constructor_def_calls),
    constructor_call_defs: create_readonly_map(constructor_call_defs),
    unresolved_calls: create_readonly_array(unresolved_calls),
  };
}

function combine_maps<K, V>(maps: ReadonlyMap<K, V>[]): ReadonlyMap<K, V> {
  return new Map(maps.flatMap((map) => [...map]));
}

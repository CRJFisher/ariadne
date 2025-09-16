/**
 * File Analysis Module
 *
 * Provides single file analysis functionality, breaking down the analysis
 * into distinct semantic layers.
 */

import Parser, { SyntaxNode } from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";

import { build_scope_tree } from "./scope_analysis/scope_tree";
import {
  extract_exports,
  extract_imports,
} from "./import_export/import_export_resolution";
import { find_class_definitions } from "./inheritance/class_detection";
import { find_function_calls } from "./call_graph/function_calls/function_calls";
import { find_method_calls } from "./call_graph/method_calls/method_calls";
import { find_constructor_calls } from "./call_graph/constructor_calls";
// Variable extraction now done through scope_tree
import {
  create_error_collector,
  ErrorCollector,
} from "./error_collection/analysis_errors";
import {
  Import,
  Export,
  FunctionCall,
  MethodCall,
  ConstructorCall,
  TypeInfo,
  Language,
  FileAnalysis,
  FunctionDefinition,
  ScopeTree,
  ClassDefinition,
  SourceCode,
  FilePath,
  create_readonly_array,
  SymbolId,
  TypeIndex,
  TypeDefinition,
  SymbolIndex,
} from "@ariadnejs/types";
import {
  infer_all_return_types,
} from "./type_analysis/return_type_inference";
import {
  infer_all_parameter_types,
} from "./type_analysis/parameter_type_inference";

// Re-export types from shared modules
import { CodeFile } from "./project/file_scanner";
import {
  process_file_for_types,
  TypeTrackingContext,
} from "./type_analysis/type_tracking";
import { determine_caller } from "./scope_analysis/usage_finder";
import { extract_definitions as extract_function_definitions } from "./call_graph/function_definitions";

/**
 * Main entry point for analyzing a single file
 */
export async function analyze_file(
  file: CodeFile
): Promise<{ analysis: FileAnalysis; tree: Parser.Tree }> {
  // Create error collector for this file
  const error_collector = create_error_collector(
    file.file_path,
    file.language,
    "parsing"
  );

  // Parse the file
  const tree = parse_file(file);
  const source_code = file.source_code;

  // Analyze scopes
  error_collector.set_phase("scope_analysis");
  const scopes = build_scope_tree(tree.rootNode, file.file_path, file.language);

  // Detect local structures (imports, exports, classes)
  error_collector.set_phase("imports_and_exports");
  const { imports, exports } = detect_imports_and_exports(
    tree.rootNode,
    source_code,
    file.language,
    file.file_path,
    error_collector
  );

  // Detect class definitions
  error_collector.set_phase("class_detection");
  const class_definitions = find_class_definitions({
    ast_root: tree.rootNode,
    source_code,
    language: file.language,
    file_path: file.file_path,
    error_collector,
  });

  // Analyze local types
  const { type_tracker, inferred_parameters, inferred_returns } =
    analyze_local_types(
      source_code,
      tree.rootNode,
      file,
      scopes,
      imports,
      class_definitions
    );

  // Analyze calls
  const { function_calls, method_calls, constructor_calls } = analyze_calls(
    tree.rootNode,
    source_code,
    file.language,
    type_tracker,
    scopes,
    file.file_path
  );

  // Extract definitions
  const function_definitions = extract_function_definitions(
    tree.rootNode,
    file.file_path
  );


  // Build final analysis
  const analysis = build_file_analysis(
    file,
    imports,
    exports,
    function_definitions,
    class_definitions,
    function_calls,
    method_calls,
    constructor_calls,
    type_tracker,
    scopes,
    error_collector
  );

  return { analysis, tree };
}

/**
 * Parse a file using the appropriate language parser
 */
function parse_file(file: CodeFile): Parser.Tree {
  const parser = new Parser();

  switch (file.language) {
    case "javascript":
      parser.setLanguage(JavaScript as any);
      break;
    case "typescript":
      parser.setLanguage(TypeScript.typescript as any);
      break;
    case "python":
      parser.setLanguage(Python as any);
      break;
    case "rust":
      parser.setLanguage(Rust as any);
      break;
    default:
      throw new Error(`Unsupported language: ${file.language}`);
  }

  const tree = parser.parse(file.source_code);
  return tree;
}

/**
 * Detect local structures (imports, exports, classes)
 */
function detect_imports_and_exports(
  root_node: SyntaxNode,
  source_code: SourceCode,
  language: Language,
  file_path: FilePath,
  _error_collector?: ErrorCollector
): {
  imports: Import[];
  exports: Export[];
} {
  // Extract imports
  const imports = extract_imports({
    source_code,
    file_path,
    language,
    ast_root: root_node,
  });

  // Extract exports
  const exports = extract_exports({
    source_code,
    file_path,
    language,
    ast_root: root_node,
  });

  return { imports, exports };
}

/**
 * Analyze local types
 */
function analyze_local_types(
  source_code: SourceCode,
  root_node: SyntaxNode,
  file: CodeFile,
  scopes: ScopeTree,
  imports: Import[],
  class_definitions: ClassDefinition[]
): {
  type_tracker: TypeIndex;
  inferred_parameters: Map<SymbolId, TypeDefinition[]>;
  inferred_returns: Map<SymbolId, TypeDefinition>;
} {
  const type_tracking_context: TypeTrackingContext = {
    language: file.language,
    file_path: file.file_path,
    source_code: source_code,
    ast_root: root_node,
  };

  const type_tracker = process_file_for_types(type_tracking_context);

  // Infer parameter types for all functions
  const inferred_parameters = infer_all_parameter_types({
    language: file.language,
    file_path: file.file_path,
    source_code: source_code,
    ast_root: root_node,
  });

  // Infer return types for all functions
  const inferred_returns = infer_all_return_types({
    language: file.language,
    file_path: file.file_path,
    source_code: source_code,
    ast_root: root_node,
  });

  return {
    type_tracker,
    inferred_parameters,
    inferred_returns,
  };
}

/**
 * Analyze function, method, and constructor calls
 *
 * This implements Phase 1 (Layer 4) early enrichment from PROCESSING_PIPELINE.md:
 * - Tree-sitter queries find the calls (simple pattern matching)
 * - Scope tree determines the caller context (structural information)
 * - Type tracker will be used for indirect call resolution (semantic analysis)
 *
 * The separation of concerns is intentional:
 * - Tree-sitter: Fast syntactic pattern matching for call detection
 * - Scope tree: Already-built structural context for caller identification
 * - TODO: Type tracker: Future enhancement for resolving variable references,
 *   method bindings, and dynamic dispatch (e.g., when `processor` variable
 *   holds a function reference, or for polymorphic method calls)
 */
function analyze_calls(
  root_node: SyntaxNode,
  source_code: SourceCode,
  language: Language,
  type_tracker: TypeIndex,
  scopes: ScopeTree,
  file_path: FilePath
): {
  function_calls: FunctionCall[];
  method_calls: MethodCall[];
  constructor_calls: ConstructorCall[];
} {
  const context = {
    source_code,
    file_path,
    language,
    ast_root: root_node,
  };

  // Enrich with caller information from scope tree
  const function_calls = find_function_calls(context).map((call) => ({
    ...call,
    caller: determine_caller(call.location, scopes),
  }));

  const method_calls = find_method_calls(context).map((call) => ({
    ...call,
    caller: determine_caller(call.location, scopes),
  }));

  const constructor_calls = find_constructor_calls(context).map((call) => ({
    ...call,
    caller: determine_caller(call.location, scopes),
  }));

  return { function_calls, method_calls, constructor_calls };
}

/**
 * Build the final FileAnalysis object
 */
function build_file_analysis(
  file: CodeFile,
  imports: Import[],
  exports: Export[],
  functions: FunctionDefinition[],
  classes: ClassDefinition[],
  function_calls: FunctionCall[],
  method_calls: MethodCall[],
  constructor_calls: ConstructorCall[],
  type_tracker: TypeIndex,
  scopes: ScopeTree,
  error_collector?: ErrorCollector
): FileAnalysis {
  // Use unified types directly (no conversion needed)
  const import_statements = imports;
  const export_statements = exports;

  // Convert type_tracker.variable_types to Map<SymbolId, TypeInfo>
  const public_type_info = new Map<SymbolId, TypeInfo>();
  // Note: type_tracker.variable_types needs to be converted to use SymbolId keys

  // Extract variables from scope tree
  // const variables = extract_variables_from_scopes(scopes); // TODO: why are variables in scopes? Why are we extracting variables?
  const errors = error_collector?.get_errors() || [];

  return {
    file_path: file.file_path,
    source_code: file.source_code,
    language: file.language,
    imports: import_statements,
    exports: export_statements,
    functions: create_readonly_array(functions),
    classes: create_readonly_array(classes),
    // variables,
    errors,
    function_calls: create_readonly_array(function_calls),
    method_calls: create_readonly_array(method_calls),
    constructor_calls: create_readonly_array(constructor_calls),
    type_info: public_type_info,
    scopes,
    // TODO: Add these when properly typed
    // symbol_registry,
    // scope_entity_connections,
  };
}

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
import { extract_imports } from "./import_export/import_resolution";
import { extract_exports } from "./import_export/export_detection";
import { find_class_definitions } from "./inheritance/class_detection";
import {
  process_file_for_types,
  TypeTrackingContext,
} from "./type_analysis/type_tracking";
import { find_function_calls } from "./call_graph/function_calls";
import { find_method_calls } from "./call_graph/method_calls";
import { find_constructor_calls } from "./call_graph/constructor_calls";
import { extract_variable_declarations } from "./variable_analysis/variable_extraction";
import {
  create_error_collector,
  ErrorCollector,
} from "./error_collection/analysis_errors";
import {
  find_function_node,
  get_enclosing_class_name,
} from "./definition_extraction/def_factory";
import {
  convert_imports_to_statements,
  convert_exports_to_statements,
  convert_type_map_to_public,
  create_readonly_array,
  create_empty_variables,
  create_empty_errors,
  create_location_from_range,
} from "./type_analysis/type_adapters";
import {
  infer_function_return_type,
  ReturnTypeContext,
} from "./type_analysis/return_type_inference";

import {
  Language,
  FileAnalysis,
  ImportStatement,
  ExportStatement,
  FunctionInfo,
  ClassInfo,
  MethodInfo,
  Location,
  FunctionSignature,
  ScopeTree,
  ExportInfo,
  ClassDefinition,
  FunctionCallInfo,
} from "@ariadnejs/types";

// Re-export types from shared modules
import type { FileTypeTracker } from "./type_analysis/type_tracking";
import type { MethodCallInfo } from "./call_graph/method_calls";
import type { ConstructorCallInfo } from "./call_graph/constructor_calls";
import { CodeFile } from "./project/file_scanner";
// Symbol types - to be properly imported when symbol_analysis module is available
type SymbolRegistry = Map<any, any>;
type ScopeEntityConnections = Map<any, any>;

interface ParseResult {
  tree: Parser.Tree;
  parser: Parser;
}

interface Layer1Results {
  scopes: ScopeTree;
}

interface Layer2Results {
  imports: ResolvedImport[];
  exports: ExportInfo[];
  class_definitions: ClassDefinition[];
}

interface Layer3Results {
  type_tracker: FileTypeTracker;
}

interface Layer4Results {
  function_calls: FunctionCallInfo[];
  method_calls: MethodCallInfo[];
  constructor_calls: ConstructorCallInfo[];
}

interface Layer5Results {
  variables: VariableInfo[];
}

interface Layer6Results {
  functions: FunctionInfo[];
  classes: ClassInfo[];
}

interface Layer7Results {
  symbol_registry: SymbolRegistry;
  scope_entity_connections: ScopeEntityConnections;
}

/**
 * Main entry point for analyzing a single file
 */
export async function analyze_file(
  file: CodeFile
): Promise<{ analysis: FileAnalysis; tree: Parser.Tree }> {
  
  // Parse the file
  const { tree, parser } = parse_file(file);
  const source_code = file.source_code || "";
  
  // Layer 1: Scope Analysis
  const layer1 = analyze_scopes(tree, source_code, file.language, file.file_path);
  
  // Layer 2: Local Structure Detection
  const layer2 = detect_local_structures(
    tree.rootNode,
    source_code,
    file.language,
    file.file_path
  );
  
  // Layer 3: Local Type Analysis
  const layer3 = analyze_local_types(
    source_code,
    tree.rootNode,
    file,
    layer1.scopes,
    layer2.imports,
    layer2.class_definitions
  );
  
  // Layer 4: Call Analysis
  const layer4 = analyze_calls(
    tree.rootNode,
    source_code,
    file.language,
    layer3.type_tracker,
    layer1.scopes
  );
  
  // Layer 5: Variable Extraction
  const layer5 = extract_variables(
    tree.rootNode,
    source_code,
    file.language,
    file.file_path
  );
  
  // Layer 6: Definition Extraction
  const layer6 = extract_definitions(
    tree.rootNode,
    source_code,
    file,
    layer1.scopes,
    layer2.class_definitions
  );
  
  // Layer 7: Symbol Registration
  const layer7 = register_symbols(
    file.file_path,
    layer6.functions,
    layer6.classes,
    layer1.scopes
  );
  
  // Build final analysis
  const analysis = build_file_analysis(
    file,
    layer2.imports,
    layer2.exports,
    layer6.functions,
    layer6.classes,
    layer4.function_calls,
    layer4.method_calls,
    layer4.constructor_calls,
    layer3.type_tracker,
    layer7.symbol_registry,
    layer7.scope_entity_connections
  );
  
  return { analysis, tree };
}

/**
 * Parse a file using the appropriate language parser
 */
function parse_file(file: CodeFile): ParseResult {
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
  return { tree, parser };
}

/**
 * Layer 1: Analyze scopes in the file
 */
function analyze_scopes(
  tree: Parser.Tree,
  source_code: string,
  language: Language,
  file_path: string
): Layer1Results {
  const scopes = build_scope_tree(
    tree.rootNode,
    source_code,
    language,
    file_path
  );
  
  return { scopes };
}

/**
 * Layer 2: Detect local structures (imports, exports, classes)
 */
function detect_local_structures(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Layer2Results {
  // Extract imports
  const imports = extract_imports(
    root_node,
    source_code,
    language,
    file_path
  );
  
  // Extract exports
  const exports = extract_exports(
    root_node,
    source_code,
    language,
    file_path
  );
  
  // Detect class definitions
  const class_detection_context = {
    source_code,
    file_path,
    language,
    ast_root: root_node,
  };
  const class_definitions = find_class_definitions(class_detection_context);
  
  return { imports, exports, class_definitions };
}

/**
 * Layer 3: Analyze local types
 */
function analyze_local_types(
  source_code: string,
  root_node: SyntaxNode,
  file: CodeFile,
  scopes: ScopeTree,
  imports: ImportInfo[],
  class_definitions: ClassDefinition[]
): Layer3Results {
  const type_tracking_context: TypeTrackingContext = {
    language: file.language,
    file_path: file.file_path,
    debug: false,
  };
  
  const type_tracker = process_file_for_types(
    source_code,
    root_node,
    type_tracking_context
  );
  
  return { type_tracker };
}

/**
 * Layer 4: Analyze function, method, and constructor calls
 */
function analyze_calls(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  type_tracker: FileTypeTracker,
  scopes: ScopeTree
): Layer4Results {
  // Find function calls
  const function_calls = find_function_calls(
    root_node,
    source_code,
    language,
    type_tracker
  );
  
  // Find method calls
  const method_calls = find_method_calls(
    root_node,
    source_code,
    language,
    type_tracker,
    scopes
  );
  
  // Find constructor calls
  const constructor_calls = find_constructor_calls(
    root_node,
    source_code,
    language,
    type_tracker
  );
  
  return { function_calls, method_calls, constructor_calls };
}

/**
 * Layer 5: Extract variable declarations
 */
function extract_variables(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Layer5Results {
  const variables = extract_variable_declarations(
    root_node,
    source_code,
    language
  );
  
  return { variables };
}

/**
 * Layer 6: Extract function and class definitions
 */
function extract_definitions(
  root_node: SyntaxNode,
  source_code: string,
  file: CodeFile,
  scopes: ScopeTree,
  class_definitions: ClassDefinition[]
): Layer6Results {
  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];
  const error_collector = create_error_collector();
  
  // Extract functions from scope tree
  for (const scope of scopes.scopes) {
    if (scope.type === "function" || scope.type === "method") {
      const func_node = find_function_node(root_node, scope.range);
      if (func_node) {
        const return_type_context: ReturnTypeContext = {
          language: file.language,
          file_path: file.file_path,
          source_code,
          scopes,
        };
        
        const inferred_return_type = infer_function_return_type(
          func_node,
          return_type_context
        );
        
        const enclosing_class = get_enclosing_class_name(
          scopes,
          scope.range.start_byte
        );
        
        const signature: FunctionSignature = {
          parameters: scope.parameters || [],
          return_type: inferred_return_type || undefined,
          is_async: scope.is_async || false,
          is_generator: scope.is_generator || false,
          type_parameters: [],
        };
        
        const func_info: FunctionInfo = {
          name: scope.name,
          location: create_location_from_range(scope.range),
          signature,
          docstring: undefined,
          decorators: [],
          is_exported: false,
        };
        
        if (!enclosing_class) {
          functions.push(func_info);
        }
      }
    }
  }
  
  // Extract classes from class definitions
  for (const class_def of class_definitions) {
    const methods: MethodInfo[] = [];
    
    // Find methods within this class
    for (const scope of scopes.scopes) {
      if (scope.type === "method") {
        const enclosing_class = get_enclosing_class_name(
          scopes,
          scope.range.start_byte
        );
        
        if (enclosing_class === class_def.name) {
          const func_node = find_function_node(root_node, scope.range);
          if (func_node) {
            const return_type_context: ReturnTypeContext = {
              language: file.language,
              file_path: file.file_path,
              source_code,
              scopes,
            };
            
            const inferred_return_type = infer_function_return_type(
              func_node,
              return_type_context
            );
            
            const signature: FunctionSignature = {
              parameters: scope.parameters || [],
              return_type: inferred_return_type || undefined,
              is_async: scope.is_async || false,
              is_generator: scope.is_generator || false,
              type_parameters: [],
            };
            
            methods.push({
              name: scope.name,
              location: create_location_from_range(scope.range),
              signature,
              visibility: "public",
              is_static: scope.is_static || false,
              is_abstract: false,
              decorators: [],
            });
          }
        }
      }
    }
    
    const class_info: ClassInfo = {
      name: class_def.name,
      location: create_location_from_range(class_def.range),
      extends: class_def.extends,
      implements: class_def.implements || [],
      methods,
      properties: [],
      is_abstract: false,
      is_exported: false,
      decorators: [],
      type_parameters: [],
    };
    
    classes.push(class_info);
  }
  
  return { functions, classes };
}

/**
 * Layer 7: Register symbols and create connections
 */
function register_symbols(
  file_path: string,
  functions: FunctionInfo[],
  classes: ClassInfo[],
  scopes: ScopeTree
): Layer7Results {
  // TODO: Implement actual symbol registration
  // This is a placeholder that should be replaced with actual implementation
  const symbol_registry: SymbolRegistry = new Map();
  const scope_entity_connections: ScopeEntityConnections = new Map();
  
  return { symbol_registry, scope_entity_connections };
}

/**
 * Build the final FileAnalysis object
 */
function build_file_analysis(
  file: CodeFile,
  imports: ImportInfo[],
  exports: ExportInfo[],
  functions: FunctionInfo[],
  classes: ClassInfo[],
  function_calls: FunctionCallInfo[],
  method_calls: MethodCallInfo[],
  constructor_calls: ConstructorCallInfo[],
  type_tracker: FileTypeTracker,
  symbol_registry: SymbolRegistry,
  scope_entity_connections: ScopeEntityConnections
): FileAnalysis {
  // Convert to public API types
  const import_statements = convert_imports_to_statements(imports, file.file_path);
  const export_statements = convert_exports_to_statements(exports);
  const public_type_info = convert_type_map_to_public(type_tracker.types);
  
  // Create empty collections for unimplemented features
  const variables = create_empty_variables();
  const errors = create_empty_errors();
  
  return {
    file_path: file.file_path,
    language: file.language,
    imports: import_statements,
    exports: export_statements,
    functions: create_readonly_array(functions),
    classes: create_readonly_array(classes),
    variables,
    errors,
    function_calls: create_readonly_array(function_calls),
    method_calls: create_readonly_array(method_calls),
    constructor_calls: create_readonly_array(constructor_calls),
    type_info: public_type_info,
    symbol_registry,
    scope_entity_connections,
  };
}
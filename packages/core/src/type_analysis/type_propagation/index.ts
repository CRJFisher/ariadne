/**
 * Type propagation module - Public API
 * 
 * This module provides type flow analysis through assignments, function calls,
 * and control flow narrowing. It uses configuration-driven processing for 85%
 * of the logic with language-specific bespoke handlers for unique features.
 * 
 * ONLY exports the function used by code_graph.ts. All other functions are internal
 * or test-only.
 */

import { SyntaxNode } from 'tree-sitter';
import { 
  Language,
  TypeFlow,
  PropagationPath,
  FilePath,
  FileAnalysis,
  ResolvedGeneric
} from '@ariadnejs/types';
import {
  TypePropagationContext,
  PropagationAnalysis
} from './type_propagation';
import { propagate_javascript_types } from './type_propagation.javascript';
import { propagate_typescript_types } from './type_propagation.typescript';
import { propagate_python_types } from './type_propagation.python';
import { propagate_rust_types } from './type_propagation.rust';
import { TypeRegistry } from '../type_registry';
import { ModuleGraphWithEdges } from '../../import_export/module_graph';

/**
 * Propagate types across all files in the codebase
 * This is the ONLY function used by code_graph.ts - the main entry point
 */
export async function propagate_types_across_files(
  analyses: FileAnalysis[],
  type_registry: TypeRegistry,
  resolved_generics: Map<string, ResolvedGeneric[]>,
  modules: ModuleGraphWithEdges
): Promise<Map<FilePath, TypeFlow[]>> {
  const all_type_flows = new Map<FilePath, TypeFlow[]>();
  
  // Process each file's analysis
  for (const analysis of analyses) {
    const file_flows: TypeFlow[] = [];
    const language = analysis.language;
    
    // Build context with known types from type registry and resolved generics
    const known_types = new Map<string, string>();
    
    // Add function return types from registry
    for (const func of analysis.functions) {
      if (func.signature.return_type) {
        known_types.set(func.name, func.signature.return_type);
      }
    }
    
    // Add class types from registry
    for (const cls of analysis.classes) {
      known_types.set(cls.name, cls.name);
    }
    
    // Add resolved generic types
    const file_generics = resolved_generics.get(analysis.file_path);
    if (file_generics) {
      for (const generic of file_generics) {
        // Store the resolved generic type - use original_type as key
        known_types.set(generic.original_type, generic.resolved_type || 'T');
      }
    }
    
    // Build propagation context
    const context: TypePropagationContext = {
      language: analysis.language,
      source_code: analysis.source_code || '',
      file_path: analysis.file_path,
      known_types
    };
    
    // Analyze assignments for type flow
    for (const variable of analysis.variables) {
      // VariableDeclaration doesn't have initial_value, only type
      if (variable.type) {
        // Create a type flow from the type annotation
        file_flows.push({
          source_type: variable.type,
          target_identifier: variable.name,
          flow_kind: 'assignment',
          confidence: 'explicit',
          position: {
            row: variable.location.line,
            column: variable.location.column
          }
        });
      }
    }
    
    // Analyze function calls for type propagation
    for (const call of analysis.function_calls) {
      // If we know the return type of the called function, propagate it
      const func_type = known_types.get(call.callee_name);
      if (func_type && func_type.includes('=>')) {
        const return_type = func_type.split('=>')[1].trim();
        // This would need more context to know where the return value flows to
        // For now, just track that this call site has a known return type
        file_flows.push({
          source_type: return_type,
          target_identifier: `_call_${call.callee_name}_${call.location.line}`,
          flow_kind: 'return',
          confidence: 'inferred',
          position: {
            row: call.location.line,
            column: call.location.column
          }
        });
      }
    }
    
    // Store flows for this file if any were found
    if (file_flows.length > 0) {
      all_type_flows.set(analysis.file_path, file_flows);
    }
  }
  
  return all_type_flows;
}

// ============================================================================
// TEST-ONLY EXPORTS
// The following functions are only used by tests and should not be used
// by production code. They are kept for test compatibility.
// ============================================================================

// Re-export types needed by tests
export { TypeFlow, PropagationPath, TypePropagationContext };

/**
 * @testonly - Analyze type propagation in a single file
 */
export function analyze_type_propagation(
  tree: SyntaxNode,
  source_code: string,
  language: Language,
  file_path?: FilePath
): PropagationAnalysis {
  const context: TypePropagationContext = {
    language,
    source_code,
    file_path,
    known_types: new Map()
  };
  
  // Get language-specific type propagation
  const normalized_language = normalize_language(language);
  const flows = propagate_types_in_tree(tree, context);
  
  // Build propagation paths
  const paths: PropagationPath[] = [];
  const type_map = new Map<string, string>();
  
  // Track type assignments
  for (const flow of flows) {
    if (flow.flow_kind === 'assignment') {
      type_map.set(flow.target_identifier, flow.source_type);
    }
    
    // Build path if there's a chain
    // This is simplified - real path building would track actual flow chains
    paths.push({
      path: [flow],
      confidence: flow.confidence
    });
  }
  
  return { flows, paths, type_map };
}

/**
 * @testonly - Propagate types through a syntax tree
 */
export function propagate_types_in_tree(
  node: SyntaxNode,
  context: TypePropagationContext
): TypeFlow[] {
  const flows: TypeFlow[] = [];
  const normalized_language = normalize_language(context.language);
  
  // Dispatch to language-specific handlers
  switch (normalized_language) {
    case 'javascript':
    case 'jsx' as any:
      flows.push(...propagate_javascript_types(node, context));
      break;
      
    case 'typescript':
    case 'tsx' as any:
      flows.push(...propagate_typescript_types(node, context));
      break;
      
    case 'python':
      flows.push(...propagate_python_types(node, context));
      break;
      
    case 'rust':
      flows.push(...propagate_rust_types(node, context));
      break;
  }
  
  // Recursively process children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      flows.push(...propagate_types_in_tree(child, context));
    }
  }
  
  return flows;
}

/**
 * @testonly - Find all type propagation paths in a tree
 */
export function find_all_propagation_paths(
  tree: SyntaxNode,
  source_code: string,
  language: Language
): PropagationPath[] {
  const analysis = analyze_type_propagation(tree, source_code, language);
  return analysis.paths;
}

/**
 * @testonly - Get the inferred type for an identifier
 */
export function get_inferred_type(
  identifier: string,
  tree: SyntaxNode,
  source_code: string,
  language: Language
): string | undefined {
  const analysis = analyze_type_propagation(tree, source_code, language);
  return analysis.type_map.get(identifier);
}

/**
 * @testonly - Check if two types are compatible
 */
export function are_types_compatible(type1: string, type2: string, language: Language): boolean {
  // Simplified type compatibility check
  if (type1 === type2) return true;
  if (type1 === 'any' || type2 === 'any') return true;
  if (type1 === 'unknown' || type2 === 'unknown') return true;
  
  // Language-specific compatibility
  switch (language) {
    case 'javascript':
    case 'jsx' as any:
      // JS is very permissive
      return true;
      
    case 'typescript':
    case 'tsx' as any:
      // Check structural compatibility
      if ((type1 === 'number' && type2 === 'string') ||
          (type1 === 'string' && type2 === 'number')) {
        return false;
      }
      return true;
      
    case 'python':
      // Python has duck typing
      return true;
      
    case 'rust':
      // Rust is very strict
      return type1 === type2;
      
    default:
      return false;
  }
}

/**
 * Helper: Normalize language variants
 */
function normalize_language(language: Language | string): Language {
  switch (language) {
    case 'jsx' as any:
      return 'javascript';
    case 'tsx' as any:
      return 'typescript';
    default:
      return language as Language;
  }
}
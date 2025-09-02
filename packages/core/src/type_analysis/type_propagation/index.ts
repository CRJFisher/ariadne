/**
 * Type propagation dispatcher
 * 
 * Routes type propagation analysis to language-specific implementations
 */

import { SyntaxNode } from 'tree-sitter';
import { 
  Language,
  TypeFlow,
  PropagationPath
} from '@ariadnejs/types';
import {
  TypePropagationContext,
  PropagationAnalysis,
  propagate_assignment_types,
  propagate_return_types,
  propagate_parameter_types,
  propagate_property_types,
  build_propagation_paths,
  merge_type_flows
} from './type_propagation';
import { propagate_javascript_types, handle_closure_capture } from './type_propagation.javascript';
import { propagate_typescript_types, handle_utility_types } from './type_propagation.typescript';
import { propagate_python_types, handle_with_statement } from './type_propagation.python';
import { propagate_rust_types } from './type_propagation.rust';
import {
  propagate_function_call_types,
  propagate_method_call_types,
  propagate_constructor_call_types,
  merge_call_type_flows
} from './call_propagation';

// Re-export core types and functions
export {
  TypeFlow,
  PropagationPath,
  TypePropagationContext,
  propagate_assignment_types,
  propagate_return_types,
  propagate_parameter_types,
  propagate_property_types,
  build_propagation_paths,
  merge_type_flows
};

// Re-export language-specific handlers
export {
  propagate_javascript_types,
  handle_closure_capture,
  propagate_typescript_types,
  handle_utility_types,
  propagate_python_types,
  handle_with_statement,
  propagate_rust_types
};

// Re-export call propagation functions
export {
  propagate_function_call_types,
  propagate_method_call_types,
  propagate_constructor_call_types,
  merge_call_type_flows
};

/**
 * Main entry point for type propagation analysis
 */
export function analyze_type_propagation(
  node: SyntaxNode,
  source_code: string,
  language: Language,
  scope_tree?: any, // From scope_tree - Layer 2
  known_types?: Map<string, string>,
  type_tracker?: any, // From type_tracking - Layer 3
  function_calls?: any[], // From function_calls - Layer 4
  method_calls?: any[] // From method_calls - Layer 4
): TypeFlow[] {
  const context: TypePropagationContext = {
    source_code,
    language,
    scope_tree,
    known_types: known_types || new Map()
  };
  
  // Route to language-specific implementation
  switch (language) {
    case 'javascript':
    case 'jsx':
      return propagate_javascript_types(node, context);
    
    case 'typescript':
    case 'tsx':
      return propagate_typescript_types(node, context);
    
    case 'python':
      return propagate_python_types(node, context);
    
    case 'rust':
      return propagate_rust_types(node, context);
    
    default:
      // Use generic propagation for unknown languages
      return propagate_assignment_types(node, context);
  }
}

/**
 * Propagate types through an entire AST
 */
export function propagate_types_in_tree(
  root: SyntaxNode,
  source_code: string,
  language: Language,
  scope_tree?: any, // From scope_tree - Layer 2
  initial_types?: Map<string, string>,
  type_tracker?: any, // From type_tracking - Layer 3
  function_calls?: any[], // From function_calls - Layer 4
  method_calls?: any[], // From method_calls - Layer 4
  constructor_calls?: any[], // From constructor_calls - Layer 4
  class_hierarchy?: any, // From class_hierarchy - Global Assembly
  type_registry?: any // From type_registry - Global Assembly
): Map<string, TypeFlow[]> {
  const type_flows_by_identifier = new Map<string, TypeFlow[]>();
  const known_types = new Map(initial_types);
  
  const context: TypePropagationContext = {
    source_code,
    language,
    scope_tree,
    known_types
  };
  
  // Traverse the AST and collect type flows
  function traverse(node: SyntaxNode) {
    // Get type flows for this node
    const flows = analyze_type_propagation(node, source_code, language, scope_tree, known_types);
    
    // Group flows by target identifier
    for (const flow of flows) {
      const existing = type_flows_by_identifier.get(flow.target_identifier) || [];
      existing.push(flow);
      type_flows_by_identifier.set(flow.target_identifier, existing);
      
      // Update known types for subsequent analysis
      if (flow.confidence === 'explicit' || flow.confidence === 'inferred') {
        known_types.set(flow.target_identifier, flow.source_type);
      }
    }
    
    // Traverse children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse(child);
      }
    }
  }
  
  traverse(root);
  
  // Add call graph type flows if available
  if (function_calls || method_calls || constructor_calls) {
    const function_flows = function_calls 
      ? propagate_function_call_types(function_calls, context, type_tracker?.variable_types)
      : [];
    
    const method_flows = method_calls
      ? propagate_method_call_types(method_calls, context, type_tracker?.variable_types, class_hierarchy)
      : [];
    
    const constructor_flows = constructor_calls
      ? propagate_constructor_call_types(constructor_calls, context, type_registry)
      : [];
    
    // Merge call flows into the main flows
    const call_flows = merge_call_type_flows(function_flows, method_flows, constructor_flows);
    
    for (const flow of call_flows) {
      const existing = type_flows_by_identifier.get(flow.target_identifier) || [];
      existing.push(flow);
      type_flows_by_identifier.set(flow.target_identifier, existing);
    }
  }
  
  return type_flows_by_identifier;
}

/**
 * Find all type propagation paths between two identifiers
 */
export function find_all_propagation_paths(
  from_identifier: string,
  to_identifier: string,
  root: SyntaxNode,
  source_code: string,
  language: Language,
  scope_tree?: any, // From scope_tree - Layer 2
  type_tracker?: any // From type_tracking - Layer 3
): PropagationPath[] {
  const type_flows = propagate_types_in_tree(root, source_code, language);
  const paths: PropagationPath[] = [];
  
  // Build a graph of type flows
  const flow_graph = new Map<string, TypeFlow[]>();
  for (const [identifier, flows] of type_flows) {
    flow_graph.set(identifier, flows);
  }
  
  // DFS to find all paths
  function find_paths(
    current: string,
    target: string,
    visited: Set<string>,
    current_path: TypeFlow[]
  ) {
    if (current === target && current_path.length > 0) {
      paths.push({
        path: [...current_path],
        confidence: get_path_confidence(current_path)
      });
      return;
    }
    
    visited.add(current);
    
    const flows = flow_graph.get(current) || [];
    for (const flow of flows) {
      if (!visited.has(flow.target_identifier)) {
        find_paths(
          flow.target_identifier,
          target,
          visited,
          [...current_path, flow]
        );
      }
    }
    
    visited.delete(current);
  }
  
  find_paths(from_identifier, to_identifier, new Set(), []);
  return paths;
}

/**
 * Get overall confidence for a propagation path
 */
function get_path_confidence(flows: TypeFlow[]): 'explicit' | 'inferred' | 'assumed' {
  if (flows.every(f => f.confidence === 'explicit')) return 'explicit';
  if (flows.some(f => f.confidence === 'assumed')) return 'assumed';
  return 'inferred';
}

/**
 * Get the most likely type for an identifier based on all type flows
 */
export function get_inferred_type(
  identifier: string,
  type_flows: Map<string, TypeFlow[]>
): string | undefined {
  const flows = type_flows.get(identifier);
  if (!flows || flows.length === 0) return undefined;
  
  // Sort by confidence and position (later assignments override earlier ones)
  const sorted_flows = [...flows].sort((a, b) => {
    // First sort by confidence
    const confidence_order = { 'explicit': 0, 'inferred': 1, 'assumed': 2 };
    const confidence_diff = confidence_order[a.confidence] - confidence_order[b.confidence];
    if (confidence_diff !== 0) return confidence_diff;
    
    // Then by position (later positions have higher priority)
    return b.position.row - a.position.row;
  });
  
  return sorted_flows[0]?.source_type;
}

/**
 * Check if two types are compatible
 */
export function are_types_compatible(type1: string, type2: string, language: Language): boolean {
  // Exact match
  if (type1 === type2) return true;
  
  // Handle any/unknown types
  if (type1 === 'any' || type2 === 'any') return true;
  if (type1 === 'unknown' || type2 === 'unknown') return true;
  
  // Language-specific compatibility rules
  switch (language) {
    case 'javascript':
    case 'jsx':
      // JavaScript has loose typing
      return true;
    
    case 'typescript':
    case 'tsx':
      // Check structural compatibility for TypeScript
      // This is simplified - real TypeScript compatibility is complex
      if (type1.includes('|') || type2.includes('|')) {
        // Union types - check if one is subset of other
        const types1 = type1.split('|').map(t => t.trim());
        const types2 = type2.split('|').map(t => t.trim());
        return types1.some(t1 => types2.includes(t1)) ||
               types2.some(t2 => types1.includes(t2));
      }
      return false;
    
    case 'python':
      // Python duck typing - most things are compatible at runtime
      return true;
    
    case 'rust':
      // Rust has strict typing
      // Check for reference compatibility
      if (type1.startsWith('&') && type2.startsWith('&')) {
        return are_types_compatible(type1.slice(1), type2.slice(1), language);
      }
      return false;
    
    default:
      return false;
  }
}

/**
 * Propagate types across all files in the codebase
 * This is the main entry point for Layer 7 type propagation
 */
export async function propagate_types_across_files(
  analyses: any[], // FileAnalysis from code_graph
  type_registry: any, // TypeRegistry from type_registry module
  resolved_generics: Map<string, any[]>, // From generic resolution (11.74.1)
  modules: any // ModuleGraph from module_graph
): Promise<Map<string, TypeFlow[]>> {
  const all_type_flows = new Map<string, TypeFlow[]>();
  
  // Process each file's analysis
  for (const analysis of analyses) {
    const file_flows: TypeFlow[] = [];
    const language = analysis.language;
    
    // Build context with known types from type registry and resolved generics
    const known_types = new Map<string, string>();
    
    // Add types from variables
    for (const variable of analysis.variables) {
      if (variable.type) {
        known_types.set(variable.name, variable.type);
      }
    }
    
    // Add types from function parameters and returns
    for (const func of analysis.functions) {
      if (func.return_type) {
        known_types.set(func.name, `() => ${func.return_type}`);
      }
      for (const param of func.parameters) {
        if (param.type) {
          known_types.set(param.name, param.type);
        }
      }
    }
    
    // Create propagation context
    const context: TypePropagationContext = {
      language,
      source_code: analysis.source_code || '',
      file_path: analysis.file_path,
      known_types
    };
    
    // Analyze assignments for type flow
    // Note: This is simplified - in reality we'd need the AST
    for (const variable of analysis.variables) {
      if (variable.initial_value) {
        // Create a type flow from the initial value to the variable
        file_flows.push({
          source_type: variable.type || 'unknown',
          target_identifier: variable.name,
          flow_kind: 'assignment',
          confidence: variable.type ? 'explicit' : 'inferred',
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
      const func_type = known_types.get(call.function_name);
      if (func_type && func_type.includes('=>')) {
        const return_type = func_type.split('=>')[1].trim();
        // This would need more context to know where the return value flows to
        // For now, just track that this call site has a known return type
        file_flows.push({
          source_type: return_type,
          target_identifier: `_call_${call.function_name}_${call.location.line}`,
          flow_kind: 'return',
          confidence: 'inferred',
          position: {
            row: call.location.line,
            column: call.location.column
          }
        });
      }
    }
    
    // Store flows for this file
    if (file_flows.length > 0) {
      all_type_flows.set(analysis.file_path, file_flows);
    }
  }
  
  return all_type_flows;
}
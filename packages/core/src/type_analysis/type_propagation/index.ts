/**
 * Type propagation module - Public API
 * 
 * This module provides type flow analysis through assignments, function calls,
 * and control flow narrowing.
 * 
 * ONLY exports the function used by code_graph.ts.
 */

import { 
  TypeFlow,
  FilePath,
  FileAnalysis,
  ResolvedGeneric
} from '@ariadnejs/types';
import { TypeRegistry } from '../type_registry';
import { ModuleGraphWithEdges } from '../../import_export/module_graph';

/**
 * Propagate types across all files in the codebase
 * This is the ONLY function used by code_graph.ts - the main entry point
 */
export async function propagate_types_across_files(
  analyses: FileAnalysis[],
  _type_registry: TypeRegistry,  // Reserved for future use
  resolved_generics: Map<string, ResolvedGeneric[]>,
  _modules: ModuleGraphWithEdges  // Reserved for future use
): Promise<Map<FilePath, TypeFlow[]>> {
  const all_type_flows = new Map<FilePath, TypeFlow[]>();
  
  // Process each file's analysis
  for (const analysis of analyses) {
    const file_flows: TypeFlow[] = [];
    
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
    
    // Context would be used here for more sophisticated type propagation
    // Currently we directly process the analysis data
    
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


/**
 * Core call analysis orchestration functions
 * 
 * This module contains the main entry points for analyzing function calls.
 * It orchestrates the other modules to perform complete call analysis.
 */

import { Def, Ref, FunctionCall } from '../../graph';
import { set_local_variable_type } from '../type_tracker';
import { TypeDiscovery } from '@ariadnejs/types';
import { 
  CallAnalysisConfig, 
  CallAnalysisResult
} from './types';
import { 
  find_definition_range, 
  is_position_within_range 
} from './range_utils';
import { 
  is_method_call_pattern, 
  is_reference_called 
} from './call_detection';
import { 
  analyze_constructor_call,
  ConstructorAnalysisConfig
} from './constructor_analysis';
import { 
  resolve_reference,
  resolve_call_return_type,
  ReferenceResolutionConfig
} from './reference_resolution';
import { 
  resolve_method_call_pure,
  resolve_method_on_type,
  MethodResolutionConfig
} from './method_resolution';

/**
 * Analyze all function calls made from within a definition
 * 
 * This is the main entry point for analyzing calls within a function, method,
 * or other definition. It performs a two-pass analysis:
 * 1. First pass: Identify constructor calls and track variable types
 * 2. Second pass: Resolve all references using the type information
 * 
 * @param def The definition to analyze calls from
 * @param config Configuration with all necessary data and functions
 * @returns All function calls and type discoveries made during analysis
 */
export function analyze_calls_from_definition(
  def: Def,
  config: CallAnalysisConfig
): CallAnalysisResult {
  const calls: FunctionCall[] = [];
  const typeDiscoveries: TypeDiscovery[] = [];
  
  const { graph, fileCache, localTypeTracker } = config;
  
  // Find the full definition body range
  const definitionRange = find_definition_range(def, fileCache);
  
  // Get all references in this file
  const refs = graph.getNodes<Ref>('reference');
  
  // Filter to only refs within this definition's range
  const definitionRefs = refs.filter(ref => 
    is_position_within_range(ref.range.start, definitionRange) &&
    is_position_within_range(ref.range.end, definitionRange)
  );
  
  // First pass: identify constructor calls and collect type discoveries
  const constructorConfig: ConstructorAnalysisConfig = {
    file_path: config.file_path,
    fileCache: config.fileCache,
    fileTypeTracker: config.fileTypeTracker,
    localTypeTracker: config.localTypeTracker,
    go_to_definition: config.go_to_definition,
    get_imports_with_definitions: config.get_imports_with_definitions
  };
  
  for (const ref of definitionRefs) {
    const constructorAnalysis = analyze_constructor_call(ref, def, constructorConfig);
    if (constructorAnalysis && constructorAnalysis.typeDiscoveries.length > 0) {
      typeDiscoveries.push(...constructorAnalysis.typeDiscoveries);
    }
  }
  
  // Second pass: resolve all references including method calls
  // Create an updated local type tracker with discovered types
  let currentLocalTracker = localTypeTracker;
  
  // Apply discovered types to the local tracker
  for (const discovery of typeDiscoveries) {
    if (discovery.scope === 'local') {
      currentLocalTracker = set_local_variable_type(
        currentLocalTracker,
        discovery.variableName,
        discovery.typeInfo
      );
    }
  }
  
  // Create resolution configs
  const methodConfig: MethodResolutionConfig = {
    file_path: config.file_path,
    graph: config.graph,
    fileCache: config.fileCache,
    get_file_graph: config.get_file_graph,
    get_file_cache: config.get_file_cache
  };
  
  const referenceConfig: ReferenceResolutionConfig = {
    file_path: config.file_path,
    fileCache: config.fileCache,
    go_to_definition: config.go_to_definition,
    get_imports_with_definitions: config.get_imports_with_definitions,
    get_file_graph: config.get_file_graph,
    resolve_method_call: (ref, objName) => 
      resolve_method_call_pure(ref, objName, methodConfig, currentLocalTracker),
    resolve_method_on_type: (ref, typeName) => 
      resolve_method_on_type(ref, typeName, methodConfig)
  };
  
  for (const ref of definitionRefs) {
    const resolved = resolve_reference(ref, def, referenceConfig, currentLocalTracker);
    
    // Check if this reference is part of a call expression
    const isCallExpression = is_reference_called(ref, fileCache);
    
    if (resolved.resolved) {
      // Check if this is a callable symbol
      const callable_kinds = ['function', 'method', 'generator', 'class', 'constructor', 'struct'];
      
      // Also treat unresolved imports as callable if they are being called
      const isImportBeingCalled = resolved.resolved.symbol_kind === 'import' && isCallExpression;
      
      if (callable_kinds.includes(resolved.resolved.symbol_kind) || isImportBeingCalled) {
        // Determine if this is a method call
        const is_method_call = ref.symbol_kind === 'method' || 
          is_method_call_pattern(ref, def.file_path, fileCache);
        
        const call: FunctionCall = {
          caller_def: def,
          called_def: resolved.resolved,
          call_location: ref.range.start,
          is_method_call,
          is_constructor_call: ref.symbol_kind === 'constructor'
        };
        calls.push(call);
      }
    } else if (!resolved.resolved && isCallExpression) {
      // This is an unresolved call (likely a built-in)
      // Create a synthetic definition for tracking
      const syntheticDef: Def = {
        id: -1, // Special ID for built-ins
        kind: 'definition',
        name: ref.name,
        symbol_id: `<builtin>#${ref.name}`,
        symbol_kind: ref.symbol_kind === 'method' ? 'method' : 'function',
        range: ref.range,
        file_path: '<builtin>'
      };
      
      const call: FunctionCall = {
        caller_def: def,
        called_def: syntheticDef,
        call_location: ref.range.start,
        is_method_call: ref.symbol_kind === 'method',
        is_constructor_call: false
      };
      calls.push(call);
    }
    
    // Collect any type discoveries from method resolution
    typeDiscoveries.push(...resolved.typeDiscoveries);
  }
  
  return {
    calls,
    typeDiscoveries
  };
}

/**
 * Analyze module-level calls (calls made outside any function/class)
 * 
 * This function identifies and analyzes function calls that occur at the
 * module level, outside of any function or class definition. These are
 * typically initialization calls or module setup code.
 * 
 * @param file_path The file path to analyze
 * @param config Configuration with all necessary data and functions
 * @returns All module-level function calls
 */
export function analyze_module_level_calls(
  file_path: string,
  config: CallAnalysisConfig
): CallAnalysisResult {
  const { graph, fileCache } = config;
  const calls: FunctionCall[] = [];
  const typeDiscoveries: TypeDiscovery[] = [];
  
  // Get all references in the file
  const refs = graph.getNodes<Ref>('reference');
  
  // Get all definitions to check ranges
  const defs = graph.getNodes<Def>('definition');
  
  // Filter to only references that are NOT within any definition
  const moduleLevelRefs = refs.filter(ref => {
    // Check if this ref is inside any definition
    for (const def of defs) {
      // Use enclosing_range if available, otherwise use range
      const defRange = (def as any).enclosing_range || def.range;
      if (is_position_within_range(ref.range.start, defRange) &&
          is_position_within_range(ref.range.end, defRange)) {
        return false; // This ref is inside a definition
      }
    }
    return true; // This ref is at module level
  });
  
  // Create a pseudo-definition for the module
  const moduleDef: Def = {
    id: -1, // Special ID for module
    kind: 'definition',
    name: '<module>',
    symbol_id: `${file_path}#<module>`,
    symbol_kind: 'module' as any,
    range: { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } },
    file_path: file_path
  };
  
  // For each module-level reference, try to resolve it
  for (const ref of moduleLevelRefs) {
    const resolved = config.go_to_definition(file_path, ref.range.start);
    
    // Check if this reference is part of a call expression
    const isCallExpression = is_reference_called(ref, fileCache);
    
    if (resolved) {
      // If resolved to an import, try to resolve the import
      let final_resolved = resolved;
      if (resolved.symbol_kind === 'import') {
        const imports = config.get_imports_with_definitions(file_path);
        const import_info = imports.find(imp => 
          imp.import_statement.name === resolved.name &&
          imp.import_statement.range.start.row === resolved.range.start.row &&
          imp.import_statement.range.start.column === resolved.range.start.column
        );
        
        if (import_info && import_info.imported_function) {
          final_resolved = import_info.imported_function;
        }
      }
      
      // Include all callable symbol kinds
      const callable_kinds = ['function', 'method', 'generator', 'class', 'constructor'];
      if (callable_kinds.includes(final_resolved.symbol_kind)) {
        // Check if this is a method call
        const is_method_call = ref.symbol_kind === 'method' || 
          is_method_call_pattern(ref, file_path, fileCache);
        
        const call: FunctionCall = {
          caller_def: moduleDef,
          called_def: final_resolved,
          call_location: ref.range.start,
          is_method_call,
          is_constructor_call: ref.symbol_kind === 'constructor' || final_resolved.symbol_kind === 'constructor'
        };
        calls.push(call);
      }
    } else if (!resolved && isCallExpression) {
      // This is an unresolved call (likely a built-in)
      // Create a synthetic definition for tracking
      const syntheticDef: Def = {
        id: -1, // Special ID for built-ins
        kind: 'definition',
        name: ref.name,
        symbol_id: `<builtin>#${ref.name}`,
        symbol_kind: ref.symbol_kind === 'method' ? 'method' : 'function',
        range: ref.range,
        file_path: '<builtin>'
      };
      
      const call: FunctionCall = {
        caller_def: moduleDef,
        called_def: syntheticDef,
        call_location: ref.range.start,
        is_method_call: ref.symbol_kind === 'method',
        is_constructor_call: false
      };
      calls.push(call);
    }
  }
  
  return {
    calls,
    typeDiscoveries
  };
}

// Re-export the main resolution functions for external use
export { resolve_method_call_pure } from './method_resolution';
export { compute_class_enclosing_range } from './range_utils';
export { resolve_call_return_type } from './reference_resolution';
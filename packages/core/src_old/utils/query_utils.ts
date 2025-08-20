/**
 * Query utilities for working with scope graphs and definitions
 * 
 * These utilities provide common query operations across the project.
 * Extracted from the defunct NavigationService.
 */

import { Def, IScopeGraph } from '../graph';
import { ProjectState } from '../storage/storage_interface';

/**
 * Options for filtering functions
 */
export interface FunctionFilterOptions {
  include_private?: boolean;
  include_tests?: boolean;
  symbol_kinds?: string[];
  file_filter?: (filePath: string) => boolean;
}

/**
 * Get all functions in a specific file
 */
export function get_functions_in_file(
  graph: IScopeGraph | undefined
): Def[] {
  if (!graph) return [];
  
  return graph.getNodes<Def>('definition').filter(def => 
    def.symbol_kind === 'function' || 
    def.symbol_kind === 'method' ||
    def.symbol_kind === 'generator'
  );
}

/**
 * Get all definitions in a file
 */
export function get_definitions_in_file(
  graph: IScopeGraph | undefined
): Def[] {
  if (!graph) return [];
  return graph.getNodes<Def>('definition');
}

/**
 * Get all functions across the project with filtering
 */
export function get_all_functions(
  state: ProjectState,
  options?: FunctionFilterOptions
): Map<string, Def[]> {
  const {
    include_private = true,
    include_tests = true,
    symbol_kinds = ['function', 'method', 'generator'],
    file_filter
  } = options || {};
  
  const result = new Map<string, Def[]>();
  
  for (const [filePath, graph] of state.file_graphs) {
    // Apply file filter if provided
    if (file_filter && !file_filter(filePath)) continue;
    
    const functions = graph.getNodes<Def>('definition').filter(def => {
      // Check symbol kind
      if (!symbol_kinds.includes(def.symbol_kind)) return false;
      
      // Filter private functions
      if (!include_private && is_private_function(def)) return false;
      
      // Filter test functions
      if (!include_tests && is_test_function(def)) return false;
      
      return true;
    });
    
    if (functions.length > 0) {
      result.set(filePath, functions);
    }
  }
  
  return result;
}

/**
 * Get all functions as a flat array
 */
export function get_all_functions_flat(
  state: ProjectState,
  options?: FunctionFilterOptions
): Def[] {
  const allFunctions = get_all_functions(state, options);
  const functions: Def[] = [];
  
  for (const [_, fileFunctions] of allFunctions) {
    functions.push(...fileFunctions);
  }
  
  return functions;
}

/**
 * Get exported functions from a module
 */
export function get_exported_functions(
  graph: IScopeGraph | undefined
): Def[] {
  if (!graph) return [];
  
  const exportedFunctions: Def[] = [];
  const allDefs = graph.getNodes<Def>('definition');
  
  // Filter to only functions/generators that are exported
  for (const def of allDefs) {
    // Include functions and generators, but exclude methods
    if (['function', 'generator'].includes(def.symbol_kind)) {
      // Skip methods (they have class_name in metadata)
      if (def.metadata?.class_name) {
        continue;
      }
      
      // Check if this definition is exported
      if (def.is_exported === true) {
        exportedFunctions.push(def);
      }
    }
  }
  
  return exportedFunctions;
}

/**
 * Check if a definition is exported
 */
export function is_definition_exported(
  state: ProjectState,
  filePath: string,
  defName: string
): boolean {
  const tracker = state.call_graph_data.fileTypeTrackers.get(filePath);
  return tracker ? tracker.exportedDefinitions.has(defName) : false;
}

/**
 * Check if a function is private (starts with underscore)
 */
export function is_private_function(def: Def): boolean {
  return def.name.startsWith('_') && !def.name.startsWith('__');
}

/**
 * Check if a function is a test function
 */
export function is_test_function(def: Def): boolean {
  const name = def.name.toLowerCase();
  return name.startsWith('test') || 
         name.startsWith('test_') || 
         name.includes('_test') ||
         name === 'setup' ||
         name === 'teardown';
}

/**
 * Filter definitions by symbol kind
 */
export function filter_by_symbol_kind(
  defs: Def[],
  kinds: string[]
): Def[] {
  return defs.filter(def => kinds.includes(def.symbol_kind));
}

/**
 * Group definitions by file
 */
export function group_definitions_by_file(
  defs: Def[]
): Map<string, Def[]> {
  const grouped = new Map<string, Def[]>();
  
  for (const def of defs) {
    const fileDefs = grouped.get(def.file_path) || [];
    fileDefs.push(def);
    grouped.set(def.file_path, fileDefs);
  }
  
  return grouped;
}
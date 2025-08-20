/**
 * Method resolution functions for resolving method calls on objects
 * 
 * This module handles resolution of method calls by tracking object types
 * and finding the corresponding method definitions within class scopes.
 */

import { Def, Ref, ScopeGraph } from '../../graph';
import { Tree } from 'tree-sitter';
import { TypeDiscovery, SimpleRange } from '@ariadnejs/types';
import { 
  get_local_variable_type,
  LocalTypeTrackerData
} from '../type_tracker';
import { 
  is_position_within_range, 
  compute_class_enclosing_range
} from './range_utils';
import { MethodResolutionResult } from './reference_resolution';

/**
 * File cache interface
 */
interface FileCache {
  tree: Tree;
  source_code: string;
  graph: ScopeGraph;
}

/**
 * Configuration for method resolution
 */
export interface MethodResolutionConfig {
  readonly file_path: string;
  readonly graph: ScopeGraph;
  readonly fileCache: FileCache;
  readonly get_file_graph?: (file_path: string) => ScopeGraph | undefined;
  readonly get_file_cache?: (file_path: string) => FileCache | undefined;
}

/**
 * Resolve a method call on an object using type information
 * 
 * This function uses the type tracker to find what class an object belongs to,
 * then searches for the method within that class's scope.
 * 
 * @param ref The method reference to resolve
 * @param objectName The name of the object the method is called on
 * @param config Configuration with graph access functions
 * @param localTypeTracker Type information for local variables
 * @returns The resolved method definition and any type discoveries
 */
export function resolve_method_call_pure(
  ref: Ref,
  objectName: string,
  config: MethodResolutionConfig,
  localTypeTracker: LocalTypeTrackerData
): MethodResolutionResult {
  const typeDiscoveries: TypeDiscovery[] = [];
  
  // Get type information for the object
  const typeInfo = get_local_variable_type(localTypeTracker, objectName, ref.range.start);
  
  
  if (typeInfo && typeInfo.classDef) {
    // We have type information for this variable
    const methodName = ref.name;
    
    // Get all methods in the class file
    if (config.get_file_graph && typeInfo.classDef.file_path) {
      const classGraph = config.get_file_graph(typeInfo.classDef.file_path);
      const classDefs = classGraph ? classGraph.getNodes<Def>('definition') : [];
      
      // Compute enclosing_range if not available
      let classRange: SimpleRange | undefined = (typeInfo.classDef as any).enclosing_range;
      if (!classRange && config.get_file_cache) {
        const classFileCache = config.get_file_cache(typeInfo.classDef.file_path);
        if (classFileCache) {
          classRange = compute_class_enclosing_range(typeInfo.classDef, classFileCache.tree);
        }
      }
      // Fall back to range if still not available
      classRange = classRange || typeInfo.classDef.range;
      
      // Find method by checking if it's within the class range OR has matching symbol_id
      // For Rust, methods are in impl blocks separate from structs, so we check symbol_id
      const expectedSymbolId = `${typeInfo.classDef.file_path.replace('.rs', '')}#${typeInfo.className}.${methodName}`;
      
      const method = classDefs.find((m: Def) => 
        m.name === methodName && 
        (m.symbol_kind === 'method' || m.symbol_kind === 'function') &&
        (
          // Either within class range (for most languages)
          (is_position_within_range(m.range.start, classRange!) &&
           is_position_within_range(m.range.end, classRange!)) ||
          // Or has matching symbol_id (for Rust impl blocks)
          m.symbol_id === expectedSymbolId
        )
      );
      
      
      if (method) {
        return { resolved: method, typeDiscoveries };
      }
    }
  }
  
  return { typeDiscoveries };
}

/**
 * Resolve a method on a specific type name
 * 
 * This function finds a type definition by name and then searches for
 * a method within that type's scope. Used for resolving chained method calls
 * where we know the return type.
 * 
 * @param methodRef The method reference to resolve
 * @param typeName The name of the type to search for the method
 * @param config Configuration with graph access
 * @returns The resolved method definition if found
 */
export function resolve_method_on_type(
  methodRef: Ref,
  typeName: string,
  config: MethodResolutionConfig
): Def | undefined {
  // Try to find the type definition
  // First, check if it's a class/struct in the current file
  const currentGraph = config.graph;
  const typeDef = currentGraph.getNodes<Def>('definition').find(d => 
    d.name === typeName && 
    (d.symbol_kind === 'class' || d.symbol_kind === 'struct')
  );
  
  if (typeDef && config.get_file_graph) {
    const typeGraph = config.get_file_graph(typeDef.file_path);
    if (typeGraph) {
      const classDefs = typeGraph.getNodes<Def>('definition');
      
      // Look for the method within the class
      const method = classDefs.find(d => 
        d.name === methodRef.name && 
        (d.symbol_kind === 'method' || d.symbol_kind === 'function') &&
        is_method_of_class(d, typeDef, config)
      );
      
      if (method) {
        return method;
      }
    }
  }
  
  return undefined;
}

/**
 * Check if a definition is a method of a specific class
 * 
 * This function verifies that a method definition is within the scope
 * of a class by checking if its position is within the class's enclosing range.
 * 
 * @param methodDef The method definition to check
 * @param classDef The class definition to check against
 * @param config Configuration for accessing file cache if needed
 * @returns True if the method belongs to the class
 */
export function is_method_of_class(
  methodDef: Def,
  classDef: Def,
  config?: { get_file_cache?: (file_path: string) => FileCache | undefined }
): boolean {
  // Get the class's enclosing range
  let classRange: SimpleRange | undefined = (classDef as any).enclosing_range;
  
  // If not available and we have config, try to compute it
  if (!classRange && config?.get_file_cache && classDef.file_path) {
    const fileCache = config.get_file_cache(classDef.file_path);
    if (fileCache) {
      classRange = compute_class_enclosing_range(classDef, fileCache.tree);
    }
  }
  
  // Fall back to the definition's range
  classRange = classRange || classDef.range;
  
  return is_position_within_range(methodDef.range.start, classRange) &&
         is_position_within_range(methodDef.range.end, classRange);
}
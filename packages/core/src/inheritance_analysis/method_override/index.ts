/**
 * Method Override Detection - Language Dispatcher
 * 
 * Routes method override detection to language-specific implementations
 * following the Architecture.md marshaling pattern.
 */

import { Parser, SyntaxNode } from 'tree-sitter';
import { Def } from '@ariadnejs/types';
import { 
  MethodOverride,
  OverrideInfo,
  MethodOverrideMap,
  analyze_method_overrides,
  is_overridden,
  is_override,
  get_root_method
} from './method_override';
import { detect_javascript_overrides } from './method_override.javascript';
import { detect_python_overrides } from './method_override.python';
import { detect_rust_overrides } from './method_override.rust';
import { ClassHierarchy } from '../class_hierarchy/class_hierarchy';

// Re-export core types
export {
  MethodOverride,
  OverrideInfo,
  MethodOverrideMap,
  is_overridden,
  is_override,
  get_root_method
};

/**
 * Language metadata for override detection
 */
export interface OverrideMetadata {
  language: string;
  file_path: string;
  parser: Parser;
}

/**
 * Processor function type
 */
type OverrideProcessor = (
  ast: SyntaxNode,
  file_path: string,
  parser: Parser
) => MethodOverrideMap;

/**
 * Language-specific processors
 */
const processors: Record<string, OverrideProcessor> = {
  javascript: detect_javascript_overrides,
  typescript: detect_javascript_overrides, // Share with JavaScript
  python: detect_python_overrides,
  rust: detect_rust_overrides
};

/**
 * Detect method overrides in code
 * 
 * This is the main entry point that dispatches to language-specific implementations.
 * 
 * @param ast - The parsed AST
 * @param metadata - Language and file metadata
 * @returns Map of method override relationships
 */
export function detect_method_overrides(
  ast: SyntaxNode,
  metadata: OverrideMetadata
): MethodOverrideMap {
  const processor = processors[metadata.language];
  
  if (!processor) {
    // Return empty map for unsupported languages
    return {
      overrides: new Map(),
      override_edges: [],
      leaf_methods: [],
      abstract_methods: [],
      language: metadata.language
    };
  }
  
  // Dispatch to language-specific processor
  return processor(ast, metadata.file_path, metadata.parser);
}

/**
 * Analyze method overrides with a pre-built class hierarchy
 * 
 * This variant accepts an existing class hierarchy and method definitions,
 * useful when integrating with other analysis passes.
 * 
 * @param hierarchy - Pre-built class hierarchy
 * @param class_methods - Map of class names to their methods
 * @returns Map of method override relationships
 */
export function analyze_overrides_with_hierarchy(
  hierarchy: ClassHierarchy,
  class_methods: Map<string, Def[]>
): MethodOverrideMap {
  return analyze_method_overrides(hierarchy, class_methods);
}

/**
 * Find all methods that override a given method
 * 
 * @param method - The method to check
 * @param override_map - The override map
 * @returns Array of methods that override the given method
 */
export function find_overriding_methods(
  method: Def,
  override_map: MethodOverrideMap
): Def[] {
  const key = `${method.file_path}.${method.name}`;
  const info = override_map.overrides.get(key);
  return info ? info.overridden_by : [];
}

/**
 * Find the method that a given method overrides
 * 
 * @param method - The method to check
 * @param override_map - The override map
 * @returns The overridden method, or undefined
 */
export function find_overridden_method(
  method: Def,
  override_map: MethodOverrideMap
): Def | undefined {
  const key = `${method.file_path}.${method.name}`;
  const info = override_map.overrides.get(key);
  return info?.overrides;
}

/**
 * Get the complete override chain for a method
 * 
 * @param method - The method to get the chain for
 * @param override_map - The override map
 * @returns Array of methods from root to the given method
 */
export function get_override_chain(
  method: Def,
  override_map: MethodOverrideMap
): Def[] {
  const key = `${method.file_path}.${method.name}`;
  const info = override_map.overrides.get(key);
  return info ? info.override_chain : [method];
}

/**
 * Check if a method is abstract
 * 
 * @param method - The method to check
 * @param override_map - The override map
 * @returns True if the method is abstract
 */
export function is_abstract_method(
  method: Def,
  override_map: MethodOverrideMap
): boolean {
  const key = `${method.file_path}.${method.name}`;
  const info = override_map.overrides.get(key);
  return info ? info.is_abstract : false;
}

/**
 * Check if a method is final/sealed
 * 
 * @param method - The method to check
 * @param override_map - The override map
 * @returns True if the method is final
 */
export function is_final_method(
  method: Def,
  override_map: MethodOverrideMap
): boolean {
  const key = `${method.file_path}.${method.name}`;
  const info = override_map.overrides.get(key);
  return info ? info.is_final : false;
}

/**
 * Get all leaf methods (methods not overridden by any subclass)
 * 
 * @param override_map - The override map
 * @returns Array of leaf methods
 */
export function get_leaf_methods(
  override_map: MethodOverrideMap
): Def[] {
  return override_map.leaf_methods;
}

/**
 * Get all abstract methods that need implementation
 * 
 * @param override_map - The override map
 * @returns Array of abstract methods
 */
export function get_abstract_methods(
  override_map: MethodOverrideMap
): Def[] {
  return override_map.abstract_methods;
}

/**
 * Get all override edges (relationships)
 * 
 * @param override_map - The override map
 * @returns Array of override relationships
 */
export function get_override_edges(
  override_map: MethodOverrideMap
): MethodOverride[] {
  return override_map.override_edges;
}

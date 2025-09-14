/**
 * Method Override Detection - Main Entry Point
 * 
 * Configuration-driven approach with language-specific bespoke handlers
 */

import { Parser, SyntaxNode } from 'tree-sitter';
import { Def } from '@ariadnejs/types';
import { 
  MethodOverride,
  OverrideInfo,
  MethodOverrideMap,
  is_overridden,
  is_override,
  get_root_method
} from './method_override';
import { detect_overrides_generic, MethodOverrideContext } from './method_override';
// TODO: Language-specific handlers will be replaced with tree-sitter queries
import { ClassHierarchy } from '../class_hierarchy/class_hierarchy';

// Re-export core types  
export {
  MethodOverride,
  OverrideInfo,
  MethodOverrideMap,
  is_overridden,
  is_override,
  get_root_method,
  detect_and_validate_method_overrides
} from './method_override';

/**
 * Alias for backwards compatibility
 */
export { analyze_overrides_with_hierarchy as analyze_method_overrides };

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
 * Bespoke handlers for language-specific features
 */
type BespokeHandler = (context: MethodOverrideContext) => void;
type RustBespokeHandler = (
  ast: SyntaxNode,
  file_path: string,
  parser: Parser,
  context: MethodOverrideContext
) => void;

/**
 * Detect method overrides in code
 * 
 * Uses configuration-driven generic processor with language-specific bespoke handlers
 * 
 * @param ast - The parsed AST
 * @param metadata - Language and file metadata
 * @returns Map of method override relationships
 */
export function detect_method_overrides(
  ast: SyntaxNode,
  metadata: OverrideMetadata
): MethodOverrideMap {
  // TODO: Implement using tree-sitter queries
  return {
    overrides: new Map(),
    override_edges: [],
    leaf_methods: [],
    abstract_methods: [],
    language: metadata.language
  };
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
  // TODO: Implement actual method override analysis
  // For now, return empty result
  return {
    overrides: new Map(),
    override_edges: [],
    leaf_methods: [],
    abstract_methods: [],
    language: 'unknown'
  };
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

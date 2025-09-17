/**
 * Method override detection stub
 *
 * TODO: Implement using tree-sitter queries from method_override_queries/*.scm
 */

import { SyntaxNode } from 'tree-sitter';
import { ClassDefinition, ClassHierarchy, MethodOverrideMap, SymbolName } from '@ariadnejs/types';

export interface MethodOverride {
  parent_method: Def;
  child_method: Def;
  override_type: 'override' | 'implement' | 'extend';
}

export interface OverrideInfo {
  method: Def;
  overrides: Def[];
  is_abstract: boolean;
  is_virtual: boolean;
}

export interface MethodSignature {
  name: SymbolName;
  parameters: string[];
  return_type?: string;
}

/**
 * Module context for sharing between generic and bespoke handlers
 */
export interface MethodOverrideContext {
  config: any;
  hierarchy: ClassHierarchy;
  all_methods: Map<string, Def[]>;
  overrides: Map<string, OverrideInfo>;
  override_edges: MethodOverride[];
  leaf_methods: Def[];
  abstract_methods: Def[];
}

export const MODULE_CONTEXT = 'method_override';

/**
 * Extract methods from a class using configuration
 */
export function extract_class_methods_generic(
  class_node: SyntaxNode,
  class_def: Def,
  file_path: string,
  config: any
): Def[] {
  // TODO: Implement using tree-sitter queries from method_override_queries/*.scm
  return [];
}

/**
 * Find parent method for override detection
 */
export function find_parent_method_generic(
  method: Def,
  class_hierarchy: ClassHierarchy,
  context: MethodOverrideContext
): Def | null {
  // TODO: Implement using tree-sitter queries
  return null;
}

/**
 * Find child overrides of a method
 */
export function find_child_overrides_generic(
  parent_method: Def,
  class_hierarchy: ClassHierarchy,
  context: MethodOverrideContext
): Def[] {
  // TODO: Implement using tree-sitter queries
  return [];
}

/**
 * Detect method overrides
 */
export function detect_overrides_generic(
  context: MethodOverrideContext
): MethodOverride[] {
  // TODO: Implement using tree-sitter queries
  return [];
}

/**
 * Main entry point for method override detection
 */
export function detect_and_validate_method_overrides(
  classes: ClassDefinition[],
  hierarchy: ClassHierarchy
): MethodOverrideMap {
  // TODO: Implement using tree-sitter queries from method_override_queries/*.scm
  return new Map();
}

/**
 * Extract method signature
 */
export function extract_method_signature(
  method_node: SyntaxNode,
  config: any
): MethodSignature | null {
  // TODO: Implement using tree-sitter queries
  return null;
}

/**
 * Check if method signatures match
 */
export function signatures_match(
  sig1: MethodSignature,
  sig2: MethodSignature
): boolean {
  return sig1.name === sig2.name &&
         sig1.parameters.length === sig2.parameters.length;
}
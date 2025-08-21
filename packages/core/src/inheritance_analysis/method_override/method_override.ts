/**
 * Method Override Detection and Analysis
 * 
 * This module provides functionality to detect and track method override relationships
 * in object-oriented code across multiple languages.
 */

import { Def } from '@ariadnejs/types';
import { ClassHierarchy, ClassInfo } from '../class_hierarchy/class_hierarchy';

/**
 * Represents a method override relationship
 */
export interface MethodOverride {
  /** The overriding method */
  method: Def;
  /** The method being overridden */
  base_method: Def;
  /** Full chain from method to root */
  override_chain: Def[];
  /** If base method is abstract */
  is_abstract: boolean;
  /** If base method is virtual (C++/C#) */
  is_virtual: boolean;
  /** If override is explicit (has override keyword/decorator) */
  is_explicit: boolean;
  /** Language of the override */
  language: string;
}

/**
 * Information about a method's override relationships
 */
export interface OverrideInfo {
  /** The method definition */
  method_def: Def;
  /** Method this overrides (if any) */
  overrides?: Def;
  /** Methods that override this one */
  overridden_by: Def[];
  /** Full inheritance chain */
  override_chain: Def[];
  /** Whether this method is abstract */
  is_abstract: boolean;
  /** Whether this method is final/sealed */
  is_final: boolean;
}

/**
 * Complete override information for a codebase
 */
export interface MethodOverrideMap {
  /** Map from method signature to override info */
  overrides: Map<string, OverrideInfo>;
  /** All override relationships */
  override_edges: MethodOverride[];
  /** Methods that are never overridden */
  leaf_methods: Def[];
  /** Abstract methods that must be implemented */
  abstract_methods: Def[];
  /** Language of the analysis */
  language: string;
}

/**
 * Method signature for comparison
 */
export interface MethodSignature {
  name: string;
  parameter_count?: number;
  parameter_types?: string[];
  return_type?: string;
}

/**
 * Extract method signature from a definition
 */
export function extract_method_signature(method: Def): MethodSignature {
  return {
    name: method.name,
    // TODO: Extract parameter count and types when type system is ready
    parameter_count: undefined,
    parameter_types: undefined,
    return_type: undefined
  };
}

/**
 * Check if two method signatures match (for override detection)
 */
export function signatures_match(sig1: MethodSignature, sig2: MethodSignature): boolean {
  // Basic name matching
  if (sig1.name !== sig2.name) {
    return false;
  }

  // TODO: Add parameter and return type matching when type system is ready
  // For now, just match by name
  return true;
}

/**
 * Find the base method that a given method overrides
 */
export function find_base_method(
  method: Def,
  class_info: ClassInfo,
  hierarchy: ClassHierarchy
): Def | undefined {
  const method_sig = extract_method_signature(method);
  
  // Walk up the inheritance chain
  for (const ancestor of class_info.all_ancestors) {
    const ancestor_info = hierarchy.classes.get(ancestor.name);
    if (!ancestor_info) continue;

    // Look for matching method in ancestor
    // TODO: Integration with symbol resolution to find methods in class
    // For now, we'll need language-specific implementations to provide this
  }

  return undefined;
}

/**
 * Find all methods that override a given method
 */
export function find_overriding_methods(
  method: Def,
  class_info: ClassInfo,
  hierarchy: ClassHierarchy
): Def[] {
  const overrides: Def[] = [];
  const method_sig = extract_method_signature(method);

  // Check all descendants
  for (const descendant of class_info.all_descendants) {
    const descendant_info = hierarchy.classes.get(descendant.name);
    if (!descendant_info) continue;

    // TODO: Integration with symbol resolution to find methods in class
    // For now, we'll need language-specific implementations to provide this
  }

  return overrides;
}

/**
 * Build a complete override chain for a method
 */
export function build_override_chain(
  method: Def,
  class_info: ClassInfo,
  hierarchy: ClassHierarchy
): Def[] {
  const chain: Def[] = [method];
  
  // Walk up to find base methods
  let current = method;
  let current_class = class_info;
  
  while (current_class) {
    const base = find_base_method(current, current_class, hierarchy);
    if (!base) break;
    
    chain.unshift(base);
    current = base;
    
    // Find the class containing the base method
    const base_class_name = base.name.split('.')[0]; // Simplified, need better parsing
    current_class = hierarchy.classes.get(base_class_name) || null;
  }

  return chain;
}

/**
 * Analyze all method override relationships in a class hierarchy
 */
export function analyze_method_overrides(
  hierarchy: ClassHierarchy,
  class_methods: Map<string, Def[]>
): MethodOverrideMap {
  const overrides = new Map<string, OverrideInfo>();
  const override_edges: MethodOverride[] = [];
  const leaf_methods: Def[] = [];
  const abstract_methods: Def[] = [];

  // Process each class in the hierarchy
  for (const [class_name, class_info] of hierarchy.classes) {
    const methods = class_methods.get(class_name) || [];
    
    for (const method of methods) {
      const method_key = `${class_name}.${method.name}`;
      
      // Find base method if this is an override
      const base_method = find_base_method(method, class_info, hierarchy);
      
      // Find methods that override this one
      const overriding = find_overriding_methods(method, class_info, hierarchy);
      
      // Build override chain
      const chain = build_override_chain(method, class_info, hierarchy);
      
      // Create override info
      const info: OverrideInfo = {
        method_def: method,
        overrides: base_method,
        overridden_by: overriding,
        override_chain: chain,
        is_abstract: false, // TODO: Detect from language-specific markers
        is_final: false    // TODO: Detect from language-specific markers
      };
      
      overrides.set(method_key, info);
      
      // Track leaf methods (not overridden)
      if (overriding.length === 0) {
        leaf_methods.push(method);
      }
      
      // Create override edge if this overrides something
      if (base_method) {
        override_edges.push({
          method,
          base_method,
          override_chain: chain,
          is_abstract: false, // TODO: Detect from base method
          is_virtual: false,  // TODO: Detect from base method
          is_explicit: false, // TODO: Detect from override markers
          language: hierarchy.language
        });
      }
    }
  }

  return {
    overrides,
    override_edges,
    leaf_methods,
    abstract_methods,
    language: hierarchy.language
  };
}

/**
 * Check if a method is overridden in any subclass
 */
export function is_overridden(
  method: Def,
  override_map: MethodOverrideMap
): boolean {
  const key = `${method.file_path}.${method.name}`;
  const info = override_map.overrides.get(key);
  return info ? info.overridden_by.length > 0 : false;
}

/**
 * Check if a method overrides a base method
 */
export function is_override(
  method: Def,
  override_map: MethodOverrideMap
): boolean {
  const key = `${method.file_path}.${method.name}`;
  const info = override_map.overrides.get(key);
  return info ? info.overrides !== undefined : false;
}

/**
 * Get the root method in an override chain
 */
export function get_root_method(
  method: Def,
  override_map: MethodOverrideMap
): Def {
  const key = `${method.file_path}.${method.name}`;
  const info = override_map.overrides.get(key);
  if (!info || info.override_chain.length === 0) {
    return method;
  }
  return info.override_chain[0];
}

// TODO: Integration with Class Hierarchy
// - Walk hierarchy for base methods
// TODO: Integration with Method Calls
// - Dynamic dispatch resolution
// TODO: Integration with Type Tracking
// - Ensure type compatibility

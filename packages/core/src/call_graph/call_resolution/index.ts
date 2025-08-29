/**
 * Call Resolution - Global Phase (Layer 9)
 * 
 * Resolves method and constructor calls using global information
 * that is only available after all files have been processed.
 */

import { 
  MethodCallInfo, 
  ConstructorCallInfo,
  ClassHierarchy,
  TypeRegistry,
  Language
} from '@ariadnejs/types';

/**
 * Resolved method call with full type information
 */
export interface ResolvedMethodCall extends MethodCallInfo {
  resolved_class?: string;      // The actual class where the method is defined
  inherited_from?: string;       // If inherited, the base class it comes from
  is_virtual?: boolean;          // Whether this is a virtual method call
  possible_targets?: string[];   // For dynamic dispatch, possible target methods
}

/**
 * Resolved constructor call with validation
 */
export interface ResolvedConstructorCall extends ConstructorCallInfo {
  is_valid: boolean;            // Whether the constructor exists in the registry
  resolved_type?: string;        // The fully qualified type name
  type_parameters?: string[];    // Resolved generic type parameters
}

/**
 * Resolve method calls using class hierarchy (Global Phase - Layer 9)
 * 
 * This function runs in the global phase after all files have been processed.
 * It uses the complete class hierarchy to resolve method calls to their actual
 * definitions, including inherited methods and virtual dispatch.
 * 
 * @param raw_calls Method calls collected during per-file phase (Layer 4)
 * @param class_hierarchy Complete class hierarchy from all files (Layer 6)
 * @param type_registry Complete type registry from all files (Layer 6)
 * @returns Fully resolved method calls with inheritance information
 */
export function resolve_method_calls(
  raw_calls: MethodCallInfo[],
  class_hierarchy: ClassHierarchy,
  type_registry: TypeRegistry
): ResolvedMethodCall[] {
  const resolved: ResolvedMethodCall[] = [];
  
  for (const call of raw_calls) {
    const resolved_call: ResolvedMethodCall = {
      ...call,
      resolved_class: call.receiver_type,
      inherited_from: undefined,
      is_virtual: false,
      possible_targets: []
    };
    
    // If we know the receiver type, look it up in the class hierarchy
    if (call.receiver_type && class_hierarchy.classes.has(call.receiver_type)) {
      const class_info = class_hierarchy.classes.get(call.receiver_type)!;
      
      // Check if the method is defined in this class
      const method = class_info.methods.find(m => m.name === call.method_name);
      if (method) {
        resolved_call.resolved_class = call.receiver_type;
      } else {
        // Check parent classes for inherited methods
        for (const base_class of class_info.base_classes || []) {
          if (class_hierarchy.classes.has(base_class)) {
            const parent_info = class_hierarchy.classes.get(base_class)!;
            const inherited_method = parent_info.methods.find(m => m.name === call.method_name);
            if (inherited_method) {
              resolved_call.resolved_class = base_class;
              resolved_call.inherited_from = base_class;
              resolved_call.is_virtual = inherited_method.is_abstract || false;
              break;
            }
          }
        }
      }
      
      // For virtual methods, find all possible implementations
      if (resolved_call.is_virtual) {
        resolved_call.possible_targets = find_virtual_method_targets(
          call.method_name,
          call.receiver_type!,
          class_hierarchy
        );
      }
    }
    
    resolved.push(resolved_call);
  }
  
  return resolved;
}

/**
 * Validate and resolve constructor calls (Global Phase - Layer 9)
 * 
 * This function runs in the global phase after all files have been processed.
 * It validates that constructors actually exist in the type registry and
 * resolves generic type parameters.
 * 
 * @param raw_calls Constructor calls collected during per-file phase (Layer 4)
 * @param type_registry Complete type registry from all files (Layer 6)
 * @param class_hierarchy Complete class hierarchy from all files (Layer 6)
 * @returns Validated and resolved constructor calls
 */
export function resolve_constructor_calls(
  raw_calls: ConstructorCallInfo[],
  type_registry: TypeRegistry,
  class_hierarchy: ClassHierarchy
): ResolvedConstructorCall[] {
  const resolved: ResolvedConstructorCall[] = [];
  
  for (const call of raw_calls) {
    const resolved_call: ResolvedConstructorCall = {
      ...call,
      is_valid: false,
      resolved_type: undefined,
      type_parameters: []
    };
    
    // Check if the constructor type exists in the registry
    const type_def = type_registry.types.get(call.class_name);
    if (type_def) {
      resolved_call.is_valid = true;
      resolved_call.resolved_type = type_def.name;
      
      // TODO: Resolve generic type parameters based on arguments
      // This would require type inference from the arguments
    }
    
    // Also check in class hierarchy for additional validation
    if (class_hierarchy.classes.has(call.class_name)) {
      resolved_call.is_valid = true;
      const class_info = class_hierarchy.classes.get(call.class_name)!;
      
      // Check if it's an abstract class (can't be instantiated)
      if (class_info.is_abstract) {
        resolved_call.is_valid = false;
      }
    }
    
    resolved.push(resolved_call);
  }
  
  return resolved;
}

/**
 * Find all possible targets for a virtual method call
 */
function find_virtual_method_targets(
  method_name: string,
  base_class: string,
  class_hierarchy: ClassHierarchy
): string[] {
  const targets: string[] = [];
  
  // Find all derived classes
  for (const [class_name, class_info] of class_hierarchy.classes) {
    if (class_info.base_classes?.includes(base_class)) {
      // Check if this class implements the method
      const has_method = class_info.methods.some(m => m.name === method_name);
      if (has_method) {
        targets.push(class_name);
      }
    }
  }
  
  return targets;
}

/**
 * Resolve all calls in a codebase (Global Phase - Layer 9)
 * 
 * Convenience function to resolve both method and constructor calls.
 * 
 * @param method_calls Raw method calls from per-file phase
 * @param constructor_calls Raw constructor calls from per-file phase
 * @param class_hierarchy Complete class hierarchy
 * @param type_registry Complete type registry
 * @returns Resolved calls
 */
export function resolve_all_calls(
  method_calls: MethodCallInfo[],
  constructor_calls: ConstructorCallInfo[],
  class_hierarchy: ClassHierarchy,
  type_registry: TypeRegistry
): {
  resolved_methods: ResolvedMethodCall[];
  resolved_constructors: ResolvedConstructorCall[];
} {
  return {
    resolved_methods: resolve_method_calls(method_calls, class_hierarchy, type_registry),
    resolved_constructors: resolve_constructor_calls(constructor_calls, type_registry, class_hierarchy)
  };
}
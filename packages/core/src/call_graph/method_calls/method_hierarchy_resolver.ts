/**
 * Method Hierarchy Resolver
 * 
 * Enriches method calls with class hierarchy information during the Global Assembly phase.
 * This runs AFTER both method_calls (Per-File) and class_hierarchy (Global) have been built.
 * 
 * Key responsibilities:
 * - Resolve methods through inheritance chains
 * - Identify method overrides
 * - Track virtual method calls
 * - Handle interface/trait method implementations
 */

import { MethodCallInfo } from '@ariadnejs/types';
import type { ClassHierarchy, ClassNode } from '@ariadnejs/types';

/**
 * Extended method call info with hierarchy resolution
 */
export interface MethodCallWithHierarchy extends MethodCallInfo {
  receiver_type?: string;               // Resolved type of the receiver (from type tracking)
  defining_class_resolved?: string;    // Class that actually defines the method
  is_override?: boolean;               // If this overrides a parent method
  override_chain?: string[];           // Classes in override chain
  is_interface_method?: boolean;       // If from interface/trait
  is_virtual_call?: boolean;           // If this is a virtual method call
  possible_targets?: string[];         // Possible target classes (polymorphic)
}

/**
 * Enrich method calls with class hierarchy information
 * 
 * This function runs during Global Assembly after both method calls
 * and class hierarchy have been built.
 * 
 * @param method_calls Method calls from Per-File analysis
 * @param class_hierarchy Class hierarchy from Global Assembly
 * @param type_info Optional type information for resolving receiver types
 * @returns Method calls enriched with hierarchy information
 */
export function enrich_method_calls_with_hierarchy(
  method_calls: readonly MethodCallInfo[],
  class_hierarchy: ClassHierarchy | undefined,
  type_info?: Map<string, string>  // Maps receiver_name to type
): readonly MethodCallWithHierarchy[] {
  if (!class_hierarchy) {
    // No hierarchy available, return calls as-is
    return method_calls;
  }

  return method_calls.map(call => {
    const enriched: MethodCallWithHierarchy = { ...call };

    // Try to resolve receiver type from type info or receiver name
    const receiver_type = type_info?.get(call.receiver_name) || 
                         (call.receiver_name.charAt(0).toUpperCase() === call.receiver_name.charAt(0) ? 
                          call.receiver_name : undefined);
    
    if (receiver_type) {
      enriched.receiver_type = receiver_type;
      // Try to resolve the method through the class hierarchy
      const resolution = resolve_method_in_hierarchy(
        receiver_type,
        call.method_name,
        class_hierarchy
      );

      if (resolution) {
        enriched.defining_class_resolved = resolution.defining_class;
        enriched.is_override = resolution.is_override;
        enriched.override_chain = resolution.override_chain;
        enriched.is_interface_method = resolution.is_interface_method;
      }

      // Check if this is a virtual call (could dispatch to subclasses)
      const virtualInfo = analyze_virtual_call(
        receiver_type,
        call.method_name,
        class_hierarchy
      );

      if (virtualInfo) {
        enriched.is_virtual_call = virtualInfo.is_virtual;
        enriched.possible_targets = virtualInfo.possible_targets;
      }
    }

    return enriched;
  });
}

/**
 * Method resolution result
 */
interface MethodResolution {
  defining_class: string;
  is_override: boolean;
  override_chain: string[];
  is_interface_method: boolean;
}

/**
 * Resolve a method through the class hierarchy
 * 
 * @param class_name Starting class name
 * @param method_name Method to find
 * @param hierarchy Class hierarchy
 * @returns Resolution information or undefined if not found
 */
export function resolve_method_in_hierarchy(
  class_name: string,
  method_name: string,
  hierarchy: ClassHierarchy
): MethodResolution | undefined {
  const visited = new Set<string>();
  const override_chain: string[] = [];
  
  // Helper to check if a class has a method
  function class_has_method(class_info: ClassNode): boolean {
    // Check if the class has a methods map
    if (class_info.methods) {
      return class_info.methods.has(method_name);
    }
    
    // Fallback: check definition for method-like properties
    const def = class_info.definition;
    if ((def as any).methods && Array.isArray((def as any).methods)) {
      return (def as any).methods.some((m: any) => m.name === method_name);
    }
    
    return false;
  }

  // Recursive resolution
  function resolve_recursive(
    current_class: string,
    is_first: boolean = true
  ): MethodResolution | undefined {
    if (visited.has(current_class)) {
      return undefined;
    }
    visited.add(current_class);

    const class_info = hierarchy.classes.get(current_class);
    if (!class_info) {
      return undefined;
    }

    // Check if this class defines the method
    if (class_has_method(class_info)) {
      override_chain.push(current_class);
      
      // Check if parent also has it (making this an override)
      let is_override = false;
      if (class_info.parent_class) {
        const parent_name = class_info.base_classes?.[0];
        const parent_resolution = parent_name ? resolve_recursive(parent_name, false) : undefined;
        is_override = parent_resolution !== undefined;
      }

      return {
        defining_class: current_class,
        is_override: !is_first && is_override,
        override_chain,
        is_interface_method: class_info.is_interface || false
      };
    }

    // Method not in this class, check parent
    const parent_name = class_info.base_classes?.[0];
    if (parent_name) {
      return resolve_recursive(parent_name, false);
    }

    // Check implemented interfaces
    if (class_info.interface_nodes) {
      for (const interface_node of class_info.interface_nodes) {
        const interface_id = `${interface_node.file_path}#${interface_node.name}`;
      const interface_info = hierarchy.classes.get(interface_id);
      if (interface_info && class_has_method(interface_info)) {
        return {
          defining_class: interface_id,
          is_override: false,
          override_chain: [interface_id],
          is_interface_method: true
        };
      }
    }
    }

    return undefined;
  }

  return resolve_recursive(class_name);
}

/**
 * Virtual call analysis result
 */
interface VirtualCallInfo {
  is_virtual: boolean;
  possible_targets: string[];
}

/**
 * Analyze if a method call is virtual (could dispatch to subclasses)
 * 
 * @param class_name Class type of receiver
 * @param method_name Method being called
 * @param hierarchy Class hierarchy
 * @returns Virtual call analysis or undefined
 */
export function analyze_virtual_call(
  class_name: string,
  method_name: string,
  hierarchy: ClassHierarchy
): VirtualCallInfo | undefined {
  const class_info = hierarchy.classes.get(class_name);
  if (!class_info) {
    return undefined;
  }

  const possible_targets: string[] = [];
  
  // Check if method exists in this class or parents
  const resolution = resolve_method_in_hierarchy(class_name, method_name, hierarchy);
  if (!resolution) {
    return undefined;
  }

  // Add the defining class
  possible_targets.push(resolution.defining_class);

  // Check all subclasses for overrides
  function check_subclasses(info: ClassNode) {
    for (const subclass_name of info.derived_classes || []) {
      // Find the subclass node by name
      let subclass: ClassNode | undefined;
      for (const node of hierarchy.classes.values()) {
        if (node.name === subclass_name) {
          subclass = node;
          break;
        }
      }
      if (!subclass) continue;
      
      const subclass_id = `${subclass.file_path}#${subclass.name}`;
      const subclass_info = hierarchy.classes.get(subclass_id);
      if (subclass_info) {
        // Check if subclass overrides the method
        const subclass_resolution = resolve_method_in_hierarchy(
          subclass_id,
          method_name,
          hierarchy
        );
        
        if (subclass_resolution && 
            subclass_resolution.defining_class === subclass_id) {
          // Subclass overrides the method
          possible_targets.push(subclass_id);
        }
        
        // Recursively check subclass's subclasses
        check_subclasses(subclass_info);
      }
    }
  }

  check_subclasses(class_info);

  return {
    is_virtual: possible_targets.length > 1,
    possible_targets
  };
}

/**
 * Find all methods available to a class (including inherited)
 * 
 * @param class_name Class to analyze
 * @param hierarchy Class hierarchy
 * @returns Map of method names to their defining classes
 */
export function get_available_methods(
  class_name: string,
  hierarchy: ClassHierarchy
): Map<string, string> {
  const methods = new Map<string, string>();
  const visited = new Set<string>();

  function collect_methods(current_class: string) {
    if (visited.has(current_class)) {
      return;
    }
    visited.add(current_class);

    const class_info = hierarchy.classes.get(current_class);
    if (!class_info) {
      return;
    }

    // Add methods from this class
    if (class_info.methods) {
      for (const [method_name, _method] of class_info.methods) {
        if (!methods.has(method_name)) {
          methods.set(method_name, current_class);
        }
      }
    }

    // Collect from parent
    const parent_name = class_info.base_classes?.[0];
    if (parent_name) {
      // Find parent by name in hierarchy
      for (const [key, node] of hierarchy.classes) {
        if (node.name === parent_name) {
          collect_methods(key);
          break;
        }
      }
    }

    // Collect from interfaces
    if (class_info.interface_nodes) {
      for (const interface_node of class_info.interface_nodes) {
        const interface_key = `${interface_node.file_path}#${interface_node.name}`;
        collect_methods(interface_key);
      }
    }
  }

  collect_methods(class_name);
  return methods;
}

/**
 * Check if a method is inherited from a parent class
 * 
 * @param class_name Class to check
 * @param method_name Method to check
 * @param hierarchy Class hierarchy
 * @returns True if method is inherited, false if defined in class or not found
 */
export function is_inherited_method(
  class_name: string,
  method_name: string,
  hierarchy: ClassHierarchy
): boolean {
  const resolution = resolve_method_in_hierarchy(class_name, method_name, hierarchy);
  return resolution ? resolution.defining_class !== class_name : false;
}
/**
 * Interface Implementation Tracking and Analysis
 * 
 * This module provides functionality to track and analyze interface implementations
 * across different programming languages, including compliance checking and
 * implementation discovery.
 */

import { Def } from '@ariadnejs/types';
import { ClassHierarchy, ClassInfo } from '../class_hierarchy/class_hierarchy';

/**
 * Represents an interface definition with its members
 */
export interface InterfaceDefinition {
  /** The interface definition */
  definition: Def;
  /** Required methods that must be implemented */
  required_methods: MethodSignature[];
  /** Optional methods with default implementations */
  optional_methods?: MethodSignature[];
  /** Required properties/fields */
  required_properties?: PropertySignature[];
  /** Parent interfaces this extends */
  extends_interfaces: string[];
  /** Language of the interface */
  language: string;
}

/**
 * Method signature for compliance checking
 */
export interface MethodSignature {
  name: string;
  parameters: ParameterInfo[];
  return_type?: string;
  is_async?: boolean;
  is_static?: boolean;
  is_abstract?: boolean;
}

/**
 * Parameter information
 */
export interface ParameterInfo {
  name: string;
  type?: string;
  is_optional?: boolean;
  default_value?: string;
}

/**
 * Property signature for compliance checking
 */
export interface PropertySignature {
  name: string;
  type?: string;
  is_readonly?: boolean;
  is_optional?: boolean;
}

/**
 * Represents a class implementing an interface
 */
export interface InterfaceImplementation {
  /** The implementing class */
  implementor: Def;
  /** The interface being implemented */
  interface_def: InterfaceDefinition;
  /** Methods that satisfy the interface */
  implemented_methods: Map<string, Def>;
  /** Properties that satisfy the interface */
  implemented_properties?: Map<string, Def>;
  /** Whether the implementation is complete */
  is_complete: boolean;
  /** Missing required members */
  missing_members: string[];
  /** Language of the implementation */
  language: string;
}

/**
 * Complete interface implementation map for a codebase
 */
export interface InterfaceImplementationMap {
  /** All interface definitions */
  interfaces: Map<string, InterfaceDefinition>;
  /** Map from interface name to all its implementations */
  implementations: Map<string, InterfaceImplementation[]>;
  /** Map from class name to interfaces it implements */
  class_interfaces: Map<string, string[]>;
  /** Incomplete implementations that need attention */
  incomplete_implementations: InterfaceImplementation[];
  /** Language of the analysis */
  language: string;
}

/**
 * Extract interface definition with its members
 */
export function extract_interface_definition(
  interface_def: Def,
  members: Def[]
): InterfaceDefinition {
  const required_methods: MethodSignature[] = [];
  const optional_methods: MethodSignature[] = [];
  const required_properties: PropertySignature[] = [];
  
  // Process members
  for (const member of members) {
    if (member.symbol_kind === 'method' || member.symbol_kind === 'function') {
      const method_sig = extract_method_signature(member);
      // In interfaces, all methods are required unless explicitly marked otherwise
      if (member.metadata?.is_optional) {
        optional_methods.push(method_sig);
      } else {
        required_methods.push(method_sig);
      }
    } else if (member.symbol_kind === 'property' || member.symbol_kind === 'field') {
      const prop_sig = extract_property_signature(member);
      required_properties.push(prop_sig);
    }
  }
  
  return {
    definition: interface_def,
    required_methods,
    optional_methods: optional_methods.length > 0 ? optional_methods : undefined,
    required_properties: required_properties.length > 0 ? required_properties : undefined,
    extends_interfaces: [],
    language: interface_def.file_path?.split('.').pop() || 'unknown'
  };
}

/**
 * Extract method signature from a method definition
 */
export function extract_method_signature(method: Def): MethodSignature {
  return {
    name: method.name,
    parameters: [], // TODO: Extract parameters when type system is ready
    return_type: undefined, // TODO: Extract return type
    is_async: false, // TODO: Detect async methods
    is_static: false, // TODO: Detect static methods
    is_abstract: true // Default to required for interfaces
  };
}

/**
 * Extract property signature from a property definition
 */
export function extract_property_signature(property: Def): PropertySignature {
  return {
    name: property.name,
    type: undefined, // TODO: Extract type when type system is ready
    is_readonly: false, // TODO: Detect readonly
    is_optional: false // TODO: Detect optional
  };
}

/**
 * Find all implementations of a given interface
 */
export function find_interface_implementations(
  interface_name: string,
  hierarchy: ClassHierarchy
): Def[] {
  const implementations: Def[] = [];
  
  // Check each class in the hierarchy
  for (const [class_name, class_info] of hierarchy.classes) {
    if (class_info.implemented_interfaces.includes(interface_name)) {
      implementations.push(class_info.definition);
    }
  }
  
  return implementations;
}

/**
 * Check if a class implements an interface
 */
export function implements_interface(
  class_def: Def,
  interface_name: string,
  hierarchy: ClassHierarchy
): boolean {
  const class_info = hierarchy.classes.get(class_def.name);
  if (!class_info) {
    return false;
  }
  
  return class_info.implemented_interfaces.includes(interface_name);
}

/**
 * Check implementation compliance
 */
export function check_implementation_compliance(
  class_def: Def,
  interface_def: InterfaceDefinition,
  class_methods: Def[],
  class_properties?: Def[]
): InterfaceImplementation {
  const implemented_methods = new Map<string, Def>();
  const implemented_properties = new Map<string, Def>();
  const missing_members: string[] = [];
  
  // Check required methods
  for (const required_method of interface_def.required_methods) {
    const impl = class_methods.find(m => 
      m.name === required_method.name &&
      methods_compatible(m, required_method)
    );
    
    if (impl) {
      implemented_methods.set(required_method.name, impl);
    } else {
      missing_members.push(`method: ${required_method.name}`);
    }
  }
  
  // Check required properties
  if (interface_def.required_properties && class_properties) {
    for (const required_prop of interface_def.required_properties) {
      const impl = class_properties.find(p => 
        p.name === required_prop.name &&
        properties_compatible(p, required_prop)
      );
      
      if (impl) {
        implemented_properties.set(required_prop.name, impl);
      } else {
        missing_members.push(`property: ${required_prop.name}`);
      }
    }
  }
  
  return {
    implementor: class_def,
    interface_def,
    implemented_methods,
    implemented_properties: implemented_properties.size > 0 ? implemented_properties : undefined,
    is_complete: missing_members.length === 0,
    missing_members,
    language: interface_def.language
  };
}

/**
 * Check if a method implementation is compatible with interface requirement
 */
function methods_compatible(
  implementation: Def,
  requirement: MethodSignature
): boolean {
  // Basic name check for now
  // TODO: Add parameter and return type checking when type system is ready
  return implementation.name === requirement.name;
}

/**
 * Check if a property implementation is compatible with interface requirement
 */
function properties_compatible(
  implementation: Def,
  requirement: PropertySignature
): boolean {
  // Basic name check for now
  // TODO: Add type checking when type system is ready
  return implementation.name === requirement.name;
}

/**
 * Build complete interface implementation map
 */
export function build_interface_implementation_map(
  interfaces: InterfaceDefinition[],
  hierarchy: ClassHierarchy,
  class_members: Map<string, { methods: Def[]; properties?: Def[] }>
): InterfaceImplementationMap {
  const interface_map = new Map<string, InterfaceDefinition>();
  const implementations = new Map<string, InterfaceImplementation[]>();
  const class_interfaces = new Map<string, string[]>();
  const incomplete_implementations: InterfaceImplementation[] = [];
  
  // Index interfaces
  for (const iface of interfaces) {
    interface_map.set(iface.definition.name, iface);
    implementations.set(iface.definition.name, []);
  }
  
  // Process each class
  for (const [class_symbol_id, class_info] of hierarchy.classes) {
    // Try both the symbol_id and just the class name for member lookup
    const members = class_members.get(class_symbol_id) || 
                   class_members.get(class_info.definition.name);
    if (!members) continue;
    
    const implemented_interface_names: string[] = [];
    
    // Check each interface this class claims to implement
    for (const interface_name of class_info.implemented_interfaces) {
      const interface_def = interface_map.get(interface_name);
      if (!interface_def) continue;
      
      const implementation = check_implementation_compliance(
        class_info.definition,
        interface_def,
        members.methods,
        members.properties
      );
      
      // Add to implementations map
      const impls = implementations.get(interface_name) || [];
      impls.push(implementation);
      implementations.set(interface_name, impls);
      
      // Track incomplete implementations
      if (!implementation.is_complete) {
        incomplete_implementations.push(implementation);
      }
      
      implemented_interface_names.push(interface_name);
    }
    
    // Track which interfaces each class implements
    if (implemented_interface_names.length > 0) {
      class_interfaces.set(class_info.definition.name, implemented_interface_names);
    }
  }
  
  return {
    interfaces: interface_map,
    implementations,
    class_interfaces,
    incomplete_implementations,
    language: hierarchy.language
  };
}

/**
 * Get all classes that implement a specific interface
 */
export function get_interface_implementors(
  interface_name: string,
  impl_map: InterfaceImplementationMap
): Def[] {
  const impls = impl_map.implementations.get(interface_name) || [];
  return impls.map(impl => impl.implementor);
}

/**
 * Get all interfaces implemented by a class
 */
export function get_implemented_interfaces(
  class_name: string,
  impl_map: InterfaceImplementationMap
): InterfaceDefinition[] {
  const interface_names = impl_map.class_interfaces.get(class_name) || [];
  return interface_names
    .map(name => impl_map.interfaces.get(name))
    .filter(iface => iface !== undefined) as InterfaceDefinition[];
}

/**
 * Check if all required interfaces are properly implemented
 */
export function validate_all_implementations(
  impl_map: InterfaceImplementationMap
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const incomplete of impl_map.incomplete_implementations) {
    const class_name = incomplete.implementor.name;
    const interface_name = incomplete.interface_def.definition.name;
    const missing = incomplete.missing_members.join(', ');
    
    errors.push(
      `${class_name} does not fully implement ${interface_name}. Missing: ${missing}`
    );
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// TODO: Integration with Class Hierarchy
// - Link classes to interfaces
// TODO: Integration with Method Calls
// - Find concrete implementations
// TODO: Integration with Type Tracking
// - Interface type compatibility
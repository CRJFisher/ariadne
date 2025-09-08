/**
 * Types for Interface Implementation Tracking
 * 
 * Core types used across generic and language-specific implementations.
 */

import { Language, Location } from '@ariadnejs/types';

/**
 * Represents an interface/trait/protocol definition with its members
 */
export interface InterfaceDefinition {
  /** Interface name */
  name: string;
  
  /** Location in source code */
  location: Location;
  
  /** Required methods that must be implemented */
  required_methods: MethodSignature[];
  
  /** Optional methods with default implementations */
  optional_methods?: MethodSignature[];
  
  /** Required properties/fields */
  required_properties?: PropertySignature[];
  
  /** Parent interfaces this extends */
  extends_interfaces: string[];
  
  /** Language of the interface */
  language: Language;
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
  is_generic?: boolean;
  type_parameters?: string[];
}

/**
 * Parameter information
 */
export interface ParameterInfo {
  name: string;
  type?: string;
  is_optional?: boolean;
  default_value?: string;
  is_variadic?: boolean;
}

/**
 * Property signature for compliance checking
 */
export interface PropertySignature {
  name: string;
  type?: string;
  is_readonly?: boolean;
  is_optional?: boolean;
  is_static?: boolean;
  visibility?: 'public' | 'private' | 'protected';
}

/**
 * Represents a class/struct implementing an interface/trait
 */
export interface InterfaceImplementation {
  /** Name of the implementing class/struct */
  implementor_name: string;
  
  /** Location of the implementor */
  implementor_location: Location;
  
  /** Name of the interface being implemented */
  interface_name: string;
  
  /** Location of the interface definition */
  interface_location: Location;
  
  /** Methods that satisfy the interface */
  implemented_methods: Map<string, MethodSignature>;
  
  /** Properties that satisfy the interface */
  implemented_properties?: Map<string, PropertySignature>;
  
  /** Whether the implementation is complete */
  is_complete: boolean;
  
  /** Missing required members */
  missing_members: string[];
  
  /** Language of the implementation */
  language: Language;
}

/**
 * Complete interface implementation map for a codebase
 */
export interface InterfaceImplementationMap {
  /** All interface definitions by name */
  interfaces: Map<string, InterfaceDefinition>;
  
  /** Map from interface name to all its implementations */
  implementations: Map<string, InterfaceImplementation[]>;
  
  /** Map from class name to interfaces it implements */
  class_interfaces: Map<string, string[]>;
  
  /** Incomplete implementations that need attention */
  incomplete_implementations: InterfaceImplementation[];
}

/**
 * Result of building an implementation map
 */
export interface ImplementationMapResult {
  map: InterfaceImplementationMap;
  statistics: {
    total_interfaces: number;
    total_implementations: number;
    complete_implementations: number;
    incomplete_implementations: number;
    coverage_percentage: number;
  };
}
/**
 * Type conversion utilities for bridging between different type systems
 * 
 * This module provides converters between:
 * - Legacy Def types and new Definition types
 * - ClassInfo (from common.ts) and ClassDefinition
 * - Internal types and shared types
 */

import {
  ClassInfo,
  MethodInfo,
  PropertyInfo,
  FunctionInfo,
  Location,
  Language
} from '@ariadnejs/types';

import {
  ClassDefinition,
  FunctionDefinition,
  InterfaceDefinition,
  MethodDefinition,
  PropertyDefinition,
  ParameterDefinition,
  Definition
} from '@ariadnejs/types';

/**
 * Convert ClassInfo to ClassDefinition
 */
export function class_info_to_class_definition(
  info: ClassInfo,
  file_path: string,
  language: Language
): ClassDefinition {
  return {
    name: info.name,
    location: info.location,
    file_path,
    language,
    extends: info.base_classes,
    implements: info.interfaces,
    is_abstract: info.is_abstract,
    is_final: false,
    is_exported: info.is_exported,
    methods: info.methods.map(m => method_info_to_definition(m)),
    properties: info.properties.map(p => property_info_to_definition(p)),
    decorators: info.decorators,
    docstring: info.docstring,
    generics: [] // TODO: Extract from type info
  };
}

/**
 * Convert MethodInfo to MethodDefinition
 */
export function method_info_to_definition(info: MethodInfo): MethodDefinition {
  return {
    name: info.name,
    location: info.location,
    is_static: info.is_static || false,
    is_abstract: info.is_abstract || false,
    is_private: info.visibility === 'private',
    is_protected: info.visibility === 'protected',
    is_constructor: false, // TODO: Detect constructor
    is_async: info.signature.is_async || false,
    parameters: info.signature.parameters.map(p => ({
      name: p.name,
      type: p.type,
      is_optional: p.is_optional || false,
      is_rest: p.is_rest || false,
      default_value: p.default_value
    })),
    return_type: info.signature.return_type,
    generics: info.signature.type_parameters,
    decorators: info.decorators
  };
}

/**
 * Convert PropertyInfo to PropertyDefinition
 */
export function property_info_to_definition(info: PropertyInfo): PropertyDefinition {
  return {
    name: info.name,
    location: info.location,
    type: info.type,
    is_static: info.is_static || false,
    is_private: info.visibility === 'private',
    is_protected: info.visibility === 'protected',
    is_readonly: info.is_readonly || false,
    initial_value: info.default_value,
    decorators: []
  };
}

/**
 * Convert FunctionInfo to FunctionDefinition
 */
export function function_info_to_function_definition(
  info: FunctionInfo,
  file_path: string,
  language: Language,
  is_exported: boolean = false
): FunctionDefinition {
  return {
    name: info.name,
    location: info.location,
    file_path,
    language,
    parameters: info.signature.parameters.map(p => ({
      name: p.name,
      type: p.type,
      is_optional: p.is_optional || false,
      is_rest: p.is_rest || false,
      default_value: p.default_value
    })),
    return_type: info.signature.return_type,
    is_async: info.signature.is_async || false,
    is_generator: info.signature.is_generator || false,
    is_exported,
    generics: info.signature.type_parameters,
    decorators: info.decorators,
    docstring: info.docstring,
    is_arrow_function: false, // TODO: Detect arrow functions
    is_anonymous: info.name === '<anonymous>'
  };
}

/**
 * Generate a unique key for a definition
 */
export function generate_definition_key(def: Definition): string {
  return `${def.file_path}#${def.name}`;
}

/**
 * Create a stub ClassDefinition from minimal information
 * Used when we need a ClassDefinition but only have partial data
 */
export function create_stub_class_definition(
  name: string,
  file_path: string,
  language: Language,
  location?: Location
): ClassDefinition {
  return {
    name,
    file_path,
    language,
    location: location || {
      file_path,
      line: 0,
      column: 0,
      end_line: 0,
      end_column: 0
    },
    methods: [],
    properties: [],
    is_exported: false
  };
}
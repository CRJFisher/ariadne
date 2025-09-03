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
  Language,
  FilePath,
} from "@ariadnejs/types";

import {
  ClassDefinition,
  FunctionDefinition,
  InterfaceDefinition,
  MethodDefinition,
  PropertyDefinition,
  ParameterDefinition,
  SymbolDefinition,
} from "@ariadnejs/types";

/**
 * Convert ClassInfo to ClassDefinition
 */
export function class_info_to_class_definition(
  info: ClassInfo,
  file_path: FilePath,
): ClassDefinition {
  return {
    name: info.name,
    location: info.location,
    file_path,
    extends: info.base_classes,
    implements: info.interfaces,
    is_abstract: info.is_abstract,
    is_final: false,
    is_exported: info.is_exported,
    methods: info.methods.map((m) => method_info_to_definition(m)),
    properties: info.properties.map((p) => property_info_to_definition(p)),
    decorators: info.decorators,
    docstring: info.docstring,
    generics: [], // TODO: Extract from type info
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
    is_private: info.visibility === "private",
    is_protected: info.visibility === "protected",
    is_constructor: false, // TODO: Detect constructor
    is_async: info.signature.is_async || false,
    parameters: info.signature.parameters.map((p) => ({
      name: p.name,
      type: p.type,
      is_optional: p.is_optional || false,
      is_rest: p.is_rest || false,
      default_value: p.default_value,
    })),
    return_type: info.signature.return_type,
    generics: info.signature.type_parameters,
    decorators: info.decorators,
  };
}

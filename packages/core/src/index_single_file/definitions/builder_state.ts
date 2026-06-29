/**
 * Mutable accumulator types for the DefinitionBuilder.
 *
 * Each builder state holds the partially-assembled form of a definition while
 * captures are processed, with child members kept in Maps so they can be added
 * incrementally before the final immutable Definition is built.
 */

import type {
  ClassDefinition,
  ConstructorDefinition,
  CallbackContext,
  DecoratorDefinition,
  EnumDefinition,
  EnumMember,
  FunctionDefinition,
  InterfaceDefinition,
  MethodDefinition,
  NamespaceDefinition,
  ParameterDefinition,
  PropertyDefinition,
  ScopeId,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";

export interface ClassBuilderState {
  base: Partial<
    Omit<ClassDefinition, "constructor" | "methods" | "properties" | "decorators">
  >;
  methods: Map<SymbolId, MethodBuilderState>;
  properties: Map<SymbolId, PropertyBuilderState>;
  constructors: Map<SymbolId, ConstructorBuilderState>;
  decorators: DecoratorDefinition[];
}

export interface MethodBuilderState {
  base: Partial<
    Omit<MethodDefinition, "parameters" | "decorators" | "body_scope_id">
  >;
  parameters: Map<SymbolId, ParameterDefinition>;
  decorators: DecoratorDefinition[];
  body_scope_id?: ScopeId;
}

export interface ConstructorBuilderState {
  base: Partial<
    Omit<ConstructorDefinition, "parameters" | "decorators" | "body_scope_id">
  >;
  parameters: Map<SymbolId, ParameterDefinition>;
  decorators: DecoratorDefinition[];
  body_scope_id?: ScopeId;
}

export interface PropertyBuilderState {
  base: Partial<Omit<PropertyDefinition, "decorators">>;
  decorators: DecoratorDefinition[];
}

export interface FunctionBuilderState {
  base: Partial<
    Omit<
      FunctionDefinition,
      "signature" | "decorators" | "body_scope_id" | "callback_context"
    >
  >;
  signature: FunctionSignatureState;
  decorators: DecoratorDefinition[];
  body_scope_id?: ScopeId;
  callback_context?: CallbackContext;
}

export interface FunctionSignatureState {
  parameters: Map<SymbolId, ParameterDefinition>;
  return_type?: SymbolName;
}

export interface InterfaceBuilderState {
  base: Partial<Omit<InterfaceDefinition, "methods" | "properties">>;
  methods: Map<SymbolId, MethodBuilderState>;
  properties: Map<SymbolId, PropertyDefinition>;
}

export interface EnumBuilderState {
  base: Partial<Omit<EnumDefinition, "members" | "methods">>;
  members: Map<SymbolId, EnumMember>;
  methods?: Map<SymbolId, MethodBuilderState>;
}

export interface NamespaceBuilderState {
  base: Partial<Omit<NamespaceDefinition, "exported_symbols">>;
  exported_symbols: Set<SymbolId>;
}

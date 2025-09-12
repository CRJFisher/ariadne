/**
 * Type analysis types for type tracking, inference, and propagation
 * across all type analysis modules
 */

import { Location, Language } from "./common";
import { FilePath } from "./aliases";
import {
  SymbolName,
  SymbolId,
  TypeExpression,
  ResolvedTypeKind,
} from "./branded-types";
import {
  SemanticNode,
  Resolution,
  ResolutionConfidence,
} from "./base-query-types";

// ============================================================================
// Core Type Definition
// ============================================================================

/**
 * Type definition with full metadata and relationships
 * Extends SemanticNode for consistency with other semantic types
 */
export interface TypeDefinition extends SemanticNode {
  readonly id: SymbolId;
  readonly name: SymbolName;
  readonly kind: ResolvedTypeKind; // From branded types
  readonly type_expression?: TypeExpression; // Full type expression

  // Type parameters and constraints
  readonly type_parameters?: readonly TypeParameter[];
  readonly constraints?: readonly TypeConstraint[];

  // Inheritance and composition
  readonly extends?: readonly SymbolId[]; // Base types
  readonly implements?: readonly SymbolId[]; // Interfaces
  readonly mixins?: readonly SymbolId[]; // Mixins/traits

  // Members (unified for all type kinds)
  readonly members?: ReadonlyMap<SymbolName, TypeMember>;

  // Type metadata
  readonly is_generic?: boolean;
  readonly is_abstract?: boolean;
  readonly is_final?: boolean;
  readonly is_nullable?: boolean;
  readonly is_optional?: boolean;
}

/**
 * Type parameter with variance
 */
export interface TypeParameter {
  readonly name: string;
  readonly constraint?: TypeExpression;
  readonly default?: TypeExpression;
  readonly variance?: "covariant" | "contravariant" | "invariant";
}

/**
 * Type constraint
 */
export interface TypeConstraint {
  readonly kind: "extends" | "super" | "equals";
  readonly type: TypeExpression;
}

/**
 * Unified type member (property, method, etc.)
 */
export interface TypeMember extends SemanticNode {
  readonly name: SymbolName;
  readonly member_kind:
    | "property"
    | "method"
    | "getter"
    | "setter"
    | "constructor";
  readonly type?: TypeExpression;
  readonly is_optional?: boolean;
  readonly is_readonly?: boolean;
  readonly is_static?: boolean;
  readonly is_abstract?: boolean;
  readonly accessibility?: "public" | "private" | "protected";
}

// ============================================================================
// Type Tracking and Flow
// ============================================================================

/**
 * Tracked type information at a specific location
 * Replaces VariableType and similar types
 */
export interface TrackedType extends SemanticNode {
  readonly symbol_id: SymbolId;
  readonly tracked_type: Resolution<TypeDefinition>;
  readonly flow_source: TypeFlowSource;
  readonly narrowed_from?: SymbolId; // Original type before narrowing
}

/**
 * Source of type information
 */
export type TypeFlowSource =
  | "declaration" // Explicit type annotation
  | "initialization" // Inferred from initializer
  | "assignment" // Inferred from assignment
  | "return" // Inferred from return type
  | "parameter" // Function parameter type
  | "property" // Object property type
  | "element" // Array/tuple element
  | "cast" // Type assertion/cast
  | "guard" // Type guard narrowing
  | "inference"; // Generic type inference

/**
 * Type flow through the program
 */
export interface TypeFlow {
  readonly from: TrackedType;
  readonly to: TrackedType;
  readonly flow_kind: TypeFlowKind;
  readonly confidence: ResolutionConfidence;
}

export type TypeFlowKind =
  | "assignment" // Variable assignment
  | "parameter" // Function parameter passing
  | "return" // Function return
  | "property" // Property access
  | "narrowing" // Type narrowing
  | "widening" // Type widening
  | "instantiation" // Generic instantiation
  | "propagation"; // Type propagation

// ============================================================================
// Type Inference and Resolution
// ============================================================================

/**
 * Inferred type information
 */
export interface InferredType {
  readonly symbol_id: SymbolId;
  readonly inferred: TypeDefinition;
  readonly inference_source: InferenceSource;
  readonly confidence: ResolutionConfidence;
  readonly alternatives?: readonly TypeDefinition[]; // Other possible types
}

/**
 * Source of type inference
 */
export type InferenceSource =
  | "usage_pattern" // Inferred from how it's used
  | "context" // Contextual typing
  | "control_flow" // Control flow analysis
  | "generic_constraint" // Generic type constraint
  | "return_flow" // Return type flow
  | "parameter_flow" // Parameter type flow
  | "literal" // Literal type
  | "structural"; // Structural typing

/**
 * Type resolution result
 */
export interface ResolvedType {
  readonly requested: TypeExpression;
  readonly resolved: Resolution<TypeDefinition>;
  readonly substitutions?: ReadonlyMap<string, TypeDefinition>; // Generic substitutions
}

// ============================================================================
// Type Relationships
// ============================================================================

/**
 * Relationship between types
 */
export interface TypeRelation {
  readonly from_type: SymbolId;
  readonly to_type: SymbolId;
  readonly relation: TypeRelationKind;
  readonly location?: Location;
}

export type TypeRelationKind =
  | "extends" // Inheritance
  | "implements" // Interface implementation
  | "satisfies" // Type satisfaction
  | "assignable_to" // Assignment compatibility
  | "convertible_to" // Type conversion
  | "subtype_of" // Subtyping
  | "instance_of" // Instance relationship
  | "generic_argument"; // Generic type argument

// ============================================================================
// Type Guards
// ============================================================================

export function is_type_definition(value: unknown): value is TypeDefinition {
  if (typeof value !== "object" || value === null) return false;
  const type = value as any;
  return (
    "id" in type &&
    "name" in type &&
    "kind" in type &&
    "location" in type &&
    "language" in type
  );
}

export function is_type_member(value: unknown): value is TypeMember {
  if (typeof value !== "object" || value === null) return false;
  const member = value as any;
  return "name" in member && "member_kind" in member && "location" in member;
}

export function is_tracked_type(value: unknown): value is TrackedType {
  if (typeof value !== "object" || value === null) return false;
  const tracked = value as any;
  return (
    "symbol_id" in tracked &&
    "tracked_type" in tracked &&
    "flow_source" in tracked
  );
}

export function is_inferred_type(value: unknown): value is InferredType {
  if (typeof value !== "object" || value === null) return false;
  const inferred = value as any;
  return (
    "symbol_id" in inferred &&
    "inferred" in inferred &&
    "inference_source" in inferred &&
    "confidence" in inferred
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a type is primitive
 */
export function is_primitive_type(type: TypeDefinition): boolean {
  return type.kind === "primitive";
}

/**
 * Check if a type is generic
 */
export function is_generic_type(type: TypeDefinition): boolean {
  return type.is_generic === true || (type.type_parameters?.length ?? 0) > 0;
}

/**
 * Check if a type is nullable
 */
export function is_nullable_type(type: TypeDefinition): boolean {
  return type.is_nullable === true || type.is_optional === true;
}

/**
 * Get all base types (extends + implements)
 */
export function get_base_types(type: TypeDefinition): SymbolId[] {
  return [...(type.extends || []), ...(type.implements || [])];
}

/**
 * Create a simple type
 */
export function create_type_definition(
  id: SymbolId,
  name: SymbolName,
  kind: ResolvedTypeKind,
  location: Location,
  language: Language,
  options?: Partial<TypeDefinition>
): TypeDefinition {
  return {
    id,
    name,
    kind,
    location,
    language,
    node_type: get_node_type_for_type_kind(kind),
    ...options,
  };
}

/**
 * Get tree-sitter node type for type kind
 */
function get_node_type_for_type_kind(kind: ResolvedTypeKind): string {
  switch (kind) {
    case "class":
      return "class_declaration";
    case "interface":
      return "interface_declaration";
    case "type":
      return "type_alias";
    case "enum":
      return "enum_declaration";
    case "trait":
      return "trait_declaration";
    case "primitive":
      return "primitive_type";
    case "unknown":
      return "unknown_type";
  }
}

/**
 * Create tracked type information
 */
export function create_tracked_type(
  symbol_id: SymbolId,
  type: TypeDefinition,
  source: TypeFlowSource,
  location: Location,
  language: Language,
  confidence: ResolutionConfidence = "high"
): TrackedType {
  return {
    symbol_id,
    tracked_type: {
      resolved: type,
      confidence,
      reason: "direct_match",
    },
    flow_source: source,
    location,
    language,
    node_type: "type_annotation",
  };
}

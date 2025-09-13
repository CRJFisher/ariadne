/**
 * Type analysis types for type tracking, inference, and propagation
 * across all type analysis modules
 */

import { Location, Language, TypeParameter } from "./common";
import { FilePath, TypeName } from "./aliases";
import { SymbolName } from "./symbol_utils";
import { SymbolId } from "./symbol_utils";
import { SemanticNode, Resolution, ResolutionConfidence } from "./query";

// ============================================================================
// Branded Types for Type Analysis
// ============================================================================

/** Type expression (more specific than TypeString) */
export type TypeExpression = string & { __brand: "TypeExpression" };

/** Type constraint expression (e.g., "T extends BaseClass") */
export type TypeConstraintExpression = string & { __brand: "TypeConstraintExpression" };

/** Default value expression */
export type DefaultValue = string & { __brand: "DefaultValue" };

/** Code expression */
export type Expression = string & { __brand: "Expression" };

/** Initial value for a variable */
export type InitialValue = string & { __brand: "InitialValue" };

/** Type kind for resolved types */
export type ResolvedTypeKind =
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "trait"
  | "primitive"
  | "unknown";

// ============================================================================
// Type Guards for Type Analysis
// ============================================================================

export function is_type_expression(value: unknown): value is TypeExpression {
  return typeof value === "string" && value.length > 0;
}

export function is_type_constraint_expression(value: unknown): value is TypeConstraintExpression {
  return typeof value === "string" && value.length > 0;
}

export function is_default_value(value: unknown): value is DefaultValue {
  return typeof value === "string";
}

export function is_expression(value: unknown): value is Expression {
  return typeof value === "string";
}

// ============================================================================
// Branded Type Creators for Type Analysis
// ============================================================================

export function to_type_expression(value: string): TypeExpression {
  if (!value || value.length === 0) {
    throw new Error(`Invalid TypeExpression: "${value}"`);
  }
  return value as TypeExpression;
}

export function to_type_constraint_expression(value: string): TypeConstraintExpression {
  if (!value || value.length === 0) {
    throw new Error(`Invalid TypeConstraintExpression: "${value}"`);
  }
  return value as TypeConstraintExpression;
}

export function to_default_value(value: string): DefaultValue {
  return value as DefaultValue;
}

export function to_expression(value: string): Expression {
  return value as Expression;
}

export function to_initial_value(value: string): InitialValue {
  return value as InitialValue;
}

// ============================================================================
// Type Expression Utilities
// ============================================================================

export type TypeModifier =
  | "array"
  | "nullable"
  | "optional"
  | "promise"
  | "readonly";

/**
 * Build a TypeExpression from components
 */
export function build_type_expression(
  base: string,
  generics?: string[],
  modifiers?: TypeModifier[]
): TypeExpression {
  let expr = base;

  // Add generic parameters
  if (generics && generics.length > 0) {
    expr += `<${generics.join(", ")}>`;
  }

  // Apply modifiers
  if (modifiers) {
    for (const modifier of modifiers) {
      switch (modifier) {
        case "array":
          expr += "[]";
          break;
        case "nullable":
          expr += " | null";
          break;
        case "optional":
          expr += " | undefined";
          break;
        case "promise":
          expr = `Promise<${expr}>`;
          break;
        case "readonly":
          expr = `readonly ${expr}`;
          break;
      }
    }
  }

  return to_type_expression(expr);
}

/**
 * Parse a TypeExpression into components
 */
export function parse_type_expression(expr: TypeExpression): {
  base: string;
  generics?: string[];
  is_array: boolean;
  is_nullable: boolean;
  is_optional: boolean;
  is_promise: boolean;
  is_union: boolean;
  union_types?: string[];
} {
  const str = expr as string;

  // Check for union types
  const is_union = str.includes(" | ");
  const union_types = is_union
    ? str.split(" | ").map((s) => s.trim())
    : undefined;

  // Check for Promise
  const is_promise = str.startsWith("Promise<");

  // Check for array
  const is_array = str.endsWith("[]");

  // Check for nullable/optional
  const is_nullable = str.includes(" | null");
  const is_optional = str.includes(" | undefined");

  // Extract base type and generics
  let base = str;
  let generics: string[] | undefined;

  // Simple generic extraction (doesn't handle nested generics perfectly)
  const generic_match = /^([^<]+)<([^>]+)>/.exec(str);
  if (generic_match) {
    base = generic_match[1];
    generics = generic_match[2].split(",").map((s) => s.trim());
  } else if (is_array) {
    base = str.replace(/\[\]$/, "");
  }

  return {
    base,
    generics,
    is_array,
    is_nullable,
    is_optional,
    is_promise,
    is_union,
    union_types,
  };
}

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
  readonly type_parameters: readonly TypeParameter[]; // Always present, defaults to empty array
  readonly constraints: readonly TypeConstraint[]; // Always present, defaults to empty array

  // Inheritance and composition
  readonly extends: readonly SymbolId[]; // Always present, defaults to empty array
  readonly implements: readonly SymbolId[]; // Always present, defaults to empty array
  readonly mixins: readonly SymbolId[]; // Always present, defaults to empty array

  // Members (unified for all type kinds)
  readonly members: ReadonlyMap<SymbolName, TypeMember>; // Always present, defaults to empty map

  // Type metadata
  readonly is_generic: boolean;
  readonly is_abstract: boolean;
  readonly is_final: boolean;
  readonly is_nullable: boolean;
  readonly is_optional: boolean;
}

// TypeParameter interface moved to common.ts
// Note: This version had 'variance' property - consider adding to common.ts if needed

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
  readonly is_optional: boolean;
  readonly is_readonly: boolean;
  readonly is_static: boolean;
  readonly is_abstract: boolean;
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
    "language" in type &&
    "members" in type &&
    type.members instanceof Map
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
  return type.is_generic || (type.type_parameters?.length ?? 0) > 0;
}

/**
 * Check if a type is nullable
 */
export function is_nullable_type(type: TypeDefinition): boolean {
  return type.is_nullable || type.is_optional;
}

/**
 * Get all base types (extends + implements)
 */
export function get_base_types(type: TypeDefinition): SymbolId[] {
  return [...type.extends, ...type.implements];
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
    // Provide defaults for required array properties
    type_parameters: [],
    constraints: [],
    extends: [],
    implements: [],
    mixins: [],
    // Provide defaults for required map properties
    members: new Map(),
    // Provide defaults for required boolean properties
    is_generic: false,
    is_abstract: false,
    is_final: false,
    is_nullable: false,
    is_optional: false,
    modifiers: [], // Always provide default empty array for non-nullable field
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
    modifiers: [], // Always provide default empty array for non-nullable field
  };
}

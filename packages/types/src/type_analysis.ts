/**
 * Type analysis types for type tracking, inference, and propagation
 * across all type analysis modules
 */

import { SymbolName } from "./symbols";
import { SymbolId } from "./symbols";
import { SemanticNode, Resolution } from "./query";
import { TypeParameter } from "./definitions";

// ============================================================================
// Branded Types for Type Analysis
// ============================================================================

/** Type expression (more specific than TypeString) */
export type TypeExpression = string & { __brand: "TypeExpression" };

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

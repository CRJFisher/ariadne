/**
 * Unified inheritance types that simplify class detection and hierarchy
 * with unified handling of interfaces, traits, and mixins
 */

import { SymbolName } from "./symbol";
import { SymbolId } from "./symbol";
import { SemanticNode } from "./query";
import { TypeDefinition } from "./type_analysis";

export type Visibility = "public" | "private" | "protected";

// ============================================================================
// Unified Class/Interface/Trait Types
// ============================================================================

/**
 * Unified type entity that represents classes, interfaces, traits, mixins
 * Replaces ClassNode, InterfaceDefinition, TraitDefinition
 */
export interface TypeEntity extends SemanticNode {
  readonly id: SymbolId;
  readonly name: SymbolName;
  readonly entity_kind: TypeEntityKind;

  // Inheritance relationships (unified)
  readonly extends: readonly SymbolId[]; // Always present, defaults to empty array
  readonly implements: readonly SymbolId[]; // Always present, defaults to empty array
  readonly uses: readonly SymbolId[]; // Always present, defaults to empty array

  // Members
  readonly members: ReadonlyMap<SymbolName, Member>;

  // Type characteristics
  readonly modifiers: readonly TypeModifier[]; // Always present, defaults to empty array
  readonly type_parameters: readonly string[]; // Always present, defaults to empty array

  // Computed hierarchy information
  readonly ancestors: readonly SymbolId[]; // All ancestors in order, defaults to empty array
  readonly descendants: readonly SymbolId[]; // All descendants, defaults to empty array
  readonly mro: readonly SymbolId[]; // Method resolution order, defaults to empty array
}

/**
 * Kind of type entity
 */
export type TypeEntityKind =
  | "class" // Regular class
  | "abstract_class" // Abstract class
  | "interface" // Interface/protocol
  | "trait" // Trait (Rust/PHP)
  | "mixin" // Mixin (Python/Ruby)
  | "struct" // Struct (Rust/C)
  | "enum"; // Enum class

/**
 * Type modifiers
 */
export type TypeModifier =
  | "abstract"
  | "final"
  | "sealed"
  | "static"
  | "partial" // C# partial classes
  | "data" // Kotlin data classes
  | "value"; // Value types

/**
 * Base member information extending SemanticNode
 */
interface BaseMember extends SemanticNode {
  readonly id: SymbolId;
  readonly name: SymbolName;
  readonly visibility: Visibility; // Always present, defaults to "public"
  readonly modifiers: readonly MemberModifier[]; // Override SemanticNode's modifiers with specific type
  readonly overridden_by: readonly SymbolId[]; // Members that override this, defaults to empty array
}

/**
 * Field member (has type, no signature)
 */
export interface FieldMember extends BaseMember {
  readonly member_type: "field" | "static_field";
  readonly type: TypeDefinition; // Always present for fields
  readonly overrides?: SymbolId; // Field being overridden (for property overrides)
  // implements not applicable for fields
}

/**
 * Method member (has signature, may have return type info)
 */
export interface MethodMember extends BaseMember {
  readonly member_type:
    | "method"
    | "constructor"
    | "destructor"
    | "getter"
    | "setter"
    | "static_method";
  readonly signature: MemberSignature; // Always present for methods
  readonly overrides?: SymbolId; // Method being overridden
  readonly implements?: SymbolId; // Interface method being implemented
}

/**
 * Unified member - discriminated union for type safety
 */
export type Member = FieldMember | MethodMember;

export type MemberType =
  | "field" // Instance field/property
  | "method" // Instance method
  | "constructor" // Constructor
  | "destructor" // Destructor
  | "getter" // Property getter
  | "setter" // Property setter
  | "static_field" // Static field
  | "static_method"; // Static method

export type MemberModifier =
  | "abstract"
  | "override"
  | "virtual"
  | "final"
  | "static"
  | "readonly"
  | "async"
  | "const";

/**
 * Member signature for methods
 */
export interface MemberSignature {
  readonly parameters: readonly Parameter[]; // Always present, defaults to empty array
  readonly return_type?: TypeDefinition;
  readonly type_parameters: readonly string[]; // Always present, defaults to empty array
  readonly throws: readonly TypeDefinition[]; // Always present, defaults to empty array
}

export interface Parameter {
  readonly name: SymbolName;
  readonly type?: TypeDefinition;
  readonly is_optional: boolean; // Always present, defaults to false
  readonly is_rest: boolean; // Always present, defaults to false
  readonly default_value?: string;
}

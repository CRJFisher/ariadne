/**
 * Unified inheritance types that simplify class detection and hierarchy
 * with unified handling of interfaces, traits, and mixins
 */

import { Location, Language } from "./common";
import { FilePath } from "./aliases";
import { Visibility } from "./symbol_scope";
import { SymbolName } from "./symbol_utils";
import { SymbolId } from "./symbol_utils";
import { SemanticNode, Resolution } from "./query";
import { TypeDefinition, TypeMember } from "./type_analysis";
import { map_get_array } from "./map_utils";

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
  readonly member_type: "method" | "constructor" | "destructor" | "getter" | "setter" | "static_method";
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

// ============================================================================
// Inheritance Relationships
// ============================================================================

/**
 * Unified inheritance relationship
 * Replaces InheritanceEdge
 */
export interface InheritanceRelation {
  readonly from: SymbolId; // Child type
  readonly to: SymbolId; // Parent type
  readonly relation_type: InheritanceType;
  readonly location: Location; // Where declared
  readonly is_direct: boolean; // Direct vs transitive
}

export type InheritanceType =
  | "extends" // Class inheritance
  | "implements" // Interface implementation
  | "uses" // Trait/mixin usage
  | "conforms" // Protocol conformance
  | "derives"; // Rust derive

/**
 * Complete inheritance hierarchy
 */
export interface InheritanceHierarchy {
  readonly entities: ReadonlyMap<SymbolId, TypeEntity>;
  readonly relations: readonly InheritanceRelation[];
  readonly roots: ReadonlySet<SymbolId>; // Types with no parents
  readonly leaves: ReadonlySet<SymbolId>; // Types with no children

  // Computed analysis
  readonly cycles?: readonly SymbolId[][]; // Circular inheritance
  readonly depth_map?: ReadonlyMap<SymbolId, number>; // Inheritance depth
  readonly diamond_problems?: readonly DiamondProblem[];
}

/**
 * Diamond inheritance problem detection
 */
export interface DiamondProblem {
  readonly base: SymbolId; // Common ancestor
  readonly paths: readonly SymbolId[][]; // Multiple inheritance paths
  readonly conflicting_members?: readonly SymbolName[];
}

// ============================================================================
// Method Override Analysis
// ============================================================================

/**
 * Method override chain
 */
export interface OverrideChain {
  readonly method_name: SymbolName;
  readonly chain: readonly OverrideStep[];
  readonly has_conflict?: boolean;
}

export interface OverrideStep {
  readonly type_id: SymbolId;
  readonly member_id: SymbolId;
  readonly implementation: "abstract" | "concrete" | "default";
}

// ============================================================================
// Type Guards
// ============================================================================

export function is_unified_type_entity(
  value: unknown
): value is TypeEntity {
  if (typeof value !== "object" || value === null) return false;
  const entity = value as any;
  return (
    "id" in entity &&
    "name" in entity &&
    "entity_kind" in entity &&
    "members" in entity &&
    entity.members instanceof Map
  );
}

export function is_unified_member(value: unknown): value is Member {
  if (typeof value !== "object" || value === null) return false;
  const member = value as any;
  return (
    "id" in member &&
    "name" in member &&
    "member_type" in member &&
    "location" in member
  );
}

export function is_inheritance_relation(
  value: unknown
): value is InheritanceRelation {
  if (typeof value !== "object" || value === null) return false;
  const relation = value as any;
  return (
    "from" in relation &&
    "to" in relation &&
    "relation_type" in relation &&
    "is_direct" in relation
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if entity is abstract
 */
export function is_abstract(entity: TypeEntity): boolean {
  return (
    entity.entity_kind === "abstract_class" ||
    entity.entity_kind === "interface" ||
    entity.entity_kind === "trait" ||
    entity.modifiers.includes("abstract") === true
  );
}

/**
 * Check if entity can be instantiated
 */
export function is_instantiable(entity: TypeEntity): boolean {
  return (
    !is_abstract(entity) &&
    entity.entity_kind !== "interface" &&
    entity.entity_kind !== "trait"
  );
}

/**
 * Check if member is overridable
 */
export function is_overridable(member: Member): boolean {
  return (
    !member.modifiers.includes("final") &&
    !member.modifiers.includes("static") &&
    (member.modifiers.includes("virtual") ||
      member.modifiers.includes("abstract") ||
      member.visibility !== "private")
  );
}

/**
 * Get all base types (extends + implements + uses)
 */
export function get_all_base_types(entity: TypeEntity): SymbolId[] {
  return [
    ...entity.extends,
    ...entity.implements,
    ...entity.uses,
  ];
}

/**
 * Create a class entity
 */
export function create_class_entity(
  id: SymbolId,
  name: SymbolName,
  location: Location,
  language: Language,
  options?: Partial<TypeEntity>
): TypeEntity {
  return {
    id,
    name,
    entity_kind: "class",
    extends: [],
    implements: [],
    uses: [],
    members: new Map(),
    modifiers: [],
    type_parameters: [],
    ancestors: [],
    descendants: [],
    mro: [],
    location,
    language,
    node_type: "class_declaration",
    ...options,
  };
}

/**
 * Create an interface entity
 */
export function create_interface_entity(
  id: SymbolId,
  name: SymbolName,
  location: Location,
  language: Language,
  options?: Partial<TypeEntity>
): TypeEntity {
  return {
    id,
    name,
    entity_kind: "interface",
    extends: [],
    implements: [],
    uses: [],
    members: new Map(),
    modifiers: [],
    type_parameters: [],
    ancestors: [],
    descendants: [],
    mro: [],
    location,
    language,
    node_type: "interface_declaration",
    ...options,
  };
}

/**
 * Check for diamond inheritance
 */
export function find_diamond_problems(
  hierarchy: InheritanceHierarchy
): DiamondProblem[] {
  const problems: DiamondProblem[] = [];

  // For each entity, find if it has multiple paths to any ancestor
  for (const [entity_id, entity] of hierarchy.entities) {
    const paths_to_ancestors = new Map<SymbolId, SymbolId[][]>();

    // Track all paths to each ancestor
    const visited = new Set<SymbolId>();
    const find_paths = (current: SymbolId, path: SymbolId[]) => {
      if (visited.has(current)) return;
      visited.add(current);

      const entity = hierarchy.entities.get(current);
      if (!entity) return;

      const bases = get_all_base_types(entity);
      for (const base of bases) {
        const new_path = [...path, base];
        const existing = map_get_array(paths_to_ancestors, base);
        paths_to_ancestors.set(base, [...existing, new_path]);
        find_paths(base, new_path);
      }
    };

    find_paths(entity_id, [entity_id]);

    // Check for multiple paths
    for (const [ancestor, paths] of paths_to_ancestors) {
      if (paths.length > 1) {
        problems.push({
          base: ancestor,
          paths,
        });
      }
    }
  }

  return problems;
}

// ============================================================================
// Type Guards for Member Types
// ============================================================================

/**
 * Type guard to check if a member is a field member
 */
export function is_field_member(member: Member): member is FieldMember {
  return member.member_type === "field" || member.member_type === "static_field";
}

/**
 * Type guard to check if a member is a method member
 */
export function is_method_member(member: Member): member is MethodMember {
  const method_types: readonly MemberType[] = [
    "method",
    "constructor",
    "destructor",
    "getter",
    "setter",
    "static_method"
  ];
  return method_types.includes(member.member_type);
}

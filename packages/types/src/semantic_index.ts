/**
 * Semantic Index - Unified symbol extraction with lexical scoping
 *
 * Essential types for call chain resolution and cross-file symbol tracking.
 * Language-agnostic with minimal fields needed for call graph construction.
 */

import type { Location, Language } from "./common";
import type { FilePath } from "./common";
import type { SymbolId, SymbolName } from "./symbol";
import type { ScopeId, ScopeType } from "./scopes";
import type { Import, Export } from "./import_export";
import type { TypeId } from "./type_id";

/**
 * Symbol kind - essential for resolution rules
 */
export type SymbolKind =
  | "function"
  | "class"
  | "method"
  | "constructor"
  | "parameter"
  | "variable"
  | "constant"
  | "import"
  | "interface"
  | "enum"
  | "type_alias"
  | "namespace";

/**
 * Reference type - essential for call chain tracking
 */
export type ReferenceType =
  | "call" // Function/method call - CRITICAL for call chains
  | "construct" // Constructor call - CRITICAL for call chains
  | "read" // Variable read
  | "write" // Variable write
  | "member_access" // Property/method access - needed for method resolution
  | "type" // Type reference
  | "assignment" // Assignment target/source connection
  | "return"; // Return value - tracks function return types

/**
 * Lexical scope with symbols
 * Self-contained scope with symbol table for resolution
 */
export interface LexicalScope {
  /** Unique scope identifier */
  readonly id: ScopeId;

  /** Parent scope ID (null for root) */
  readonly parent_id: ScopeId | null;

  /** Scope name (for named scopes like functions/classes) */
  readonly name: SymbolName | null;

  /** Type of scope */
  readonly type: ScopeType;

  /** Scope location */
  readonly location: Location;

  /** Child scope IDs */
  readonly child_ids: readonly ScopeId[];

  /** Symbols defined in this scope */
  readonly symbols: Map<SymbolName, SymbolDefinition>;
}

/**
 * Symbol definition - minimal fields for call resolution
 */
export interface SymbolDefinition {
  /** Universal symbol ID */
  readonly id: SymbolId;

  /** Local name in scope */
  readonly name: SymbolName;

  /** Kind determines resolution behavior */
  readonly kind: SymbolKind;

  /** Definition location */
  readonly location: Location;

  /** Containing scope  */
  readonly scope_id: ScopeId;

  /** Hoisting behavior - CRITICAL for JS/TS */
  readonly is_hoisted: boolean;

  /** Module boundary markers */
  readonly is_exported: boolean;
  readonly is_imported: boolean;

  /** For imports: source module */
  readonly import_source?: FilePath;

  /** For exports: exported name if different */
  readonly exported_as?: SymbolName;

  /** For classes: what it extends */
  readonly extends_class?: SymbolName;

  /** For classes: what it implements */
  readonly implements_interfaces?: readonly SymbolName[];

  /** For methods: whether it's static */
  readonly is_static?: boolean;

  /** For functions/methods: return type hint */
  readonly return_type_hint?: SymbolName;

  /** All references to this symbol */
  readonly references: readonly SymbolReference[];

  // Type information
  /** For classes, interfaces, type aliases: their TypeId */
  readonly type_id?: TypeId;

  /** For functions/methods: resolved return type */
  readonly return_type?: TypeId;

  /** For methods/properties: the type they belong to */
  readonly member_of?: TypeId;

  /** For variables/properties: their value type */
  readonly value_type?: TypeId;

  /** For methods: available overloads */
  readonly overloads?: readonly TypeId[];

  /** For classes: member symbols */
  readonly members?: readonly SymbolId[];

  /** For classes: static member symbols */
  readonly static_members?: readonly SymbolId[];
}

/**
 * Type information for references
 */
export interface TypeInfo {
  /** Type identifier */
  readonly type_id: TypeId;

  /** Human-readable type name */
  readonly type_name: SymbolName;

  /** How certain we are about this type */
  readonly certainty: "declared" | "inferred" | "ambiguous";

  /** Whether nullable */
  readonly is_nullable?: boolean;
}

/**
 * Symbol reference - tracks usage for call chains with rich type information
 */
export interface SymbolReference {
  /** Reference location */
  readonly location: Location;

  /** Type of reference - CRITICAL for call detection */
  readonly type: ReferenceType;

  /** Scope containing this reference */
  readonly scope_id: ScopeId;

  /** Name being referenced */
  readonly name: SymbolName;

  /** Additional context for resolution */
  readonly context?: ReferenceContext;

  /** Type information at this reference */
  readonly type_info?: TypeInfo;

  /** For calls: what kind of call */
  readonly call_type?: "function" | "method" | "constructor" | "super";

  /** For assignments: type flow information */
  readonly type_flow?: {
    source_type?: TypeInfo;
    target_type?: TypeInfo;
    is_narrowing: boolean;
    is_widening: boolean;
  };

  /** For returns: return type */
  readonly return_type?: TypeInfo;

  /** For member access: access details */
  readonly member_access?: {
    object_type?: TypeInfo;
    access_type: "property" | "method" | "index";
    is_optional_chain: boolean;
  };
}

/**
 * Additional context for complex references
 */
export interface ReferenceContext {
  /** For method calls: the receiver object location */
  readonly receiver_location?: Location;

  /** For assignments: the source value location */
  readonly assignment_source?: Location;

  /** For assignments: the target variable location */
  readonly assignment_target?: Location;

  /** For constructor calls: the variable being assigned to */
  readonly construct_target?: Location;

  /** For returns: the containing function */
  readonly containing_function?: SymbolId;

  /** For member access: the property chain */
  readonly property_chain?: readonly SymbolName[];
}

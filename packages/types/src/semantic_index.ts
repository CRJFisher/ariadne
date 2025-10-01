/**
 * Semantic Index - Unified symbol extraction with lexical scoping
 *
 * Essential types for call chain resolution and cross-file symbol tracking.
 * Language-agnostic with minimal fields needed for call graph construction.
 */

import type { Location } from "./common";
import type { SymbolId, SymbolName } from "./symbol";
import type { ScopeId, ScopeType } from "./scopes";
import type { SymbolAvailability } from "./symbol_definitions";
import type { SymbolKind } from "./symbol";

/**
 * Reference type - essential for call chain tracking
 */
export type ReferenceType =
  | "call" // Function/method call
  | "construct" // Constructor call
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
}

// /**
//  * Base definition interface - common fields for all symbol types
//  */
// export interface BaseDefinition {
//   /** Universal symbol ID */
//   readonly id: SymbolId;
//   /** Local name in scope */
//   readonly name: SymbolName;
//   /** Kind determines resolution behavior and acts as discriminator */
//   readonly kind: SymbolKind;
//   /** Definition location */
//   readonly location: Location;
//   /** Containing scope */
//   readonly scope_id: ScopeId;
//   /** Symbol availability for import/export */
//   readonly availability: SymbolAvailability;
// }

// /**
//  * Function definition for extraction phase
//  */
// export interface FunctionDef extends BaseDefinition {
//   readonly kind: "function" | "constructor";
//   readonly return_type_hint?: SymbolName;
//   readonly is_generic?: boolean;
//   readonly is_async?: boolean;
//   readonly is_generator?: boolean;
//   // Rust-specific
//   readonly is_const?: boolean;
//   readonly is_move?: boolean;
//   readonly returns_impl_trait?: boolean;
//   readonly accepts_impl_trait?: boolean;
//   readonly is_higher_order?: boolean;
//   readonly is_function_pointer?: boolean;
//   readonly is_function_trait?: boolean;
// }

// /**
//  * Class definition for extraction phase
//  */
// export interface ClassDef extends BaseDefinition {
//   readonly kind: "class";
//   readonly extends_class?: SymbolName;
//   readonly implements_interfaces?: readonly SymbolName[];
//   readonly methods?: readonly MethodDef[];
//   readonly fields?: readonly VariableDef[];
//   readonly is_generic?: boolean;
// }

// /**
//  * Interface definition for extraction phase
//  */
// export interface InterfaceDef extends BaseDefinition {
//   readonly kind: "interface";
//   readonly extends_interfaces?: readonly SymbolName[];
//   readonly methods?: readonly MethodDef[];
//   readonly is_generic?: boolean;
// }

// /**
//  * Enum definition for extraction phase
//  */
// export interface EnumDef extends BaseDefinition {
//   readonly kind: "enum";
//   readonly members?: readonly SymbolName[];
//   readonly methods?: readonly MethodDef[];
// }

// /**
//  * Method definition for extraction phase
//  */
// export interface MethodDef extends BaseDefinition {
//   readonly kind: "method";
//   readonly is_static?: boolean;
//   readonly return_type_hint?: SymbolName;
//   readonly is_generic?: boolean;
//   readonly is_async?: boolean;
// }

// /**
//  * Variable/constant/parameter definition for extraction phase
//  */
// export interface VariableDef extends BaseDefinition {
//   readonly kind: "variable" | "constant" | "parameter";
//   readonly type_hint?: SymbolName;
//   readonly is_lifetime?: boolean; // Rust lifetime parameter
// }

// /**
//  * Import definition for extraction phase
//  */
// export interface ImportDef extends BaseDefinition {
//   readonly kind: "import";
//   readonly source: FilePath; // Module path imported from
//   readonly original_name?: SymbolName; // Original name if aliased
//   readonly is_default?: boolean;
//   readonly is_namespace?: boolean;
// }

// /**
//  * Type/type alias definition for extraction phase
//  */
// export interface TypeDef extends BaseDefinition {
//   readonly kind: "type" | "type_alias";
//   readonly type_expression?: string;
//   readonly is_generic?: boolean;
// }

// /**
//  * Namespace/module definition for extraction phase
//  */
// export interface NamespaceDef extends BaseDefinition {
//   readonly kind: "namespace" | "module";
//   readonly exported_symbols?: readonly SymbolId[];
// }

// /**
//  * Discriminated union of all definition types
//  */
// export type AnyDefinition =
//   | FunctionDef
//   | ClassDef
//   | MethodDef
//   | VariableDef
//   | InterfaceDef
//   | EnumDef
//   | TypeDef
//   | NamespaceDef
//   | ImportDef;

// /**
//  * Type guards for definition types
//  */
// export function isFunctionDef(def: AnyDefinition): def is FunctionDef {
//   return def.kind === "function" || def.kind === "constructor";
// }

// export function isClassDef(def: AnyDefinition): def is ClassDef {
//   return def.kind === "class";
// }

// export function isMethodDef(def: AnyDefinition): def is MethodDef {
//   return def.kind === "method";
// }

// export function isVariableDef(def: AnyDefinition): def is VariableDef {
//   return def.kind === "variable" || def.kind === "constant" || def.kind === "parameter";
// }

// export function isImportDef(def: AnyDefinition): def is ImportDef {
//   return def.kind === "import";
// }

// export function isInterfaceDef(def: AnyDefinition): def is InterfaceDef {
//   return def.kind === "interface";
// }

// export function isEnumDef(def: AnyDefinition): def is EnumDef {
//   return def.kind === "enum";
// }

// export function isTypeDef(def: AnyDefinition): def is TypeDef {
//   return def.kind === "type" || def.kind === "type_alias";
// }

// export function isNamespaceDef(def: AnyDefinition): def is NamespaceDef {
//   return def.kind === "namespace" || def.kind === "module";
// }

/**
 * Symbol definition - minimal fields for call resolution
 * @deprecated Use AnyDefinition instead
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

  /** Symbol availability for import/export */
  readonly availability: SymbolAvailability;

  /** For classes: what it extends */
  readonly extends_class?: SymbolName;

  /** For classes: what it implements */
  readonly implements_interfaces?: readonly SymbolName[];

  /** For methods: whether it's static */
  readonly is_static?: boolean;

  /** For generics: whether it has generic parameters */
  readonly is_generic?: boolean;

  /** For lifetimes: whether it's a lifetime parameter */
  readonly is_lifetime?: boolean;

  /** For functions/methods: return type hint */
  readonly return_type_hint?: SymbolName;

  /** For classes: member symbols */
  readonly members?: readonly SymbolId[];

  /** For classes: static member symbols */
  readonly static_members?: readonly SymbolId[];

  /** Function-specific modifiers */
  readonly is_const?: boolean;
  readonly is_move?: boolean;
  readonly returns_impl_trait?: boolean;
  readonly accepts_impl_trait?: boolean;
  readonly is_function_pointer?: boolean;
  readonly is_function_trait?: boolean;
  readonly is_higher_order?: boolean;
}

/**
 * Type information for references
 */
export interface TypeInfo {
  /** Type identifier */
  readonly type_id: SymbolId;

  /** Human-readable type name */
  readonly type_name: SymbolName;

  /** How certain we are about this type */
  readonly certainty: "declared" | "inferred" | "ambiguous";

  /** Whether nullable */
  readonly is_nullable?: boolean;
}

/**
 * Symbol reference - tracks symbol usage for call chain resolution
 *
 * Designed for method call resolution: given `obj.method()`, determine which class
 * defines `method` by tracking receiver types and property chains.
 *
 * All attributes are extracted from tree-sitter AST nodes or inferred from type
 * annotations. Fields fall into two categories:
 * - **Extractable**: Directly captured from tree-sitter queries
 * - **Inference-based**: Derived from type annotations or context
 *
 * @example
 * // Method call: user.getName()
 * {
 *   location: { file_path: "app.ts", start_line: 10, ... },
 *   type: "call",
 *   name: "getName",
 *   call_type: "method",
 *   context: {
 *     receiver_location: <location of 'user'>,
 *     property_chain: ["user", "getName"]
 *   },
 *   type_info: { type_name: "User", certainty: "declared" }
 * }
 */
export interface SymbolReference {
  /**
   * Reference location in source file
   *
   * **Extractable** - Tree-sitter pattern: `@capture` yields node with start/end positions
   *
   * Example: `obj.method()` → location points to the entire call expression
   */
  readonly location: Location;

  /**
   * Type of reference - distinguishes calls, reads, writes, type references
   *
   * **Extractable** - Determined from capture name and AST node type
   *
   * Tree-sitter pattern: Capture names like `@reference.call`, `@reference.variable`
   * map to ReferenceType values ("call", "read", etc.)
   *
   * Critical for call detection - filters method calls from variable reads.
   */
  readonly type: ReferenceType;

  /**
   * Scope containing this reference
   *
   * **Extractable** - Resolved from location by looking up enclosing scope
   *
   * Enables lexical scope resolution for local variables and function parameters.
   */
  readonly scope_id: ScopeId;

  /**
   * Name being referenced
   *
   * **Extractable** - Tree-sitter pattern: `@capture` provides node text
   *
   * Example: `user.getName()` → name is "getName"
   * Example: `const x = getValue()` → name is "getValue"
   */
  readonly name: SymbolName;

  /**
   * Additional context for method call resolution
   *
   * **Extractable** - See ReferenceContext for tree-sitter patterns
   *
   * Contains receiver_location, property_chain, and construct_target.
   * Only present when relevant to the reference type.
   */
  readonly context?: ReferenceContext;

  /**
   * Type information at this reference
   *
   * **Inference-based** - Extracted from type annotations or JSDoc
   *
   * Tree-sitter pattern (TypeScript):
   * ```
   * (variable_declarator
   *   name: (identifier) @var.name
   *   type: (type_annotation) @var.type)
   * ```
   *
   * Provides receiver type for method resolution when explicitly annotated.
   */
  readonly type_info?: TypeInfo;

  /**
   * For calls: what kind of call
   *
   * **Extractable** - Determined from AST node structure
   *
   * - "function": Regular function call `foo()`
   * - "method": Method call `obj.method()`
   * - "constructor": Constructor call `new Class()`
   * - "super": Super call `super.method()`
   *
   * Tree-sitter pattern (method call):
   * ```
   * (call_expression
   *   function: (member_expression) @method.call)
   * ```
   */
  readonly call_type?: "function" | "method" | "constructor" | "super";

  /**
   * For assignments: explicit type annotation on the assignment target
   *
   * **Inference-based** - Extracted from type annotation AST nodes
   *
   * Tree-sitter pattern (TypeScript):
   * ```
   * (variable_declarator
   *   name: (identifier) @assignment.target
   *   type: (type_annotation) @assignment.type
   *   value: (_) @assignment.value)
   * ```
   *
   * Enables tracking type flow through assignments: `const obj: MyClass = factory()`
   */
  readonly assignment_type?: TypeInfo;

  /**
   * For returns: return type of the function
   *
   * **Inference-based** - Extracted from function return type annotation
   *
   * Tree-sitter pattern (TypeScript):
   * ```
   * (function_declaration
   *   name: (identifier)
   *   return_type: (type_annotation) @function.return_type)
   * ```
   *
   * Tracks what type flows out of function calls for downstream resolution.
   */
  readonly return_type?: TypeInfo;

  /**
   * For member access: detailed access information
   *
   * **Mixed** - access_type and is_optional_chain are extractable; object_type is inference-based
   *
   * Tree-sitter pattern (optional chain):
   * ```
   * (optional_chain
   *   object: (_) @member.object
   *   property: (_) @member.property)
   * ```
   *
   * Distinguishes property access from method calls and tracks optional chaining syntax.
   */
  readonly member_access?: {
    /** Object type - inference-based from type annotations */
    object_type?: TypeInfo;
    /** Access type - extractable from node type */
    access_type: "property" | "method" | "index";
    /** Optional chain detection - extractable via AST node type check */
    is_optional_chain: boolean;
  };
}

/**
 * Additional context for method call resolution
 *
 * Provides extractable metadata to support resolving method calls of the form `obj.method()`.
 * All fields are extracted directly from tree-sitter AST traversal.
 *
 * This interface enables:
 * - Finding the receiver object for method calls
 * - Tracking chained property/method access
 * - Connecting constructor calls to their target variables
 *
 * @example
 * // Method call: user.getName()
 * {
 *   receiver_location: <location of 'user'>,
 *   property_chain: ["user", "getName"]
 * }
 *
 * @example
 * // Constructor: const obj = new MyClass()
 * {
 *   construct_target: <location of 'obj'>
 * }
 */
export interface ReferenceContext {
  /**
   * For method calls: the receiver object location
   *
   * **Extractable** - Identifies which object the method is called on
   *
   * Essential for method resolution: to resolve `obj.method()`, we need to:
   * 1. Find the receiver object at this location
   * 2. Determine its type
   * 3. Look up which class defines the method
   *
   * Tree-sitter patterns by language:
   *
   * JavaScript/TypeScript:
   * ```
   * (call_expression
   *   function: (member_expression
   *     object: (_) @receiver))
   * ```
   *
   * Python:
   * ```
   * (call
   *   function: (attribute
   *     object: (_) @receiver))
   * ```
   *
   * Rust:
   * ```
   * (call_expression
   *   function: (field_expression
   *     value: (_) @receiver))
   * ```
   *
   * Example: `user.getName()` → receiver_location points to `user`
   * Example: `this.helper.process()` → receiver_location points to `this.helper`
   */
  readonly receiver_location?: Location;

  /**
   * For member access: the complete property/method chain
   *
   * **Extractable** - Tracks multi-step access patterns for chained calls
   *
   * Critical for resolving chained method calls where each call returns an object
   * that the next method is called on.
   *
   * Tree-sitter pattern: Recursive traversal of member access nodes:
   * - JavaScript/TypeScript: `member_expression`, `optional_chain`
   * - Python: `attribute`
   * - Rust: `field_expression`
   *
   * Algorithm:
   * 1. Start with the root identifier (leftmost symbol)
   * 2. Traverse member access nodes from left to right
   * 3. Build array of all accessed names
   *
   * Example: `container.getUser().getName()` → ['container', 'getUser', 'getName']
   * Example: `a.b.c.d` → ['a', 'b', 'c', 'd']
   * Example: `obj?.method?.()` → ['obj', 'method']
   */
  readonly property_chain?: readonly SymbolName[];

  /**
   * For constructor calls: the variable being assigned to
   *
   * **Extractable** - Most reliable type determination strategy
   *
   * Essential for type tracking: when we see `const obj = new MyClass()`, we can
   * immediately determine that `obj` has type `MyClass` without type inference.
   *
   * Tree-sitter patterns by language:
   *
   * JavaScript/TypeScript:
   * ```
   * (variable_declarator
   *   name: (identifier) @construct.target
   *   value: (new_expression
   *     constructor: (identifier) @construct.class))
   * ```
   *
   * Python:
   * ```
   * (assignment
   *   left: (identifier) @construct.target
   *   right: (call
   *     function: (identifier) @construct.class))
   * ```
   *
   * Rust:
   * ```
   * (let_declaration
   *   pattern: (identifier) @construct.target
   *   value: (call_expression
   *     function: (identifier) @construct.class))
   * ```
   *
   * Example: `const obj = new MyClass()` → construct_target points to `obj`
   * Example: `this.instance = new Helper()` → construct_target points to `this.instance`
   *
   * This enables tracking: whenever we see `obj.method()`, we can look up that
   * `obj` was constructed as `MyClass` and resolve the method accordingly.
   */
  readonly construct_target?: Location;
}


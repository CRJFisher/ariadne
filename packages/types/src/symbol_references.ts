import type { Location } from "./common";
import type { ScopeId } from "./scopes";
import { ReferenceType, TypeInfo } from "./semantic_index";
import type { SymbolName } from "./symbol";

/**
 * Symbol reference - tracks symbol usage for call chain resolution
 *
 * TODO: split this into
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
   * **Status**: ⚠️ PARTIALLY IMPLEMENTED - Extracted but not yet used in resolution
   * **Future Work**: See backlog/tasks/task-154-type-resolution-and-heuristics.md
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
   * **Purpose**: Enable type flow analysis for dynamic languages (JavaScript, Python)
   *
   * Example use case:
   * ```typescript
   * const service = createService();  // No type annotation!
   * service.getData();  // Would resolve if assignment_type tracked createService() return type
   * ```
   *
   * **Current State**:
   * - ✅ Extracted for Rust (task-epic-11.123)
   * - ⚠️ Partially extracted for TypeScript/JavaScript/Python
   * - ❌ Not yet used in type resolution (uses VariableDefinition.type instead)
   *
   * **Integration Point**: Would be consumed by extract_type_bindings() as fallback
   * when VariableDefinition.type is undefined (i.e., no explicit type annotation).
   */
  readonly assignment_type?: TypeInfo;

  /**
   * For calls: return type of the called function/method
   *
   * **Status**: ❌ NOT YET IMPLEMENTED - Field exists but never populated
   * **Future Work**: See backlog/tasks/task-154-type-resolution-and-heuristics.md
   *
   * **Inference-based** - Would be extracted from function definition's return type
   *
   * **Purpose**: Enable type tracking through function calls
   *
   * Example use case:
   * ```typescript
   * function createService(): Service { ... }
   *
   * const service = createService();  // Call reference would have return_type: Service
   * // Then assignment reference could use this return_type for assignment_type
   * ```
   *
   * **Current State**:
   * - ❌ Never populated (no extractor exists)
   * - ❌ Never read (no consumer exists)
   * - ❌ Completely unused (dead code)
   *
   * **Integration Plan**:
   * 1. During call resolution, after resolving to FunctionDefinition
   * 2. Extract FunctionDefinition.return_type (already exists in definitions)
   * 3. Store in SymbolReference.return_type
   * 4. Link to assignment references via assignment_type
   * 5. Enables type flow: function return → variable assignment → method call
   *
   * Tree-sitter pattern (for reference - not yet implemented):
   * ```
   * // This happens during resolution, not parsing
   * const func_def = resolve_call(call_ref);
   * call_ref.return_type = func_def.return_type;
   * ```
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

import type { SyntaxNode } from "tree-sitter";
import type { Location, SymbolName, TypeInfo, FilePath, SelfReferenceKeyword } from "@ariadnejs/types";

/**
 * Receiver information for method calls and property access
 *
 * Contains information about the receiver object in member access expressions,
 * including whether it's a self-reference keyword (this, self, super, cls).
 */
export interface ReceiverInfo {
  /** Location of the receiver object */
  readonly receiver_location: Location;
  /** Property access chain */
  readonly property_chain: readonly SymbolName[];
  /** Whether the receiver is a self-reference keyword */
  readonly is_self_reference: boolean;
  /** The self-reference keyword used (if is_self_reference is true) */
  readonly self_keyword?: SelfReferenceKeyword;
}

/**
 * Language-specific metadata extraction functions
 *
 * Each language implements these functions to extract rich metadata
 * from tree-sitter SyntaxNode structures. AST structures differ by
 * language, requiring language-specific implementations.
 */
export interface MetadataExtractors {
  /**
   * Extract type information from type annotation nodes
   *
   * Examples:
   * - TypeScript: `const x: string` → extract "string"
   * - Python: `def foo() -> int:` → extract "int"
   * - Rust: `let x: i32` → extract "i32"
   *
   * @param node - The SyntaxNode to extract type information from
   * @param file_path - The file containing the node (needed for Location creation)
   * @returns TypeInfo containing the extracted type or undefined if not a type annotation
   */
  extract_type_from_annotation(
    node: SyntaxNode,
    file_path: FilePath
  ): TypeInfo | undefined;

  /**
   * Extract receiver/object location from method call
   *
   * For `obj.method()`, extract the location of `obj`
   * Enables tracing the receiver to determine method resolution
   *
   * Examples:
   * - JavaScript: `user.getName()` → location of `user`
   * - Python: `self.process()` → location of `self`
   * - Rust: `vec.push(5)` → location of `vec`
   *
   * @param node - The SyntaxNode representing a method call
   * @param file_path - The file containing the node
   * @returns Location of the receiver object or undefined if not a method call
   */
  extract_call_receiver(
    node: SyntaxNode,
    file_path: FilePath
  ): Location | undefined;

  /**
   * Extract property access chain
   *
   * For `a.b.c.d`, extract ["a", "b", "c", "d"]
   * Enables tracking chained method calls and nested property access
   *
   * Examples:
   * - JavaScript: `config.database.host` → ["config", "database", "host"]
   * - Python: `self.data.items` → ["self", "data", "items"]
   * - Rust: `struct.field1.field2` → ["struct", "field1", "field2"]
   *
   * @param node - The SyntaxNode representing a property access chain
   * @returns Array of property names in the chain or undefined if not a property access
   */
  extract_property_chain(
    node: SyntaxNode
  ): SymbolName[] | undefined;

  /**
   * Extract receiver information with self-reference keyword detection
   *
   * For method calls and property access, extracts receiver location, property chain,
   * and detects if the receiver is a self-reference keyword (this, self, super, cls).
   *
   * Examples:
   * - JavaScript: `this.method()` → { receiver_location, property_chain: ['this', 'method'], is_self_reference: true, self_keyword: 'this' }
   * - JavaScript: `user.getName()` → { receiver_location, property_chain: ['user', 'getName'], is_self_reference: false }
   * - Python: `self.process()` → { receiver_location, property_chain: ['self', 'process'], is_self_reference: true, self_keyword: 'self' }
   * - Python: `super().method()` → { receiver_location, property_chain: ['super', 'method'], is_self_reference: true, self_keyword: 'super' }
   *
   * @param node - The SyntaxNode representing a member expression or method call
   * @param file_path - The file containing the node (needed for Location creation)
   * @returns ReceiverInfo with keyword detection or undefined if not a member access
   */
  extract_receiver_info(
    node: SyntaxNode,
    file_path: FilePath
  ): ReceiverInfo | undefined;

  /**
   * Extract assignment source and target locations
   *
   * For `target = source`, extract locations of both
   * Enables type flow analysis and tracking variable assignments
   *
   * Examples:
   * - JavaScript: `const x = getValue()` → target: location of `x`, source: location of `getValue()`
   * - Python: `result = compute(data)` → target: location of `result`, source: location of `compute(data)`
   * - Rust: `let mut x = 42` → target: location of `x`, source: location of `42`
   *
   * @param node - The SyntaxNode representing an assignment
   * @param file_path - The file containing the node
   * @returns Object with source and target locations, either may be undefined
   */
  extract_assignment_parts(
    node: SyntaxNode,
    file_path: FilePath
  ): {
    source: Location | undefined;
    target: Location | undefined;
  };

  /**
   * Extract constructor call target variable location
   *
   * For `const obj = new Class()`, extract location of `obj`
   * Enables tracking constructed objects and their types
   *
   * Examples:
   * - JavaScript: `const user = new User()` → location of `user`
   * - Python: `obj = MyClass()` → location of `obj`
   * - Rust: `let vec = Vec::new()` → location of `vec`
   *
   * @param node - The SyntaxNode representing a constructor call or instantiation
   * @param file_path - The file containing the node
   * @returns Location of the target variable or undefined if not a constructor assignment
   */
  extract_construct_target(
    node: SyntaxNode,
    file_path: FilePath
  ): Location | undefined;

  /**
   * Extract generic type arguments
   *
   * Examples:
   * - TypeScript: `Array<string>` → ["string"]
   * - TypeScript: `Map<string, number>` → ["string", "number"]
   * - Rust: `Vec<i32>` → ["i32"]
   * - Rust: `HashMap<String, u64>` → ["String", "u64"]
   *
   * @param node - The SyntaxNode representing a generic type
   * @returns Array of type argument names or undefined if no type arguments
   */
  extract_type_arguments(
    node: SyntaxNode
  ): string[] | undefined;

  /**
   * Check if a node represents optional chaining
   *
   * Optional chaining (`?.`) affects method resolution - the result can be undefined.
   * This is only supported in JavaScript/TypeScript.
   *
   * Tree-sitter pattern (JavaScript/TypeScript):
   * ```
   * (optional_chain
   *   object: (_) @object
   *   property: (_) @property)
   * ```
   *
   * Examples:
   * - JavaScript/TypeScript: `obj?.method()` → true
   * - JavaScript/TypeScript: `obj.method()` → false
   * - JavaScript/TypeScript: `obj?.prop?.method()` → true
   * - Python/Rust: Always false (no optional chaining syntax)
   *
   * @param node - The SyntaxNode representing a member access or call expression
   * @returns true if the node uses optional chaining syntax, false otherwise
   */
  extract_is_optional_chain(
    node: SyntaxNode
  ): boolean;

  /**
   * Check if a call node represents a method call (vs a regular function call)
   *
   * Distinguishes `obj.method()` (method call) from `func()` (function call).
   * Language-specific patterns:
   *
   * JavaScript/TypeScript:
   * ```
   * (call_expression
   *   function: (member_expression) @is_method)  → true
   * (call_expression
   *   function: (identifier) @not_method)        → false
   * ```
   *
   * Python:
   * ```
   * (call
   *   function: (attribute) @is_method)          → true
   * (call
   *   function: (identifier) @not_method)        → false
   * ```
   *
   * Rust:
   * ```
   * (call_expression
   *   function: (field_expression) @is_method)   → true
   * (call_expression
   *   function: (identifier) @not_method)        → false
   * ```
   *
   * Examples:
   * - JavaScript: `obj.method()` → true, `func()` → false
   * - Python: `self.process()` → true, `print()` → false
   * - Rust: `vec.push(5)` → true, `main()` → false
   *
   * @param node - The SyntaxNode representing a call
   * @returns true if the call is a method call, false if it's a function call
   */
  is_method_call(node: SyntaxNode): boolean;

  /**
   * Extract the method or function name from a call node
   *
   * For method calls like `obj.method()`, extracts just the method name ("method").
   * For function calls like `func()`, extracts the function name ("func").
   *
   * Language-specific extraction:
   *
   * JavaScript/TypeScript (method call):
   * ```
   * (call_expression
   *   function: (member_expression
   *     property: (property_identifier) @extract_this))
   * ```
   *
   * Python (method call):
   * ```
   * (call
   *   function: (attribute
   *     attribute: (identifier) @extract_this))
   * ```
   *
   * Rust (method call):
   * ```
   * (call_expression
   *   function: (field_expression
   *     field: (field_identifier) @extract_this))
   * ```
   *
   * All languages (function call):
   * ```
   * (call/call_expression
   *   function: (identifier) @extract_this)
   * ```
   *
   * Examples:
   * - JavaScript: `obj.method()` → "method", `func()` → "func"
   * - Python: `self.process()` → "process", `print("x")` → "print"
   * - Rust: `vec.push(5)` → "push", `println!()` → "println"
   *
   * @param node - The SyntaxNode representing a call
   * @returns The name of the method or function being called, or undefined if it cannot be extracted
   */
  extract_call_name(node: SyntaxNode): SymbolName | undefined;
}

/**
 * Result of attempting to extract metadata
 *
 * Represents the outcome of any metadata extraction attempt,
 * where undefined indicates the node didn't match the expected structure
 */
export type ExtractionResult<T> = T | undefined;

/**
 * AST node traversal result
 *
 * Used when traversing the AST to collect context about a node's position
 * within the tree structure
 */
export interface NodeTraversal {
  /** The current node being traversed */
  node: SyntaxNode;
  /** Path from root to current node, as node types */
  path: string[];
}

/**
 * Helper type for metadata extraction context
 *
 * Provides common context needed during extraction operations
 */
export interface ExtractionContext {
  /** The file being processed */
  file_path: FilePath;
  /** The root node of the file's AST */
  root_node: SyntaxNode;
}
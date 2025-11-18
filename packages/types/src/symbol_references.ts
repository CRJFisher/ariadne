import type { Location } from "./common";
import type { ScopeId } from "./scopes";
import type { TypeInfo } from "./semantic_index";
import type { SymbolName, SymbolId } from "./symbol";

/**
 * Discriminated union of all reference types
 *
 * This replaces the monolithic SymbolReference interface with specific typed variants.
 * Each variant has exactly the fields it needs, making impossible states unrepresentable.
 *
 * Benefits:
 * - Type safety: Compiler enforces required fields per variant
 * - Pattern matching: Clean dispatch using switch(ref.kind)
 * - No runtime undefined checks: Fields are guaranteed present
 * - Self-documenting: Each variant clearly shows its purpose
 *
 * @example
 * // Pattern matching on kind
 * function resolve_reference(ref: SymbolReference): SymbolId | null {
 *   switch (ref.kind) {
 *     case 'method_call':
 *       return resolve_method_call(ref);  // ref is MethodCallReference
 *     case 'self_reference_call':
 *       return resolve_self_reference_call(ref);  // ref is SelfReferenceCall
 *     // ... other cases
 *   }
 * }
 */
export type SymbolReference =
  | SelfReferenceCall
  | MethodCallReference
  | FunctionCallReference
  | ConstructorCallReference
  | VariableReference
  | PropertyAccessReference
  | TypeReference
  | AssignmentReference;

/**
 * Base fields shared by all reference variants
 */
interface BaseReference {
  /** Reference location in source file */
  readonly location: Location;
  /** Scope containing this reference */
  readonly scope_id: ScopeId;
  /** Name being referenced */
  readonly name: SymbolName;
  /** Type information at this reference (optional) */
  readonly type_info?: TypeInfo;
}

/**
 * Self-reference method call: this.method(), self.method(), super.method()
 *
 * Represents method calls where the receiver is a self-reference keyword
 * (this, self, super) that refers to the containing class or parent class.
 *
 * This variant is critical for fixing the self-reference resolution bug where
 * short property chains like `this.method()` failed to resolve.
 *
 * @example TypeScript
 * class Builder {
 *   process() { this.build_class(node); }
 * }
 * // → SelfReferenceCall { keyword: 'this', property_chain: ['this', 'build_class'] }
 *
 * @example Python
 * class IndexBuilder:
 *   def process(self):
 *     self.build_class(node)
 * // → SelfReferenceCall { keyword: 'self', property_chain: ['self', 'build_class'] }
 *
 * @example Super call
 * class Child extends Parent {
 *   process() { super.process(); }
 * }
 * // → SelfReferenceCall { keyword: 'super', property_chain: ['super', 'process'] }
 */
export interface SelfReferenceCall extends BaseReference {
  readonly kind: "self_reference_call";
  /** Self-reference keyword used */
  readonly keyword: SelfReferenceKeyword;
  /** Property chain (always starts with keyword) */
  readonly property_chain: readonly SymbolName[];
}

/**
 * Self-reference keywords across all supported languages
 */
export type SelfReferenceKeyword = "this" | "self" | "super" | "cls";

/**
 * Regular method call: obj.method(), receiver.getName()
 *
 * Represents method calls where the receiver is a variable, parameter, or
 * property (not a self-reference keyword).
 *
 * @example
 * const user = getUser();
 * user.getName();  // MethodCallReference
 * // → { receiver_location: <loc of 'user'>, property_chain: ['user', 'getName'] }
 *
 * @example Optional chaining
 * obj?.method();  // MethodCallReference with optional_chaining: true
 */
export interface MethodCallReference extends BaseReference {
  readonly kind: "method_call";
  /** Location of the receiver object (REQUIRED) */
  readonly receiver_location: Location;
  /** Property chain (REQUIRED) */
  readonly property_chain: readonly SymbolName[];
  /** Whether this uses optional chaining (obj?.method()) */
  readonly optional_chaining?: boolean;
}

/**
 * Function call: foo(), myFunction()
 *
 * Represents calls to standalone functions (not methods on objects).
 *
 * @example
 * function processData(x) { }
 * processData(value);  // FunctionCallReference
 * // → { name: 'processData' }
 */
export interface FunctionCallReference extends BaseReference {
  readonly kind: "function_call";
  /** Optional argument type information */
  readonly argument_types?: readonly TypeInfo[];
}

/**
 * Constructor call: new MyClass(), new Service()
 *
 * Represents constructor invocations using `new` keyword.
 *
 * @example TypeScript with assignment
 * const obj = new MyClass();
 * // → ConstructorCallReference { construct_target: <loc of 'obj'> }
 *
 * @example Python with assignment
 * obj = MyClass()
 * // → ConstructorCallReference { construct_target: <loc of 'obj'> }
 *
 * @example Standalone (no assignment)
 * MyClass()  // side effect only
 * // → ConstructorCallReference { construct_target: undefined }
 */
export interface ConstructorCallReference extends BaseReference {
  readonly kind: "constructor_call";
  /** Location of the variable being assigned (optional - undefined for standalone calls) */
  readonly construct_target?: Location;
  /** Type being constructed */
  readonly constructed_type?: TypeInfo;
}

/**
 * Variable reference: reading or writing a variable
 *
 * Represents uses of variables, parameters, or fields (not calls).
 *
 * @example
 * const x = 5;
 * const y = x;  // VariableReference { name: 'x', access_type: 'read' }
 * x = 10;       // VariableReference { name: 'x', access_type: 'write' }
 */
export interface VariableReference extends BaseReference {
  readonly kind: "variable_reference";
  /** How the variable is accessed */
  readonly access_type: "read" | "write";
  /** For writes: the type being assigned */
  readonly assignment_type?: TypeInfo;
}

/**
 * Property access: obj.field, this.registry
 *
 * Represents accessing a property/field (not calling a method).
 * Distinct from method calls even though syntax is similar.
 *
 * @example
 * const name = user.name;  // PropertyAccessReference
 * // vs
 * const name = user.getName();  // MethodCallReference
 */
export interface PropertyAccessReference extends BaseReference {
  readonly kind: "property_access";
  /** Object whose property is accessed */
  readonly receiver_location: Location;
  /** Property chain (REQUIRED) */
  readonly property_chain: readonly SymbolName[];
  /** Access type */
  readonly access_type: "property" | "index";
  /** Whether this uses optional chaining (obj?.field) */
  readonly is_optional_chain: boolean;
}

/**
 * Type reference: Type annotations, extends/implements clauses
 *
 * Represents references to types in type positions (not value positions).
 *
 * @example TypeScript
 * const x: MyType = ...;     // TypeReference { context: 'annotation' }
 * class A extends Base { }   // TypeReference { context: 'extends' }
 * class B implements I { }   // TypeReference { context: 'implements' }
 * function<T extends Base>   // TypeReference { context: 'generic' }
 */
export interface TypeReference extends BaseReference {
  readonly kind: "type_reference";
  /** Context where the type is referenced */
  readonly type_context: "annotation" | "extends" | "implements" | "generic" | "return";
}

/**
 * Assignment reference: x = value
 *
 * Represents assignment operations where a value is stored in a variable.
 *
 * @example
 * x = getValue();  // AssignmentReference
 * this.field = obj;  // AssignmentReference
 */
export interface AssignmentReference extends BaseReference {
  readonly kind: "assignment";
  /** Target location being assigned to */
  readonly target_location: Location;
  /** Type of the value being assigned (if known) */
  readonly assignment_type?: TypeInfo;
}

/**
 * Type guards for each reference variant
 */
export function is_self_reference_call(ref: SymbolReference): ref is SelfReferenceCall {
  return ref.kind === "self_reference_call";
}

export function is_method_call(ref: SymbolReference): ref is MethodCallReference {
  return ref.kind === "method_call";
}

export function is_function_call(ref: SymbolReference): ref is FunctionCallReference {
  return ref.kind === "function_call";
}

export function is_constructor_call(ref: SymbolReference): ref is ConstructorCallReference {
  return ref.kind === "constructor_call";
}

export function is_variable_reference(ref: SymbolReference): ref is VariableReference {
  return ref.kind === "variable_reference";
}

export function is_property_access(ref: SymbolReference): ref is PropertyAccessReference {
  return ref.kind === "property_access";
}

export function is_type_reference(ref: SymbolReference): ref is TypeReference {
  return ref.kind === "type_reference";
}

export function is_assignment(ref: SymbolReference): ref is AssignmentReference {
  return ref.kind === "assignment";
}

// ============================================================================
// Resolution Types
// ============================================================================

/**
 * Confidence level for symbol resolution
 */
export type ResolutionConfidence =
  | "certain"    // Definite resolution (direct or all polymorphic implementations)
  | "probable"   // High-confidence heuristic match
  | "possible";  // Lower-confidence candidate

/**
 * Structured reason for resolution
 *
 * Discriminated union allows type-safe analysis and serialization.
 */
export type ResolutionReason =
  | { type: "direct" }
  | { type: "interface_implementation"; interface_id: SymbolId }
  | { type: "collection_member"; collection_id: SymbolId; access_pattern?: string }
  | { type: "heuristic_match"; score: number };

/**
 * Single resolution candidate with metadata
 */
export interface Resolution {
  /** Resolved symbol identifier */
  symbol_id: SymbolId;

  /** Confidence level for this resolution */
  confidence: ResolutionConfidence;

  /** Structured reason explaining why this symbol was selected */
  reason: ResolutionReason;
}

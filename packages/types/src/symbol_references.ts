import type { Location } from "./location";
import type { ScopeId } from "./scopes";
import type { TypeInfo } from "./type_member_info";
import type { SymbolName } from "./symbol";
import type { CallSiteSyntax } from "./resolution_failure";

/**
 * Discriminated union of all reference types, dispatched via `ref.kind`.
 *
 * @example
 * switch (ref.kind) {
 *   case 'method_call': return resolve_method_call(ref);
 *   case 'self_reference_call': return resolve_self_reference_call(ref);
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
 * Self-reference keywords across all supported languages.
 * - `this` / `super` — @language javascript,typescript
 * - `self` — @language python,rust
 * - `cls` — @language python
 */
export type SelfReferenceKeyword = "this" | "self" | "super" | "cls";

/**
 * Positional call-argument identifier names, aligned index-for-index with a
 * `property_chain`. Entry `i` holds the bare-identifier argument names of the
 * call invoked at chain position `i`, or `null` when that position is not an
 * invoked call. Within a call's entry, a `null` element is a non-identifier
 * argument (literal, expression, spread) kept to preserve positional index so a
 * later parameter still aligns to its argument.
 *
 * @example injector.get(Token).method()
 * // property_chain:            ["injector", "get", "method"]
 * // property_chain_arguments:  [null, ["Token"], []]
 *
 * @language javascript,typescript
 */
export type ChainCallArguments = readonly (readonly (SymbolName | null)[] | null)[];

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
 * obj?.method();  // MethodCallReference with is_optional_chain: true
 */
export interface MethodCallReference extends BaseReference {
  readonly kind: "method_call";
  readonly receiver_location: Location;
  /** Full property chain from receiver to method */
  readonly property_chain: readonly SymbolName[];
  /** Whether this uses optional chaining (obj?.method()) */
  readonly is_optional_chain: boolean;
  /** Location of assigned variable when this call may be a class instantiation (e.g. user = models.User()) */
  readonly potential_construct_target?: Location;
  /**
   * Syntactic shape of the call site — a neutral AST observation, not a
   * classifier label. Populated when the receiver AST shape is determinable
   * at index time, and copied onto the emitted `CallReference` during call
   * resolution. Consumers (including the auto-classifier in
   * `.claude/skills/triage`) compose it with `resolution_failure`
   * and other signals; core stores only the observation.
   */
  readonly call_site_syntax?: CallSiteSyntax;
  /**
   * Positional call arguments per chain position, index-aligned to
   * `property_chain`. Present only when at least one chain position is an
   * invoked call carrying identifier arguments (omitted otherwise). Drives
   * TypeScript generic-return-type inference from `Type<T>` token arguments in
   * chained receivers (`injector.get(Token).method()`).
   *
   * @language javascript,typescript
   */
  readonly property_chain_arguments?: ChainCallArguments;
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
 *
 * @example Python class instantiation
 * obj = MyClass()  // Initially captured as FunctionCallReference
 * // → { name: 'MyClass', potential_construct_target: <loc of 'obj'> }
 * // Call resolution converts this to ConstructorCallReference if MyClass is a class
 */
export interface FunctionCallReference extends BaseReference {
  readonly kind: "function_call";
  /** Location of variable being assigned if this call may be a class instantiation (e.g. obj = SomeClass()) */
  readonly potential_construct_target?: Location;
  /**
   * Rust scoped-path qualifier that scopes the terminal-name lookup, e.g.
   * ["worker"] for `worker::create()` or ["Parker"] for `Parker::make()`.
   * Held separately from the TypeScript `[namespace, class]` `property_chain`
   * convention: this is the module/type path that disambiguates the terminal
   * (including against a local shadow), not a namespace-class pair.
   * @language rust
   */
  readonly path_prefix?: readonly SymbolName[];
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
 *
 * @example Namespace-qualified constructor (TypeScript)
 * const user = new models.User(name);
 * // → ConstructorCallReference { property_chain: ['models', 'User'] }
 */
export interface ConstructorCallReference extends BaseReference {
  readonly kind: "constructor_call";
  /** Location of the variable being assigned (optional - undefined for standalone calls) */
  readonly construct_target?: Location;
  /** Namespace-qualified constructors: ["models", "User"] for new models.User() */
  readonly property_chain?: readonly SymbolName[];
  /**
   * Rust full type path of an associated constructor, e.g.
   * ["crate","runtime","Driver"] for `crate::runtime::Driver::new()` or
   * ["Cell"] for `Cell::<u8>::new()`. Held separately from `property_chain`,
   * whose two TypeScript-oriented consumers bake in a `[namespace, class]`
   * index convention; this is a type-last path that scopes the terminal lookup.
   * @language rust
   */
  readonly path_prefix?: readonly SymbolName[];
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

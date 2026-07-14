/**
 * Rust Constructor Resolution
 *
 * Resolves the Rust-specific constructor shapes: `Self::new()` substitution,
 * inline full-path type binding (`crate::runtime::Driver::new()`), and the
 * associated-constructor (`fn new`) member linkage. Every function self-guards
 * on its Rust syntactic marker (`Self`, a populated `path_prefix`) and returns
 * null for any other call shape, so the neutral resolver can invoke them
 * unconditionally.
 */

import type {
  SymbolId,
  SymbolName,
  ConstructorCallReference,
  ClassDefinition,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition";
import type { ScopeRegistry } from "../registries/scope";
import type { ResolutionRegistry } from "../resolve_references";
import {
  find_containing_class_scope,
  find_class_from_scope,
} from "./receiver_resolution";
import {
  normalize_path_prefix,
  resolve_in_module_body,
} from "./path_resolution.rust";

/**
 * The terminal name of a Rust associated constructor. The `rust.scm` query only
 * captures `^new$` as an associated constructor, so the member-index lookup that
 * links a `Type::new()` call to its function always keys on this name.
 */
const RUST_ASSOCIATED_CONSTRUCTOR_NAME = "new" as SymbolName;

/**
 * The `Self` type keyword a Rust associated function uses to name its own impl
 * type, e.g. `Self::new()`. A constructor call whose terminal type name is
 * `Self` is resolved to the enclosing impl/trait type by walking the call scope.
 */
const SELF_TYPE_KEYWORD = "Self" as SymbolName;

/**
 * Resolve the `Self` keyword to the enclosing impl/trait type. `Self` is never
 * in scope, so this must run before the bare-name lookup would fail; a call
 * whose terminal name is anything else is not a `Self` constructor and returns
 * null.
 */
export function resolve_self_type_rust(
  call_ref: ConstructorCallReference,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry
): SymbolId | null {
  if (call_ref.name !== SELF_TYPE_KEYWORD) return null;

  const class_scope_id = find_containing_class_scope(
    call_ref.scope_id,
    scopes,
    definitions
  );
  if (!class_scope_id) return null;

  return find_class_from_scope(class_scope_id, definitions);
}

/**
 * Bind an inline-full-path Rust constructor's type by walking its module path.
 *
 * A constructor `path_prefix` is **type-last**: the final segment is the type
 * (`crate::runtime::Driver` → `["crate","runtime","Driver"]`, type `Driver`), the
 * leading segments are its module path. Contrast the function-call resolver, whose
 * terminal lives in `ref.name` and whose qualifier is therefore the *last* prefix
 * segment; here the type is the last segment, so its module qualifier is the
 * *second-to-last*. When the bare type name misses in scope (the type is never
 * imported), resolve that module qualifier in scope and look the type up in that
 * module's body. The module qualifier disambiguates same-named types across
 * modules, so two in-scope modules each exposing a `Driver` resolve to the correct
 * one via the prefix. Runs after the bare-name miss, so the in-scope
 * `Type::new()` and TS/Python `new ClassName()` paths are untouched.
 *
 * Only the type's immediate module is walked: the qualifier must itself resolve in
 * the caller's scope, so a deeper path (`crate::a::b::Driver`) whose intermediate
 * module `b` is not bound in scope bails, exactly as the function-call resolver
 * does. Bails (returns null) likewise when the qualifier is not an in-scope `mod`
 * whose body holds the type — a cross-file re-export hop belongs to
 * import_resolution, so we do not fabricate an edge.
 */
export function resolve_type_via_module_path_rust(
  call_ref: ConstructorCallReference,
  definitions: DefinitionRegistry,
  scopes: ScopeRegistry,
  resolutions: ResolutionRegistry
): SymbolId | null {
  const prefix = normalize_path_prefix(call_ref.path_prefix ?? []);
  // Need at least [module, Type]: the type is the last segment, its immediate
  // module is the segment before it. A lone type segment (`["Driver"]`) has no
  // module path to walk and already missed the bare lookup.
  if (prefix.length < 2) return null;

  const type_name = call_ref.name as SymbolName;
  // Type-last prefix: the type is the last segment, its module the one before it.
  const qualifier = prefix[prefix.length - 2];

  const qualifier_id = resolutions.resolve(call_ref.scope_id, qualifier);
  if (!qualifier_id) return null;

  // Rust `mod` declarations are captured as namespace definitions.
  const qualifier_def = definitions.get(qualifier_id);
  if (qualifier_def?.kind !== "namespace") return null;

  return resolve_in_module_body(
    qualifier,
    qualifier_def.defining_scope_id,
    type_name,
    scopes,
    definitions
  );
}

/**
 * Find a Rust associated constructor (`fn new`) for a type via the member index.
 *
 * Rust's `impl T { fn new() -> Self }` is indexed as a plain method on `T`
 * rather than a `ConstructorDefinition`, so it never populates
 * `ClassDefinition.constructors`. This links a resolved `Type::new()` /
 * `Self::new()` call to that member so the constructor is reachable instead of
 * surfacing as a false-positive entry point. Gated to the Rust qualified path
 * by `path_prefix`, so the TS/Python `new ClassName()` path is untouched.
 */
export function find_associated_constructor_rust(
  call_ref: ConstructorCallReference,
  class_def: ClassDefinition,
  definitions: DefinitionRegistry
): SymbolId | null {
  if (!call_ref.path_prefix || call_ref.path_prefix.length === 0) return null;

  const members = definitions.get_member_index().get(class_def.symbol_id);
  const member = members?.get(RUST_ASSOCIATED_CONSTRUCTOR_NAME);
  if (!member) {
    return null;
  }
  // A field named `new` (`struct T { new: ... }`) overwrites the `fn new` method
  // in the flat member index; only a callable target is the constructor. Mirrors
  // the `is_callable_definition` guard on the function-call member lookup.
  const kind = definitions.get(member)?.kind;
  return kind === "method" || kind === "function" ? member : null;
}

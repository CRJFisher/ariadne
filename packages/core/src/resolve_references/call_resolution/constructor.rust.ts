/**
 * Rust Constructor Resolution
 *
 * The two Rust constructor shapes that need Rust knowledge: the inline full-path
 * type (`crate::runtime::Driver::new()`), whose type-last prefix is reshaped for
 * the shared `::`-path resolver, and the associated-constructor (`fn new`) member
 * linkage. Both self-guard on a populated `path_prefix`, so the neutral resolver
 * can invoke them unconditionally. `Self` substitution lives with the path
 * resolver in `path_resolution.rust.ts`.
 */

import type {
  SymbolId,
  SymbolName,
  ConstructorCallReference,
  ClassDefinition,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition";
import {
  is_callable_definition,
  resolve_qualified_path_rust,
} from "./path_resolution.rust";
import type { RustPathResolutionContext } from "./path_resolution.rust";

/**
 * The terminal name of a Rust associated constructor. The `rust.scm` query only
 * captures `^new$` as an associated constructor, so the member-index lookup that
 * links a `Type::new()` call to its function always keys on this name.
 */
const RUST_ASSOCIATED_CONSTRUCTOR_NAME = "new" as SymbolName;

/**
 * Bind an inline-full-path Rust constructor's type through its module path.
 *
 * A constructor `path_prefix` is **type-last**: the final segment is the type
 * (`crate::runtime::Driver` → `["crate","runtime","Driver"]`, type `Driver`), so
 * the module path handed to the path resolver is everything before it. Runs
 * after the bare-name miss, so the in-scope `Type::new()` and TS/Python
 * `new ClassName()` paths are untouched.
 */
export function resolve_type_via_path_prefix_rust(
  call_ref: ConstructorCallReference,
  context: RustPathResolutionContext
): SymbolId | null {
  return resolve_qualified_path_rust(
    (call_ref.path_prefix ?? []).slice(0, -1),
    call_ref.name as SymbolName,
    "type",
    call_ref.scope_id,
    call_ref.location.file_path,
    context
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
  // in the flat member index; only a callable target is the constructor.
  return is_callable_definition(member, definitions) ? member : null;
}

/**
 * What a generic declaration's type parameters are bound to at one call site.
 *
 * A generic's declared types are written in terms of names that denote nothing
 * on their own: `get<T>(token: Type<T>): T` returns a `T`, and no receiver can
 * be looked up on `T` until something says which type it stands for. This file
 * is that binding, and only that: matching a declared annotation against a
 * concrete one to bind the names between them, and substituting what it bound
 * back into another declared annotation.
 *
 * Pure and registry-free. Bindings are annotations rather than resolved
 * symbols, because a binding is only as resolvable as the text it came from —
 * `Map<K, V>` against `Map<string, Foo>` binds `K` to `string`, which names no
 * type, while still binding `V` to `Foo`, which does. Resolving a binding to a
 * `SymbolId`, and deciding which scope to resolve it in, is the caller's.
 */

import type { ScopeId, SymbolName, TypeParameter } from "@ariadnejs/types";
import type { ParsedTypeAnnotation } from "./annotation";
import { container_element_annotation } from "./container_shape";

/**
 * One type parameter's binding: the annotation it stands for, and the scope
 * that annotation's names are written in. The scope travels with the
 * annotation because a binding is taken from the call site while the parameter
 * it binds is declared elsewhere — `injector.get(Router)` binds `T` to a
 * `Router` that only the caller's file can resolve.
 */
export interface TypeParameterBinding {
  readonly annotation: ParsedTypeAnnotation;
  readonly scope_id: ScopeId;
}

type TypeParameterEnvironment = ReadonlyMap<SymbolName, TypeParameterBinding>;

/**
 * The concrete side of a unification: what an argument, or a receiver's
 * declared instantiation, actually is.
 *
 * The two are distinguished because they bind differently, not as a
 * convenience. A value's annotation says what the value holds, so it matches a
 * declared annotation head for head. A type named as a value — the `Router` of
 * `injector.get(Router)` — holds no instance of itself, so it binds only
 * through a wrapper that designates it, and a parameter declared as the bare
 * type variable binds to nothing.
 */
export type ConcreteType =
  | { readonly kind: "value"; readonly annotation: ParsedTypeAnnotation }
  | { readonly kind: "class_object"; readonly annotation: ParsedTypeAnnotation };

/**
 * Bind every type parameter of `type_parameters` that `declared` and
 * `concrete` agree on, writing each into `bindings`.
 *
 * The first binding of a name wins: a type parameter appearing in two
 * parameters is bound by the leftmost argument that says anything about it,
 * which is the one a reader reaches first.
 *
 * Nothing is bound where the two disagree. A type parameter left unbound is
 * the honest answer — the caller resolves nothing rather than guessing a type
 * the call site never named.
 */
export function unify_type_parameters(
  declared: ParsedTypeAnnotation,
  concrete: ConcreteType,
  type_parameters: ReadonlySet<SymbolName>,
  scope_id: ScopeId,
  bindings: Map<SymbolName, TypeParameterBinding>
): void {
  const parameter_name = bare_type_parameter(declared, type_parameters);
  if (parameter_name !== null) {
    // A class object is not an instance of the type it names, so a parameter
    // declared as the bare variable learns nothing from one.
    if (concrete.kind === "value" && !bindings.has(parameter_name)) {
      bindings.set(parameter_name, { annotation: concrete.annotation, scope_id });
    }
    return;
  }

  if (declared.arguments.length === 0) {
    return;
  }

  if (
    concrete.kind === "value" &&
    heads_agree(declared, concrete.annotation) &&
    declared.arguments.length === concrete.annotation.arguments.length
  ) {
    for (let index = 0; index < declared.arguments.length; index++) {
      unify_type_parameters(
        declared.arguments[index],
        { kind: "value", annotation: concrete.annotation.arguments[index] },
        type_parameters,
        scope_id,
        bindings
      );
    }
    return;
  }

  // A type token: a one-argument wrapper standing for the type its argument
  // names (`Type<T>`, `ClassRef<T>`), handed the type itself. A container is
  // never one — an `Array<T>` holds values of `T` and designates nothing — and
  // neither is a wrapper handed a value, which the head-for-head match above
  // is the only honest reading of.
  if (
    concrete.kind === "class_object" &&
    declared.arguments.length === 1 &&
    concrete.annotation.arguments.length === 0 &&
    container_element_annotation(declared) === null
  ) {
    unify_type_parameters(
      declared.arguments[0],
      { kind: "value", annotation: concrete.annotation },
      type_parameters,
      scope_id,
      bindings
    );
  }
}

/**
 * Bind each of `type_parameters` that declares a bound to the type that bound
 * names, in the scope the declaration was written in.
 *
 * A bound is an upper bound, not the type a call site chose, so it is the
 * weakest evidence there is: it is written only where nothing has bound the
 * parameter already. It is still the right answer for a body that has no call
 * site to read — Rust's `fn walk<V: Visitor>(v: &mut V)` calls `v.visit_item()`
 * against `Visitor` whatever any caller passes.
 */
export function bind_type_parameter_bounds(
  type_parameters: readonly TypeParameter[],
  scope_id: ScopeId,
  bindings: Map<SymbolName, TypeParameterBinding>
): void {
  for (const parameter of type_parameters) {
    if (parameter.bound === undefined || bindings.has(parameter.name)) {
      continue;
    }
    bindings.set(parameter.name, {
      annotation: { head: [parameter.bound], arguments: [] },
      scope_id,
    });
  }
}

/**
 * `annotation` with every type parameter `environment` binds replaced by what
 * it is bound to, or null when a type parameter it names is bound to nothing.
 *
 * Returning null rather than the unsubstituted annotation is what keeps an
 * unbindable type parameter from resolving: `T` left as written would be
 * looked up as an ordinary type name, and a project declaring an unrelated
 * type called `T` would answer it.
 */
export function substitute_type_parameters(
  annotation: ParsedTypeAnnotation,
  type_parameters: ReadonlySet<SymbolName>,
  environment: TypeParameterEnvironment
): TypeParameterBinding | null {
  const parameter_name = bare_type_parameter(annotation, type_parameters);
  if (parameter_name !== null) {
    return environment.get(parameter_name) ?? null;
  }

  if (annotation.arguments.length === 0) {
    return null;
  }

  const substituted: ParsedTypeAnnotation[] = [];
  let scope_id: ScopeId | null = null;
  for (const argument of annotation.arguments) {
    const bound = substitute_type_parameters(argument, type_parameters, environment);
    substituted.push(bound === null ? argument : bound.annotation);
    if (bound !== null) {
      scope_id = bound.scope_id;
    }
  }

  // An annotation naming no bound parameter is not this file's to answer: it
  // resolves as the ordinary declared annotation it already is.
  return scope_id === null
    ? null
    : {
        annotation: { ...annotation, arguments: substituted },
        scope_id,
      };
}

/** The type parameter `annotation` is, written bare — `T`, never `Type<T>` or `a.T`. */
function bare_type_parameter(
  annotation: ParsedTypeAnnotation,
  type_parameters: ReadonlySet<SymbolName>
): SymbolName | null {
  return annotation.head.length === 1 &&
    annotation.arguments.length === 0 &&
    annotation.module_specifier === undefined &&
    type_parameters.has(annotation.head[0])
    ? annotation.head[0]
    : null;
}

/**
 * Whether two annotations name the same type. The terminal segment alone
 * decides: one side is written where the generic is declared and the other
 * where it is called, so the same type reaches them under different qualifiers
 * (`Map` against `collections.Map`), and a qualifier neither side resolves is
 * no evidence that the two differ.
 */
function heads_agree(left: ParsedTypeAnnotation, right: ParsedTypeAnnotation): boolean {
  return left.head[left.head.length - 1] === right.head[right.head.length - 1];
}

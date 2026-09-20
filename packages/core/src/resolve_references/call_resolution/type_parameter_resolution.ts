/**
 * The type a receiver's declared annotation denotes when it names a type
 * parameter.
 *
 * Two receivers need one answer. A chained call through a generic member
 * (`injector.get(Router).navigate()`) continues on what the member's return
 * type stands for at that call site; a binding annotated with a type parameter
 * (Rust's `fn walk<V: Visitor>(v: &mut V)`) is a receiver whose declared type
 * names nothing at all until the parameter is bound. Both answer by reading an
 * annotation in a type-parameter environment, so both live here.
 *
 * What this file owns is the receiver-shaped evidence only: which type
 * parameters are in scope for a receiver, and what the receiver's own declared
 * instantiation binds. Building the environment from that evidence and
 * resolving an annotation through it is `type_parameter_environment.ts`'s, and
 * unifying and substituting annotations is `type_parameter_binding.ts`'s, which
 * is pure.
 */

import type {
  AnyDefinition,
  FunctionDefinition,
  MethodDefinition,
  ScopeId,
  SymbolId,
  SymbolName,
  TypeParameter,
} from "@ariadnejs/types";
import { parse_type_annotation, type TypeParameterBinding } from "../type_preprocessing";
import {
  declared_annotation,
  resolve_annotation_in_environment,
} from "../type_parameter_environment";
import type { ReceiverResolutionContext } from "./receiver_resolution";

/** The type parameters a type declares, or none for a definition that declares no members. */
function type_parameters_of(def: AnyDefinition | undefined): readonly TypeParameter[] {
  return def?.kind === "class" || def?.kind === "interface" || def?.kind === "enum"
    ? (def.generics ?? [])
    : [];
}

/**
 * Infer the concrete return type of a generic callable whose declared return
 * names one of the type parameters in scope for it — the callable's own, or,
 * for a method, its owning type's.
 *
 * Two call shapes ask it. A chained call through a generic member
 * (`injector.get(Router).navigate()`) binds from the receiver's instantiation
 * as well as the call's arguments; a binding a generic factory initialises
 * (`const r = create(Router)`) has no receiver, and its arguments are all the
 * evidence there is.
 *
 * Returns null when the callable is not generic, when its return names no type
 * parameter, or when nothing at the call site binds the one it names, leaving
 * the caller's failure intact. Guessing instead would type the receiver as
 * something the source never said it was.
 */
export function infer_generic_return(
  callee: FunctionDefinition | MethodDefinition,
  receiver_binding: SymbolId | null,
  call_arguments_at_position: readonly (SymbolName | null)[] | null,
  scope_id: ScopeId,
  context: ReceiverResolutionContext
): SymbolId | null {
  const return_type = callee.return_type;
  if (!return_type) {
    return null;
  }

  const language = context.languages.get(callee.location.file_path);
  if (!language) {
    return null;
  }

  const owner_id = context.definitions.get_member_owner(callee.symbol_id) ?? null;
  const owner = owner_id ? context.definitions.get(owner_id) : undefined;
  const owner_parameters = type_parameters_of(owner);
  const own_parameters = callee.generics ?? [];

  // A method re-declaring a name its owning type also declares introduces its
  // own parameter, and the receiver's instantiation of the type's parameter
  // says nothing about it: `Box<Foo>`'s `wrap<T extends Base>(): T` returns the
  // method's `T`, bounded by `Base`, not `Foo`.
  const shadowed_by_method = new Set<SymbolName>(
    own_parameters.map((parameter) => parameter.name)
  );

  const type_parameters = new Set<SymbolName>(
    [...owner_parameters, ...own_parameters].map((parameter) => parameter.name)
  );
  if (type_parameters.size === 0) {
    return null;
  }

  const return_annotation = parse_type_annotation(return_type, language);
  if (!return_annotation) {
    return null;
  }

  const declaring_scope = context.definitions.get_symbol_scope(callee.symbol_id);

  return resolve_annotation_in_environment(
    return_annotation,
    type_parameters,
    {
      call: {
        parameters:
          callee.kind === "function" ? callee.signature.parameters : callee.parameters,
        call_arguments: call_arguments_at_position,
        declaring_language: language,
        scope_id,
      },
      ...(owner_id &&
        receiver_binding && {
          bind_receiver_instantiation: (bindings: Map<SymbolName, TypeParameterBinding>) =>
            bind_from_declared_instantiation(
              receiver_binding,
              owner_id,
              owner_parameters,
              shadowed_by_method,
              context,
              bindings
            ),
        }),
      ...(declaring_scope && {
        bounds: {
          parameters: [...own_parameters, ...owner_parameters],
          scope_id: declaring_scope,
        },
      }),
    },
    context
  );
}

/**
 * The type a binding annotated with a type parameter holds: the bound that
 * parameter declares, read off whichever declaration — the enclosing callable
 * or the owning type — introduced the name.
 *
 * Nothing but the bound is available here. A binding is typed once, where it is
 * written, and the call sites that would say more about it are not in view, so
 * a parameter constrained by nothing leaves the receiver unresolved.
 */
export function resolve_type_parameter_annotation(
  def: AnyDefinition,
  context: ReceiverResolutionContext
): SymbolId | null {
  if (def.kind !== "parameter" && def.kind !== "variable" && def.kind !== "constant" && def.kind !== "property") {
    return null;
  }
  const annotation_text = def.type;
  if (annotation_text === undefined) {
    return null;
  }

  const language = context.languages.get(def.location.file_path);
  if (!language) {
    return null;
  }
  const annotation = parse_type_annotation(annotation_text, language);
  if (!annotation) {
    return null;
  }

  const declarations = declaring_type_parameters(def, context);
  const type_parameters = new Set<SymbolName>(
    declarations.parameters.map((parameter) => parameter.name)
  );
  if (type_parameters.size === 0) {
    return null;
  }

  return resolve_annotation_in_environment(
    annotation,
    type_parameters,
    { bounds: { parameters: declarations.parameters, scope_id: declarations.scope_id } },
    context
  );
}

/**
 * Every type parameter in scope for `def`'s annotation, and the scope their
 * bounds resolve in.
 *
 * A name written inside a method body can come from either declaration — the
 * method's own `<T>` or its class's — so both are collected, the method's
 * first, and a name the two declare alike is the method's as it is in the
 * source. The scope is the innermost one, which the bound's lookup walks out of
 * through the class into the module, so it reaches either declaration's names.
 */
function declaring_type_parameters(
  def: AnyDefinition,
  context: ReceiverResolutionContext
): { readonly parameters: readonly TypeParameter[]; readonly scope_id: ScopeId } {
  const member_owner_id = context.definitions.get_member_owner(def.symbol_id);
  if (member_owner_id) {
    return {
      parameters: type_parameters_of(context.definitions.get(member_owner_id)),
      scope_id:
        context.definitions.get_symbol_scope(member_owner_id) ?? def.defining_scope_id,
    };
  }

  // A scope the registry does not hold cannot be walked out of; the receiver is
  // then unresolved, as it is for a declaration naming no type parameter.
  if (!context.scopes.get_scope(def.defining_scope_id)) {
    return { parameters: [], scope_id: def.defining_scope_id };
  }

  const function_scope = context.scopes.find_enclosing_function_scope(def.defining_scope_id);
  const callable_id = context.definitions.get_callable_of_body_scope(function_scope);
  const callable = callable_id ? context.definitions.get(callable_id) : undefined;
  if (!callable_id || (callable?.kind !== "function" && callable?.kind !== "method")) {
    return { parameters: [], scope_id: def.defining_scope_id };
  }

  const enclosing_type_id = context.definitions.get_member_owner(callable_id);
  const enclosing_type = enclosing_type_id
    ? context.definitions.get(enclosing_type_id)
    : undefined;

  return {
    parameters: [...(callable.generics ?? []), ...type_parameters_of(enclosing_type)],
    scope_id: context.definitions.get_symbol_scope(callable_id) ?? def.defining_scope_id,
  };
}

/**
 * Bind the owning type's parameters from the instantiation the receiver's own
 * annotation writes: `const p: Provider<Foo>` binds `Provider`'s `T` to `Foo`
 * for every call on `p`.
 *
 * The annotation must name the owning type itself. A subtype instantiation
 * (`const p: MyProvider<Foo>`) states its arguments in its own parameters'
 * order, which says nothing about the order the type it extends declares.
 *
 * `shadowed` names the parameters the called method re-declares as its own.
 * They are skipped rather than filtered out beforehand, because the positions
 * the instantiation's arguments stand at are the owning type's.
 */
function bind_from_declared_instantiation(
  receiver_binding: SymbolId,
  owner_id: SymbolId,
  owner_parameters: readonly TypeParameter[],
  shadowed: ReadonlySet<SymbolName>,
  context: ReceiverResolutionContext,
  bindings: Map<SymbolName, TypeParameterBinding>
): void {
  if (owner_parameters.length === 0) {
    return;
  }
  const binding_def = context.definitions.get(receiver_binding);
  const annotation = binding_def ? declared_annotation(binding_def, context) : null;
  const owner = context.definitions.get(owner_id);
  if (!annotation || !binding_def || !owner) {
    return;
  }
  if (annotation.head[annotation.head.length - 1] !== owner.name) {
    return;
  }
  if (annotation.arguments.length !== owner_parameters.length) {
    return;
  }

  const scope_id = context.definitions.get_symbol_scope(receiver_binding);
  if (!scope_id) {
    return;
  }
  for (let index = 0; index < owner_parameters.length; index++) {
    const name = owner_parameters[index].name;
    if (!shadowed.has(name) && !bindings.has(name)) {
      bindings.set(name, { annotation: annotation.arguments[index], scope_id });
    }
  }
}


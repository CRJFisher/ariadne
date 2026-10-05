/**
 * The type a declared annotation denotes once a call site's type parameters are
 * bound: building the environment from the evidence in view, substituting the
 * annotation through it, and resolving what comes out to a definition.
 *
 * Three stages ask this of the same declaration. A chained receiver hop reads
 * the arguments standing at its chain position (`injector.get(Router).navigate()`);
 * a call-initialised binding reads the arguments of the call that produced its
 * value (`const r = create(Router)`); a binding annotated with a type parameter
 * has no call site at all and reads only the bound its declaration writes. All
 * three run the same sequence and need the answer as a `SymbolId`, so the
 * sequence is here rather than reassembled by each of them.
 *
 * Evidence binds in order of authority — the call's arguments, then the
 * receiver's own declared instantiation, then the declared bounds — and each
 * tier is optional, because which tiers exist is what distinguishes the three
 * callers. The receiver tier arrives as a binder rather than data: what a
 * receiver's annotation instantiates is call resolution's to read, and this
 * file is imported by the registries, which never import that layer.
 *
 * Registry-querying, which is why this is not part of `type_preprocessing/`:
 * unifying and substituting annotations is pure and lives there, while reaching
 * an argument's declaration and resolving a bound annotation to a symbol needs
 * name resolution and the definitions.
 *
 * An argument is one of two things, and the difference decides what it binds. A
 * name resolving to a class, interface, enum or type alias designates that type
 * without being an instance of it. Anything else is a value, and what it says
 * about a type parameter is whatever annotation its own declaration writes.
 */

import type {
  AnyDefinition,
  FilePath,
  Language,
  ParameterDefinition,
  ScopeId,
  SymbolId,
  SymbolName,
  TypeParameter,
} from "@ariadnejs/types";
import {
  bind_type_parameter_bounds,
  parse_type_annotation,
  substitute_type_parameters,
  unify_type_parameters,
  type ConcreteType,
  type ParsedTypeAnnotation,
  type TypeParameterBinding,
} from "./type_preprocessing";
import type { DefinitionRegistry } from "./registries/definition";
import type { ResolutionRegistry } from "./resolution_registry";

/** The registries an argument's type is read from, narrower than any caller's own context. */
interface TypeParameterContext {
  readonly definitions: DefinitionRegistry;
  readonly resolutions: ResolutionRegistry;
  readonly languages: ReadonlyMap<FilePath, Language>;
}

/**
 * What one call site says about a generic declaration's type parameters, one
 * field per tier of evidence. A tier left out is one the caller has nothing to
 * say about: a free function has no receiver, and a binding annotated with a
 * type parameter has no call.
 */
interface TypeParameterEvidence {
  /**
   * The callee's declared parameters against the arguments standing at their
   * positions. `declaring_language` is the callee's, because the parameter
   * annotations are written where the callee is; `scope_id` is the call's,
   * because the arguments are written there.
   */
  readonly call?: {
    readonly parameters: readonly ParameterDefinition[];
    readonly call_arguments: readonly (SymbolName | null)[] | null;
    readonly declaring_language: Language;
    readonly scope_id: ScopeId;
  };
  /**
   * What the receiver's own declared instantiation binds, written into the
   * environment by call resolution — the only layer that can read it.
   */
  readonly bind_receiver_instantiation?: (
    bindings: Map<SymbolName, TypeParameterBinding>
  ) => void;
  /** The parameters whose declared bounds are the weakest evidence, and the scope they resolve in. */
  readonly bounds?: {
    readonly parameters: readonly TypeParameter[];
    readonly scope_id: ScopeId;
  };
}

/**
 * The definition `annotation` denotes once every type parameter `evidence`
 * binds is substituted into it, or null where the annotation names a parameter
 * nothing bound.
 *
 * Null rather than a guess: substitution answers null for an unbound parameter
 * so that `T` is never looked up as an ordinary type name, and the caller is
 * left with the failure it already had.
 */
export function resolve_annotation_in_environment(
  annotation: ParsedTypeAnnotation,
  type_parameters: ReadonlySet<SymbolName>,
  evidence: TypeParameterEvidence,
  context: TypeParameterContext
): SymbolId | null {
  const bindings = new Map<SymbolName, TypeParameterBinding>();

  if (evidence.call) {
    bind_from_call_arguments(
      evidence.call.parameters,
      evidence.call.call_arguments,
      type_parameters,
      evidence.call.declaring_language,
      evidence.call.scope_id,
      context,
      bindings
    );
  }

  evidence.bind_receiver_instantiation?.(bindings);

  if (evidence.bounds) {
    bind_type_parameter_bounds(evidence.bounds.parameters, evidence.bounds.scope_id, bindings);
  }

  const substituted = substitute_type_parameters(annotation, type_parameters, bindings);
  return substituted === null ? null : resolve_bound_type(substituted, context);
}

/** Whether a name used as a value designates a type rather than holding one. */
function designates_a_type(def: AnyDefinition | undefined): boolean {
  return (
    def?.kind === "class" ||
    def?.kind === "interface" ||
    def?.kind === "enum" ||
    def?.kind === "type" ||
    def?.kind === "type_alias"
  );
}

/**
 * Bind what a call's arguments say, matching each declared parameter annotation
 * against the argument standing at its position.
 */
function bind_from_call_arguments(
  parameters: readonly ParameterDefinition[],
  call_arguments: readonly (SymbolName | null)[] | null,
  type_parameters: ReadonlySet<SymbolName>,
  declaring_language: Language,
  scope_id: ScopeId,
  context: TypeParameterContext,
  bindings: Map<SymbolName, TypeParameterBinding>
): void {
  if (!call_arguments) {
    return;
  }

  for (let index = 0; index < parameters.length; index++) {
    const declared_text = parameters[index].type;
    const argument_name = call_arguments[index] ?? null;
    if (declared_text === undefined || argument_name === null) {
      continue;
    }
    const declared = parse_type_annotation(declared_text, declaring_language);
    const concrete = concrete_argument_type(argument_name, scope_id, context);
    if (!declared || concrete === null) {
      continue;
    }
    unify_type_parameters(declared, concrete.type, type_parameters, concrete.scope_id, bindings);
  }
}

/**
 * The concrete type `argument_name` stands for when read from `scope_id`, with
 * the scope that type's own names resolve in — the call's scope for a type
 * named outright, the argument's declaring scope for an annotation it carries.
 *
 * Null for an argument whose declaration writes no annotation. The type the
 * registries recorded for such a binding is a resolved symbol rather than
 * written text, and unification needs text to reach the arguments inside it.
 */
function concrete_argument_type(
  argument_name: SymbolName,
  scope_id: ScopeId,
  context: TypeParameterContext
): { readonly type: ConcreteType; readonly scope_id: ScopeId } | null {
  const symbol_id = context.resolutions.resolve(scope_id, argument_name);
  if (!symbol_id) {
    return null;
  }
  const def = context.definitions.get(symbol_id);
  if (!def) {
    return null;
  }

  if (designates_a_type(def)) {
    return {
      type: { kind: "class_object", annotation: { head: [argument_name], arguments: [] } },
      scope_id,
    };
  }

  const annotation = declared_annotation(def, context);
  const declaring_scope = context.definitions.get_symbol_scope(symbol_id);
  return annotation && declaring_scope
    ? { type: { kind: "value", annotation }, scope_id: declaring_scope }
    : null;
}

/** The annotation a value binding declares, parsed under its own file's grammar. */
export function declared_annotation(
  def: AnyDefinition,
  context: TypeParameterContext
): ParsedTypeAnnotation | null {
  if (
    def.kind !== "parameter" &&
    def.kind !== "variable" &&
    def.kind !== "constant" &&
    def.kind !== "property"
  ) {
    return null;
  }
  const annotation_text = def.type;
  const language = context.languages.get(def.location.file_path);
  return annotation_text !== undefined && language
    ? parse_type_annotation(annotation_text, language)
    : null;
}

/**
 * The definition a bound annotation names. Only a bare head resolves: a
 * qualified one needs the annotation resolver the `TypeRegistry` owns, which
 * runs when a file is indexed rather than when a call is resolved.
 */
function resolve_bound_type(
  binding: TypeParameterBinding,
  context: TypeParameterContext
): SymbolId | null {
  if (binding.annotation.head.length !== 1) {
    return null;
  }
  const symbol_id = context.resolutions.resolve(binding.scope_id, binding.annotation.head[0]);
  if (!symbol_id) {
    return null;
  }
  return designates_a_type(context.definitions.get(symbol_id)) ? symbol_id : null;
}

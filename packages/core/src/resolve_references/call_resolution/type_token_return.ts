/**
 * @language typescript
 * Type-token return inference for a receiver chain hop through a generic
 * method: `injector.get(Router).navigate()` hops through `Router`.
 */

import type { MethodDefinition, ScopeId, SymbolId, SymbolName } from "@ariadnejs/types";
import { parse_type_annotation, type ParsedTypeAnnotation } from "../type_preprocessing";
import type { ReceiverResolutionContext } from "./receiver_resolution";

/**
 * Infer the concrete return type of a generic method whose return type is one
 * of its own type parameters bound by a type-token parameter — the DI shape
 * `get<T>(token: Type<T>): T`. Returns the type the token argument names, or
 * null when the method is not that shape or the argument cannot be resolved
 * (leaving the caller's `member_type_unknown` failure intact).
 */
export function infer_generic_return_from_type_token(
  method_def: MethodDefinition,
  call_arguments_at_position: readonly (SymbolName | null)[] | null,
  scope_id: ScopeId,
  context: ReceiverResolutionContext
): SymbolId | null {
  const return_type = method_def.return_type;
  if (!return_type || !method_def.generics?.includes(return_type)) {
    return null;
  }
  if (!call_arguments_at_position) {
    return null;
  }
  const language = context.languages.get(method_def.location.file_path);
  if (!language) {
    return null;
  }

  // The token parameter is the one whose declared type wraps the return-type
  // parameter exactly (token: Type<T> for a method returning T).
  const token_index = method_def.parameters.findIndex(
    (param) =>
      param.type !== undefined &&
      is_type_token_for(parse_type_annotation(param.type, language), return_type)
  );
  if (token_index < 0) {
    return null;
  }

  const argument_name = call_arguments_at_position[token_index] ?? null;
  if (!argument_name) {
    return null;
  }

  return resolve_token_argument_type(argument_name, scope_id, context);
}

/**
 * Whether a parameter annotation is a token designating `type_parameter`: a
 * single-argument generic wrapping exactly that parameter (`Type<T>`). An
 * array of `T` (`T[]`, `Array<T>`) holds values of `T` and designates nothing.
 */
function is_type_token_for(
  annotation: ParsedTypeAnnotation | null,
  type_parameter: SymbolName
): boolean {
  if (!annotation || annotation.arguments.length !== 1) {
    return false;
  }
  if (annotation.head.length === 1 && annotation.head[0] === "Array") {
    return false;
  }
  const [wrapped] = annotation.arguments;
  return (
    wrapped.head.length === 1 &&
    wrapped.head[0] === type_parameter &&
    wrapped.arguments.length === 0
  );
}

/**
 * Resolve a type-token argument to the class it designates: a class/type used
 * directly (`injector.get(Service)`) is its own type; a typed token binding
 * (a parameter `token: Type<Service>`) designates the single type argument its
 * annotation resolved to.
 */
function resolve_token_argument_type(
  argument_name: SymbolName,
  scope_id: ScopeId,
  context: ReceiverResolutionContext
): SymbolId | null {
  const symbol_id = context.resolutions.resolve(scope_id, argument_name);
  if (!symbol_id) {
    return null;
  }

  const def = context.definitions.get(symbol_id);
  if (!def) {
    return null;
  }

  if (
    def.kind === "class" ||
    def.kind === "interface" ||
    def.kind === "enum" ||
    def.kind === "type" ||
    def.kind === "type_alias"
  ) {
    return symbol_id;
  }

  const type_arguments = context.types.get_symbol_type_arguments(symbol_id);
  return type_arguments.length === 1 ? type_arguments[0] : null;
}

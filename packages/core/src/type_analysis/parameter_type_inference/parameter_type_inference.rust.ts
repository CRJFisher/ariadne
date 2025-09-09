/**
 * Rust-specific bespoke parameter type inference
 *
 * Handles unique Rust features that cannot be expressed through configuration:
 * - Lifetime parameters
 * - Generic type parameters with where clauses
 * - Pattern parameters and destructuring
 * - Trait bounds
 */

import { SyntaxNode } from "tree-sitter";
import {
  ParameterInfo,
  ParameterTypeInfo,
  ParameterInferenceContext,
} from "./parameter_type_inference";

/**
 * Handle Rust pattern parameters (destructuring)
 */
export function handle_pattern_parameters(
  param_node: SyntaxNode,
  context: ParameterInferenceContext
): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  const { source_code } = context;

  if (param_node.type !== "parameter") {
    return params;
  }

  const pattern = param_node.childForFieldName("pattern");
  const type_node = param_node.childForFieldName("type");

  if (!pattern) {
    return params;
  }

  const type_annotation = type_node
    ? source_code.substring(type_node.startIndex, type_node.endIndex)
    : undefined;

  // Handle different pattern types
  switch (pattern.type) {
    case "identifier":
      params.push({
        name: source_code.substring(pattern.startIndex, pattern.endIndex),
        position: 0,
        type_annotation,
      });
      break;

    case "tuple_pattern":
      // Destructure tuple: (a, b, c): (Type1, Type2, Type3)
      const tuple_types = type_annotation
        ? parse_tuple_type(type_annotation)
        : [];
      let index = 0;

      for (let i = 0; i < pattern.childCount; i++) {
        const child = pattern.child(i);
        if (child && child.type === "identifier") {
          params.push({
            name: source_code.substring(child.startIndex, child.endIndex),
            position: index,
            type_annotation: tuple_types[index] || undefined,
          });
          index++;
        }
      }
      break;

    case "struct_pattern":
      // Destructure struct: Point { x, y }: Point
      for (let i = 0; i < pattern.childCount; i++) {
        const field = pattern.child(i);
        if (field && field.type === "field_pattern") {
          const name_node = field.childForFieldName("name");
          if (name_node) {
            params.push({
              name: source_code.substring(
                name_node.startIndex,
                name_node.endIndex
              ),
              position: params.length,
              type_annotation: type_annotation
                ? `${type_annotation}::field`
                : undefined,
            });
          }
        }
      }
      break;

    case "ref_pattern":
    case "mut_pattern":
      // Handle ref/mut patterns
      const inner = pattern.child(pattern.childCount - 1);
      if (inner && inner.type === "identifier") {
        const is_ref = pattern.type === "ref_pattern";
        const adjusted_type =
          type_annotation && is_ref ? `&${type_annotation}` : type_annotation;
        params.push({
          name: source_code.substring(inner.startIndex, inner.endIndex),
          position: 0,
          type_annotation: adjusted_type,
        });
      }
      break;
  }

  return params;
}

/**
 * Parse tuple type string into component types
 */
function parse_tuple_type(tuple_type: string): string[] {
  if (!tuple_type.startsWith("(") || !tuple_type.endsWith(")")) {
    return [];
  }

  const inner = tuple_type.slice(1, -1);
  const types: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of inner) {
    if (char === "," && depth === 0) {
      types.push(current.trim());
      current = "";
    } else {
      if (char === "(" || char === "<") depth++;
      if (char === ")" || char === ">") depth--;
      current += char;
    }
  }

  if (current.trim()) {
    types.push(current.trim());
  }

  return types;
}

/**
 * Extract turbofish type parameters from a call
 */
function extract_turbofish_types(
  call_node: SyntaxNode,
  context: ParameterInferenceContext
): string[] {
  const types: string[] = [];
  const { source_code } = context;

  // Look for :: followed by <...>
  const func = call_node.childForFieldName("function");
  if (func && func.type === "generic_function") {
    const type_args = func.childForFieldName("type_arguments");
    if (type_args) {
      for (let i = 0; i < type_args.childCount; i++) {
        const arg = type_args.child(i);
        if (arg && arg.type !== "<" && arg.type !== ">" && arg.type !== ",") {
          types.push(source_code.substring(arg.startIndex, arg.endIndex));
        }
      }
    }
  }

  return types;
}

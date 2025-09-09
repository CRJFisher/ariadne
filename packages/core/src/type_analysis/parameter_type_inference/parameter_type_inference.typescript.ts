/**
 * TypeScript-specific bespoke parameter type inference
 *
 * Handles unique TypeScript features that cannot be expressed through configuration:
 * - Generic type parameters and constraints
 * - Function overload resolution
 * - Utility type resolution
 * - Union/intersection types
 */

import { SyntaxNode } from "tree-sitter";
import { FunctionDefinition } from "@ariadnejs/types";
import {
  ParameterInfo,
  ParameterTypeInfo,
  ParameterInferenceContext,
} from "./parameter_type_inference";

/**
 * Resolve TypeScript function overloads
 */
export function resolve_overload_parameters(
  func_def: FunctionDefinition,
  func_node: SyntaxNode,
  parameters: ParameterInfo[],
  context: ParameterInferenceContext
): ParameterInfo[] {
  // Check if this is an overload implementation
  const parent = func_node.parent;
  if (!parent) {
    return parameters;
  }

  const overloads: SyntaxNode[] = [];

  // Collect all overload signatures
  for (let i = 0; i < parent.childCount; i++) {
    const sibling = parent.child(i);
    if (
      sibling &&
      sibling.type === "function_signature" &&
      sibling.childForFieldName("name")?.text === func_def.name
    ) {
      overloads.push(sibling);
    }
  }

  if (overloads.length === 0) {
    return parameters;
  }

  // Merge parameter info from overloads
  const merged_params = [...parameters];

  for (const overload of overloads) {
    const overload_params = extract_overload_parameters(overload, context);

    // Merge type information
    for (
      let i = 0;
      i < Math.min(merged_params.length, overload_params.length);
      i++
    ) {
      if (
        overload_params[i].type_annotation &&
        !merged_params[i].type_annotation
      ) {
        merged_params[i].type_annotation = overload_params[i].type_annotation;
      }
    }
  }

  return merged_params;
}

/**
 * Extract parameters from an overload signature
 */
function extract_overload_parameters(
  signature_node: SyntaxNode,
  context: ParameterInferenceContext
): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  const params_node = signature_node.childForFieldName("parameters");

  if (!params_node) {
    return params;
  }

  const { source_code } = context;
  let position = 0;

  for (let i = 0; i < params_node.childCount; i++) {
    const param = params_node.child(i);
    if (
      param &&
      (param.type === "required_parameter" ||
        param.type === "optional_parameter")
    ) {
      const pattern = param.childForFieldName("pattern");
      const type = param.childForFieldName("type");

      if (pattern) {
        params.push({
          name: source_code.substring(pattern.startIndex, pattern.endIndex),
          position,
          type_annotation: type
            ? source_code.substring(type.startIndex, type.endIndex)
            : undefined,
          is_optional: param.type === "optional_parameter",
        });
        position++;
      }
    }
  }

  return params;
}

import type { ParameterDefinition } from "@ariadnejs/types";
import type { SemanticIndex } from "../index_single_file/semantic_index";

/**
 * Extract all parameters from a semantic index as first-class definitions.
 *
 * Parameters are nested in function/method/constructor definitions but need to be
 * available in DefinitionRegistry for type resolution to work correctly.
 *
 * Extracts from:
 * - Function signature parameters
 * - Class method parameters
 * - Class constructor parameters
 * - Interface method parameters
 *
 * @param semantic_index - The semantic index containing all definitions
 * @returns Array of all parameter definitions
 */
export function extract_all_parameters(
  semantic_index: SemanticIndex
): ParameterDefinition[] {
  const params: ParameterDefinition[] = [];

  // Extract from standalone functions
  for (const func of semantic_index.functions.values()) {
    if (func.signature?.parameters) {
      params.push(...func.signature.parameters);
    }
  }

  // Extract from class methods and constructors
  for (const class_def of semantic_index.classes.values()) {
    // From methods
    for (const method of class_def.methods) {
      if (method.parameters) {
        params.push(...method.parameters);
      }
    }

    // From constructors
    if (class_def.constructor) {
      for (const ctor of class_def.constructor) {
        if (ctor.parameters) {
          params.push(...ctor.parameters);
        }
      }
    }
  }

  // Extract from interface methods
  for (const interface_def of semantic_index.interfaces.values()) {
    for (const method of interface_def.methods) {
      if (method.parameters) {
        params.push(...method.parameters);
      }
    }
  }

  return params;
}

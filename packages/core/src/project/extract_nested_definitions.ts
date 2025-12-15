import type { ParameterDefinition } from "@ariadnejs/types";
import type { SemanticIndex } from "../index_single_file/index_single_file";

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
 * @param index_single_file - The semantic index containing all definitions
 * @returns Array of all parameter definitions
 */
export function extract_all_parameters(
  index_single_file: SemanticIndex
): ParameterDefinition[] {
  const params: ParameterDefinition[] = [];

  // Extract from standalone functions
  for (const func of index_single_file.functions.values()) {
    if (func.signature?.parameters) {
      params.push(...func.signature.parameters);
    }
  }

  // Extract from class methods and constructors
  for (const class_def of index_single_file.classes.values()) {
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
  for (const interface_def of index_single_file.interfaces.values()) {
    for (const method of interface_def.methods) {
      if (method.parameters) {
        params.push(...method.parameters);
      }
    }
  }

  return params;
}

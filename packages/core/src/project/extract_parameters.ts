import type { ParameterDefinition } from "@ariadnejs/types";
import type { SemanticIndex } from "../index_single_file/index_single_file";

/**
 * Flatten the parameters nested inside functions, methods, constructors, and
 * interface methods into standalone definitions.
 *
 * Type resolution looks parameters up directly in the DefinitionRegistry rather
 * than walking into their enclosing signature, so they must be surfaced here as
 * first-class definitions.
 */
export function extract_all_parameters(
  index_single_file: SemanticIndex
): ParameterDefinition[] {
  const params: ParameterDefinition[] = [];

  for (const func of index_single_file.functions.values()) {
    if (func.signature?.parameters) {
      params.push(...func.signature.parameters);
    }
  }

  for (const class_def of index_single_file.classes.values()) {
    for (const method of class_def.methods) {
      if (method.parameters) {
        params.push(...method.parameters);
      }
    }

    if (class_def.constructors) {
      for (const ctor of class_def.constructors) {
        if (ctor.parameters) {
          params.push(...ctor.parameters);
        }
      }
    }
  }

  for (const interface_def of index_single_file.interfaces.values()) {
    for (const method of interface_def.methods) {
      if (method.parameters) {
        params.push(...method.parameters);
      }
    }
  }

  return params;
}

/**
 * Render a callable definition as a human-readable signature string.
 *
 * The single reconciled contract: the diagnostics enrichment calls it with a
 * name, and the optional `location` renders anonymous callables as
 * `<anonymous@file:line>` so they stay distinguishable in a flat listing. The
 * signature is the superset both a named-caller and a flat-listing caller need.
 */

import type {
  AnyDefinition,
  FunctionDefinition,
  MethodDefinition,
  ConstructorDefinition,
} from "@ariadnejs/types";

export interface SignatureLocation {
  file_path: string;
  start_line: number;
}

export function build_signature(
  definition: AnyDefinition,
  location?: SignatureLocation,
): string {
  let display_name: string = definition.name;
  if (definition.name === "<anonymous>" && location) {
    const basename = location.file_path.split("/").pop() || location.file_path;
    display_name = `<anonymous@${basename}:${location.start_line}>`;
  }

  if (
    definition.kind === "function" ||
    definition.kind === "method" ||
    definition.kind === "constructor"
  ) {
    let parameters: string[] = [];

    if (definition.kind === "function") {
      const func_def = definition as FunctionDefinition;
      parameters = func_def.signature.parameters.map((p) =>
        p.type ? `${p.name}: ${p.type}` : `${p.name}: any`,
      );
    } else if (definition.kind === "method") {
      const method_def = definition as MethodDefinition;
      parameters = method_def.parameters.map((p) =>
        p.type ? `${p.name}: ${p.type}` : `${p.name}: any`,
      );
    } else {
      const ctor_def = definition as ConstructorDefinition;
      parameters = ctor_def.parameters.map((p) =>
        p.type ? `${p.name}: ${p.type}` : `${p.name}: any`,
      );
    }

    const param_list = parameters.join(", ");

    if (definition.kind === "constructor") {
      return `constructor(${param_list})`;
    }

    let return_type = "unknown";
    if (definition.kind === "function") {
      const func_def = definition as FunctionDefinition;
      return_type =
        func_def.signature.return_type || func_def.return_type || "unknown";
    } else {
      const method_def = definition as MethodDefinition;
      return_type = method_def.return_type || "unknown";
    }

    return `${display_name}(${param_list}): ${return_type}`;
  }

  return display_name;
}

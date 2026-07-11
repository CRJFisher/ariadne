/**
 * Maps definition locations to the type names taken from their explicit
 * annotations. Values are raw type-name strings; resolving those names to
 * SymbolIds is a later stage's job.
 */

import type {
  VariableDefinition,
  FunctionDefinition,
  ClassDefinition,
  InterfaceDefinition,
} from "@ariadnejs/types";
import type { LocationKey, SymbolName } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";

/**
 * Collects type-name bindings from variable/constant annotations, parameter
 * annotations, and function/method return-type annotations across every
 * definition kind. Each binding is keyed by the annotated definition's own
 * location, so a name redefined in another scope yields a distinct entry.
 *
 * @returns Map from definition location to its annotated type name.
 */
export function extract_type_bindings(definitions: {
  variables: ReadonlyMap<unknown, VariableDefinition>;
  functions: ReadonlyMap<unknown, FunctionDefinition>;
  classes: ReadonlyMap<unknown, ClassDefinition>;
  interfaces: ReadonlyMap<unknown, InterfaceDefinition>;
}): ReadonlyMap<LocationKey, SymbolName> {
  const bindings = new Map<LocationKey, SymbolName>();

  for (const variable of definitions.variables.values()) {
    if (variable.type) {
      bindings.set(location_key(variable.location), variable.type);
    }
  }

  for (const func of definitions.functions.values()) {
    if (func.return_type) {
      bindings.set(location_key(func.location), func.return_type);
    }
    for (const param of func.signature.parameters) {
      if (param.type) {
        bindings.set(location_key(param.location), param.type);
      }
    }
  }

  for (const class_def of definitions.classes.values()) {
    for (const method of class_def.methods) {
      if (method.return_type) {
        bindings.set(location_key(method.location), method.return_type);
      }
      for (const param of method.parameters) {
        if (param.type) {
          bindings.set(location_key(param.location), param.type);
        }
      }
    }

    for (const prop of class_def.properties) {
      if (prop.type) {
        bindings.set(location_key(prop.location), prop.type);
      }
    }

    if (class_def.constructors) {
      for (const ctor of class_def.constructors) {
        for (const param of ctor.parameters) {
          if (param.type) {
            bindings.set(location_key(param.location), param.type);
          }
        }
      }
    }
  }

  for (const interface_def of definitions.interfaces.values()) {
    for (const method of interface_def.methods) {
      if (method.return_type) {
        bindings.set(location_key(method.location), method.return_type);
      }
      for (const param of method.parameters) {
        if (param.type) {
          bindings.set(location_key(param.location), param.type);
        }
      }
    }

    for (const prop of interface_def.properties) {
      if (prop.type) {
        bindings.set(location_key(prop.location), prop.type);
      }
    }
  }

  return bindings;
}

/**
 * Maps annotated definitions to the annotation text they declare. Values are
 * raw annotation strings; parsing and resolving them to SymbolIds is a later
 * stage's job.
 */

import type {
  VariableDefinition,
  FunctionDefinition,
  ClassDefinition,
  InterfaceDefinition,
} from "@ariadnejs/types";
import type { SymbolId, SymbolName } from "@ariadnejs/types";

/**
 * Collects type-name bindings from variable/constant annotations, parameter
 * annotations, and function/method return-type annotations across every
 * definition kind. Each binding is keyed by the annotated definition's own
 * SymbolId, so a name redefined in another scope yields a distinct entry, and
 * two definitions sharing one span — a TypeScript constructor parameter
 * property is both a parameter and a property — each keep their binding.
 *
 * @returns Map from definition SymbolId to its annotation text.
 */
export function extract_type_bindings(definitions: {
  variables: ReadonlyMap<unknown, VariableDefinition>;
  functions: ReadonlyMap<unknown, FunctionDefinition>;
  classes: ReadonlyMap<unknown, ClassDefinition>;
  interfaces: ReadonlyMap<unknown, InterfaceDefinition>;
}): ReadonlyMap<SymbolId, SymbolName> {
  const bindings = new Map<SymbolId, SymbolName>();

  for (const variable of definitions.variables.values()) {
    if (variable.type) {
      bindings.set(variable.symbol_id, variable.type);
    }
  }

  for (const func of definitions.functions.values()) {
    if (func.return_type) {
      bindings.set(func.symbol_id, func.return_type);
    }
    for (const param of func.signature.parameters) {
      if (param.type) {
        bindings.set(param.symbol_id, param.type);
      }
    }
  }

  for (const class_def of definitions.classes.values()) {
    for (const method of class_def.methods) {
      if (method.return_type) {
        bindings.set(method.symbol_id, method.return_type);
      }
      for (const param of method.parameters) {
        if (param.type) {
          bindings.set(param.symbol_id, param.type);
        }
      }
    }

    for (const prop of class_def.properties) {
      if (prop.type) {
        bindings.set(prop.symbol_id, prop.type);
      }
    }

    if (class_def.constructors) {
      for (const ctor of class_def.constructors) {
        for (const param of ctor.parameters) {
          if (param.type) {
            bindings.set(param.symbol_id, param.type);
          }
        }
      }
    }
  }

  for (const interface_def of definitions.interfaces.values()) {
    for (const method of interface_def.methods) {
      if (method.return_type) {
        bindings.set(method.symbol_id, method.return_type);
      }
      for (const param of method.parameters) {
        if (param.type) {
          bindings.set(param.symbol_id, param.type);
        }
      }
    }

    for (const prop of interface_def.properties) {
      if (prop.type) {
        bindings.set(prop.symbol_id, prop.type);
      }
    }
  }

  return bindings;
}

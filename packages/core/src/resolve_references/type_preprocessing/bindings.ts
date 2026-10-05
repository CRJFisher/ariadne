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
  EnumDefinition,
  MethodDefinition,
  ParameterDefinition,
} from "@ariadnejs/types";
import type { SymbolId, SymbolName } from "@ariadnejs/types";

/**
 * A file's annotations, split by what the annotated definition is. A value
 * binding says what a variable, parameter or property holds; a return binding
 * says what calling a function or method yields. The two are different facts
 * about different receivers — `e.connect` names the method, `e.connect()` its
 * result — so they are never kept in one map.
 */
interface TypeBindings {
  /** Variable, parameter, class property or struct field → its annotation text. */
  readonly value_bindings: ReadonlyMap<SymbolId, SymbolName>;
  /** Function or method → its declared return annotation text. */
  readonly return_bindings: ReadonlyMap<SymbolId, SymbolName>;
}

/**
 * Collects annotation bindings across every definition kind that carries one.
 * Each binding is keyed by the annotated definition's own SymbolId, so a name
 * redefined in another scope yields a distinct entry, and two definitions
 * sharing one span — a TypeScript constructor parameter property is both a
 * parameter and a property — each keep their binding.
 */
export function extract_type_bindings(definitions: {
  variables: ReadonlyMap<unknown, VariableDefinition>;
  functions: ReadonlyMap<unknown, FunctionDefinition>;
  classes: ReadonlyMap<unknown, ClassDefinition>;
  interfaces: ReadonlyMap<unknown, InterfaceDefinition>;
  enums: ReadonlyMap<unknown, EnumDefinition>;
}): TypeBindings {
  const value_bindings = new Map<SymbolId, SymbolName>();
  const return_bindings = new Map<SymbolId, SymbolName>();

  const bind_parameters = (parameters: readonly ParameterDefinition[]): void => {
    for (const param of parameters) {
      if (param.type) {
        value_bindings.set(param.symbol_id, param.type);
      }
    }
  };
  const bind_methods = (methods: readonly MethodDefinition[]): void => {
    for (const method of methods) {
      if (method.return_type) {
        return_bindings.set(method.symbol_id, method.return_type);
      }
      bind_parameters(method.parameters);
    }
  };

  for (const variable of definitions.variables.values()) {
    if (variable.type) {
      value_bindings.set(variable.symbol_id, variable.type);
    }
  }

  for (const func of definitions.functions.values()) {
    if (func.return_type) {
      return_bindings.set(func.symbol_id, func.return_type);
    }
    bind_parameters(func.signature.parameters);
  }

  // A Rust struct is indexed as a class, so its fields are these properties.
  for (const class_def of definitions.classes.values()) {
    bind_methods(class_def.methods);
    for (const prop of class_def.properties) {
      if (prop.type) {
        value_bindings.set(prop.symbol_id, prop.type);
      }
    }
    for (const ctor of class_def.constructors ?? []) {
      bind_parameters(ctor.parameters);
    }
  }

  for (const interface_def of definitions.interfaces.values()) {
    bind_methods(interface_def.methods);
    for (const prop of interface_def.properties) {
      if (prop.type) {
        value_bindings.set(prop.symbol_id, prop.type);
      }
    }
  }

  for (const enum_def of definitions.enums.values()) {
    bind_methods(enum_def.methods ?? []);
  }

  return { value_bindings, return_bindings };
}

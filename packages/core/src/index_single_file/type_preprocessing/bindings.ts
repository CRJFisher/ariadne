/**
 * Type Bindings Extraction
 *
 * Extracts type names from explicit annotations in definitions.
 * Maps definition locations to their type names (strings, not resolved SymbolIds).
 *
 * Resolution of type names to SymbolIds happens in task 11.109 using ScopeResolver.
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
 * Extract type bindings from definitions
 *
 * Extracts type names from:
 * - Variable/constant type annotations
 * - Parameter type annotations
 * - Function return type annotations
 *
 * @param definitions - Object containing all definition maps
 * @returns Map from definition location to type name (string)
 *
 * @example
 * ```typescript
 * // Input: const user: User = getUser();
 * // Output: Map { "file.ts:1:6:1:10" => "User" }
 *
 * // Input: function getName(): string { ... }
 * // Output: Map { "file.ts:1:0:1:35" => "string" }
 * ```
 */
export function extract_type_bindings(definitions: {
  variables: ReadonlyMap<unknown, VariableDefinition>;
  functions: ReadonlyMap<unknown, FunctionDefinition>;
  classes: ReadonlyMap<unknown, ClassDefinition>;
  interfaces: ReadonlyMap<unknown, InterfaceDefinition>;
}): ReadonlyMap<LocationKey, SymbolName> {
  const bindings = new Map<LocationKey, SymbolName>();

  // Extract from variable/constant definitions
  for (const variable of definitions.variables.values()) {
    if (variable.type) {
      const key = location_key(variable.location);
      bindings.set(key, variable.type);
    }
  }

  // Extract from function return types
  for (const func of definitions.functions.values()) {
    if (func.return_type) {
      const key = location_key(func.location);
      bindings.set(key, func.return_type);
    }

    // Extract from function parameters
    if (func.signature?.parameters) {
      for (const param of func.signature.parameters) {
        if (param.type) {
          const key = location_key(param.location);
          bindings.set(key, param.type);
        }
      }
    }
  }

  // Extract from class methods and properties
  for (const class_def of definitions.classes.values()) {
    // Extract from methods
    for (const method of class_def.methods) {
      // Method return types
      if (method.return_type) {
        const key = location_key(method.location);
        bindings.set(key, method.return_type);
      }

      // Method parameters
      if (method.parameters) {
        for (const param of method.parameters) {
          if (param.type) {
            const key = location_key(param.location);
            bindings.set(key, param.type);
          }
        }
      }
    }

    // Extract from properties
    for (const prop of class_def.properties) {
      if (prop.type) {
        const key = location_key(prop.location);
        bindings.set(key, prop.type);
      }
    }

    // Extract from constructor parameters
    if (class_def.constructor) {
      for (const ctor of class_def.constructor) {
        for (const param of ctor.parameters) {
          if (param.type) {
            const key = location_key(param.location);
            bindings.set(key, param.type);
          }
        }
      }
    }
  }

  // Extract from interface methods and properties
  for (const interface_def of definitions.interfaces.values()) {
    // Extract from interface methods
    for (const method of interface_def.methods) {
      // Method return types
      if (method.return_type) {
        const key = location_key(method.location);
        bindings.set(key, method.return_type);
      }

      // Method parameters
      if (method.parameters) {
        for (const param of method.parameters) {
          if (param.type) {
            const key = location_key(param.location);
            bindings.set(key, param.type);
          }
        }
      }
    }

    // Extract from interface properties
    for (const prop of interface_def.properties) {
      if (prop.type) {
        const key = location_key(prop.location);
        bindings.set(key, prop.type);
      }
    }
  }

  return bindings;
}

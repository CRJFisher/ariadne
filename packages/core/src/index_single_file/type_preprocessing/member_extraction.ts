/**
 * Type Member Extraction
 *
 * Extracts member information (methods, properties, constructor) from type definitions.
 * Maps type SymbolIds to their member information for efficient lookup during method resolution.
 *
 * Resolution of member types happens in task 11.109 using TypeContext.
 */

import type {
  SymbolId,
  SymbolName,
  ClassDefinition,
  InterfaceDefinition,
  EnumDefinition,
  TypeMemberInfo,
} from "@ariadnejs/types";

/**
 * Extract the local name from a SymbolId
 *
 * SymbolId format: "kind:file_path:start_line:start_column:end_line:end_column:name"
 * This extracts the last component (the local identifier name)
 *
 * @param symbol_id - The SymbolId to extract from
 * @returns The local name component
 */
function extract_name_from_symbol_id(symbol_id: SymbolId): SymbolName {
  const parts = symbol_id.split(":");
  return parts[parts.length - 1] as SymbolName;
}

/**
 * Extract type members from class, interface, and enum definitions
 *
 * Builds a map of type SymbolId → its members for efficient lookup
 * during method resolution. Tracks inheritance for future resolution.
 *
 * @param definitions - Object containing definition maps (classes, interfaces, enums)
 * @returns Map from type SymbolId to its member information
 *
 * @example
 * ```typescript
 * // Input: class User { getName() { ... }; email: string; }
 * // Output: Map {
 * //   User_SymbolId => {
 * //     methods: Map { "getName" => getName_SymbolId },
 * //     properties: Map { "email" => email_SymbolId },
 * //     constructor: undefined,
 * //     extends: []
 * //   }
 * // }
 * ```
 */
export function extract_type_members(definitions: {
  classes: ReadonlyMap<SymbolId, ClassDefinition>;
  interfaces: ReadonlyMap<SymbolId, InterfaceDefinition>;
  enums: ReadonlyMap<SymbolId, EnumDefinition>;
}): ReadonlyMap<SymbolId, TypeMemberInfo> {
  const members = new Map<SymbolId, TypeMemberInfo>();

  // 1. Extract from classes
  for (const [class_id, class_def] of definitions.classes) {
    const methods = new Map<SymbolName, SymbolId>();
    const properties = new Map<SymbolName, SymbolId>();

    // Index methods
    for (const method of class_def.methods) {
      methods.set(method.name, method.symbol_id);
    }

    // Index properties
    for (const prop of class_def.properties) {
      properties.set(prop.name, prop.symbol_id);
    }

    // Get constructor (if any)
    const constructor_id = class_def.constructor?.[0]?.symbol_id;

    // Get extends (store as SymbolName strings, resolved later in 11.109)
    const extends_names = class_def.extends || [];

    members.set(class_id, {
      methods,
      properties,
      constructor: constructor_id,
      extends: extends_names,
    });
  }

  // 2. Extract from interfaces
  for (const [iface_id, iface_def] of definitions.interfaces) {
    const methods = new Map<SymbolName, SymbolId>();
    const properties = new Map<SymbolName, SymbolId>();

    // Index method signatures
    for (const method of iface_def.methods) {
      methods.set(method.name, method.symbol_id);
    }

    // Index property signatures
    for (const prop of iface_def.properties) {
      properties.set(prop.name, prop.symbol_id);
    }

    // Get extends (interfaces can extend other interfaces)
    const extends_names = iface_def.extends || [];

    members.set(iface_id, {
      methods,
      properties,
      constructor: undefined, // Interfaces don't have constructors
      extends: extends_names,
    });
  }

  // 3. Extract from enums (Rust enums can have methods)
  for (const [enum_id, enum_def] of definitions.enums) {
    if (!enum_def.methods || enum_def.methods.length === 0) {
      // Enum with no methods - still track it but with empty members
      members.set(enum_id, {
        methods: new Map(),
        properties: new Map(),
        constructor: undefined,
        extends: [],
      });
      continue;
    }

    const methods = new Map<SymbolName, SymbolId>();

    for (const method of enum_def.methods) {
      methods.set(method.name, method.symbol_id);
    }

    members.set(enum_id, {
      methods,
      properties: new Map(), // Enums don't have properties in this model
      constructor: undefined,
      extends: [],
    });
  }

  return members;
}

/**
 * Type Member Extraction
 *
 * Extracts member information (methods, properties) from type definitions.
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
 * Record a member in a name→symbol member map, giving a getter precedence over a
 * same-named setter. A `get value()` and `set value()` are distinct definitions
 * sharing one name; a bare read (`obj.value`) resolves through this map to invoke
 * the getter, so the getter must win the slot regardless of declaration order. A
 * setter therefore never shadows an existing member. `accessor_kind` is JS/TS-only,
 * so other languages keep plain last-write-wins semantics.
 */
export function set_member_symbol(
  members: Map<SymbolName, SymbolId>,
  member: {
    readonly name: SymbolName;
    readonly symbol_id: SymbolId;
    readonly accessor_kind?: "getter" | "setter";
  }
): void {
  if (member.accessor_kind === "setter" && members.has(member.name)) return;
  members.set(member.name, member.symbol_id);
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
      set_member_symbol(methods, method);
    }

    // Index properties
    for (const prop of class_def.properties) {
      properties.set(prop.name, prop.symbol_id);
    }

    // Get extends (store as SymbolName strings, resolved later in 11.109)
    const extends_names = class_def.extends || [];

    members.set(class_id, {
      methods,
      properties,
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
      extends: extends_names,
    });
  }

  // 3. Extract from enums
  for (const [enum_id, enum_def] of definitions.enums) {
    const methods = new Map<SymbolName, SymbolId>();
    const properties = new Map<SymbolName, SymbolId>();

    // Index enum members as properties (e.g. Python Color.RED, TS Direction.Up)
    for (const member of enum_def.members) {
      properties.set(member.name, member.symbol_id);
    }

    // @language rust
    // Index methods (Rust enums can have impl methods)
    if (enum_def.methods) {
      for (const method of enum_def.methods) {
        methods.set(method.name, method.symbol_id);
      }
    }

    members.set(enum_id, {
      methods,
      properties,
      extends: [],
    });
  }

  return members;
}

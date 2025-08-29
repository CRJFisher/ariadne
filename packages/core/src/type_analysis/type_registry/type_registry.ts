/**
 * Type Registry Implementation
 * 
 * Language-specific type registration and resolution logic.
 */

import {
  Language,
  ClassDefinition,
  InterfaceDefinition,
  EnumDefinition,
  TypeAliasDefinition,
  StructDefinition,
  TraitDefinition,
  ProtocolDefinition,
  TypeDefinition,
  FilePath,
  TypeName,
  QualifiedName
} from '@ariadnejs/types';

/**
 * Convert a ClassDefinition to a unified TypeDefinition
 */
export function class_to_type_definition(
  class_def: ClassDefinition,
  language: Language
): TypeDefinition {
  const type_def: TypeDefinition = {
    name: class_def.name as TypeName,
    file_path: class_def.file_path as FilePath,
    location: class_def.location,
    kind: 'class',
    type_parameters: class_def.generics?.map(g => g.name as TypeName),
    extends: class_def.extends as TypeName[] | undefined,
    implements: class_def.implements as TypeName[] | undefined,
    members: new Map()
  };
  
  // Convert methods to type members
  if (class_def.methods) {
    for (const method of class_def.methods) {
      type_def.members?.set(method.name, {
        name: method.name,
        type: method.return_type,
        kind: method.is_constructor ? 'constructor' : 'method'
      });
    }
  }
  
  // Convert properties to type members
  if (class_def.properties) {
    for (const prop of class_def.properties) {
      type_def.members?.set(prop.name, {
        name: prop.name,
        type: prop.type,
        kind: 'property',
        is_optional: false,
        is_readonly: prop.is_readonly
      });
    }
  }
  
  return type_def;
}

/**
 * Convert an InterfaceDefinition to a unified TypeDefinition
 */
export function interface_to_type_definition(
  interface_def: InterfaceDefinition,
  language: Language
): TypeDefinition {
  const type_def: TypeDefinition = {
    name: interface_def.name as TypeName,
    file_path: interface_def.file_path as FilePath,
    location: interface_def.location,
    kind: 'interface',
    type_parameters: interface_def.generics?.map(g => g.name as TypeName),
    extends: interface_def.extends as TypeName[] | undefined,
    members: new Map()
  };
  
  // Convert method signatures to type members
  if (interface_def.methods) {
    for (const method of interface_def.methods) {
      type_def.members?.set(method.name, {
        name: method.name,
        type: method.return_type,
        kind: 'method',
        is_optional: method.is_optional
      });
    }
  }
  
  // Convert property signatures to type members
  if (interface_def.properties) {
    for (const prop of interface_def.properties) {
      type_def.members?.set(prop.name, {
        name: prop.name,
        type: prop.type,
        kind: 'property',
        is_optional: prop.is_optional,
        is_readonly: prop.is_readonly
      });
    }
  }
  
  return type_def;
}

/**
 * Convert an EnumDefinition to a unified TypeDefinition
 */
export function enum_to_type_definition(
  enum_def: EnumDefinition
): TypeDefinition {
  const type_def: TypeDefinition = {
    name: enum_def.name as TypeName,
    file_path: enum_def.file_path as FilePath,
    location: enum_def.location,
    kind: 'enum',
    members: new Map()
  };
  
  // Convert enum members
  if (enum_def.members) {
    for (const member of enum_def.members) {
      type_def.members?.set(member.name, {
        name: member.name,
        type: typeof member.value === 'string' ? 'string' : 'number',
        kind: 'property',
        is_readonly: true
      });
    }
  }
  
  return type_def;
}

/**
 * Convert a TypeAliasDefinition to a unified TypeDefinition
 */
export function type_alias_to_type_definition(
  alias_def: TypeAliasDefinition
): TypeDefinition {
  return {
    name: alias_def.name as TypeName,
    file_path: alias_def.file_path as FilePath,
    location: alias_def.location,
    kind: 'type',
    type_parameters: alias_def.generics?.map(g => g.name as TypeName)
  };
}

/**
 * Convert a Rust StructDefinition to a unified TypeDefinition
 */
export function struct_to_type_definition(
  struct_def: StructDefinition
): TypeDefinition {
  const type_def: TypeDefinition = {
    name: struct_def.name as TypeName,
    file_path: struct_def.file_path as FilePath,
    location: struct_def.location,
    kind: 'class', // Structs are class-like
    type_parameters: struct_def.generics?.map(g => g.name as TypeName),
    members: new Map()
  };
  
  // Convert fields to members
  if (struct_def.fields) {
    for (const field of struct_def.fields) {
      if (field.name) {
        type_def.members?.set(field.name, {
          name: field.name,
          type: field.type,
          kind: 'property',
          is_readonly: false
        });
      }
    }
  }
  
  return type_def;
}

/**
 * Convert a Rust TraitDefinition to a unified TypeDefinition
 */
export function trait_to_type_definition(
  trait_def: TraitDefinition
): TypeDefinition {
  const type_def: TypeDefinition = {
    name: trait_def.name as TypeName,
    file_path: trait_def.file_path as FilePath,
    location: trait_def.location,
    kind: 'trait',
    type_parameters: trait_def.generics?.map(g => g.name as TypeName),
    extends: trait_def.supertraits as TypeName[] | undefined,
    members: new Map()
  };
  
  // Convert method signatures to members
  if (trait_def.methods) {
    for (const method of trait_def.methods) {
      type_def.members?.set(method.name, {
        name: method.name,
        type: method.return_type,
        kind: 'method',
        is_optional: method.is_optional
      });
    }
  }
  
  return type_def;
}

/**
 * Convert a Python ProtocolDefinition to a unified TypeDefinition
 */
export function protocol_to_type_definition(
  protocol_def: ProtocolDefinition
): TypeDefinition {
  const type_def: TypeDefinition = {
    name: protocol_def.name as TypeName,
    file_path: protocol_def.file_path as FilePath,
    location: protocol_def.location,
    kind: 'interface', // Protocols are interface-like
    extends: protocol_def.bases as TypeName[] | undefined,
    members: new Map()
  };
  
  // Convert method signatures to members
  if (protocol_def.methods) {
    for (const method of protocol_def.methods) {
      type_def.members?.set(method.name, {
        name: method.name,
        type: method.return_type,
        kind: 'method',
        is_optional: method.is_optional
      });
    }
  }
  
  // Convert property signatures to members
  if (protocol_def.properties) {
    for (const prop of protocol_def.properties) {
      type_def.members?.set(prop.name, {
        name: prop.name,
        type: prop.type,
        kind: 'property',
        is_optional: prop.is_optional,
        is_readonly: prop.is_readonly
      });
    }
  }
  
  return type_def;
}

/**
 * Resolve type references through re-export chains
 */
export function resolve_through_reexports(
  type_name: TypeName,
  module_path: FilePath,
  exports_map: Map<FilePath, Map<string, QualifiedName>>
): QualifiedName | undefined {
  const module_exports = exports_map.get(module_path);
  if (!module_exports) return undefined;
  
  // Check if this module exports the type
  const qualified = module_exports.get(type_name);
  if (qualified) return qualified;
  
  // Check for re-exports (export { foo } from './other')
  // This would require tracking re-export information
  // TODO: Implement re-export chain resolution
  
  return undefined;
}

/**
 * Check if a type is a built-in for the given language
 */
export function is_builtin_type(
  type_name: TypeName,
  language: Language
): boolean {
  const builtins = get_language_builtins(language);
  return builtins.has(type_name);
}

/**
 * Get built-in types for a language
 */
function get_language_builtins(language: Language): Set<TypeName> {
  switch (language) {
    case 'javascript':
      return new Set([
        'string', 'number', 'boolean', 'object', 'undefined', 'null', 'symbol', 'bigint',
        'Array', 'Object', 'Function', 'Date', 'RegExp', 'Map', 'Set', 'Promise',
        'Error', 'TypeError', 'ReferenceError', 'SyntaxError'
      ] as TypeName[]);
      
    case 'typescript':
      return new Set([
        'string', 'number', 'boolean', 'object', 'undefined', 'null', 'symbol', 'bigint',
        'Array', 'Object', 'Function', 'Date', 'RegExp', 'Map', 'Set', 'Promise',
        'Error', 'TypeError', 'ReferenceError', 'SyntaxError',
        'any', 'unknown', 'never', 'void'
      ] as TypeName[]);
      
    case 'python':
      return new Set([
        'int', 'float', 'str', 'bool', 'None', 'list', 'dict', 'tuple', 'set',
        'type', 'object', 'Exception', 'ValueError', 'TypeError', 'KeyError'
      ] as TypeName[]);
      
    case 'rust':
      return new Set([
        'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
        'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
        'f32', 'f64', 'bool', 'char', 'str',
        'String', 'Vec', 'HashMap', 'HashSet', 'Option', 'Result'
      ] as TypeName[]);
      
    default:
      return new Set();
  }
}

/**
 * Validate type consistency
 * Checks for conflicts like duplicate definitions, circular dependencies, etc.
 */
export function validate_type_consistency(
  registry_types: Map<QualifiedName, TypeDefinition>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for circular inheritance
  const visited = new Set<QualifiedName>();
  const recursion_stack = new Set<QualifiedName>();
  
  function check_circular_inheritance(
    type_name: QualifiedName,
    chain: QualifiedName[] = []
  ): void {
    if (recursion_stack.has(type_name)) {
      errors.push(`Circular inheritance detected: ${chain.join(' -> ')} -> ${type_name}`);
      return;
    }
    
    if (visited.has(type_name)) return;
    
    visited.add(type_name);
    recursion_stack.add(type_name);
    
    const type_def = registry_types.get(type_name);
    if (type_def?.extends) {
      for (const parent of type_def.extends) {
        // Need to resolve parent to qualified name
        // This is simplified - would need proper resolution
        check_circular_inheritance(parent as QualifiedName, [...chain, type_name]);
      }
    }
    
    recursion_stack.delete(type_name);
  }
  
  // Check all types for circular inheritance
  for (const [type_name] of registry_types) {
    if (!visited.has(type_name)) {
      check_circular_inheritance(type_name);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
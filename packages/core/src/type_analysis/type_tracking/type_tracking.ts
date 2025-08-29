/**
 * Common type tracking logic
 * 
 * Provides functionality for tracking variable types, imported classes,
 * and type information across codebases.
 * 
 * Migrated from: src_old/call_graph/type_tracker.ts
 */

// TODO: Integration with Constructor Calls
// - Update type map on construction
// TODO: Integration with Method Calls
// - Provide type context for method resolution
// TODO: Integration with Import Resolution
// - Add import type tracking

import { Language } from '@ariadnejs/types';

/**
 * Type information for a variable at a specific position
 */
export interface TypeInfo {
  type_name: string;           // The type name (e.g., "string", "MyClass")
  type_kind: 'primitive' | 'class' | 'interface' | 'function' | 'object' | 'array' | 'unknown';
  position: {
    row: number;
    column: number;
  };
  confidence: 'explicit' | 'inferred' | 'assumed';
  source?: 'annotation' | 'assignment' | 'constructor' | 'return' | 'parameter';
}

/**
 * Information about an imported class/type
 */
export interface ImportedClassInfo {
  class_name: string;
  source_module: string;
  local_name: string;
  is_default?: boolean;
  is_type_only?: boolean;  // TypeScript type-only import
}

/**
 * Information about an exported type
 */
export interface ExportedTypeInfo {
  class_name: string;
  class_def: Def;
  source_file: string;
  is_default?: boolean;
  is_type_only?: boolean;
}

/**
 * Type tracking context
 */
export interface TypeTrackingContext {
  language: Language;
  file_path: string;
  debug?: boolean;
}

/**
 * File-level type tracking data
 */
export interface FileTypeTracker {
  variable_types: Map<string, TypeInfo[]>;       // Variable name -> type history
  imported_classes: Map<string, ImportedClassInfo>;  // Local name -> import info
  exported_definitions: Set<string>;             // Names of exported definitions
}

/**
 * Local scope type tracking (with parent fallback)
 */
export interface LocalTypeTracker {
  local_types: Map<string, TypeInfo[]>;
  parent: FileTypeTracker;
}

/**
 * Project-wide type registry
 */
export interface ProjectTypeRegistry {
  exported_types: Map<string, ExportedTypeInfo>;  // Symbol -> type info
  file_exports: Map<string, Set<string>>;         // File -> exported symbols
}

// TODO: Add these stub interfaces for future integration

// Integration with type inference
export interface TypeInferrer {
  infer_type(expr: any, context: TypeTrackingContext): TypeInfo | undefined;
  infer_return_type(func: Def, context: TypeTrackingContext): TypeInfo | undefined;
  infer_parameter_types(func: Def, context: TypeTrackingContext): Map<string, TypeInfo>;
}

// Integration with type propagation
export interface TypePropagator {
  propagate_type(from: string, to: string, type: TypeInfo): void;
  get_propagated_type(var_name: string): TypeInfo | undefined;
}

/**
 * Create a new file type tracker
 */
export function create_file_type_tracker(): FileTypeTracker {
  return {
    variable_types: new Map(),
    imported_classes: new Map(),
    exported_definitions: new Set()
  };
}

/**
 * Set the type of a variable at a specific position
 */
export function set_variable_type(
  tracker: FileTypeTracker,
  var_name: string,
  type_info: TypeInfo
): FileTypeTracker {
  const existing_types = tracker.variable_types.get(var_name) || [];
  
  // Add new type and sort by position
  const new_types = [...existing_types, type_info].sort((a, b) => {
    if (a.position.row !== b.position.row) {
      return a.position.row - b.position.row;
    }
    return a.position.column - b.position.column;
  });
  
  // Create new tracker with updated types
  const new_variable_types = new Map(tracker.variable_types);
  new_variable_types.set(var_name, new_types);
  
  return {
    ...tracker,
    variable_types: new_variable_types
  };
}

/**
 * Get the type of a variable at a specific position
 */
export function get_variable_type(
  tracker: FileTypeTracker,
  var_name: string,
  position?: { row: number; column: number }
): TypeInfo | undefined {
  const types = tracker.variable_types.get(var_name);
  if (!types || types.length === 0) return undefined;
  
  // If no position specified, return the last type
  if (!position) {
    return types[types.length - 1];
  }
  
  // Find the type that was assigned before this position
  let last_type: TypeInfo | undefined = undefined;
  for (const type_info of types) {
    if (type_info.position.row > position.row || 
        (type_info.position.row === position.row && type_info.position.column > position.column)) {
      break;
    }
    last_type = type_info;
  }
  
  return last_type;
}

/**
 * Track an imported class/type
 */
export function set_imported_class(
  tracker: FileTypeTracker,
  local_name: string,
  class_info: ImportedClassInfo
): FileTypeTracker {
  const new_imported_classes = new Map(tracker.imported_classes);
  new_imported_classes.set(local_name, class_info);
  
  return {
    ...tracker,
    imported_classes: new_imported_classes
  };
}

/**
 * Get imported class information
 */
export function get_imported_class(
  tracker: FileTypeTracker,
  local_name: string
): ImportedClassInfo | undefined {
  return tracker.imported_classes.get(local_name);
}

/**
 * Mark a definition as exported
 */
export function mark_as_exported(
  tracker: FileTypeTracker,
  def_name: string
): FileTypeTracker {
  const new_exported_definitions = new Set(tracker.exported_definitions);
  new_exported_definitions.add(def_name);
  
  return {
    ...tracker,
    exported_definitions: new_exported_definitions
  };
}

/**
 * Check if a definition is exported
 */
export function is_exported(
  tracker: FileTypeTracker,
  def_name: string
): boolean {
  return tracker.exported_definitions.has(def_name);
}

/**
 * Get all exported definitions
 */
export function get_exported_definitions(
  tracker: FileTypeTracker
): Set<string> {
  return new Set(tracker.exported_definitions);
}

/**
 * Clear all type information
 */
export function clear_file_type_tracker(): FileTypeTracker {
  return create_file_type_tracker();
}

/**
 * Create a local type tracker that inherits from a parent
 */
export function create_local_type_tracker(parent: FileTypeTracker): LocalTypeTracker {
  return {
    local_types: new Map(),
    parent
  };
}

/**
 * Set variable type in local scope
 */
export function set_local_variable_type(
  tracker: LocalTypeTracker,
  var_name: string,
  type_info: TypeInfo
): LocalTypeTracker {
  const existing_types = tracker.local_types.get(var_name) || [];
  
  const new_types = [...existing_types, type_info].sort((a, b) => {
    if (a.position.row !== b.position.row) {
      return a.position.row - b.position.row;
    }
    return a.position.column - b.position.column;
  });
  
  const new_local_types = new Map(tracker.local_types);
  new_local_types.set(var_name, new_types);
  
  return {
    ...tracker,
    local_types: new_local_types
  };
}

/**
 * Get variable type from local scope with parent fallback
 */
export function get_local_variable_type(
  tracker: LocalTypeTracker,
  var_name: string,
  position?: { row: number; column: number }
): TypeInfo | undefined {
  const local_types = tracker.local_types.get(var_name);
  
  if (local_types && local_types.length > 0) {
    if (!position) {
      return local_types[local_types.length - 1];
    }
    
    let last_type: TypeInfo | undefined = undefined;
    for (const type_info of local_types) {
      if (type_info.position.row > position.row || 
          (type_info.position.row === position.row && type_info.position.column > position.column)) {
        break;
      }
      last_type = type_info;
    }
    
    if (last_type) return last_type;
  }
  
  // Check parent
  return get_variable_type(tracker.parent, var_name, position);
}

/**
 * Get imported class from parent
 */
export function get_local_imported_class(
  tracker: LocalTypeTracker,
  local_name: string
): ImportedClassInfo | undefined {
  return get_imported_class(tracker.parent, local_name);
}

/**
 * Create a new project type registry
 */
export function create_project_type_registry(): ProjectTypeRegistry {
  return {
    exported_types: new Map(),
    file_exports: new Map()
  };
}

/**
 * Register an exported type from a file
 */
export function register_export(
  registry: ProjectTypeRegistry,
  file_path: string,
  export_name: string,
  type_info: ExportedTypeInfo
): ProjectTypeRegistry {
  const symbol = `${file_path}#${export_name}`;
  
  // Update exported types
  const new_exported_types = new Map(registry.exported_types);
  new_exported_types.set(symbol, type_info);
  
  // Update file exports
  const current_file_exports = registry.file_exports.get(file_path) || new Set();
  const new_file_export_set = new Set(current_file_exports);
  new_file_export_set.add(symbol);
  
  const new_file_exports = new Map(registry.file_exports);
  new_file_exports.set(file_path, new_file_export_set);
  
  return {
    exported_types: new_exported_types,
    file_exports: new_file_exports
  };
}

/**
 * Get type information for an imported symbol
 */
export function get_imported_type(
  registry: ProjectTypeRegistry,
  imported_from: string,
  import_name: string
): ExportedTypeInfo | undefined {
  const symbol = `${imported_from}#${import_name}`;
  return registry.exported_types.get(symbol);
}

/**
 * Clear type information for a specific file
 */
export function clear_file_exports(
  registry: ProjectTypeRegistry,
  file_path: string
): ProjectTypeRegistry {
  const exports = registry.file_exports.get(file_path);
  if (!exports) return registry;
  
  // Create new maps without the file's exports
  const new_exported_types = new Map(registry.exported_types);
  for (const symbol of exports) {
    new_exported_types.delete(symbol);
  }
  
  const new_file_exports = new Map(registry.file_exports);
  new_file_exports.delete(file_path);
  
  return {
    exported_types: new_exported_types,
    file_exports: new_file_exports
  };
}

// Helper functions for batch operations

/**
 * Apply multiple variable type updates at once
 */
export function set_variable_types(
  tracker: FileTypeTracker,
  updates: Array<{ var_name: string; type_info: TypeInfo }>
): FileTypeTracker {
  return updates.reduce(
    (acc, { var_name, type_info }) => set_variable_type(acc, var_name, type_info),
    tracker
  );
}

/**
 * Apply multiple imported class updates at once
 */
export function set_imported_classes(
  tracker: FileTypeTracker,
  updates: Array<{ local_name: string; class_info: ImportedClassInfo }>
): FileTypeTracker {
  return updates.reduce(
    (acc, { local_name, class_info }) => set_imported_class(acc, local_name, class_info),
    tracker
  );
}

/**
 * Mark multiple definitions as exported at once
 */
export function mark_as_exported_batch(
  tracker: FileTypeTracker,
  def_names: string[]
): FileTypeTracker {
  const new_exported_definitions = new Set(tracker.exported_definitions);
  for (const def_name of def_names) {
    new_exported_definitions.add(def_name);
  }
  
  return {
    ...tracker,
    exported_definitions: new_exported_definitions
  };
}

/**
 * Register multiple exports at once
 */
export function register_exports(
  registry: ProjectTypeRegistry,
  exports: Array<{
    file_path: string;
    export_name: string;
    type_info: ExportedTypeInfo;
  }>
): ProjectTypeRegistry {
  return exports.reduce(
    (acc, exp) => register_export(acc, exp.file_path, exp.export_name, exp.type_info),
    registry
  );
}

/**
 * Determine type kind from type name
 */
export function infer_type_kind(type_name: string, language: Language): TypeInfo['type_kind'] {
  // Primitive types
  const primitives = ['string', 'number', 'boolean', 'null', 'undefined', 'void', 'any', 'unknown'];
  if (primitives.includes(type_name.toLowerCase())) {
    return 'primitive';
  }
  
  // Array types
  if (type_name.includes('[]') || type_name.startsWith('Array<')) {
    return 'array';
  }
  
  // Function types
  if (type_name.includes('=>') || type_name.includes('Function')) {
    return 'function';
  }
  
  // Interface (TypeScript)
  if (language === 'typescript' && type_name.startsWith('I')) {
    // Convention: interfaces often start with I
    return 'interface';
  }
  
  // Object literals
  if (type_name.includes('{') || type_name === 'object') {
    return 'object';
  }
  
  // Assume class for capitalized names
  if (type_name[0] === type_name[0].toUpperCase()) {
    return 'class';
  }
  
  return 'unknown';
}

/**
 * Check if a type is assignable to another
 */
export function is_type_assignable(
  from_type: TypeInfo,
  to_type: TypeInfo,
  language: Language
): boolean {
  // Same type is always assignable
  if (from_type.type_name === to_type.type_name) {
    return true;
  }
  
  // Any type can be assigned to 'any' or 'unknown'
  if (to_type.type_name === 'any' || to_type.type_name === 'unknown') {
    return true;
  }
  
  // 'any' can be assigned to any type
  if (from_type.type_name === 'any') {
    return true;
  }
  
  // Language-specific rules
  if (language === 'typescript' || language === 'javascript') {
    // null/undefined can be assigned to any type (in JS)
    if (from_type.type_name === 'null' || from_type.type_name === 'undefined') {
      return true;
    }
  }
  
  // TODO: More sophisticated type compatibility checking
  // - Inheritance relationships
  // - Interface implementations
  // - Generic type parameters
  
  return false;
}
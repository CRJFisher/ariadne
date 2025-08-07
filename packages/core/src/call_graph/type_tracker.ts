import { Def } from '../graph';
import { normalize_module_path } from '../symbol_naming';
import { DeepReadonly, ImmutableMap, ImmutableSet } from './readonly_types';
import type { TypeInfo, ImportedClassInfo, ExportedTypeInfo } from '@ariadnejs/types';

// Re-export types for consumers
export type { TypeInfo, ImportedClassInfo, ExportedTypeInfo };

// SimpleRange type for position tracking
interface SimpleRange {
  start: { row: number; column: number };
  end: { row: number; column: number };
}

/**
 * File-level type tracking data structure (immutable)
 */
export interface FileTypeTrackerData {
  readonly variableTypes: ReadonlyMap<string, readonly TypeInfo[]>;
  readonly importedClasses: ReadonlyMap<string, ImportedClassInfo>;
  readonly exportedDefinitions: ReadonlySet<string>;
}

/**
 * Create a new file type tracker
 */
export function create_file_type_tracker(): FileTypeTrackerData {
  return {
    variableTypes: new Map(),
    importedClasses: new Map(),
    exportedDefinitions: new Set()
  };
}

/**
 * Set the type of a variable at a specific position (returns new tracker)
 */
export function set_variable_type(
  tracker: FileTypeTrackerData,
  varName: string,
  typeInfo: TypeInfo
): FileTypeTrackerData {
  // Get existing types or empty array
  const existingTypes = tracker.variableTypes.get(varName) || [];
  
  // Create new array with the new type
  const newTypes = [...existingTypes, typeInfo].sort((a, b) => {
    if (a.position.row !== b.position.row) {
      return a.position.row - b.position.row;
    }
    return a.position.column - b.position.column;
  });
  
  // Create new Map with the updated types
  const newVariableTypes = new Map(tracker.variableTypes);
  newVariableTypes.set(varName, newTypes);
  
  // Return new tracker instance
  return {
    ...tracker,
    variableTypes: newVariableTypes
  };
}

/**
 * Get the type of a variable at a specific position
 */
export function get_variable_type(
  tracker: FileTypeTrackerData,
  varName: string,
  position?: { row: number; column: number }
): TypeInfo | undefined {
  const types = tracker.variableTypes.get(varName);
  if (!types || types.length === 0) return undefined;
  
  // If no position specified, return the last type
  if (!position) {
    return types[types.length - 1];
  }
  
  // Find the type that was assigned before this position
  let lastType: TypeInfo | undefined = undefined;
  for (const typeInfo of types) {
    if (typeInfo.position.row > position.row || 
        (typeInfo.position.row === position.row && typeInfo.position.column > position.column)) {
      break;
    }
    lastType = typeInfo;
  }
  
  return lastType;
}

/**
 * Track an imported class (returns new tracker)
 */
export function set_imported_class(
  tracker: FileTypeTrackerData,
  localName: string,
  classInfo: ImportedClassInfo
): FileTypeTrackerData {
  const newImportedClasses = new Map(tracker.importedClasses);
  newImportedClasses.set(localName, classInfo);
  
  return {
    ...tracker,
    importedClasses: newImportedClasses
  };
}

/**
 * Get imported class information
 */
export function get_imported_class(
  tracker: FileTypeTrackerData,
  localName: string
): ImportedClassInfo | undefined {
  return tracker.importedClasses.get(localName);
}

/**
 * Mark a definition as exported (returns new tracker)
 */
export function mark_as_exported(
  tracker: FileTypeTrackerData,
  defName: string
): FileTypeTrackerData {
  const newExportedDefinitions = new Set(tracker.exportedDefinitions);
  newExportedDefinitions.add(defName);
  
  return {
    ...tracker,
    exportedDefinitions: newExportedDefinitions
  };
}

/**
 * Check if a definition is exported
 */
export function is_exported(
  tracker: FileTypeTrackerData,
  defName: string
): boolean {
  return tracker.exportedDefinitions.has(defName);
}

/**
 * Get all exported definitions
 */
export function get_exported_definitions(
  tracker: FileTypeTrackerData
): ReadonlySet<string> {
  return tracker.exportedDefinitions;
}

/**
 * Clear all type information (returns empty tracker)
 */
export function clear_file_type_tracker(
  tracker: FileTypeTrackerData
): FileTypeTrackerData {
  return create_file_type_tracker();
}

/**
 * Local type tracking with parent fallback (immutable)
 */
export interface LocalTypeTrackerData {
  readonly localTypes: ReadonlyMap<string, readonly TypeInfo[]>;
  readonly parent: FileTypeTrackerData;
}

/**
 * Create a local type tracker that inherits from a parent
 */
export function create_local_type_tracker(parent: FileTypeTrackerData): LocalTypeTrackerData {
  return {
    localTypes: new Map(),
    parent
  };
}

/**
 * Set variable type in local scope (returns new tracker)
 */
export function set_local_variable_type(
  tracker: LocalTypeTrackerData,
  varName: string,
  typeInfo: TypeInfo
): LocalTypeTrackerData {
  const existingTypes = tracker.localTypes.get(varName) || [];
  
  const newTypes = [...existingTypes, typeInfo].sort((a, b) => {
    if (a.position.row !== b.position.row) {
      return a.position.row - b.position.row;
    }
    return a.position.column - b.position.column;
  });
  
  const newLocalTypes = new Map(tracker.localTypes);
  newLocalTypes.set(varName, newTypes);
  
  return {
    ...tracker,
    localTypes: newLocalTypes
  };
}

/**
 * Get variable type from local scope with parent fallback
 */
export function get_local_variable_type(
  tracker: LocalTypeTrackerData,
  varName: string,
  position?: { row: number; column: number }
): TypeInfo | undefined {
  const localTypes = tracker.localTypes.get(varName);
  
  
  if (localTypes && localTypes.length > 0) {
    if (!position) {
      return localTypes[localTypes.length - 1];
    }
    
    let lastType: TypeInfo | undefined = undefined;
    for (const typeInfo of localTypes) {
      if (typeInfo.position.row > position.row || 
          (typeInfo.position.row === position.row && typeInfo.position.column > position.column)) {
        break;
      }
      lastType = typeInfo;
    }
    
    if (lastType) return lastType;
  }
  
  // Check parent
  return get_variable_type(tracker.parent, varName, position);
}

/**
 * Get imported class from parent
 */
export function get_local_imported_class(
  tracker: LocalTypeTrackerData,
  localName: string
): ImportedClassInfo | undefined {
  return get_imported_class(tracker.parent, localName);
}

/**
 * Project-wide type registry data (immutable)
 */
export interface ProjectTypeRegistryData {
  readonly exportedTypes: ReadonlyMap<string, ExportedTypeInfo>;
  readonly fileExports: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * Create a new project type registry
 */
export function create_project_type_registry(): ProjectTypeRegistryData {
  return {
    exportedTypes: new Map(),
    fileExports: new Map()
  };
}

/**
 * Register an exported type from a file (returns new registry)
 */
export function register_export(
  registry: ProjectTypeRegistryData,
  file_path: string,
  exportName: string,
  className: string,
  classDef: Def & { enclosing_range?: SimpleRange }
): ProjectTypeRegistryData {
  const symbol = `${normalize_module_path(file_path)}#${exportName}`;
  
  // Update exported types
  const newExportedTypes = new Map(registry.exportedTypes);
  newExportedTypes.set(symbol, {
    className,
    classDef,
    sourceFile: file_path
  });
  
  // Update file exports
  const currentFileExports = registry.fileExports.get(file_path) || new Set();
  const newFileExportSet = new Set(currentFileExports);
  newFileExportSet.add(symbol);
  
  const newFileExports = new Map(registry.fileExports);
  newFileExports.set(file_path, newFileExportSet);
  
  return {
    exportedTypes: newExportedTypes,
    fileExports: newFileExports
  };
}

/**
 * Get type information for an imported symbol
 */
export function get_imported_type(
  registry: ProjectTypeRegistryData,
  importedFrom: string,
  importName: string
): ExportedTypeInfo | undefined {
  const symbol = `${normalize_module_path(importedFrom)}#${importName}`;
  return registry.exportedTypes.get(symbol);
}

/**
 * Clear type information for a specific file (returns new registry)
 */
export function clear_file_exports(
  registry: ProjectTypeRegistryData,
  file_path: string
): ProjectTypeRegistryData {
  const exports = registry.fileExports.get(file_path);
  if (!exports) return registry;
  
  // Create new maps without the file's exports
  const newExportedTypes = new Map(registry.exportedTypes);
  for (const symbol of exports) {
    newExportedTypes.delete(symbol);
  }
  
  const newFileExports = new Map(registry.fileExports);
  newFileExports.delete(file_path);
  
  return {
    exportedTypes: newExportedTypes,
    fileExports: newFileExports
  };
}

// Helper functions for common update patterns

/**
 * Apply multiple variable type updates at once
 */
export function set_variable_types(
  tracker: FileTypeTrackerData,
  updates: Array<{ varName: string; typeInfo: TypeInfo }>
): FileTypeTrackerData {
  return updates.reduce(
    (acc, { varName, typeInfo }) => set_variable_type(acc, varName, typeInfo),
    tracker
  );
}

/**
 * Apply multiple imported class updates at once
 */
export function set_imported_classes(
  tracker: FileTypeTrackerData,
  updates: Array<{ localName: string; classInfo: ImportedClassInfo }>
): FileTypeTrackerData {
  return updates.reduce(
    (acc, { localName, classInfo }) => set_imported_class(acc, localName, classInfo),
    tracker
  );
}

/**
 * Mark multiple definitions as exported at once
 */
export function mark_as_exported_batch(
  tracker: FileTypeTrackerData,
  defNames: string[]
): FileTypeTrackerData {
  const newExportedDefinitions = new Set(tracker.exportedDefinitions);
  for (const defName of defNames) {
    newExportedDefinitions.add(defName);
  }
  
  return {
    ...tracker,
    exportedDefinitions: newExportedDefinitions
  };
}

/**
 * Register multiple exports at once
 */
export function register_exports(
  registry: ProjectTypeRegistryData,
  exports: Array<{
    file_path: string;
    exportName: string;
    className: string;
    classDef: Def & { enclosing_range?: SimpleRange };
  }>
): ProjectTypeRegistryData {
  return exports.reduce(
    (acc, exp) => register_export(acc, exp.file_path, exp.exportName, exp.className, exp.classDef),
    registry
  );
}
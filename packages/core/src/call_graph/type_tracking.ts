/**
 * Type tracking module that provides backward compatibility for mutable operations
 * by wrapping the immutable implementation.
 * 
 * This module re-exports all types and provides wrapper functions that maintain
 * the mutable API while using the immutable implementation internally.
 */

import * as Immutable from './immutable_type_tracking';

// Re-export types with mutable interfaces for backward compatibility
export type FileTypeTrackerData = {
  variableTypes: Map<string, Immutable.TypeInfo[]>;
  importedClasses: Map<string, Immutable.ImportedClassInfo>;
  exportedDefinitions: Set<string>;
  // Internal reference to immutable data
  _immutable: Immutable.FileTypeTrackerData;
};

// Re-export other types
export type { TypeInfo, ImportedClassInfo, ExportedTypeInfo } from './types';

/**
 * Create a new file type tracker with mutable wrapper
 */
export function create_file_type_tracker(): FileTypeTrackerData {
  const immutable = Immutable.create_file_type_tracker();
  return {
    variableTypes: new Map(
      Array.from(immutable.variableTypes.entries()).map(([k, v]) => [k, [...v]])
    ),
    importedClasses: new Map(immutable.importedClasses),
    exportedDefinitions: new Set(immutable.exportedDefinitions),
    _immutable: immutable
  };
}

/**
 * Set the type of a variable at a specific position (mutates tracker)
 */
export function set_variable_type(
  tracker: FileTypeTrackerData,
  varName: string,
  typeInfo: Immutable.TypeInfo
): void {
  // Update immutable data
  tracker._immutable = Immutable.set_variable_type(tracker._immutable, varName, typeInfo);
  
  // Update mutable references
  tracker.variableTypes = new Map(
    Array.from(tracker._immutable.variableTypes.entries()).map(([k, v]) => [k, [...v]])
  );
}

/**
 * Get the type of a variable at a specific position
 */
export function get_variable_type(
  tracker: FileTypeTrackerData,
  varName: string,
  position?: { row: number; column: number }
): Immutable.TypeInfo | undefined {
  return Immutable.get_variable_type(tracker._immutable, varName, position);
}

/**
 * Track an imported class (mutates tracker)
 */
export function set_imported_class(
  tracker: FileTypeTrackerData,
  localName: string,
  classInfo: Immutable.ImportedClassInfo
): void {
  // Update immutable data
  tracker._immutable = Immutable.set_imported_class(tracker._immutable, localName, classInfo);
  
  // Update mutable references
  tracker.importedClasses = new Map(tracker._immutable.importedClasses);
}

/**
 * Get imported class information
 */
export function get_imported_class(
  tracker: FileTypeTrackerData,
  localName: string
): Immutable.ImportedClassInfo | undefined {
  return Immutable.get_imported_class(tracker._immutable, localName);
}

/**
 * Mark a definition as exported (mutates tracker)
 */
export function mark_as_exported(
  tracker: FileTypeTrackerData,
  defName: string
): void {
  // Update immutable data
  tracker._immutable = Immutable.mark_as_exported(tracker._immutable, defName);
  
  // Update mutable references
  tracker.exportedDefinitions = new Set(tracker._immutable.exportedDefinitions);
}

/**
 * Check if a definition is exported
 */
export function is_exported(
  tracker: FileTypeTrackerData,
  defName: string
): boolean {
  return Immutable.is_exported(tracker._immutable, defName);
}

/**
 * Get all exported definitions
 */
export function get_exported_definitions(
  tracker: FileTypeTrackerData
): Set<string> {
  // Return mutable copy for backward compatibility
  return new Set(tracker._immutable.exportedDefinitions);
}

/**
 * Clear all type information for this file (mutates tracker)
 */
export function clear_file_type_tracker(
  tracker: FileTypeTrackerData
): void {
  // Update immutable data
  tracker._immutable = Immutable.clear_file_type_tracker(tracker._immutable);
  
  // Update mutable references
  tracker.variableTypes = new Map(
    Array.from(tracker._immutable.variableTypes.entries()).map(([k, v]) => [k, [...v]])
  );
  tracker.importedClasses = new Map(tracker._immutable.importedClasses);
  tracker.exportedDefinitions = new Set(tracker._immutable.exportedDefinitions);
}

/**
 * Local type tracking with parent fallback (mutable wrapper)
 */
export type LocalTypeTrackerData = {
  localTypes: Map<string, Immutable.TypeInfo[]>;
  parent: FileTypeTrackerData;
  // Internal reference to immutable data
  _immutable: Immutable.LocalTypeTrackerData;
};

/**
 * Create a local type tracker that inherits from a parent
 */
export function create_local_type_tracker(parent: FileTypeTrackerData): LocalTypeTrackerData {
  const immutable = Immutable.create_local_type_tracker(parent._immutable);
  return {
    localTypes: new Map(
      Array.from(immutable.localTypes.entries()).map(([k, v]) => [k, [...v]])
    ),
    parent,
    _immutable: immutable
  };
}

/**
 * Set variable type in local scope (mutates tracker)
 */
export function set_local_variable_type(
  tracker: LocalTypeTrackerData,
  varName: string,
  typeInfo: Immutable.TypeInfo
): void {
  // Update immutable data
  tracker._immutable = Immutable.set_local_variable_type(tracker._immutable, varName, typeInfo);
  
  // Update mutable references
  tracker.localTypes = new Map(
    Array.from(tracker._immutable.localTypes.entries()).map(([k, v]) => [k, [...v]])
  );
}

/**
 * Get variable type from local scope with parent fallback
 */
export function get_local_variable_type(
  tracker: LocalTypeTrackerData,
  varName: string,
  position?: { row: number; column: number }
): Immutable.TypeInfo | undefined {
  return Immutable.get_local_variable_type(tracker._immutable, varName, position);
}

/**
 * Get imported class from parent (imported classes are always file-level)
 */
export function get_local_imported_class(
  tracker: LocalTypeTrackerData,
  localName: string
): Immutable.ImportedClassInfo | undefined {
  return Immutable.get_local_imported_class(tracker._immutable, localName);
}

/**
 * Project-wide type registry data (mutable wrapper)
 */
export type ProjectTypeRegistryData = {
  exportedTypes: Map<string, Immutable.ExportedTypeInfo>;
  fileExports: Map<string, Set<string>>;
  // Internal reference to immutable data
  _immutable: Immutable.ProjectTypeRegistryData;
};

// Re-export SimpleRange type if needed
import { Def } from '../graph';

/**
 * Create a new project type registry
 */
export function create_project_type_registry(): ProjectTypeRegistryData {
  const immutable = Immutable.create_project_type_registry();
  return {
    exportedTypes: new Map(immutable.exportedTypes),
    fileExports: new Map(
      Array.from(immutable.fileExports.entries()).map(([k, v]) => [k, new Set(v)])
    ),
    _immutable: immutable
  };
}

/**
 * Register an exported type from a file (mutates registry)
 */
export function register_export(
  registry: ProjectTypeRegistryData,
  file_path: string,
  exportName: string,
  className: string,
  classDef: Def & { enclosing_range?: any }
): void {
  // Update immutable data
  registry._immutable = Immutable.register_export(
    registry._immutable,
    file_path,
    exportName,
    className,
    classDef
  );
  
  // Update mutable references
  registry.exportedTypes = new Map(registry._immutable.exportedTypes);
  registry.fileExports = new Map(
    Array.from(registry._immutable.fileExports.entries()).map(([k, v]) => [k, new Set(v)])
  );
}

/**
 * Get type information for an imported symbol
 */
export function get_imported_type(
  registry: ProjectTypeRegistryData,
  importedFrom: string,
  importName: string
): Immutable.ExportedTypeInfo | undefined {
  return Immutable.get_imported_type(registry._immutable, importedFrom, importName);
}

/**
 * Clear type information for a specific file (mutates registry)
 */
export function clear_file_exports(
  registry: ProjectTypeRegistryData,
  file_path: string
): void {
  // Update immutable data
  registry._immutable = Immutable.clear_file_exports(registry._immutable, file_path);
  
  // Update mutable references
  registry.exportedTypes = new Map(registry._immutable.exportedTypes);
  registry.fileExports = new Map(
    Array.from(registry._immutable.fileExports.entries()).map(([k, v]) => [k, new Set(v)])
  );
}
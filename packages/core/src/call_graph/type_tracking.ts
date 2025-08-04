import { Def } from '../graph';
import { normalize_module_path } from '../symbol_naming';
import { TypeInfo, ImportedClassInfo, ExportedTypeInfo } from './types';

/**
 * File-level type tracking data structure
 */
export interface FileTypeTrackerData {
  variableTypes: Map<string, TypeInfo[]>;
  importedClasses: Map<string, ImportedClassInfo>;
  exportedDefinitions: Set<string>;
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
 * Set the type of a variable at a specific position
 */
export function set_variable_type(
  tracker: FileTypeTrackerData,
  varName: string,
  typeInfo: TypeInfo
): void {
  const types = tracker.variableTypes.get(varName) || [];
  types.push(typeInfo);
  
  // Sort by position (row, then column) so we can find the right type for a given position
  types.sort((a, b) => {
    if (a.position.row !== b.position.row) {
      return a.position.row - b.position.row;
    }
    return a.position.column - b.position.column;
  });
  
  tracker.variableTypes.set(varName, types);
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
  
  // If no position specified, return the last type (backward compatibility)
  if (!position) {
    return types[types.length - 1];
  }
  
  // Find the type that was assigned before this position
  let lastType: TypeInfo | undefined = undefined;
  for (const typeInfo of types) {
    // If this assignment is after the position we're checking, stop
    if (typeInfo.position.row > position.row || 
        (typeInfo.position.row === position.row && typeInfo.position.column > position.column)) {
      break;
    }
    lastType = typeInfo;
  }
  
  return lastType;
}

/**
 * Track an imported class
 */
export function set_imported_class(
  tracker: FileTypeTrackerData,
  localName: string,
  classInfo: ImportedClassInfo
): void {
  tracker.importedClasses.set(localName, classInfo);
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
 * Mark a definition as exported
 */
export function mark_as_exported(
  tracker: FileTypeTrackerData,
  defName: string
): void {
  tracker.exportedDefinitions.add(defName);
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
): Set<string> {
  return tracker.exportedDefinitions;
}

/**
 * Clear all type information for this file
 */
export function clear_file_type_tracker(
  tracker: FileTypeTrackerData
): void {
  tracker.variableTypes.clear();
  tracker.importedClasses.clear();
  tracker.exportedDefinitions.clear();
}

/**
 * Local type tracking with parent fallback
 */
export interface LocalTypeTrackerData {
  localTypes: Map<string, TypeInfo[]>;
  parent: FileTypeTrackerData;
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
 * Set variable type in local scope
 */
export function set_local_variable_type(
  tracker: LocalTypeTrackerData,
  varName: string,
  typeInfo: TypeInfo
): void {
  const types = tracker.localTypes.get(varName) || [];
  types.push(typeInfo);
  
  // Sort by position
  types.sort((a, b) => {
    if (a.position.row !== b.position.row) {
      return a.position.row - b.position.row;
    }
    return a.position.column - b.position.column;
  });
  
  tracker.localTypes.set(varName, types);
}

/**
 * Get variable type from local scope with parent fallback
 */
export function get_local_variable_type(
  tracker: LocalTypeTrackerData,
  varName: string,
  position?: { row: number; column: number }
): TypeInfo | undefined {
  // First check local types
  const localTypes = tracker.localTypes.get(varName);
  if (localTypes && localTypes.length > 0) {
    if (!position) {
      return localTypes[localTypes.length - 1];
    }
    
    // Find the type that was assigned before this position
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
  
  // Then check parent
  return get_variable_type(tracker.parent, varName, position);
}

/**
 * Get imported class from parent (imported classes are always file-level)
 */
export function get_local_imported_class(
  tracker: LocalTypeTrackerData,
  localName: string
): ImportedClassInfo | undefined {
  return get_imported_class(tracker.parent, localName);
}

/**
 * Project-wide type registry data
 */
export interface ProjectTypeRegistryData {
  exportedTypes: Map<string, ExportedTypeInfo>;
  fileExports: Map<string, Set<string>>;
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
 * Register an exported type from a file
 */
export function register_export(
  registry: ProjectTypeRegistryData,
  file_path: string,
  exportName: string,
  className: string,
  classDef: Def & { enclosing_range?: SimpleRange }
): void {
  const symbol = `${normalize_module_path(file_path)}#${exportName}`;
  
  registry.exportedTypes.set(symbol, {
    className,
    classDef,
    sourceFile: file_path
  });
  
  // Track which file exports this symbol
  if (!registry.fileExports.has(file_path)) {
    registry.fileExports.set(file_path, new Set());
  }
  registry.fileExports.get(file_path)!.add(symbol);
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
 * Clear type information for a specific file (when file is updated)
 */
export function clear_file_exports(
  registry: ProjectTypeRegistryData,
  file_path: string
): void {
  const exports = registry.fileExports.get(file_path);
  if (exports) {
    for (const symbol of exports) {
      registry.exportedTypes.delete(symbol);
    }
    registry.fileExports.delete(file_path);
  }
}
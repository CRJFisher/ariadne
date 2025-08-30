/**
 * Import Type Resolver
 * 
 * Resolves type references using ImportInfo[] from the import_resolution layer.
 * This eliminates duplicate import extraction and ensures consistent import handling.
 */

import { ImportInfo, Language } from '@ariadnejs/types';
import { ImportedClassInfo } from './type_tracking';

/**
 * Resolve a type identifier from imports
 * 
 * @param identifier The type identifier to resolve (e.g., "User", "React.Component")
 * @param imports The ImportInfo[] from import_resolution layer
 * @returns The resolved type info or undefined if not imported
 */
export function resolve_type_from_imports(
  identifier: string,
  imports: ImportInfo[]
): ImportedClassInfo | undefined {
  if (!imports || imports.length === 0) {
    return undefined;
  }

  // Handle namespace member access (e.g., "React.Component")
  const [namespace, member] = identifier.includes('.') 
    ? identifier.split('.', 2)
    : [identifier, undefined];

  // First check for direct matches (named or default imports)
  for (const importInfo of imports) {
    // Check if identifier matches the imported name or alias
    if (importInfo.alias === identifier || importInfo.name === identifier) {
      return {
        class_name: importInfo.name,
        source_module: importInfo.source,
        local_name: importInfo.alias || importInfo.name,
        is_default: importInfo.kind === 'default',
        is_type_only: importInfo.is_type_only
      };
    }

    // Handle namespace imports (e.g., import * as React from 'react')
    if (importInfo.kind === 'namespace' && importInfo.namespace_name === namespace && member) {
      return {
        class_name: member,
        source_module: importInfo.source,
        local_name: identifier, // Full "React.Component"
        is_default: false,
        is_type_only: importInfo.is_type_only
      };
    }
  }

  return undefined;
}

/**
 * Convert ImportInfo[] to a map of imported types for faster lookups
 * 
 * @param imports The ImportInfo[] from import_resolution layer
 * @returns Map of local name to ImportedClassInfo
 */
export function build_import_type_map(
  imports: ImportInfo[]
): Map<string, ImportedClassInfo> {
  const typeMap = new Map<string, ImportedClassInfo>();

  for (const importInfo of imports) {
    const localName = importInfo.alias || importInfo.name;
    
    // Add direct import
    typeMap.set(localName, {
      class_name: importInfo.name,
      source_module: importInfo.source,
      local_name: localName,
      is_default: importInfo.kind === 'default',
      is_type_only: importInfo.is_type_only
    });

    // For namespace imports, we can't pre-populate all members
    // They need to be resolved on-demand
    if (importInfo.kind === 'namespace' && importInfo.namespace_name) {
      // Mark the namespace itself
      typeMap.set(importInfo.namespace_name, {
        class_name: '*',
        source_module: importInfo.source,
        local_name: importInfo.namespace_name,
        is_default: false,
        is_type_only: importInfo.is_type_only
      });
    }
  }

  return typeMap;
}

/**
 * Check if a type is imported (including namespace members)
 * 
 * @param typeName The type name to check
 * @param imports The ImportInfo[] from import_resolution layer
 * @returns Whether the type is imported
 */
export function is_imported_type(
  typeName: string,
  imports: ImportInfo[]
): boolean {
  return resolve_type_from_imports(typeName, imports) !== undefined;
}

/**
 * Get the fully qualified type name from an import
 * 
 * @param localName The local name used in the code
 * @param imports The ImportInfo[] from import_resolution layer
 * @returns The fully qualified type name (e.g., "module#ClassName")
 */
export function get_qualified_type_name(
  localName: string,
  imports: ImportInfo[]
): string {
  const importedType = resolve_type_from_imports(localName, imports);
  
  if (importedType) {
    // Return qualified name: module#class
    return `${importedType.source_module}#${importedType.class_name}`;
  }
  
  // Not imported, return as-is (local type)
  return localName;
}

/**
 * Filter imports to only include type-relevant imports
 * (classes, interfaces, types, but not regular functions or values)
 * 
 * @param imports All imports from import_resolution
 * @param language The programming language
 * @returns Filtered imports likely to be types
 */
export function filter_type_imports(
  imports: ImportInfo[],
  language: Language
): ImportInfo[] {
  return imports.filter(importInfo => {
    // TypeScript type-only imports are definitely types
    if (importInfo.is_type_only) {
      return true;
    }

    // In TypeScript/JavaScript, uppercase names are conventionally classes/types
    if (language === 'typescript' || language === 'javascript') {
      const name = importInfo.name;
      return name && name[0] === name[0].toUpperCase();
    }

    // In Python, we'd need more context to determine if it's a type
    // For now, include all imports
    if (language === 'python') {
      return true;
    }

    // In Rust, types are usually uppercase
    if (language === 'rust') {
      const name = importInfo.name;
      return name && name[0] === name[0].toUpperCase();
    }

    return true;
  });
}

/**
 * Merge imported types into the FileTypeTracker
 * 
 * @param tracker The current type tracker
 * @param imports The ImportInfo[] from import_resolution layer
 * @returns Updated tracker with imported types
 */
export function merge_imported_types(
  tracker: { imported_classes: Map<string, ImportedClassInfo> },
  imports: ImportInfo[]
): void {
  const importTypeMap = build_import_type_map(imports);
  
  // Merge into existing imported_classes map
  for (const [localName, importInfo] of importTypeMap) {
    tracker.imported_classes.set(localName, importInfo);
  }
}
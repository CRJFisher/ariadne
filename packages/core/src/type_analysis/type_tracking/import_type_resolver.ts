/**
 * Import Type Resolver
 * 
 * Resolves type references using ImportInfo[] from the import_resolution layer.
 * This eliminates duplicate import extraction and ensures consistent import handling.
 */

import { ImportInfo } from '@ariadnejs/types';
import { ImportedClassInfo } from './type_tracking';


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
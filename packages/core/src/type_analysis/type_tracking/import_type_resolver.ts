/**
 * Import Type Resolver
 * 
 * Resolves type references using ImportInfo[] from the import_resolution layer.
 * This eliminates duplicate import extraction and ensures consistent import handling.
 */

import { ImportInfo } from '@ariadnejs/types';


/**
 * Convert ImportInfo[] to a map of imported types for faster lookups
 * 
 * @param imports The ImportInfo[] from import_resolution layer
 * @returns Map of local name to any
 */
export function build_import_type_map(
  imports: ImportInfo[]
): Map<string, any> {
  const type_map = new Map<string, any>();

  for (const import_info of imports) {
    const local_name = import_info.alias || import_info.name;
    
    // Add direct import
    type_map.set(local_name, {
      class_name: import_info.name,
      source_module: import_info.source,
      local_name: local_name,
      is_default: import_info.kind === 'default',
      is_type_only: import_info.is_type_only
    });

    // For namespace imports, we can't pre-populate all members
    // They need to be resolved on-demand
    if (import_info.kind === 'namespace' && import_info.namespace_name) {
      // Mark the namespace itself
      type_map.set(import_info.namespace_name, {
        class_name: '*',
        source_module: import_info.source,
        local_name: import_info.namespace_name,
        is_default: false,
        is_type_only: import_info.is_type_only
      });
    }
  }

  return type_map;
}

/**
 * Merge imported types into the FileTypeTracker
 * 
 * @param tracker The current type tracker
 * @param imports The ImportInfo[] from import_resolution layer
 * @returns Updated tracker with imported types
 */
export function merge_imported_types(
  tracker: { imported_classes: Map<string, any> },
  imports: ImportInfo[]
): void {
  const import_type_map = build_import_type_map(imports);
  
  // Merge into existing imported_classes map
  for (const [local_name, import_info] of import_type_map) {
    tracker.imported_classes.set(local_name, import_info);
  }
}
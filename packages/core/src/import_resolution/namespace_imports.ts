/**
 * Namespace Import Common Logic
 * 
 * Shared processing logic for namespace imports across all languages.
 * This handles the common patterns that most languages share.
 */

import type { Def, Import, Ref, ScopeGraph } from '../graph';

// Language metadata that flows through all functions
export interface LanguageMetadata {
  language: 'javascript' | 'typescript' | 'python' | 'rust';
  file_path: string;
}

// Resolution configuration
export interface NamespaceResolutionConfig {
  get_file_graph?: (file_path: string) => ScopeGraph | undefined;
  get_imports_with_definitions: (file_path: string) => Array<{
    local_name: string;
    import_statement: Import;
    imported_function: Def;
  }>;
  debug?: boolean;
}

// Namespace export result type
export type NamespaceExport = 
  | Def 
  | { is_namespace_reexport: true; target_module: string };

/**
 * Check if an import is a namespace import (common pattern)
 */
export function is_common_namespace_import(
  imp: Import,
  metadata: LanguageMetadata
): boolean {
  // Most languages use * to indicate namespace import
  return imp.source_name === '*';
}

/**
 * Common namespace export resolution
 */
export function resolve_common_namespace_exports(
  target_file: string,
  config: NamespaceResolutionConfig,
  metadata: LanguageMetadata
): Map<string, NamespaceExport> {
  const exports = new Map<string, NamespaceExport>();
  
  // Get the scope graph for the target file
  const target_graph = config.get_file_graph?.(target_file);
  if (!target_graph) {
    if (config.debug) {
      console.log(`No graph found for ${target_file}`);
    }
    return exports;
  }
  
  // Collect all exported definitions
  const defs = target_graph.getNodes('definition') as Def[];
  for (const def of defs) {
    if (def.is_exported === true) {
      exports.set(def.name, def);
    }
  }
  
  // Find re-exported namespaces
  find_reexported_namespaces(target_graph, exports, metadata);
  
  return exports;
}

/**
 * Find re-exported namespaces in the target file
 */
function find_reexported_namespaces(
  target_graph: ScopeGraph,
  exports: Map<string, NamespaceExport>,
  metadata: LanguageMetadata
): void {
  const imports = target_graph.getAllImports();
  const refs = target_graph.getNodes('reference') as Ref[];
  
  for (const imp of imports) {
    if (is_common_namespace_import(imp, metadata)) {
      // Check if this namespace is re-exported
      const export_ref = refs.find(ref => 
        ref.name === imp.name &&
        is_in_export_context(ref, target_graph)
      );
      
      if (export_ref) {
        exports.set(imp.name, {
          is_namespace_reexport: true,
          target_module: imp.imported_from
        });
      }
    }
  }
}

/**
 * Check if a reference is in an export context
 */
function is_in_export_context(ref: Ref, graph: ScopeGraph): boolean {
  // This is a simplified check - would need more sophisticated AST analysis
  // For now, check if the reference is at module scope
  return ref.scope_id === 0; // Module scope
}

/**
 * Common namespace member resolution
 */
export function resolve_common_namespace_member(
  namespace_name: string,
  member_ref: Ref,
  context_def: Def,
  config: NamespaceResolutionConfig,
  metadata: LanguageMetadata
): Def | undefined {
  // Find the namespace import in the current file
  const imports = config.get_imports_with_definitions(context_def.file_path);
  const namespace_import = imports.find(i => 
    i.local_name === namespace_name && 
    is_common_namespace_import(i.import_statement, metadata)
  );
  
  if (!namespace_import) {
    if (config.debug) {
      console.log(`No namespace import found for ${namespace_name}`);
    }
    return undefined;
  }
  
  // Get exports from the target module
  const target_file = namespace_import.import_statement.imported_from;
  const exports = resolve_common_namespace_exports(
    target_file,
    config,
    { ...metadata, file_path: target_file }
  );
  
  // Find the member in exports
  const member_name = member_ref.name;
  const export_def = exports.get(member_name);
  
  if (export_def && 'name' in export_def) {
    return export_def;
  }
  
  // Handle re-exported namespace
  if (export_def && 'is_namespace_reexport' in export_def) {
    // Recursively resolve from the re-exported module
    return resolve_common_namespace_member(
      namespace_name,
      member_ref,
      context_def,
      config,
      { ...metadata, file_path: export_def.target_module }
    );
  }
  
  return undefined;
}

/**
 * Common nested namespace resolution
 */
export function resolve_common_nested_namespace(
  namespace_path: string[],
  member_ref: Ref,
  context_def: Def,
  config: NamespaceResolutionConfig,
  metadata: LanguageMetadata
): Def | undefined {
  if (namespace_path.length === 0) {
    return undefined;
  }
  
  // Start with the root namespace
  let current_def = resolve_common_namespace_member(
    namespace_path[0],
    { ...member_ref, name: namespace_path[1] || member_ref.name },
    context_def,
    config,
    metadata
  );
  
  // Navigate through nested namespaces
  for (let i = 2; i < namespace_path.length && current_def; i++) {
    const next_name = namespace_path[i];
    current_def = resolve_common_namespace_member(
      namespace_path[i - 1],
      { ...member_ref, name: next_name },
      current_def,
      config,
      metadata
    );
  }
  
  // Finally resolve the actual member
  if (current_def && namespace_path.length > 1) {
    return resolve_common_namespace_member(
      namespace_path[namespace_path.length - 1],
      member_ref,
      current_def,
      config,
      metadata
    );
  }
  
  return current_def;
}
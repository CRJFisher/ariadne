/**
 * Namespace import helper functions
 * 
 * Provides utilities for detecting and resolving namespace member access.
 * Used by type resolution and symbol resolution to handle patterns like:
 * - JavaScript/TypeScript: `utils.helper()` from `import * as utils`
 * - Python: `os.path.join()` from `import os`
 * - Rust: items from `use module::*`
 */

import { ModuleGraph, ExportedSymbol } from '@ariadnejs/types';

// Local interface for backward compatibility
interface ImportInfo {
  name: string;
  source: string;
  alias?: string;
  kind?: string;
  location?: any;
  is_type_only?: boolean;
  namespace_name?: string;
}

/**
 * Check if an identifier is a namespace member access
 * 
 * Detects patterns like:
 * - `namespace.member`
 * - `namespace.nested.member`
 * 
 * @example
 * ```typescript
 * is_namespace_access('utils.helper', imports)
 * // Returns: { is_namespace: true, namespace_name: 'utils', member_name: 'helper' }
 * ```
 */
export function is_namespace_access(
  identifier: string,
  imports: ImportInfo[]
): {
  is_namespace: boolean;
  namespace_name?: string;
  member_name?: string;
  remaining_path?: string[];
} {
  // Check if identifier contains a dot
  if (!identifier.includes('.')) {
    return { is_namespace: false };
  }
  
  const parts = identifier.split('.');
  const potential_namespace = parts[0];
  
  // Check if the first part matches any namespace import
  const namespace_import = imports.find(imp => 
    (imp.kind === 'namespace' && imp.name === potential_namespace) ||
    // In Python, regular module imports are also namespaces
    (imp.name === potential_namespace && !imp.source.includes('/'))
  );
  
  if (namespace_import) {
    return {
      is_namespace: true,
      namespace_name: potential_namespace,
      member_name: parts[1],
      remaining_path: parts.slice(2)
    };
  }
  
  return { is_namespace: false };
}

/**
 * Resolve a namespace member to its source module and export
 * 
 * Given a namespace and member name, finds the actual export in the source module.
 * 
 * @example
 * ```typescript
 * // With import * as utils from './utils'
 * resolve_namespace_member('utils', 'helper', imports, module_graph)
 * // Returns: { source_module: './utils', export_name: 'helper' }
 * ```
 */
export function resolve_namespace_member(
  namespace_name: string,
  member_name: string,
  imports: ImportInfo[],
  module_graph?: ModuleGraph
): {
  source_module: string;
  export_name: string;
  is_reexport?: boolean;
} | undefined {
  // Find the namespace import
  const namespace_import = imports.find(imp => 
    imp.name === namespace_name && 
    (imp.kind === 'namespace' || 
     // Python treats module imports as namespaces
     !imp.source.includes('/'))
  );
  
  if (!namespace_import) {
    return undefined;
  }
  
  // If we have a module graph, verify the export exists
  if (module_graph) {
    const module_node = module_graph.modules.get(namespace_import.source);
    if (module_node) {
      const exported_symbol = module_node.exports.get(member_name);
      if (exported_symbol) {
        return {
          source_module: namespace_import.source,
          export_name: member_name,
          is_reexport: exported_symbol.is_reexport
        };
      }
    }
  }
  
  // Without module graph, assume the member exists
  return {
    source_module: namespace_import.source,
    export_name: member_name
  };
}

/**
 * Get all namespace imports from a list of imports
 * 
 * Filters imports to only return namespace bindings.
 */
export function get_namespace_imports(imports: ImportInfo[]): ImportInfo[] {
  return imports.filter(imp => 
    imp.kind === 'namespace' || 
    // Python module imports without specific members
    (imp.kind === 'named' && !imp.source.includes('/') && !imp.alias)
  );
}

/**
 * Check if a name is a namespace binding
 * 
 * Returns true if the name was imported as a namespace.
 */
export function is_namespace_binding(
  name: string,
  imports: ImportInfo[]
): boolean {
  return imports.some(imp => 
    imp.name === name && 
    (imp.kind === 'namespace' || 
     // Python treats module imports as potential namespaces
     (!imp.source.includes('/') && !imp.alias))
  );
}

/**
 * Resolve nested namespace access
 * 
 * Handles patterns like `a.b.c.d` where multiple levels might be namespaces.
 * 
 * @example
 * ```typescript
 * // With import os (Python)
 * resolve_nested_namespace('os.path.join', imports)
 * // Returns: { 
 * //   namespace_chain: ['os', 'path'], 
 * //   final_member: 'join',
 * //   source_module: 'os'
 * // }
 * ```
 */
export function resolve_nested_namespace(
  identifier: string,
  imports: ImportInfo[],
  module_graph?: ModuleGraph
): {
  namespace_chain: string[];
  final_member: string;
  source_module?: string;
} | undefined {
  const parts = identifier.split('.');
  if (parts.length < 2) {
    return undefined;
  }
  
  // Check if first part is a namespace
  const first_namespace = imports.find(imp => 
    imp.name === parts[0] && 
    (imp.kind === 'namespace' || !imp.source.includes('/'))
  );
  
  if (!first_namespace) {
    return undefined;
  }
  
  // For now, assume all but the last part are namespace segments
  return {
    namespace_chain: parts.slice(0, -1),
    final_member: parts[parts.length - 1],
    source_module: first_namespace.source
  };
}

/**
 * Convert a namespace wildcard import to individual named imports
 * 
 * When we have `import * as ns from 'module'` and the module graph,
 * we can expand this to know all available members.
 */
export function expand_namespace_import(
  namespace_import: ImportInfo,
  module_graph: ModuleGraph
): ImportInfo[] {
  if (namespace_import.kind !== 'namespace') {
    return [namespace_import];
  }
  
  const module_node = module_graph.modules.get(namespace_import.source);
  if (!module_node) {
    return [namespace_import];
  }
  
  const expanded: ImportInfo[] = [];
  
  // Create a named import for each export
  for (const [export_name, exported_symbol] of module_node.exports) {
    expanded.push({
      name: `${namespace_import.name}.${export_name}`,
      source: namespace_import.source,
      kind: 'named',
      location: namespace_import.location,
      // Preserve the namespace context
      namespace_name: namespace_import.name
    });
  }
  
  return expanded.length > 0 ? expanded : [namespace_import];
}
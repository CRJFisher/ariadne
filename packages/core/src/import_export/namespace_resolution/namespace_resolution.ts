/**
 * Common namespace resolution logic
 * 
 * Provides functionality for resolving namespace imports and their members
 * across different programming languages.
 * 
 * Migrated from: src_old/import_resolution/namespace_imports.ts
 */

// TODO: Integration with import_resolution
// - Namespace imports are handled by import resolver
// - Need to mark imports as namespace type

// TODO: Integration with export_detection  
// - Enumerate exports from target module
// - Handle re-exported namespaces

// TODO: Integration with symbol_resolution
// - Qualified name resolution (ns.member.submember)
// - Scope-aware member lookup

import { Def, Import, Ref, ScopeGraph, Language } from '@ariadnejs/types';

/**
 * Resolution configuration for namespace imports
 */
export interface NamespaceResolutionConfig {
  get_file_graph?: (file_path: string) => ScopeGraph | undefined;
  get_imports_with_definitions: (file_path: string) => Array<{
    local_name: string;
    import_statement: Import;
    imported_function: Def;
  }>;
  debug?: boolean;
  // TODO: Integration with other features
  // get_module_exports?: (file: string) => ExportInfo[];  // From export_detection
  // symbol_resolver?: SymbolResolver;  // From symbol_resolution
  // type_tracker?: TypeTracker;  // From type_tracking
}

/**
 * Context for namespace resolution
 */
export interface NamespaceResolutionContext {
  language: Language;
  file_path: string;
  config: NamespaceResolutionConfig;
}

/**
 * Namespace export result type
 */
export type NamespaceExport = 
  | Def 
  | { is_namespace_reexport: true; target_module: string };

/**
 * Information about a namespace import
 */
export interface NamespaceImportInfo {
  namespace_name: string;  // Local name of the namespace
  source_module: string;   // Module it's imported from
  is_namespace: boolean;   // Always true for namespace imports
  members?: string[];      // Cached list of available members
}

// TODO: Add these stub interfaces for future integration

// Integration with import resolution
export interface NamespaceResolver {
  is_namespace_import(imp: Import): boolean;
  resolve_namespace_member(ns: string, member: string): Def | undefined;
  get_namespace_exports(ns: string): Map<string, NamespaceExport>;
}

// Integration with symbol resolution (future)
export interface QualifiedNameResolver {
  resolve_qualified_name(parts: string[]): Def | undefined;
}

/**
 * Check if an import is a namespace import
 */
export function is_namespace_import(
  imp: Import,
  language: Language
): boolean {
  // Most languages use * to indicate namespace import
  // Language-specific implementations can override this
  switch (language) {
    case 'javascript':
    case 'typescript':
      // import * as name from 'module'
      return imp.source_name === '*';
    
    case 'python':
      // import module or from module import *
      return imp.source_name === '*' || !imp.source_name;
    
    case 'rust':
      // use module::* or use module
      return imp.source_name === '*' || imp.is_namespace === true;
    
    default:
      return imp.source_name === '*';
  }
}

/**
 * Resolve all exports from a namespace
 */
export function resolve_namespace_exports(
  target_file: string,
  context: NamespaceResolutionContext
): Map<string, NamespaceExport> {
  const exports = new Map<string, NamespaceExport>();
  const { config } = context;
  
  // Get the scope graph for the target file
  const target_graph = config.get_file_graph?.(target_file);
  if (!target_graph) {
    if (config.debug) {
      console.log(`No graph found for ${target_file}`);
    }
    return exports;
  }
  
  // TODO: Integration with export_detection
  // When export_detection is available:
  // const module_exports = config.get_module_exports?.(target_file);
  // for (const exp of module_exports) {
  //   exports.set(exp.export_name, exp.definition || exp);
  // }
  
  // For now, collect all exported definitions from scope graph
  const defs = target_graph.getNodes<Def>('definition');
  for (const def of defs) {
    if (is_exported_definition(def, context.language)) {
      exports.set(def.name, def);
    }
  }
  
  // Find re-exported namespaces
  find_reexported_namespaces(target_graph, exports, context);
  
  return exports;
}

/**
 * Check if a definition is exported
 */
function is_exported_definition(def: Def, language: Language): boolean {
  // Explicit export
  if (def.is_exported === true) {
    return true;
  }
  
  // Language-specific auto-export rules
  if (language === 'python') {
    // Python exports all public top-level definitions
    return !def.name.startsWith('_');
  }
  
  return false;
}

/**
 * Find re-exported namespaces in the target file
 */
function find_reexported_namespaces(
  target_graph: ScopeGraph,
  exports: Map<string, NamespaceExport>,
  context: NamespaceResolutionContext
): void {
  const imports = target_graph.getAllImports();
  const refs = target_graph.getNodes<Ref>('reference');
  
  for (const imp of imports) {
    if (is_namespace_import(imp, context.language)) {
      // Check if this namespace is re-exported
      const export_ref = refs.find(ref => 
        ref.name === imp.name &&
        is_in_export_context(ref, target_graph)
      );
      
      if (export_ref) {
        exports.set(imp.name, {
          is_namespace_reexport: true,
          target_module: imp.source_module || ''
        });
      }
    }
  }
}

/**
 * Check if a reference is in an export context
 */
function is_in_export_context(ref: Ref, graph: ScopeGraph): boolean {
  // TODO: Integration with export_detection
  // This requires analyzing the AST to check if the reference is in an export statement
  // For now, return false as placeholder
  return false;
}

/**
 * Resolve a namespace member reference
 */
export function resolve_namespace_member(
  namespace_name: string,
  member_name: string,
  context_def: Def,
  context: NamespaceResolutionContext
): Def | undefined {
  const { config } = context;
  
  // Find the namespace import in the current file
  const imports = config.get_imports_with_definitions(context_def.file_path);
  const namespace_import = imports.find(i => 
    i.local_name === namespace_name && 
    is_namespace_import(i.import_statement, context.language)
  );
  
  if (!namespace_import) {
    if (config.debug) {
      console.log(`No namespace import found for ${namespace_name}`);
    }
    return undefined;
  }

  // Get exports from the target module
  const target_file = namespace_import.import_statement.source_module;
  if (!target_file) {
    if (config.debug) {
      console.log(`No target file found for ${namespace_name}`);
    }
    return undefined;
  }

  const exports = resolve_namespace_exports(
    target_file,
    { ...context, file_path: target_file }
  );
  
  // Find the member in exports
  const export_def = exports.get(member_name);
  
  if (export_def && 'name' in export_def) {
    return export_def;
  }
  
  // Handle re-exported namespace
  if (export_def && 'is_namespace_reexport' in export_def) {
    // Recursively resolve from the re-exported module
    return resolve_namespace_member(
      namespace_name,
      member_name,
      context_def,
      { ...context, file_path: export_def.target_module }
    );
  }
  
  return undefined;
}

/**
 * Resolve nested namespace path (e.g., ns1.ns2.member)
 */
export function resolve_nested_namespace(
  namespace_path: string[],
  member_name: string,
  context_def: Def,
  context: NamespaceResolutionContext
): Def | undefined {
  if (namespace_path.length === 0) {
    return undefined;
  }
  
  // TODO: Integration with symbol_resolution for qualified names
  // When available, use:
  // return context.config.symbol_resolver?.resolve_qualified_name([...namespace_path, member_name]);
  
  // For now, implement step-by-step resolution
  let current_def: Def | undefined = context_def;
  let current_namespace = namespace_path[0];
  
  // Navigate through nested namespaces
  for (let i = 1; i < namespace_path.length && current_def; i++) {
    current_def = resolve_namespace_member(
      current_namespace,
      namespace_path[i],
      current_def,
      context
    );
    current_namespace = namespace_path[i];
  }
  
  // Finally resolve the actual member
  if (current_def) {
    return resolve_namespace_member(
      current_namespace,
      member_name,
      current_def,
      context
    );
  }
  
  return undefined;
}

/**
 * Get all available members in a namespace
 */
export function get_namespace_members(
  namespace_name: string,
  context_def: Def,
  context: NamespaceResolutionContext
): string[] {
  const { config } = context;
  
  // Find the namespace import
  const imports = config.get_imports_with_definitions(context_def.file_path);
  const namespace_import = imports.find(i => 
    i.local_name === namespace_name && 
    is_namespace_import(i.import_statement, context.language)
  );
  
  if (!namespace_import) {
    return [];
  }
  
  const target_file = namespace_import.import_statement.source_module;
  if (!target_file) {
    return [];
  }
  
  const exports = resolve_namespace_exports(
    target_file,
    { ...context, file_path: target_file }
  );
  
  return Array.from(exports.keys());
}

/**
 * Check if a namespace has a specific member
 */
export function namespace_has_member(
  namespace_name: string,
  member_name: string,
  context_def: Def,
  context: NamespaceResolutionContext
): boolean {
  const members = get_namespace_members(namespace_name, context_def, context);
  return members.includes(member_name);
}
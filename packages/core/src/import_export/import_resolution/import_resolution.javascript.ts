/**
 * JavaScript/TypeScript-specific import resolution
 * 
 * Handles JavaScript and TypeScript import patterns including:
 * - ES6 imports (named, default, namespace)
 * - CommonJS require()
 * - Dynamic imports
 * - Re-exports
 */

import { Def, Import, Ref, ScopeGraph, Language } from '@ariadnejs/types';
import { 
  ImportResolutionConfig,
  ImportResolutionContext,
  NamespaceExport,
  get_module_exports
} from './import_resolution';

/**
 * Resolve JavaScript/TypeScript namespace exports
 * 
 * Extends common resolution with JS/TS-specific patterns
 */
export function resolve_javascript_namespace_exports(
  target_file: string,
  config: ImportResolutionConfig,
  language: Language,
  common_exports: Map<string, NamespaceExport>
): Map<string, NamespaceExport> {
  // Start with common exports
  const exports = new Map(common_exports);
  
  const target_graph = config.get_file_graph(target_file);
  if (!target_graph) {
    return exports;
  }
  
  // Check for export * from 'module' patterns
  const imports = target_graph.getAllImports();
  for (const imp of imports) {
    // Look for re-export patterns
    if (imp.source_name === '*' && imp.source_module) {
      // This might be export * from 'module'
      // Check if there's a corresponding export
      const refs = target_graph.getNodes<Ref>('reference');
      const has_export_star = refs.some(ref => 
        ref.name === imp.name && 
        is_in_export_statement(ref, target_graph)
      );
      
      if (has_export_star) {
        // Mark this as a re-exported namespace
        exports.set('*', {
          is_namespace_reexport: true,
          target_module: imp.source_module
        });
      }
    }
  }
  
  // Handle default exports
  const defs = target_graph.getNodes<Def>('definition');
  const default_export = find_default_export(defs);
  if (default_export) {
    exports.set('default', default_export);
  }
  
  return exports;
}

/**
 * Resolve JavaScript/TypeScript namespace member
 */
export function resolve_javascript_namespace_member(
  namespace_name: string,
  member_ref: Ref,
  context_def: Def,
  config: ImportResolutionConfig,
  language: Language
): Def | undefined {
  // Handle nested member access (e.g., ns.sub.member)
  const namespace_path = extract_namespace_path(namespace_name, member_ref);
  if (namespace_path.length > 1) {
    return resolve_nested_namespace_member(
      namespace_path,
      member_ref,
      context_def,
      config,
      language
    );
  }
  
  // Check for CommonJS patterns (require().member)
  if (is_commonjs_require(namespace_name, context_def)) {
    return resolve_commonjs_member(namespace_name, member_ref, context_def, config);
  }
  
  return undefined;
}

/**
 * Find the default export in a list of definitions
 */
function find_default_export(defs: Def[]): Def | undefined {
  // Look for explicitly marked default exports
  const explicit_default = defs.find(def => 
    def.name === 'default' && def.is_exported === true
  );
  
  if (explicit_default) {
    return explicit_default;
  }
  
  // Look for export default patterns
  // In some parsers, the default export might have a different name
  const likely_default = defs.find(def => {
    // Check if the definition is at the top level and exported
    // This is a heuristic - full implementation would check AST
    return def.is_exported === true && 
           def.symbol_kind === 'function' &&
           def.name.startsWith('_default');
  });
  
  return likely_default;
}

/**
 * Check if a reference is in an export statement
 */
function is_in_export_statement(ref: Ref, graph: ScopeGraph): boolean {
  // This would need AST analysis to properly determine
  // For now, use a heuristic based on the reference context
  
  // Check if the reference has export-related symbol kind
  if (ref.symbol_kind === 'export' || ref.symbol_kind === 'module') {
    return true;
  }
  
  // Additional heuristics could be added here
  return false;
}

/**
 * Extract namespace path from a member access
 */
function extract_namespace_path(namespace_name: string, member_ref: Ref): string[] {
  // Check if the namespace_name already contains dots (nested access)
  if (namespace_name.includes('.')) {
    const parts = namespace_name.split('.');
    parts.push(member_ref.name);
    return parts;
  }
  
  return [namespace_name, member_ref.name];
}

/**
 * Resolve nested namespace member access
 */
function resolve_nested_namespace_member(
  namespace_path: string[],
  member_ref: Ref,
  context_def: Def,
  config: ImportResolutionConfig,
  language: Language
): Def | undefined {
  // Start from the root namespace
  let current_module = namespace_path[0];
  let current_context = context_def;
  
  // Navigate through the namespace path
  for (let i = 1; i < namespace_path.length - 1; i++) {
    const next_member = namespace_path[i];
    
    // Try to resolve the intermediate namespace
    const intermediate_ref: Ref = {
      ...member_ref,
      name: next_member
    };
    
    // This would need full implementation with proper context tracking
    // For now, return undefined
    return undefined;
  }
  
  return undefined;
}

/**
 * Check if a namespace is from CommonJS require
 */
function is_commonjs_require(namespace_name: string, context_def: Def): boolean {
  // Check if the file is likely using CommonJS
  const file_ext = context_def.file_path.split('.').pop();
  if (file_ext === 'mjs' || file_ext === 'mts') {
    return false; // ES modules
  }
  
  // Check if the namespace name suggests CommonJS
  // This is a heuristic - full implementation would check the actual require() call
  return namespace_name.includes('require') || 
         namespace_name.startsWith('_') ||
         file_ext === 'cjs';
}

/**
 * Resolve CommonJS member access
 */
function resolve_commonjs_member(
  namespace_name: string,
  member_ref: Ref,
  context_def: Def,
  config: ImportResolutionConfig
): Def | undefined {
  // CommonJS resolution would need special handling
  // For now, return undefined
  return undefined;
}

/**
 * Check if an import is a dynamic import
 */
export function is_dynamic_import(imp: Import): boolean {
  // Dynamic imports often have special markers
  // This would need parser-specific implementation
  return imp.symbol_kind === 'dynamic_import' ||
         imp.name.includes('import(');
}

/**
 * Resolve TypeScript-specific imports (type imports, etc.)
 */
export function resolve_typescript_import(
  imp: Import,
  context: ImportResolutionContext
): Def | undefined {
  // Check for type-only imports
  if (is_type_only_import(imp)) {
    // Type imports might need special handling
    // For now, treat them as regular imports
  }
  
  // TypeScript follows JavaScript patterns
  return undefined;
}

/**
 * Check if an import is type-only (TypeScript)
 */
function is_type_only_import(imp: Import): boolean {
  // This would need parser information
  // Look for markers that indicate type imports
  return imp.name.startsWith('type ') ||
         imp.symbol_kind === 'type_import';
}
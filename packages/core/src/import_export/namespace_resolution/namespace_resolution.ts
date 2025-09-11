/**
 * Generic namespace resolution processor
 * 
 * Configuration-driven namespace resolution that handles ~80% of namespace
 * resolution logic across all languages using language configurations.
 */

import { Language, ImportStatement as Import, Def } from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';
import {
  NamespaceLanguageConfig,
  get_namespace_config
} from './language_configs';

/**
 * Information about a namespace import
 */
export interface NamespaceImportInfo {
  namespace_name: string;
  source_module: string;
  is_namespace: boolean;
  members?: string[];
}

/**
 * Information about a namespace export
 */
export interface NamespaceExport {
  name: string;
  is_exported: boolean;
  is_namespace_reexport?: boolean;
  target_module?: string;
  visibility?: 'public' | 'private' | 'protected';
}

/**
 * Context for namespace resolution operations
 */
export interface NamespaceResolutionContext {
  source_code: string;
  language: Language;
  file_path: string;
  imports?: Import[];
  exports?: Def[];
}

/**
 * Namespace resolver interface
 */
export interface NamespaceResolver {
  detect_imports(imports: Import[]): NamespaceImportInfo[];
  resolve_member(namespace: string, member: string): any;
}

/**
 * Qualified name resolver interface  
 */
export interface QualifiedNameResolver {
  parse(qualified_name: string): { namespace: string; members: string[] };
  resolve(qualified_name: string): any;
}

/**
 * Module context shared across resolution
 */
export const MODULE_CONTEXT = {
  name: 'namespace_resolution',
  version: '2.0.0',
  layer: 2
} as const;

/**
 * Namespace resolution result
 */
export interface NamespaceResolutionResult {
  imports: NamespaceImportInfo[];
  requires_bespoke: boolean;
  bespoke_hints?: {
    has_commonjs?: boolean;
    has_dynamic_imports?: boolean;
    has_packages?: boolean;
    has_namespace_declarations?: boolean;
  };
}

/**
 * Generic namespace import detector using configuration
 */
export function detect_namespace_imports_generic(
  imports: Import[],
  language: Language
): NamespaceResolutionResult {
  const config = get_namespace_config(language);
  const namespace_imports: NamespaceImportInfo[] = [];
  const bespoke_hints: NamespaceResolutionResult['bespoke_hints'] = {};
  let requires_bespoke = false;
  
  for (const imp of imports) {
    // Check if this is a namespace import based on configuration
    if (is_namespace_import_generic(imp, config, language)) {
      namespace_imports.push({
        namespace_name: get_namespace_name(imp, config),
        source_module: imp.source,
        is_namespace: true,
        members: undefined // Will be populated on demand
      });
    }
    
    // Check for patterns that need bespoke handling
    // Since we don't have import_statement, we can't detect CommonJS or dynamic imports
    // We can only check the source for __init__ patterns
    if (config.features.has_packages && imp.source?.includes('__init__')) {
      bespoke_hints.has_packages = true;
      requires_bespoke = true;
    }
  }
  
  return {
    imports: namespace_imports,
    requires_bespoke,
    bespoke_hints: requires_bespoke ? bespoke_hints : undefined
  };
}

/**
 * Check if an import creates a namespace using configuration
 */
function is_namespace_import_generic(
  imp: Import,
  config: NamespaceLanguageConfig,
  language: Language
): boolean {
  // Check if import has is_namespace_import flag set
  if (imp.is_namespace_import === true) {
    return true;
  }
  
  // Check for wildcard imports (symbol_name === '*')
  if (imp.symbol_name === '*') {
    return true;
  }
  
  // Language-specific checks
  switch (language) {
    case 'python':
      // In Python, imports without symbol_name create namespaces
      if (!imp.symbol_name) {
        return true;
      }
      break;
    case 'rust':
      // In Rust, check if source ends with ::*
      if (imp.source.endsWith('::*')) {
        return true;
      }
      break;
  }
  
  return false;
}

/**
 * Extract namespace name from import
 */
function get_namespace_name(imp: Import, config: NamespaceLanguageConfig): string {
  // For namespace imports, use the last part of the source as the name
  // e.g., './utils' -> 'utils', 'std::collections' -> 'collections'
  const parts = imp.source.split(/[\/:]/);
  const lastPart = parts[parts.length - 1];
  
  // Remove file extensions if present
  return lastPart.replace(/\.(js|ts|py|rs)$/, '');
}

/**
 * Generic namespace member resolver using configuration
 */
export function resolve_namespace_member_generic(
  namespace: string,
  member: string,
  context: NamespaceResolutionContext,
  exports: Map<string, NamespaceExport>
): Def | undefined {
  const config = get_namespace_config(context.language);
  
  // Check if member exists in exports
  const export_entry = exports.get(member);
  if (!export_entry) {
    return undefined;
  }
  
  // Check visibility rules
  if (!is_member_visible_generic(member, config)) {
    return undefined;
  }
  
  // Handle re-export
  if (is_reexport(export_entry)) {
    return resolve_reexport_generic(export_entry, context, config);
  }
  
  // Return the definition
  return export_entry as Def;
}

/**
 * Check if a member is visible based on configuration
 */
function is_member_visible_generic(
  member: string,
  config: NamespaceLanguageConfig
): boolean {
  // Check private prefix
  if (config.visibility_rules.private_prefix) {
    if (member.startsWith(config.visibility_rules.private_prefix)) {
      return false;
    }
  }
  
  // If not private, it's visible
  return true;
}

/**
 * Check if an export is a re-export
 */
function is_reexport(exp: NamespaceExport): exp is { is_namespace_reexport: true; target_module: string } {
  return 'is_namespace_reexport' in exp && exp.is_namespace_reexport === true;
}

/**
 * Resolve a re-exported member
 */
function resolve_reexport_generic(
  reexport: { is_namespace_reexport: true; target_module: string },
  context: NamespaceResolutionContext,
  config: NamespaceLanguageConfig
): Def | undefined {
  if (!config.reexport_patterns.follow_chains) {
    return undefined;
  }
  
  // TODO: Implement re-export chain following
  // This would require loading the target module and resolving from there
  return undefined;
}

/**
 * Get namespace exports using configuration
 */
export function get_namespace_exports_generic(
  target_file: string,
  context: NamespaceResolutionContext
): Map<string, NamespaceExport> {
  const exports = new Map<string, NamespaceExport>();
  const config = get_namespace_config(context.language);
  
  // Get file analysis
  const file_graph = context.config.get_file_graph?.(target_file);
  if (!file_graph) {
    return exports;
  }
  
  // Process definitions that are exported
  for (const def of file_graph.defs) {
    // Check if this definition is exported (simplified check)
    if (is_exported_definition(def, config)) {
      exports.set(def.name, def);
    }
  }
  
  // TODO: Handle re-exports
  // TODO: Handle export lists (__all__ in Python)
  
  return exports;
}

/**
 * Check if a definition is exported
 */
function is_exported_definition(
  def: Def,
  config: NamespaceLanguageConfig
): boolean {
  // Check for private prefix first (applies to all languages that have it)
  if (config.visibility_rules.private_prefix && 
      def.name.startsWith(config.visibility_rules.private_prefix)) {
    return false;
  }
  
  // Explicit export flag always takes precedence
  if (def.is_exported !== undefined) {
    return def.is_exported;
  }
  
  // In languages with default public visibility, all non-private top-level defs are exported
  if (config.visibility_rules.default_public) {
    return true;
  }
  
  // For languages with explicit exports, default to false
  return false;
}

/**
 * Parse qualified member access (e.g., ns.member.submember)
 */
export function parse_qualified_access_generic(
  qualified_name: string,
  config: NamespaceLanguageConfig
): { namespace: string; members: string[] } {
  const separators = [config.member_access.separator];
  if (config.member_access.alt_separators) {
    separators.push(...config.member_access.alt_separators);
  }
  
  // Create regex pattern for any separator
  const sep_pattern = separators.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const parts = qualified_name.split(new RegExp(sep_pattern));
  
  if (parts.length < 2) {
    return { namespace: qualified_name, members: [] };
  }
  
  return {
    namespace: parts[0],
    members: parts.slice(1)
  };
}

/**
 * Check if processing needs bespoke handler
 */
export function needs_bespoke_processing(
  source_code: string,
  language: Language
): boolean {
  const config = get_namespace_config(language);
  
  // Quick checks for patterns that need bespoke handling
  if (config.features.has_commonjs && 
      (source_code.includes('module.exports') ||
       source_code.includes('exports.') ||
       source_code.includes('require('))) {
    return true;
  }
  
  if (config.features.has_dynamic_imports && source_code.includes('import(')) {
    return true;
  }
  
  if (config.features.has_namespace_declarations && 
      (source_code.includes('namespace ') || source_code.includes('module '))) {
    return true;
  }
  
  if (config.features.has_packages && source_code.includes('__init__')) {
    return true;
  }
  
  return false;
}

/**
 * Merge generic and bespoke namespace results
 */
export function merge_namespace_results(
  generic_results: NamespaceImportInfo[],
  bespoke_results: NamespaceImportInfo[]
): NamespaceImportInfo[] {
  const merged: NamespaceImportInfo[] = [];
  const seen = new Map<string, NamespaceImportInfo>();
  
  // First add generic results
  for (const result of generic_results) {
    const key = `${result.namespace_name}:${result.source_module}`;
    seen.set(key, result);
  }
  
  // Override with bespoke results (they take precedence)
  for (const result of bespoke_results) {
    const key = `${result.namespace_name}:${result.source_module}`;
    seen.set(key, result); // This will override generic if duplicate
  }
  
  // Add all results to merged array
  for (const result of seen.values()) {
    merged.push(result);
  }
  
  return merged;
}

/**
 * Detect namespace imports (main API wrapper)
 */
export function detect_namespace_imports(
  imports: Import[],
  language: Language
): NamespaceImportInfo[] {
  const result = detect_namespace_imports_generic(imports, language);
  return result.imports;
}

/**
 * Check if an import creates a namespace (public API)
 * 
 * @param imp - The import statement to check
 * @param language - The programming language
 * @returns true if this import creates a namespace
 */
export function is_namespace_import(
  imp: Import,
  language: Language
): boolean {
  const config = get_namespace_config(language);
  return is_namespace_import_generic(imp, config, language);
}

/**
 * Resolve namespace exports (placeholder)
 */
export function resolve_namespace_exports(
  namespace: string,
  context: NamespaceResolutionContext
): Map<string, NamespaceExport> {
  return get_namespace_exports_generic(namespace, context);
}

/**
 * Resolve namespace member (main API wrapper)
 */
export function resolve_namespace_member(
  namespace: string,
  member: string,
  context: NamespaceResolutionContext,
  exports: Map<string, NamespaceExport>
): any {
  return resolve_namespace_member_generic(namespace, member, context, exports);
}

/**
 * Resolve nested namespace (placeholder)
 */
export function resolve_nested_namespace(
  qualified_name: string,
  context: NamespaceResolutionContext
): any {
  const config = get_namespace_config(context.language);
  const parsed = parse_qualified_access_generic(qualified_name, config);
  return parsed;
}

/**
 * Get namespace members (placeholder)
 */
export function get_namespace_members(
  namespace: string,
  context: NamespaceResolutionContext
): string[] {
  const exports = get_namespace_exports_generic(namespace, context);
  return Array.from(exports.keys());
}

/**
 * Check if namespace has member (placeholder)
 */
export function namespace_has_member(
  namespace: string,
  member: string,
  context: NamespaceResolutionContext
): boolean {
  const exports = get_namespace_exports_generic(namespace, context);
  return exports.has(member);
}

/**
 * Get statistics about namespace resolution
 */
export function get_namespace_stats(imports: NamespaceImportInfo[]): {
  total: number;
  by_source: Map<string, number>;
} {
  const stats = {
    total: imports.length,
    by_source: new Map<string, number>()
  };
  
  for (const imp of imports) {
    const count = stats.by_source.get(imp.source_module) || 0;
    stats.by_source.set(imp.source_module, count + 1);
  }
  
  return stats;
}
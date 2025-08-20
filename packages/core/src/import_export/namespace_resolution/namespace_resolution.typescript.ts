/**
 * TypeScript-specific namespace resolution
 * 
 * Handles TypeScript namespace import patterns including:
 * - ES6 namespace imports with type information
 * - TypeScript namespaces (namespace/module declarations)
 * - Type-only namespace imports
 * - Ambient module declarations
 * 
 * Migrated from: src_old/import_resolution/namespace_imports.javascript.ts (shared with JS)
 */

// TODO: Connect to type_tracking
// - Track types of namespace members
// - Propagate type info through namespace access

import { Def, Import } from '@ariadnejs/types';
import {
  NamespaceExport,
  NamespaceResolutionContext,
  resolve_javascript_namespace_exports,
  resolve_javascript_namespace_member
} from './namespace_resolution.javascript';

/**
 * Resolve namespace exports for TypeScript
 * Extends JavaScript resolution with TS-specific patterns
 */
export function resolve_typescript_namespace_exports(
  target_file: string,
  context: NamespaceResolutionContext,
  common_exports: Map<string, NamespaceExport>
): Map<string, NamespaceExport> {
  // Start with JavaScript resolution
  const enhanced_exports = resolve_javascript_namespace_exports(
    target_file,
    context,
    common_exports
  );
  
  // Add TypeScript-specific patterns
  add_typescript_namespace_exports(enhanced_exports, target_file, context);
  
  // Handle type-only exports
  mark_type_only_exports(enhanced_exports, target_file, context);
  
  return enhanced_exports;
}

/**
 * Resolve namespace member for TypeScript
 * Handles TS-specific member access patterns
 */
export function resolve_typescript_namespace_member(
  namespace_name: string,
  member_name: string,
  context_def: Def,
  context: NamespaceResolutionContext
): Def | undefined {
  // Try JavaScript resolution first
  const js_result = resolve_javascript_namespace_member(
    namespace_name,
    member_name,
    context_def,
    context
  );
  
  if (js_result) {
    return js_result;
  }
  
  // TypeScript-specific resolution
  
  // Check for TypeScript namespace declaration
  if (is_typescript_namespace(namespace_name, context_def)) {
    return resolve_typescript_namespace_member_internal(
      namespace_name,
      member_name,
      context_def,
      context
    );
  }
  
  // Check for ambient module
  if (is_ambient_module(namespace_name, context_def)) {
    return resolve_ambient_module_member(
      namespace_name,
      member_name,
      context_def,
      context
    );
  }
  
  return undefined;
}

/**
 * Check if an import is a TypeScript namespace import
 */
export function is_typescript_namespace_import(imp: Import): boolean {
  // ES6 namespace import
  if (imp.source_name === '*') {
    return true;
  }
  
  // Type-only namespace import: import type * as ns from 'module'
  if (imp.is_type_import && imp.source_name === '*') {
    return true;
  }
  
  // TypeScript namespace/module import
  if (imp.is_namespace === true) {
    return true;
  }
  
  return false;
}

/**
 * Add TypeScript namespace exports
 */
function add_typescript_namespace_exports(
  exports: Map<string, NamespaceExport>,
  file_path: string,
  context: NamespaceResolutionContext
): void {
  const { config } = context;
  const graph = config.get_file_graph?.(file_path);
  
  if (!graph) {
    return;
  }
  
  const defs = graph.getNodes<Def>('definition');
  
  for (const def of defs) {
    // Add TypeScript namespace members
    if (def.symbol_kind === 'namespace' && def.is_exported) {
      // Namespace itself is exported
      exports.set(def.name, def);
      
      // TODO: Add namespace members
      // This requires analyzing the namespace body
      add_namespace_members(exports, def, context);
    }
    
    // Add interface and type alias exports
    if ((def.symbol_kind === 'interface' || 
         def.symbol_kind === 'type_alias') && 
        def.is_exported) {
      exports.set(def.name, def);
    }
    
    // Add enum exports
    if (def.symbol_kind === 'enum' && def.is_exported) {
      exports.set(def.name, def);
      // TODO: Add enum members as well
    }
  }
}

/**
 * Add members of a TypeScript namespace
 */
function add_namespace_members(
  exports: Map<string, NamespaceExport>,
  namespace_def: Def,
  context: NamespaceResolutionContext
): void {
  // TODO: Extract members from namespace body
  // This requires analyzing the AST of the namespace declaration
  // Members should be prefixed with namespace name
}

/**
 * Mark type-only exports
 */
function mark_type_only_exports(
  exports: Map<string, NamespaceExport>,
  file_path: string,
  context: NamespaceResolutionContext
): void {
  // TODO: Identify which exports are type-only
  // This requires analyzing export statements for 'export type' syntax
}

/**
 * Check if a name refers to a TypeScript namespace
 */
function is_typescript_namespace(
  namespace_name: string,
  context_def: Def
): boolean {
  // TODO: Check if namespace_name is a TypeScript namespace declaration
  // This requires checking for 'namespace' or 'module' declarations
  return false;
}

/**
 * Resolve a member from a TypeScript namespace
 */
function resolve_typescript_namespace_member_internal(
  namespace_name: string,
  member_name: string,
  context_def: Def,
  context: NamespaceResolutionContext
): Def | undefined {
  // TODO: Resolve member within TypeScript namespace
  // This requires finding the namespace declaration and its members
  return undefined;
}

/**
 * Check if a name refers to an ambient module
 */
function is_ambient_module(
  module_name: string,
  context_def: Def
): boolean {
  // TODO: Check if module_name is an ambient module declaration
  // These are typically in .d.ts files
  return context_def.file_path.endsWith('.d.ts');
}

/**
 * Resolve a member from an ambient module
 */
function resolve_ambient_module_member(
  module_name: string,
  member_name: string,
  context_def: Def,
  context: NamespaceResolutionContext
): Def | undefined {
  // TODO: Resolve member from ambient module declaration
  return undefined;
}

/**
 * TypeScript-specific namespace information
 */
export interface TypeScriptNamespaceInfo {
  is_type_only: boolean;
  is_namespace_declaration: boolean;
  is_ambient: boolean;
  has_type_exports: boolean;
  has_value_exports: boolean;
}

/**
 * Analyze a TypeScript namespace import
 */
export function analyze_typescript_namespace(
  namespace_name: string,
  context_def: Def,
  context: NamespaceResolutionContext
): TypeScriptNamespaceInfo {
  return {
    is_type_only: false,  // TODO: Check if import type * as
    is_namespace_declaration: is_typescript_namespace(namespace_name, context_def),
    is_ambient: is_ambient_module(namespace_name, context_def),
    has_type_exports: false,  // TODO: Check for type exports
    has_value_exports: false  // TODO: Check for value exports
  };
}

/**
 * Check if a namespace member is a type
 */
export function is_type_member(
  namespace_name: string,
  member_name: string,
  context_def: Def,
  context: NamespaceResolutionContext
): boolean {
  const member = resolve_typescript_namespace_member(
    namespace_name,
    member_name,
    context_def,
    context
  );
  
  if (!member) {
    return false;
  }
  
  return member.symbol_kind === 'interface' ||
         member.symbol_kind === 'type_alias' ||
         member.symbol_kind === 'type_parameter';
}
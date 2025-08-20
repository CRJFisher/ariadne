/**
 * JavaScript/TypeScript Namespace Import Resolution
 * 
 * Language-specific implementation for JavaScript and TypeScript
 * namespace imports (import * as name from 'module').
 */

import type { Def, Ref } from '../graph';
import type { 
  LanguageMetadata, 
  NamespaceExport, 
  NamespaceResolutionConfig 
} from './namespace_imports';

/**
 * Resolve namespace exports for JavaScript/TypeScript
 * Enhances the common resolution with JS-specific patterns
 */
export function resolve_javascript_namespace_exports(
  target_file: string,
  config: NamespaceResolutionConfig,
  metadata: LanguageMetadata,
  common_exports: Map<string, NamespaceExport>
): Map<string, NamespaceExport> {
  // JavaScript-specific enhancements
  const enhanced_exports = new Map(common_exports);
  
  // Handle JavaScript-specific export patterns:
  // 1. CommonJS exports (module.exports, exports.name)
  // 2. Default exports that should be accessible
  // 3. Dynamic exports
  
  if (is_commonjs_module(target_file)) {
    add_commonjs_exports(enhanced_exports, target_file, config);
  }
  
  // Handle default export accessibility
  const default_export = enhanced_exports.get('default');
  if (default_export && should_expose_default_members(default_export)) {
    expose_default_export_members(enhanced_exports, default_export, config);
  }
  
  return enhanced_exports;
}

/**
 * Resolve namespace member for JavaScript/TypeScript
 * Handles JS-specific member access patterns
 */
export function resolve_javascript_namespace_member(
  namespace_name: string,
  member_ref: Ref,
  context_def: Def,
  config: NamespaceResolutionConfig,
  metadata: LanguageMetadata
): Def | undefined {
  // JavaScript-specific member resolution
  // This handles cases that common resolution might miss
  
  // Check for CommonJS-style require
  if (is_commonjs_require_namespace(namespace_name, context_def)) {
    return resolve_commonjs_member(namespace_name, member_ref, context_def, config);
  }
  
  // Check for dynamic import namespace
  if (is_dynamic_import_namespace(namespace_name, context_def)) {
    return resolve_dynamic_import_member(namespace_name, member_ref, context_def, config);
  }
  
  // No JavaScript-specific resolution found
  return undefined;
}

/**
 * Check if a file uses CommonJS module system
 */
function is_commonjs_module(file_path: string): boolean {
  // Check file extension
  if (file_path.endsWith('.cjs')) {
    return true;
  }
  
  // Would need to analyze the file content to detect
  // module.exports or exports usage
  // For now, return false
  return false;
}

/**
 * Add CommonJS exports to the exports map
 */
function add_commonjs_exports(
  exports: Map<string, NamespaceExport>,
  file_path: string,
  config: NamespaceResolutionConfig
): void {
  // This would analyze module.exports and exports.name patterns
  // For now, this is a placeholder
  
  // In a real implementation:
  // 1. Parse the file for module.exports assignments
  // 2. Parse exports.name = value patterns
  // 3. Add them to the exports map
}

/**
 * Check if default export members should be exposed
 * (for cases like export default { func1, func2 })
 */
function should_expose_default_members(default_export: NamespaceExport): boolean {
  // Check if the default export is an object literal
  // with enumerable members
  
  if ('symbol_kind' in default_export) {
    return default_export.symbol_kind === 'object';
  }
  
  return false;
}

/**
 * Expose members of a default export object
 */
function expose_default_export_members(
  exports: Map<string, NamespaceExport>,
  default_export: NamespaceExport,
  config: NamespaceResolutionConfig
): void {
  // This would analyze the default export object
  // and add its members to the exports map
  // For now, this is a placeholder
}

/**
 * Check if a namespace is from CommonJS require
 */
function is_commonjs_require_namespace(
  namespace_name: string,
  context_def: Def
): boolean {
  // Check if the namespace was created via const ns = require('module')
  // This requires analyzing the definition context
  return false;
}

/**
 * Resolve member from CommonJS namespace
 */
function resolve_commonjs_member(
  namespace_name: string,
  member_ref: Ref,
  context_def: Def,
  config: NamespaceResolutionConfig
): Def | undefined {
  // Handle CommonJS-specific member resolution
  // This is a placeholder for now
  return undefined;
}

/**
 * Check if a namespace is from dynamic import
 */
function is_dynamic_import_namespace(
  namespace_name: string,
  context_def: Def
): boolean {
  // Check if the namespace was created via const ns = await import('module')
  // This requires analyzing the definition context
  return false;
}

/**
 * Resolve member from dynamic import namespace
 */
function resolve_dynamic_import_member(
  namespace_name: string,
  member_ref: Ref,
  context_def: Def,
  config: NamespaceResolutionConfig
): Def | undefined {
  // Handle dynamic import member resolution
  // This is a placeholder for now
  return undefined;
}

/**
 * Extract namespace path from a JavaScript member expression
 * Used for resolving nested namespace access like math.operations.multiply()
 */
export function extract_javascript_namespace_path(object_node: any): string[] {
  const path: string[] = [];
  let current_node = object_node;
  
  // Walk up the member expression chain
  while (is_member_expression(current_node)) {
    const property_node = get_property_node(current_node);
    
    if (property_node) {
      path.unshift(property_node.text);
    }
    
    current_node = get_object_node(current_node);
    if (!current_node) break;
  }
  
  // Add the base identifier
  if (current_node && current_node.type === 'identifier') {
    path.unshift(current_node.text);
  }
  
  return path;
}

/**
 * Check if a node is a member expression
 */
function is_member_expression(node: any): boolean {
  return node && node.type === 'member_expression';
}

/**
 * Get the property node from a member expression
 */
function get_property_node(node: any): any {
  return node.propertyNode || node.property;
}

/**
 * Get the object node from a member expression
 */
function get_object_node(node: any): any {
  return node.objectNode || node.object;
}
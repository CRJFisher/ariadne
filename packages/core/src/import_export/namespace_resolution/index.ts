/**
 * Namespace resolution dispatcher
 * 
 * Routes namespace resolution to language-specific implementations
 */

import { Language, Def } from '@ariadnejs/types';
import {
  NamespaceExport,
  NamespaceResolutionContext,
  NamespaceResolutionConfig,
  NamespaceImportInfo,
  NamespaceResolver,
  QualifiedNameResolver,
  is_namespace_import,
  resolve_namespace_exports as resolve_common_exports,
  resolve_namespace_member as resolve_common_member,
  resolve_nested_namespace,
  get_namespace_members,
  namespace_has_member
} from './namespace_resolution';

import { 
  resolve_javascript_namespace_exports,
  resolve_javascript_namespace_member,
  analyze_javascript_namespace,
  JavaScriptNamespaceInfo
} from './namespace_resolution.javascript';

import {
  resolve_typescript_namespace_exports,
  resolve_typescript_namespace_member,
  analyze_typescript_namespace,
  TypeScriptNamespaceInfo,
  is_type_member
} from './namespace_resolution.typescript';

import {
  resolve_python_namespace_exports,
  resolve_python_namespace_member,
  analyze_python_namespace,
  PythonNamespaceInfo,
  get_module_path,
  resolve_relative_import
} from './namespace_resolution.python';

import {
  resolve_rust_namespace_exports,
  resolve_rust_namespace_member,
  analyze_rust_namespace,
  RustNamespaceInfo,
  resolve_crate_import,
  get_module_visibility,
  is_path_accessible
} from './namespace_resolution.rust';

// Re-export common types and utilities
export {
  NamespaceExport,
  NamespaceResolutionContext,
  NamespaceResolutionConfig,
  NamespaceImportInfo,
  NamespaceResolver,
  QualifiedNameResolver,
  is_namespace_import,
  resolve_nested_namespace,
  get_namespace_members,
  namespace_has_member
};

// Re-export language-specific types
export {
  JavaScriptNamespaceInfo,
  TypeScriptNamespaceInfo,
  PythonNamespaceInfo,
  RustNamespaceInfo,
  is_type_member,
  get_module_path,
  resolve_relative_import,
  resolve_crate_import,
  get_module_visibility,
  is_path_accessible
};

/**
 * Main entry point for namespace export resolution
 * 
 * Dispatches to language-specific implementations
 */
export function resolve_namespace_exports(
  target_file: string,
  context: NamespaceResolutionContext
): Map<string, NamespaceExport> {
  // Get common exports first
  const common_exports = resolve_common_exports(target_file, context);
  
  // Dispatch to language-specific resolution
  switch (context.language) {
    case 'javascript':
      return resolve_javascript_namespace_exports(target_file, context, common_exports);
      
    case 'typescript':
      return resolve_typescript_namespace_exports(target_file, context, common_exports);
      
    case 'python':
      return resolve_python_namespace_exports(target_file, context, common_exports);
      
    case 'rust':
      return resolve_rust_namespace_exports(target_file, context, common_exports);
      
    default:
      // Fallback to common resolution
      return common_exports;
  }
}

/**
 * Main entry point for namespace member resolution
 * 
 * Dispatches to language-specific implementations
 */
export function resolve_namespace_member(
  namespace_name: string,
  member_name: string,
  context_def: Def,
  context: NamespaceResolutionContext
): Def | undefined {
  // Try language-specific resolution
  switch (context.language) {
    case 'javascript':
      return resolve_javascript_namespace_member(
        namespace_name,
        member_name,
        context_def,
        context
      );
      
    case 'typescript':
      return resolve_typescript_namespace_member(
        namespace_name,
        member_name,
        context_def,
        context
      );
      
    case 'python':
      return resolve_python_namespace_member(
        namespace_name,
        member_name,
        context_def,
        context
      );
      
    case 'rust':
      return resolve_rust_namespace_member(
        namespace_name,
        member_name,
        context_def,
        context
      );
      
    default:
      // Fallback to common resolution
      return resolve_common_member(
        namespace_name,
        member_name,
        context_def,
        context
      );
  }
}

/**
 * Analyze a namespace import for language-specific information
 */
export function analyze_namespace(
  namespace_name: string,
  context_def: Def,
  context: NamespaceResolutionContext
): JavaScriptNamespaceInfo | TypeScriptNamespaceInfo | PythonNamespaceInfo | RustNamespaceInfo | {} {
  switch (context.language) {
    case 'javascript':
      return analyze_javascript_namespace(namespace_name, context_def, context);
      
    case 'typescript':
      return analyze_typescript_namespace(namespace_name, context_def, context);
      
    case 'python':
      return analyze_python_namespace(namespace_name, context_def, context);
      
    case 'rust':
      return analyze_rust_namespace(namespace_name, context_def, context);
      
    default:
      return {};
  }
}

/**
 * Create a namespace resolver instance
 * 
 * Utility for integration with other features
 */
export function create_namespace_resolver(
  config: NamespaceResolutionConfig,
  language: Language
): NamespaceResolver {
  return {
    is_namespace_import: (imp) => is_namespace_import(imp, language),
    
    resolve_namespace_member: (ns, member) => {
      // This is simplified - would need context_def
      const context: NamespaceResolutionContext = {
        language,
        file_path: '',
        config
      };
      return undefined;  // Need context_def to properly resolve
    },
    
    get_namespace_exports: (ns) => {
      // This is simplified - would need target file
      return new Map();
    }
  };
}

/**
 * Check if a qualified name refers to a namespace member
 * 
 * e.g., "ns.member" or "pkg.module.func"
 */
export function is_namespace_qualified_name(
  qualified_name: string,
  context: NamespaceResolutionContext
): boolean {
  const parts = qualified_name.split('.');
  if (parts.length < 2) {
    return false;
  }
  
  // TODO: Check if first part is a known namespace
  // This requires checking imports in the current scope
  
  return true;
}

/**
 * Split a qualified name into namespace and member parts
 */
export function split_qualified_name(
  qualified_name: string
): { namespace: string[]; member: string } | null {
  const parts = qualified_name.split('.');
  if (parts.length < 2) {
    return null;
  }
  
  return {
    namespace: parts.slice(0, -1),
    member: parts[parts.length - 1]
  };
}
/**
 * Import Resolution Dispatcher
 * 
 * Routes import resolution functionality to language-specific implementations
 * following the Architecture's functional paradigm.
 * Currently handles namespace imports (import * as name from 'module').
 */

import { resolve_javascript_namespace_exports, resolve_javascript_namespace_member } from './namespace_imports.javascript';
import { resolve_python_namespace_exports, resolve_python_namespace_member } from './namespace_imports.python';
import { resolve_rust_namespace_exports, resolve_rust_namespace_member } from './namespace_imports.rust';
import { 
  resolve_common_namespace_exports, 
  resolve_common_namespace_member,
  resolve_common_nested_namespace as resolve_nested_namespace_member,
  is_common_namespace_import as is_namespace_import,
  type LanguageMetadata,
  type NamespaceResolutionConfig,
  type NamespaceExport 
} from './namespace_imports';
import type { Def, Ref } from '../graph';

// Re-export types and common functions for external use
export type { LanguageMetadata, NamespaceResolutionConfig, NamespaceExport };
export { is_namespace_import, resolve_nested_namespace_member };

// Language-specific export resolvers mapping
const namespace_export_resolvers = {
  javascript: resolve_javascript_namespace_exports,
  typescript: resolve_javascript_namespace_exports, // Shares with JavaScript
  python: resolve_python_namespace_exports,
  rust: resolve_rust_namespace_exports
};

// Language-specific member resolvers mapping
const namespace_member_resolvers = {
  javascript: resolve_javascript_namespace_member,
  typescript: resolve_javascript_namespace_member, // Shares with JavaScript
  python: resolve_python_namespace_member,
  rust: resolve_rust_namespace_member
};

/**
 * Resolve all exports from a namespace
 */
export function resolve_namespace_exports(
  target_file: string,
  config: NamespaceResolutionConfig,
  metadata: LanguageMetadata
): Map<string, NamespaceExport> {
  // Common processing
  const common_exports = resolve_common_namespace_exports(
    target_file,
    config,
    metadata
  );
  
  // Dispatch to language-specific resolver
  const resolver = namespace_export_resolvers[metadata.language];
  if (!resolver) {
    return common_exports;
  }
  
  // Language-specific enhancement
  return resolver(target_file, config, metadata, common_exports);
}

/**
 * Resolve a member access on a namespace import
 */
export function resolve_namespace_member(
  namespace_name: string,
  member_ref: Ref,
  context_def: Def,
  config: NamespaceResolutionConfig,
  metadata: LanguageMetadata
): Def | undefined {
  // Try common resolution first
  const common_result = resolve_common_namespace_member(
    namespace_name,
    member_ref,
    context_def,
    config,
    metadata
  );
  
  // If common resolution found something, we're done
  if (common_result) {
    return common_result;
  }
  
  // Try language-specific resolution
  const resolver = namespace_member_resolvers[metadata.language];
  if (!resolver) {
    return undefined;
  }
  
  return resolver(
    namespace_name,
    member_ref,
    context_def,
    config,
    metadata
  );
}

/**
 * Get language metadata from file path
 * This is a helper for callers who don't have the language yet
 */
export function get_language_metadata(file_path: string): LanguageMetadata {
  const ext = file_path.split('.').pop()?.toLowerCase() || '';
  
  // Map file extensions to languages
  const extension_map: Record<string, LanguageMetadata['language']> = {
    'js': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'mts': 'typescript',
    'cts': 'typescript',
    'py': 'python',
    'pyw': 'python',
    'rs': 'rust'
  };
  
  const language = extension_map[ext] || 'javascript';
  
  return {
    language,
    file_path
  };
}
/**
 * Namespace resolution module
 * 
 * Provides comprehensive namespace import and member resolution
 * using a configuration-driven approach with language-specific
 * bespoke handlers for edge cases.
 * 
 * Architecture:
 * - Main orchestrator coordinates resolution
 * - Generic processor handles ~85% of patterns
 * - Language configs drive common behavior
 * - Bespoke handlers augment with ~15% unique patterns
 */

// Export main orchestrator API
export {
  // Types
  NamespaceExport,
  NamespaceResolutionContext,
  NamespaceResolutionConfig,
  NamespaceImportInfo,
  NamespaceResolver,
  QualifiedNameResolver,
  
  // Main functions
  detect_namespace_imports,
  is_namespace_import,
  resolve_namespace_exports,
  resolve_namespace_member,
  resolve_nested_namespace,
  get_namespace_members,
  namespace_has_member
} from './namespace_resolution';

// Export configuration utilities
export {
  NamespaceLanguageConfig,
  get_namespace_config,
  is_namespace_import_pattern,
  get_member_separator,
  is_private_member,
  supports_namespace_feature,
  get_namespace_node_types,
  supports_reexports,
  get_visibility_keywords,
  has_default_public_exports,
  get_export_list_name
} from './language_configs';

// Export generic processor utilities (for advanced use)
export {
  NamespaceResolutionResult,
  detect_namespace_imports_generic,
  resolve_namespace_member_generic,
  get_namespace_exports_generic,
  needs_bespoke_processing,
  merge_namespace_results,
  parse_qualified_access_generic,
  get_namespace_stats
} from './namespace_resolution';
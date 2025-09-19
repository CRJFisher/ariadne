/**
 * Namespace resolution module
 * 
 * Provides comprehensive namespace import and member resolution
 * using a configuration-driven approach with language-specific
 * bespoke handlers for edge cases.
 */

// Export main orchestrator API
export {
  resolve_namespaces_across_files,
  collect_namespace_exports,
  is_namespace_import,
  resolve_namespace_exports,
  resolve_namespace_member,
  detect_namespace_imports,
  resolve_nested_namespace,
} from './namespace_resolution';

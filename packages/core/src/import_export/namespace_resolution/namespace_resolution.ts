/**
 * Namespace resolution orchestrator
 * 
 * Coordinates generic configuration-driven resolution (~85%) with
 * language-specific bespoke handlers (~15%) for comprehensive
 * namespace import and member resolution.
 * 
 * Pattern: Generic processor handles common patterns, bespoke
 * handlers augment with language-specific edge cases.
 */

import { Def, ImportStatement as Import, Ref, ScopeGraph, Language } from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';

// Generic processor (handles ~85% of logic)
import {
  detect_namespace_imports_generic,
  resolve_namespace_member_generic,
  get_namespace_exports_generic,
  needs_bespoke_processing,
  merge_namespace_results,
  parse_qualified_access_generic
} from './namespace_resolution.generic';

// Language-specific bespoke handlers (~15% of logic)
import * as JavaScriptBespoke from './namespace_resolution.javascript.bespoke';
import * as TypeScriptBespoke from './namespace_resolution.typescript.bespoke';
import * as PythonBespoke from './namespace_resolution.python.bespoke';
import * as RustBespoke from './namespace_resolution.rust.bespoke';

// Language configurations
import { get_namespace_config } from './language_configs';

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
 * Detect namespace imports using orchestrator pattern
 */
export function detect_namespace_imports(
  imports: Import[],
  language: Language,
  source_code?: string,
  root_node?: SyntaxNode
): NamespaceImportInfo[] {
  // Step 1: Generic detection (handles ~85%)
  const generic_result = detect_namespace_imports_generic(imports, language);
  
  // Step 2: Check if bespoke processing is needed
  // If source_code is provided, check for patterns that need bespoke handling
  let requires_bespoke = generic_result.requires_bespoke;
  if (source_code && !requires_bespoke) {
    requires_bespoke = needs_bespoke_processing(source_code, language);
  }
  
  if (!requires_bespoke || !source_code) {
    return generic_result.imports;
  }
  
  // Step 3: Apply language-specific bespoke handlers
  const bespoke_imports = get_bespoke_namespace_imports(
    language,
    source_code,
    root_node
  );
  
  // Step 4: Merge results (bespoke takes precedence)
  return merge_namespace_results(generic_result.imports, bespoke_imports);
}

/**
 * Check if an import is a namespace import (backward compatibility)
 */
export function is_namespace_import(
  imp: Import,
  language: Language
): boolean {
  // Check explicit namespace flag first
  if (imp.is_namespace_import === true) {
    return true;
  }
  
  // Check wildcard imports (import * as name)
  if (imp.symbol_name === '*') {
    return true;
  }
  
  // Language-specific checks
  switch (language) {
    case 'python':
      // In Python, bare imports (import module) create namespaces
      // This is when symbol_name is undefined
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
 * Get bespoke namespace imports for a language
 */
function get_bespoke_namespace_imports(
  language: Language,
  source_code: string,
  root_node?: SyntaxNode
): NamespaceImportInfo[] {
  const bespoke_imports: NamespaceImportInfo[] = [];
  
  // Create a dummy node if not provided
  const node = root_node || ({} as SyntaxNode);
  
  switch (language) {
    case 'javascript':
      // Handle CommonJS and dynamic imports
      bespoke_imports.push(
        ...JavaScriptBespoke.handle_commonjs_require(node, source_code),
        ...JavaScriptBespoke.handle_dynamic_imports(node, source_code)
      );
      break;
      
    case 'typescript':
      // Handle namespace declarations and export =
      bespoke_imports.push(
        ...TypeScriptBespoke.handle_namespace_declarations(node, source_code)
      );
      
      // Handle ambient modules
      const ambient_modules = TypeScriptBespoke.handle_ambient_modules(node, source_code);
      // Convert ambient modules to namespace imports
      for (const [module_name] of ambient_modules) {
        bespoke_imports.push({
          namespace_name: module_name,
          source_module: module_name,
          is_namespace: true,
          members: undefined
        });
      }
      break;
      
    case 'python':
      // Handle package imports
      const file_system = {
        exists: (path: string) => {
          // Simple check - would need real file system access
          return false;
        }
      };
      bespoke_imports.push(
        ...PythonBespoke.handle_package_imports(source_code, file_system)
      );
      break;
      
    case 'rust':
      // Handle extern crate and complex use statements
      bespoke_imports.push(
        ...RustBespoke.handle_extern_crate(source_code),
        ...RustBespoke.handle_complex_use_statements(source_code)
      );
      break;
  }
  
  return bespoke_imports;
}

/**
 * Resolve all exports from a namespace
 */
export function resolve_namespace_exports(
  target_file: string,
  context: NamespaceResolutionContext,
  source_code?: string
): Map<string, NamespaceExport> {
  // Step 1: Get generic exports (~85%)
  const generic_exports = get_namespace_exports_generic(target_file, context);
  
  // Step 2: Check if bespoke processing is needed
  if (!source_code || !needs_bespoke_processing(source_code, context.language)) {
    return generic_exports;
  }
  
  // Step 3: Apply bespoke handlers
  apply_bespoke_export_handlers(
    generic_exports,
    context.language,
    source_code
  );
  
  return generic_exports;
}

/**
 * Apply bespoke export handlers to augment exports
 */
function apply_bespoke_export_handlers(
  exports: Map<string, NamespaceExport>,
  language: Language,
  source_code: string
): void {
  switch (language) {
    case 'javascript':
      // Handle module.exports spreading
      JavaScriptBespoke.handle_module_exports_spreading(exports, source_code);
      break;
      
    case 'typescript':
      // Handle export = syntax
      TypeScriptBespoke.handle_export_equals(exports, source_code);
      break;
      
    case 'python':
      // Handle __all__ export list
      PythonBespoke.handle_all_exports(exports, source_code);
      break;
      
    case 'rust':
      // Rust visibility is handled in generic processor
      // Additional handling could go here
      break;
  }
}

/**
 * Check if a definition is exported (now uses config)
 */
function is_exported_definition(def: Def, language: Language): boolean {
  const config = get_namespace_config(language);
  
  // Explicit export
  if (def.is_exported === true) {
    return true;
  }
  
  // Check visibility rules from configuration
  if (config.visibility_rules.default_public) {
    // Check for private prefix
    if (config.visibility_rules.private_prefix && 
        def.name.startsWith(config.visibility_rules.private_prefix)) {
      return false;
    }
    return true;
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
        exports.set((imp as any).name, {
          is_namespace_reexport: true,
          target_module: imp.source || ''
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
 * Resolve a namespace member reference using orchestrator pattern
 */
export function resolve_namespace_member(
  namespace_name: string,
  member_name: string,
  context_def: Def,
  context: NamespaceResolutionContext,
  source_code?: string
): Def | undefined {
  const { config } = context;
  
  // Find the namespace import in the current file
  const imports = config.get_imports_with_definitions(context_def.file_path);
  const namespace_import = imports.find(i => 
    i.local_name === namespace_name && 
    is_namespace_import(i.import_statement as any, context.language)
  );
  
  if (!namespace_import) {
    if (config.debug) {
      console.log(`No namespace import found for ${namespace_name}`);
    }
    return undefined;
  }

  // Get exports from the target module
  const target_file = namespace_import.import_statement.source;
  if (!target_file) {
    if (config.debug) {
      console.log(`No target file found for ${namespace_name}`);
    }
    return undefined;
  }

  const exports = resolve_namespace_exports(
    target_file,
    { ...context, file_path: target_file },
    source_code
  );
  
  // Step 1: Try generic resolution (~85%)
  const generic_result = resolve_namespace_member_generic(
    namespace_name,
    member_name,
    context,
    exports
  );
  
  if (generic_result) {
    return generic_result;
  }
  
  // Step 2: Apply bespoke resolution if needed
  if (source_code && needs_bespoke_processing(source_code, context.language)) {
    return resolve_namespace_member_bespoke(
      namespace_name,
      member_name,
      context_def,
      context,
      source_code
    );
  }
  
  return undefined;
}

/**
 * Resolve namespace member using bespoke handlers
 */
function resolve_namespace_member_bespoke(
  namespace_name: string,
  member_name: string,
  context_def: Def,
  context: NamespaceResolutionContext,
  source_code: string
): Def | undefined {
  switch (context.language) {
    case 'javascript':
      // Check for prototype extensions
      const proto_members = JavaScriptBespoke.handle_prototype_extensions(
        namespace_name,
        source_code
      );
      if (proto_members.includes(member_name)) {
        // Create a synthetic definition for the prototype member
        return {
          name: member_name,
          file_path: context_def.file_path,
          line: 0,
          column: 0,
          symbol_kind: 'function'
        } as Def;
      }
      break;
      
    case 'typescript':
      // Check for namespace/value merging
      const merge_info = TypeScriptBespoke.handle_namespace_value_merging(
        namespace_name,
        source_code
      );
      if (merge_info.is_merged) {
        // Additional resolution logic for merged namespaces
        // This would need more implementation
      }
      break;
      
    case 'python':
      // Check for dynamic attribute access
      const dynamic_members = PythonBespoke.handle_dynamic_attribute_access(
        namespace_name,
        source_code
      );
      if (dynamic_members.includes(member_name)) {
        // Create a synthetic definition for the dynamic member
        return {
          name: member_name,
          file_path: context_def.file_path,
          line: 0,
          column: 0,
          symbol_kind: 'variable'
        } as Def;
      }
      break;
      
    case 'rust':
      // Handle path keywords resolution
      const resolved_path = RustBespoke.handle_path_keywords(
        `${namespace_name}::${member_name}`,
        context_def.file_path
      );
      // Would need additional logic to resolve the path
      break;
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
    is_namespace_import(i.import_statement as any, context.language)
  );
  
  if (!namespace_import) {
    return [];
  }
  
  const target_file = namespace_import.import_statement.source;
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
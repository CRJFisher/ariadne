/**
 * TypeScript-specific bespoke symbol resolution
 * 
 * This module handles ONLY TypeScript-specific features that cannot be
 * expressed through configuration:
 * - Type-only imports and exports
 * - Interface merging
 * - Namespace declarations
 * - Decorators
 */

import { SyntaxNode } from 'tree-sitter';
import { Position, SymbolId, Def, SymbolKind } from '@ariadnejs/types';
import {
  FileResolutionContext,
  ResolvedSymbol,
} from './symbol_resolution';
import {
  construct_function_symbol,
  construct_class_symbol,
  construct_symbol,
} from '../../utils/symbol_construction';

// Re-use JavaScript bespoke handlers since TypeScript extends JavaScript
import {
  handle_javascript_hoisting,
  handle_prototype_chain,
  handle_this_binding,
  handle_super_binding,
} from './symbol_resolution.javascript';

// Re-export JavaScript handlers for TypeScript use
export {
  handle_javascript_hoisting,
  handle_prototype_chain,
  handle_this_binding,
  handle_super_binding,
};

/**
 * Handle type-only imports
 * TypeScript allows importing types separately from values
 */
export function handle_type_only_imports(
  symbol_name: string,
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis } = context;
  
  // Look for type imports: import type { X } from 'module'
  for (const imp of file_analysis.imports) {
    // Check if this is a type-only import
    if (is_type_import(imp) && imp.imported.includes(symbol_name)) {
      // Resolve to the type symbol
      return construct_class_symbol(imp.source, symbol_name);
    }
  }
  
  return undefined;
}

/**
 * Handle interface merging
 * TypeScript allows multiple interface declarations with the same name to be merged
 */
export function handle_interface_merging(
  interface_name: string,
  context: FileResolutionContext
): ResolvedSymbol[] {
  const { file_analysis } = context;
  const merged_interfaces: ResolvedSymbol[] = [];
  
  // Find all interface declarations with this name
  for (const def of file_analysis.definitions) {
    if (def.name === interface_name && def.kind === 'interface') {
      merged_interfaces.push({
        symbol_id: construct_class_symbol(file_analysis.file_path, interface_name),
        kind: 'interface' as SymbolKind,
        definition: def,
      });
    }
  }
  
  return merged_interfaces;
}

/**
 * Handle namespace declarations
 * TypeScript namespaces provide a way to organize code
 */
export function handle_namespaces(
  namespace_path: string[],
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis } = context;
  
  // Parse namespace path (e.g., ["MyNamespace", "SubNamespace", "Symbol"])
  if (namespace_path.length === 0) return undefined;
  
  let current_namespace = namespace_path[0];
  let remaining_path = namespace_path.slice(1);
  
  // Find the root namespace
  const namespace_def = file_analysis.definitions.find(
    (def: Def) => def.name === current_namespace && def.kind === 'namespace'
  );
  
  if (!namespace_def) return undefined;
  
  // If there's more path to traverse, recursively resolve
  if (remaining_path.length > 0) {
    // Look for nested namespaces or symbols within this namespace
    // This would need deeper AST analysis
    return undefined; // Simplified for now
  }
  
  return construct_function_symbol(file_analysis.file_path, current_namespace);
}

/**
 * Handle decorators
 * TypeScript decorators provide metadata and can modify classes, methods, properties
 */
export function handle_decorators(
  decorator_name: string,
  target_kind: 'class' | 'method' | 'property' | 'parameter',
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis } = context;
  
  // Decorators are usually imported or defined as functions
  // First check if it's imported
  for (const imp of file_analysis.imports) {
    if (imp.imported.includes(decorator_name)) {
      return construct_function_symbol(imp.source, decorator_name);
    }
  }
  
  // Check if it's defined locally
  const decorator_def = file_analysis.definitions.find(
    (def: Def) => def.name === decorator_name && def.kind === 'function'
  );
  
  if (decorator_def) {
    return construct_function_symbol(file_analysis.file_path, decorator_name);
  }
  
  return undefined;
}

/**
 * Handle ambient declarations
 * TypeScript allows declaring types for external modules
 */
export function handle_ambient_declarations(
  module_name: string,
  symbol_name: string,
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis } = context;
  
  // Look for declare module statements
  // This would need AST analysis to find ambient module declarations
  // For now, return undefined
  return undefined;
}

/**
 * Handle generic type parameters
 * TypeScript generics allow parameterized types
 */
export function handle_generic_parameters(
  type_name: string,
  type_params: string[],
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis } = context;
  
  // Find the generic type definition
  const type_def = file_analysis.definitions.find(
    (def: Def) => def.name === type_name && 
    (def.kind === 'interface' || def.kind === 'class' || def.kind === 'type')
  );
  
  if (type_def) {
    // Create a symbol ID that includes type parameters
    const full_name = `${type_name}<${type_params.join(', ')}>`;
    return construct_class_symbol(file_analysis.file_path, full_name);
  }
  
  return undefined;
}

// Helper functions

/**
 * Check if an import is a type-only import
 */
function is_type_import(imp: any): boolean {
  // This would need to check the AST node type
  // import type { X } from 'module' has a different node type
  return false; // Simplified for now
}

/**
 * Handle enum member resolution
 * TypeScript enums create both type and value bindings
 */
export function handle_enum_members(
  enum_name: string,
  member_name: string,
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis } = context;
  
  // Find the enum definition
  const enum_def = file_analysis.definitions.find(
    (def: Def) => def.name === enum_name && def.kind === 'enum'
  );
  
  if (enum_def) {
    // Enum members are accessible as EnumName.MemberName
    const full_name = `${enum_name}.${member_name}`;
    return construct_function_symbol(file_analysis.file_path, full_name);
  }
  
  return undefined;
}

/**
 * Handle type aliases
 * TypeScript type aliases create new names for types
 */
export function handle_type_aliases(
  alias_name: string,
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis } = context;
  
  // Find type alias definition
  const alias_def = file_analysis.definitions.find(
    (def: Def) => def.name === alias_name && def.kind === 'type'
  );
  
  if (alias_def) {
    return construct_class_symbol(file_analysis.file_path, alias_name);
  }
  
  return undefined;
}
/**
 * Definition finder feature - Dispatcher
 * 
 * Routes definition finding requests to language-specific implementations
 */

import { Language, Def, Ref, Position } from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';
import { ScopeTree } from '../scope_tree';
import { ResolutionContext, create_resolution_context } from '../symbol_resolution';
import {
  DefinitionResult,
  DefinitionFinderContext,
  find_definition_at_position,
  find_definition_for_symbol,
  find_all_definitions,
  find_definitions_by_kind,
  find_exported_definitions,
  is_definition_visible,
  go_to_definition_from_ref,
  find_definition_candidates
} from './definition_finder';
import {
  find_constructor_definition,
  find_prototype_method,
  find_object_property,
  find_arrow_function,
  find_all_functions,
  find_all_classes,
  is_hoisted_definition,
  find_module_exports
} from './definition_finder.javascript';

// Re-export core types and functions
export {
  DefinitionResult,
  DefinitionFinderContext,
  find_definition_at_position,
  find_definition_for_symbol,
  find_all_definitions,
  find_definitions_by_kind,
  find_exported_definitions,
  is_definition_visible,
  go_to_definition_from_ref,
  find_definition_candidates
};

/**
 * Create definition finder context
 */
export function create_definition_context(
  scope_tree: ScopeTree,
  file_path: string,
  source_code: string,
  language: Language,
  root_node?: SyntaxNode
): DefinitionFinderContext {
  // Create resolution context for enhanced definition finding
  const resolution_context = root_node ? 
    create_resolution_context(scope_tree, language, file_path, root_node, source_code) :
    create_resolution_context(scope_tree, language, file_path);
  
  return {
    scope_tree,
    file_path,
    source_code,
    resolution_context
  };
}

/**
 * Find definition with language-specific handling
 */
export function find_definition_with_language(
  symbol_name: string,
  scope_id: string,
  context: DefinitionFinderContext,
  language: Language
): DefinitionResult | undefined {
  // Use base definition finder
  const result = find_definition_for_symbol(symbol_name, scope_id, context);
  if (result) return result;
  
  // Try language-specific patterns
  switch (language) {
    case 'javascript':
    case 'jsx':
      // Try constructor pattern
      if (symbol_name[0] === symbol_name[0].toUpperCase()) {
        return find_constructor_definition(symbol_name, context);
      }
      
      // Try arrow function
      return find_arrow_function(symbol_name, context);
    
    case 'typescript':
    case 'tsx':
      // TypeScript uses same patterns as JavaScript
      if (symbol_name[0] === symbol_name[0].toUpperCase()) {
        return find_constructor_definition(symbol_name, context);
      }
      return find_arrow_function(symbol_name, context);
    
    default:
      return undefined;
  }
}

/**
 * Find method definition with language-specific handling
 */
export function find_method_definition(
  class_name: string,
  method_name: string,
  context: DefinitionFinderContext,
  language: Language
): DefinitionResult | undefined {
  switch (language) {
    case 'javascript':
    case 'jsx':
    case 'typescript':
    case 'tsx':
      return find_prototype_method(class_name, method_name, context);
    
    default:
      // Generic method search
      const qualified_name = `${class_name}.${method_name}`;
      return find_definition_for_symbol(qualified_name, context.scope_tree.root_id, context);
  }
}

/**
 * Find all definitions of a specific kind
 */
export function find_all_by_kind(
  kind: string,
  context: DefinitionFinderContext,
  language: Language
): Def[] {
  switch (kind) {
    case 'function':
      if (language === 'javascript' || language === 'jsx' || 
          language === 'typescript' || language === 'tsx') {
        return find_all_functions(context);
      }
      break;
    
    case 'class':
      if (language === 'javascript' || language === 'jsx' || 
          language === 'typescript' || language === 'tsx') {
        return find_all_classes(context);
      }
      break;
  }
  
  // Fall back to generic search
  return find_definitions_by_kind(context.scope_tree, kind, context.file_path);
}

/**
 * High-level API: Go to definition
 */
export function go_to_definition(
  position: Position,
  scope_tree: ScopeTree,
  file_path: string,
  source_code: string,
  language: Language,
  root_node?: SyntaxNode
): Def | undefined {
  const context = create_definition_context(
    scope_tree,
    file_path,
    source_code,
    language,
    root_node
  );
  
  const result = find_definition_at_position(position, context);
  return result?.definition;
}

/**
 * High-level API: Find all definitions
 */
export function get_all_definitions(
  scope_tree: ScopeTree,
  file_path: string,
  language: Language
): Def[] {
  return find_all_definitions(scope_tree, file_path);
}

/**
 * High-level API: Find exported definitions
 */
export function get_exported_definitions(
  scope_tree: ScopeTree,
  file_path: string,
  language: Language
): Def[] {
  return find_exported_definitions(scope_tree, file_path);
}

/**
 * High-level API: Check if definition is hoisted
 */
export function is_hoisted(
  def: Def,
  scope_tree: ScopeTree,
  language: Language
): boolean {
  if (language === 'javascript' || language === 'jsx' || 
      language === 'typescript' || language === 'tsx') {
    return is_hoisted_definition(def, scope_tree);
  }
  
  // Other languages don't have hoisting
  return false;
}
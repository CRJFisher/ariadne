/**
 * JavaScript-specific definition finder
 * 
 * Handles JavaScript's unique definition patterns:
 * - Constructor functions
 * - Prototype definitions
 * - Object literal methods
 * - ES6 class definitions
 * - Arrow functions
 * - Function expressions
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, Def, Position } from '@ariadnejs/types';
import { ScopeTree } from '../scope_tree';
import {
  DefinitionResult,
  DefinitionFinderContext,
  find_definition_for_symbol,
  find_all_definitions,
  find_definitions_by_kind
} from './definition_finder';

/**
 * Find JavaScript constructor definition
 */
export function find_constructor_definition(
  class_name: string,
  context: DefinitionFinderContext
): DefinitionResult | undefined {
  // Look for class declaration
  const class_def = find_definition_for_symbol(class_name, context.scope_tree.root_id, context);
  if (class_def && class_def.definition.symbol_kind === 'class') {
    return class_def;
  }
  
  // Look for constructor function
  const func_def = find_definition_for_symbol(class_name, context.scope_tree.root_id, context);
  if (func_def && func_def.definition.symbol_kind === 'function') {
    // Check if it looks like a constructor (capital first letter)
    if (class_name[0] === class_name[0].toUpperCase()) {
      return {
        ...func_def,
        definition: {
          ...func_def.definition,
          symbol_kind: 'constructor'
        }
      };
    }
  }
  
  return undefined;
}

/**
 * Find prototype method definition
 */
export function find_prototype_method(
  class_name: string,
  method_name: string,
  context: DefinitionFinderContext
): DefinitionResult | undefined {
  // Look for Class.prototype.method pattern
  const prototype_name = `${class_name}.prototype.${method_name}`;
  
  // This would require tracking prototype assignments
  // For now, search for method definitions in class scope
  const class_def = find_constructor_definition(class_name, context);
  if (!class_def) return undefined;
  
  // Find the class scope
  for (const [scope_id, scope] of context.scope_tree.nodes) {
    if (scope.type === 'class' && scope.metadata?.name === class_name) {
      // Look for method in class scope
      const method_symbol = scope.symbols.get(method_name);
      if (method_symbol) {
        const def: Def = {
          id: `def_${scope_id}_${method_name}`,
          kind: 'definition',
          name: method_name,
          symbol_kind: 'method',
          range: method_symbol.range,
          file_path: context.file_path
        };
        
        return {
          definition: def,
          confidence: 'exact',
          source: 'local'
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Find object property definition
 */
export function find_object_property(
  object_name: string,
  property_name: string,
  context: DefinitionFinderContext
): DefinitionResult | undefined {
  // First find the object definition
  const object_def = find_definition_for_symbol(object_name, context.scope_tree.root_id, context);
  if (!object_def) return undefined;
  
  // This would require analyzing object literal properties
  // For now, return a possible match
  const def: Def = {
    id: `def_prop_${property_name}`,
    kind: 'definition',
    name: property_name,
    symbol_kind: 'property',
    range: object_def.definition.range,  // Use object's range as approximation
    file_path: context.file_path
  };
  
  return {
    definition: def,
    confidence: 'possible',
    source: 'local'
  };
}

/**
 * Find arrow function definition
 */
export function find_arrow_function(
  name: string,
  context: DefinitionFinderContext
): DefinitionResult | undefined {
  // Arrow functions are usually assigned to variables
  const def = find_definition_for_symbol(name, context.scope_tree.root_id, context);
  
  if (def && def.definition.symbol_kind === 'variable') {
    // Would need to check if the variable is assigned an arrow function
    // For now, return as possible function
    return {
      ...def,
      definition: {
        ...def.definition,
        symbol_kind: 'function'
      },
      confidence: 'likely'
    };
  }
  
  return def;
}

/**
 * Find all function definitions (including arrows and expressions)
 */
export function find_all_functions(
  context: DefinitionFinderContext
): Def[] {
  const functions: Def[] = [];
  
  // Get regular function declarations
  functions.push(...find_definitions_by_kind(context.scope_tree, 'function', context.file_path));
  
  // Get methods
  functions.push(...find_definitions_by_kind(context.scope_tree, 'method', context.file_path));
  
  // Get arrow functions (would need AST analysis)
  // For now, just return declared functions
  
  return functions;
}

/**
 * Find all class definitions
 */
export function find_all_classes(
  context: DefinitionFinderContext
): Def[] {
  return find_definitions_by_kind(context.scope_tree, 'class', context.file_path);
}

/**
 * Check if definition is hoisted
 */
export function is_hoisted_definition(
  def: Def,
  scope_tree: ScopeTree
): boolean {
  // Function declarations and var declarations are hoisted
  if (def.symbol_kind === 'function') return true;
  
  // Check if it's a var declaration
  for (const [_, scope] of scope_tree.nodes) {
    const symbol = scope.symbols.get(def.name);
    if (symbol && symbol.is_hoisted) {
      return true;
    }
  }
  
  return false;
}

/**
 * Find CommonJS module.exports definition
 */
export function find_module_exports(
  context: DefinitionFinderContext
): DefinitionResult | undefined {
  // Look for module.exports assignment
  // This would require AST analysis
  // For now, check if there's an 'exports' symbol
  
  const root_scope = context.scope_tree.nodes.get(context.scope_tree.root_id);
  if (!root_scope) return undefined;
  
  for (const [name, symbol] of root_scope.symbols) {
    if (name === 'exports' || name === 'module') {
      const def: Def = {
        id: `def_exports`,
        kind: 'definition',
        name: 'module.exports',
        symbol_kind: 'export',
        range: symbol.range,
        file_path: context.file_path
      };
      
      return {
        definition: def,
        confidence: 'likely',
        source: 'local'
      };
    }
  }
  
  return undefined;
}
/**
 * Return type inference module
 * 
 * Combines configuration-driven generic processing with language-specific
 * bespoke handlers for complete return type inference.
 */

import { SyntaxNode } from 'tree-sitter';
import { Def, Language } from '@ariadnejs/types';

// Import core types and generic processor
import {
  ReturnTypeInfo,
  ReturnAnalysis,
  ReturnTypeContext,
  RETURN_TYPE_CONTEXT,
  analyze_return_type_generic,
  extract_explicit_return_type_generic,
  analyze_return_statements_generic,
  find_return_statements,
  is_function_node,
  get_enclosing_class_name,
  is_async_function,
  is_constructor_name,
  get_void_type
} from './return_type_inference';

// Import configuration
import { get_return_type_config } from './language_configs';

// Import bespoke handlers
import {
  handle_typescript_decorators,
  handle_typescript_complex_generics,
  handle_typescript_utility_types,
  handle_typescript_composite_types
} from './return_type_inference.typescript.bespoke';

import {
  handle_javascript_jsdoc,
  handle_javascript_constructor_function,
  handle_javascript_commonjs_patterns,
  handle_javascript_class_factories,
  handle_javascript_promise_patterns
} from './return_type_inference.javascript.bespoke';

import {
  handle_python_docstring_types,
  handle_python_special_methods,
  handle_python_comprehensions,
  handle_python_typing_special_forms
} from './return_type_inference.python.bespoke';

import {
  handle_rust_impl_trait,
  handle_rust_result_option,
  handle_rust_lifetimes,
  handle_rust_associated_types,
  handle_rust_macro_types,
  handle_rust_trait_methods
} from './return_type_inference.rust.bespoke';

// Re-export core types
export {
  ReturnTypeInfo,
  ReturnAnalysis,
  ReturnTypeContext,
  RETURN_TYPE_CONTEXT,
  find_return_statements,
  is_function_node,
  get_enclosing_class_name,
  is_async_function,
  is_constructor_name,
  get_void_type
};

/**
 * Main entry point: Infer return type for a function definition
 */
export function infer_function_return_type(
  def: Def,
  func_node: SyntaxNode,
  context: ReturnTypeContext
): ReturnTypeInfo | undefined {
  // Try generic processor first (handles 85% of cases)
  const generic_result = analyze_return_type_generic(def, func_node, context);
  
  // Apply language-specific bespoke handlers for special cases
  const bespoke_result = apply_bespoke_handlers(def, func_node, context, generic_result);
  
  return bespoke_result || generic_result;
}

/**
 * Apply language-specific bespoke handlers
 */
function apply_bespoke_handlers(
  def: Def,
  func_node: SyntaxNode,
  context: ReturnTypeContext,
  generic_result: ReturnTypeInfo | undefined
): ReturnTypeInfo | undefined {
  switch (context.language) {
    case 'typescript':
      return apply_typescript_bespoke(def, func_node, context, generic_result);
    
    case 'javascript':
      return apply_javascript_bespoke(def, func_node, context, generic_result);
    
    case 'python':
      return apply_python_bespoke(def, func_node, context, generic_result);
    
    case 'rust':
      return apply_rust_bespoke(def, func_node, context, generic_result);
    
    default:
      return undefined;
  }
}

/**
 * Apply TypeScript bespoke handlers
 */
function apply_typescript_bespoke(
  def: Def,
  func_node: SyntaxNode,
  context: ReturnTypeContext,
  generic_result: ReturnTypeInfo | undefined
): ReturnTypeInfo | undefined {
  // Check for decorators that modify return types
  const decorator_type = handle_typescript_decorators(func_node, context);
  if (decorator_type) {
    return decorator_type;
  }
  
  // Handle complex generic types if present in generic result
  if (generic_result && generic_result.type_name.includes('<')) {
    const complex_generic = handle_typescript_complex_generics(
      func_node.childForFieldName('return_type') || func_node,
      context
    );
    if (complex_generic) {
      return {
        ...generic_result,
        type_name: complex_generic
      };
    }
  }
  
  // Check for utility types
  if (generic_result) {
    const utility_type = handle_typescript_utility_types(generic_result.type_name, context);
    if (utility_type) {
      return utility_type;
    }
  }
  
  return undefined;
}

/**
 * Apply JavaScript bespoke handlers
 */
function apply_javascript_bespoke(
  def: Def,
  func_node: SyntaxNode,
  context: ReturnTypeContext,
  generic_result: ReturnTypeInfo | undefined
): ReturnTypeInfo | undefined {
  // Check JSDoc comments first
  const jsdoc_type = handle_javascript_jsdoc(func_node, context);
  if (jsdoc_type) {
    return jsdoc_type;
  }
  
  // Check for constructor function pattern
  const constructor_type = handle_javascript_constructor_function(
    func_node,
    def.name,
    context
  );
  if (constructor_type) {
    return constructor_type;
  }
  
  // Check CommonJS patterns
  const commonjs_type = handle_javascript_commonjs_patterns(func_node, context);
  if (commonjs_type) {
    return commonjs_type;
  }
  
  // Check class factory patterns
  const class_factory = handle_javascript_class_factories(func_node, context);
  if (class_factory) {
    return class_factory;
  }
  
  // Check Promise patterns
  const promise_type = handle_javascript_promise_patterns(func_node, context);
  if (promise_type) {
    return promise_type;
  }
  
  return undefined;
}

/**
 * Apply Python bespoke handlers
 */
function apply_python_bespoke(
  def: Def,
  func_node: SyntaxNode,
  context: ReturnTypeContext,
  generic_result: ReturnTypeInfo | undefined
): ReturnTypeInfo | undefined {
  // Check for docstring type annotations
  const docstring_type = handle_python_docstring_types(func_node, context);
  if (docstring_type) {
    return docstring_type;
  }
  
  // Check for special methods
  const special_method = handle_python_special_methods(def.name, context.class_name);
  if (special_method) {
    return special_method;
  }
  
  // Check for comprehensions in return statements
  const returns = find_return_statements(func_node);
  for (const ret of returns) {
    const value = ret.childForFieldName('value');
    if (value) {
      const comprehension = handle_python_comprehensions(value, context);
      if (comprehension) {
        return comprehension;
      }
    }
  }
  
  // Handle typing module special forms
  if (generic_result) {
    const special_form = handle_python_typing_special_forms(generic_result.type_name);
    if (special_form) {
      return {
        ...generic_result,
        type_name: special_form
      };
    }
  }
  
  return undefined;
}

/**
 * Apply Rust bespoke handlers
 */
function apply_rust_bespoke(
  def: Def,
  func_node: SyntaxNode,
  context: ReturnTypeContext,
  generic_result: ReturnTypeInfo | undefined
): ReturnTypeInfo | undefined {
  // Get return type node for analysis
  const return_type_node = func_node.childForFieldName('return_type');
  
  if (return_type_node) {
    // Handle impl Trait types
    const impl_trait = handle_rust_impl_trait(return_type_node, context);
    if (impl_trait) {
      return {
        type_name: impl_trait,
        confidence: 'explicit',
        source: 'annotation'
      };
    }
    
    // Handle associated types
    const assoc_type = handle_rust_associated_types(return_type_node, context);
    if (assoc_type) {
      return {
        type_name: assoc_type,
        confidence: 'explicit',
        source: 'annotation'
      };
    }
  }
  
  // Handle Result and Option patterns
  if (generic_result) {
    const result_option = handle_rust_result_option(
      generic_result.type_name,
      func_node,
      context
    );
    if (result_option) {
      return result_option;
    }
    
    // Simplify lifetime annotations
    const simplified = handle_rust_lifetimes(generic_result.type_name);
    if (simplified !== generic_result.type_name) {
      return {
        ...generic_result,
        type_name: simplified
      };
    }
  }
  
  // Check for macro-generated types
  const macro_type = handle_rust_macro_types(func_node, context);
  if (macro_type) {
    return macro_type;
  }
  
  // Check for trait method implementations
  const impl_trait = extract_impl_trait(func_node);
  if (impl_trait) {
    const trait_method = handle_rust_trait_methods(def.name, impl_trait);
    if (trait_method) {
      return trait_method;
    }
  }
  
  return undefined;
}

/**
 * Helper: Extract impl trait context for Rust
 */
function extract_impl_trait(func_node: SyntaxNode): string | undefined {
  let current = func_node.parent;
  
  while (current) {
    if (current.type === 'impl_item') {
      const trait_node = current.childForFieldName('trait');
      if (trait_node) {
        return trait_node.text;
      }
    }
    current = current.parent;
  }
  
  return undefined;
}

/**
 * Process an entire file for return type inference
 */
export function process_file_for_return_types(
  defs: Def[],
  tree: SyntaxNode,
  source_code: string,
  language: Language,
  debug: boolean = false
): Map<string, ReturnTypeInfo> {
  const return_types = new Map<string, ReturnTypeInfo>();
  const context: ReturnTypeContext = {
    language,
    source_code,
    debug
  };

  for (const def of defs) {
    if (def.symbol_kind === 'function' || def.symbol_kind === 'method') {
      // Find the AST node for this definition
      const func_node = find_function_node_at_position(def, tree);
      if (func_node) {
        // Add class context for methods
        if (def.symbol_kind === 'method') {
          context.class_name = get_enclosing_class_name(func_node);
        }

        const return_type = infer_function_return_type(def, func_node, context);
        if (return_type) {
          // Create a unique key for the function
          const key = `${def.name}:${def.range.start.row}:${def.range.start.column}`;
          return_types.set(key, return_type);
        }
      }
    }
  }

  return return_types;
}

/**
 * Find the AST node for a function definition
 */
function find_function_node_at_position(def: Def, tree: SyntaxNode): SyntaxNode | undefined {
  // Navigate to the position in the tree
  let current = tree;
  
  while (current) {
    // Check if this node matches the definition position
    if (current.startPosition.row === def.range.start.row &&
        current.startPosition.column <= def.range.start.column &&
        current.endPosition.row >= def.range.end.row &&
        is_function_node(current)) {
      return current;
    }

    // Find child that contains the position
    let found_child = false;
    for (let i = 0; i < current.childCount; i++) {
      const child = current.child(i);
      if (child &&
          child.startPosition.row <= def.range.start.row &&
          child.endPosition.row >= def.range.start.row) {
        current = child;
        found_child = true;
        break;
      }
    }

    if (!found_child) {
      break;
    }
  }

  return undefined;
}

/**
 * Get a descriptive name for a return type
 */
export function get_return_type_description(
  return_type: ReturnTypeInfo,
  language: Language
): string {
  const { type_name, confidence, source } = return_type;
  
  // Add confidence indicator if not explicit
  if (confidence !== 'explicit') {
    return `${type_name} (${confidence})`;
  }
  
  return type_name;
}

/**
 * Check if a return type is a promise/future type
 */
export function is_async_return_type(
  return_type: ReturnTypeInfo,
  language: Language
): boolean {
  const type_name = return_type.type_name;
  
  switch (language) {
    case 'javascript':
    case 'typescript':
      return type_name.startsWith('Promise<') || type_name === 'Promise';
    case 'python':
      return type_name.startsWith('Awaitable') || 
             type_name.startsWith('Coroutine') ||
             type_name.startsWith('Future');
    case 'rust':
      return type_name.includes('Future') || type_name.includes('async');
    default:
      return false;
  }
}

/**
 * Check if a return type is a generator/iterator type
 */
export function is_generator_return_type(
  return_type: ReturnTypeInfo,
  language: Language
): boolean {
  const type_name = return_type.type_name;
  
  switch (language) {
    case 'javascript':
    case 'typescript':
      return type_name === 'Generator' || type_name.startsWith('Generator<');
    case 'python':
      return type_name === 'Generator' || 
             type_name === 'Iterator' ||
             type_name.startsWith('Generator[') ||
             type_name.startsWith('Iterator[');
    case 'rust':
      return type_name.includes('Iterator') || 
             type_name.includes('impl Iterator');
    default:
      return false;
  }
}

// Legacy exports for backward compatibility
export {
  infer_function_return_type as analyze_return_type,
  process_file_for_return_types as analyze_file_return_types
};
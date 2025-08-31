/**
 * Generic type resolution dispatcher
 * 
 * Routes generic type resolution to language-specific implementations
 */

import { Language, TypeName } from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';
import {
  GenericParameter,
  GenericInstance,
  GenericContext,
  ResolvedGeneric,
  create_generic_context,
  bind_type_arguments,
  resolve_generic_type,
  parse_generic_type,
  satisfies_constraint,
  infer_type_arguments,
  substitute_type_parameters
} from './generic_resolution';

// Language-specific imports
import {
  extract_typescript_generics,
  resolve_typescript_generic,
  is_typescript_generic
} from './generic_resolution.typescript';

import {
  extract_rust_generics,
  resolve_rust_generic,
  is_rust_generic
} from './generic_resolution.rust';

import {
  extract_python_generics,
  resolve_python_generic,
  is_typing_generic
} from './generic_resolution.python';

// Re-export core types and functions
export {
  GenericParameter,
  GenericInstance,
  GenericContext,
  ResolvedGeneric,
  create_generic_context,
  bind_type_arguments,
  resolve_generic_type,
  parse_generic_type,
  satisfies_constraint,
  infer_type_arguments,
  substitute_type_parameters
};

/**
 * Extract generic parameters from a type definition
 * Dispatches to language-specific implementations
 */
export function extract_generic_parameters(
  node: SyntaxNode,
  source_code: string,
  language: Language
): GenericParameter[] {
  switch (language) {
    case 'typescript':
    case 'tsx':
      return extract_typescript_generics(node, source_code);
    
    case 'rust':
      return extract_rust_generics(node, source_code);
    
    case 'python':
      return extract_python_generics(node, source_code);
    
    case 'javascript':
    case 'jsx':
      // JavaScript doesn't have static generics
      return [];
    
    default:
      return [];
  }
}


/**
 * Resolve generic types for a specific language
 * Dispatches to language-specific implementations
 */
export function resolve_language_generic(
  type_ref: string,
  language: Language,
  context: GenericContext,
  type_registry?: Map<string, any>
): ResolvedGeneric {
  switch (language) {
    case 'typescript':
    case 'tsx':
      return resolve_typescript_generic(type_ref, context, type_registry);
    
    case 'rust':
      return resolve_rust_generic(type_ref, context, type_registry);
    
    case 'python':
      return resolve_python_generic(type_ref, context, type_registry);
    
    case 'javascript':
    case 'jsx':
      // JavaScript doesn't have static generics, use default resolution
      return resolve_generic_type(type_ref, context);
    
    default:
      return resolve_generic_type(type_ref, context);
  }
}

/**
 * Check if a type name is a generic parameter for a given language
 */
export function is_generic_parameter(
  type_name: string,
  language: Language
): boolean {
  switch (language) {
    case 'typescript':
    case 'tsx':
      return is_typescript_generic(type_name);
    
    case 'rust':
      return is_rust_generic(type_name);
    
    case 'python':
      return is_typing_generic(type_name);
    
    case 'javascript':
    case 'jsx':
      // JavaScript doesn't have static generics
      return false;
    
    default:
      // Default heuristic: single uppercase letters are often generics
      return /^[A-Z]$/.test(type_name);
  }
}
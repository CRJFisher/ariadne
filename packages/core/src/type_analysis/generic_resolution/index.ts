/**
 * Generic type resolution dispatcher
 * 
 * Routes generic type resolution to language-specific implementations
 */

import { 
  Language, 
  TypeName,
  GenericParameter,
  GenericInstance,
  GenericContext,
  ResolvedGeneric
} from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';
import {
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

// Re-export types from shared package for convenience
export {
  GenericParameter,
  GenericInstance,
  ResolvedGeneric
} from '@ariadnejs/types';

// Re-export core functions and internal types
export {
  GenericContext,
  create_generic_context,
  bind_type_arguments,
  resolve_generic_type,
  parse_generic_type,
  satisfies_constraint,
  infer_type_arguments,
  substitute_type_parameters
} from './generic_resolution';

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
      // TypeScript and TSX use the same generic resolution
      return extract_typescript_generics(node, source_code);
    
    case 'rust':
      return extract_rust_generics(node, source_code);
    
    case 'python':
      return extract_python_generics(node, source_code);
    
    case 'javascript':
      // JavaScript and JSX don't have static generics
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
      // TypeScript and TSX use the same generic resolution
      return resolve_typescript_generic(type_ref, context, type_registry);
    
    case 'rust':
      return resolve_rust_generic(type_ref, context, type_registry);
    
    case 'python':
      return resolve_python_generic(type_ref, context, type_registry);
    
    case 'javascript':
      // JavaScript and JSX don't have static generics, use default resolution
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
      // TypeScript and TSX use the same generic checking
      return is_typescript_generic(type_name);
    
    case 'rust':
      return is_rust_generic(type_name);
    
    case 'python':
      return is_typing_generic(type_name);
    
    case 'javascript':
      // JavaScript and JSX don't have static generics
      return false;
    
    default:
      // Default heuristic: single uppercase letters are often generics
      return /^[A-Z]$/.test(type_name);
  }
}

/**
 * Resolve generic types across all files in the codebase
 * This is the main entry point for Layer 7 generic resolution
 */
export async function resolve_generics_across_files(
  analyses: FileAnalysis[],
  type_registry: any, // TypeRegistry from type_registry module
  class_hierarchy: any, // ClassHierarchy from class_hierarchy module  
  modules: any // ModuleGraph from module_graph
): Promise<Map<string, ResolvedGeneric[]>> {
  const resolved_generics = new Map<string, ResolvedGeneric[]>();
  
  // Process each file's analysis
  for (const analysis of analyses) {
    const file_generics: ResolvedGeneric[] = [];
    
    // Extract language from file extension
    const language = analysis.language;
    
    // Process class generics
    for (const class_info of analysis.classes) {
      // Extract generic parameters from class definition
      if (class_info.type_parameters && class_info.type_parameters.length > 0) {
        const context = create_generic_context(
          class_info.type_parameters.map(tp => ({
            name: tp.name,
            constraint: tp.constraint,
            default: tp.default_type
          }))
        );
        
        // Process methods that might use these generics
        for (const method of class_info.methods) {
          if (method.return_type) {
            const resolved = resolve_language_generic(
              method.return_type,
              language,
              context,
              type_registry
            );
            file_generics.push(resolved);
          }
          
          // Process parameter types
          for (const param of method.parameters) {
            if (param.type) {
              const resolved = resolve_language_generic(
                param.type,
                language,
                context,
                type_registry
              );
              file_generics.push(resolved);
            }
          }
        }
      }
    }
    
    // Process function generics
    for (const func of analysis.functions) {
      if (func.type_parameters && func.type_parameters.length > 0) {
        const context = create_generic_context(
          func.type_parameters.map(tp => ({
            name: tp.name,
            constraint: tp.constraint,
            default: tp.default_type
          }))
        );
        
        // Process return type
        if (func.return_type) {
          const resolved = resolve_language_generic(
            func.return_type,
            language,
            context,
            type_registry
          );
          file_generics.push(resolved);
        }
        
        // Process parameter types
        for (const param of func.parameters) {
          if (param.type) {
            const resolved = resolve_language_generic(
              param.type,
              language,
              context,
              type_registry
            );
            file_generics.push(resolved);
          }
        }
      }
    }
    
    // Store resolved generics for this file
    if (file_generics.length > 0) {
      resolved_generics.set(analysis.file_path, file_generics);
    }
  }
  
  return resolved_generics;
}
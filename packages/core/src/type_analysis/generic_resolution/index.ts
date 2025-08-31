/**
 * Generic type resolution dispatcher
 * 
 * Routes generic type resolution to language-specific implementations
 */

import { Language, TypeName } from '@ariadnejs/types';
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
 */
export function extract_generic_parameters(
  node: any, // SyntaxNode
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
      // Python 3.9+ has basic generic support
      return extract_python_generics(node, source_code);
    
    default:
      return [];
  }
}

/**
 * Extract TypeScript generic parameters
 */
function extract_typescript_generics(node: any, source_code: string): GenericParameter[] {
  const params: GenericParameter[] = [];
  
  // Look for type_parameters node
  const type_params = node.childForFieldName?.('type_parameters');
  if (!type_params) return params;
  
  // Iterate through type parameters
  for (let i = 0; i < type_params.childCount; i++) {
    const param = type_params.child(i);
    if (param?.type === 'type_parameter') {
      const name = param.childForFieldName('name');
      const constraint = param.childForFieldName('constraint');
      const default_type = param.childForFieldName('default');
      
      params.push({
        name: name ? source_code.substring(name.startIndex, name.endIndex) : '',
        constraint: constraint ? source_code.substring(constraint.startIndex, constraint.endIndex) : undefined,
        default: default_type ? source_code.substring(default_type.startIndex, default_type.endIndex) : undefined
      });
    }
  }
  
  return params;
}

/**
 * Extract Rust generic parameters
 */
function extract_rust_generics(node: any, source_code: string): GenericParameter[] {
  const params: GenericParameter[] = [];
  
  // Look for type_parameters or generic_parameters
  const type_params = node.childForFieldName?.('type_parameters') || 
                     node.childForFieldName?.('generic_parameters');
  if (!type_params) return params;
  
  // Iterate through parameters
  for (let i = 0; i < type_params.childCount; i++) {
    const param = type_params.child(i);
    
    if (param?.type === 'type_identifier' || param?.type === 'generic_type') {
      const name = source_code.substring(param.startIndex, param.endIndex);
      
      // Look for bounds (e.g., T: Clone + Debug)
      const next = type_params.child(i + 1);
      let constraint: string | undefined;
      
      if (next?.type === ':') {
        let bound_end = i + 2;
        const bounds: string[] = [];
        
        while (bound_end < type_params.childCount) {
          const bound = type_params.child(bound_end);
          if (bound?.type === ',') break;
          if (bound?.type === 'type_identifier' || bound?.type === 'trait_bound') {
            bounds.push(source_code.substring(bound.startIndex, bound.endIndex));
          }
          bound_end++;
        }
        
        if (bounds.length > 0) {
          constraint = bounds.join(' + ');
        }
      }
      
      params.push({ name, constraint });
    }
  }
  
  return params;
}

/**
 * Extract Python generic parameters (PEP 484 style)
 */
function extract_python_generics(node: any, source_code: string): GenericParameter[] {
  const params: GenericParameter[] = [];
  
  // Look for Generic[T] or TypeVar definitions
  if (node.type === 'subscript' || node.type === 'generic_type') {
    const value = node.childForFieldName?.('value');
    
    if (value && source_code.substring(value.startIndex, value.endIndex) === 'Generic') {
      const slice = node.childForFieldName('slice');
      if (slice) {
        const param_text = source_code.substring(slice.startIndex, slice.endIndex);
        // Split on commas (simple parsing)
        const param_names = param_text.split(',').map(s => s.trim());
        
        for (const name of param_names) {
          params.push({ name });
        }
      }
    }
  }
  
  return params;
}

/**
 * Resolve generic types for a specific language
 */
export function resolve_language_generic(
  type_ref: string,
  language: Language,
  context: GenericContext,
  type_registry?: Map<string, any>
): ResolvedGeneric {
  // Language-specific resolution can add additional rules
  switch (language) {
    case 'typescript':
    case 'tsx':
      return resolve_typescript_generic(type_ref, context, type_registry);
    
    case 'rust':
      return resolve_rust_generic(type_ref, context, type_registry);
    
    case 'python':
      return resolve_python_generic(type_ref, context, type_registry);
    
    default:
      return resolve_generic_type(type_ref, context);
  }
}

/**
 * TypeScript-specific generic resolution
 */
function resolve_typescript_generic(
  type_ref: string,
  context: GenericContext,
  type_registry?: Map<string, any>
): ResolvedGeneric {
  // Handle TypeScript utility types
  const utility_types: Record<string, (args: string[]) => string> = {
    'Partial': (args) => `{ [K in keyof ${args[0]}]?: ${args[0]}[K] }`,
    'Required': (args) => `{ [K in keyof ${args[0]}]-?: ${args[0]}[K] }`,
    'Readonly': (args) => `{ readonly [K in keyof ${args[0]}]: ${args[0]}[K] }`,
    'Pick': (args) => `{ [K in ${args[1]}]: ${args[0]}[K] }`,
    'Omit': (args) => `{ [K in Exclude<keyof ${args[0]}, ${args[1]}>]: ${args[0]}[K] }`,
    'Record': (args) => `{ [K in ${args[0]}]: ${args[1]} }`,
    'ReturnType': (args) => `ReturnType<${args[0]}>`,
    'InstanceType': (args) => `InstanceType<${args[0]}>`,
    'NonNullable': (args) => `${args[0]} & {}`
  };
  
  const parsed = parse_generic_type(type_ref);
  if (parsed && utility_types[parsed.base_type]) {
    const resolved_args = parsed.type_arguments.map(arg => {
      const resolved = resolve_generic_type(arg, context);
      return resolved.resolved_type;
    });
    
    const resolved_type = utility_types[parsed.base_type](resolved_args);
    
    return {
      original_type: type_ref,
      resolved_type,
      type_substitutions: new Map(),
      confidence: 'exact'
    };
  }
  
  // Fall back to standard resolution
  return resolve_generic_type(type_ref, context);
}

/**
 * Rust-specific generic resolution
 */
function resolve_rust_generic(
  type_ref: string,
  context: GenericContext,
  type_registry?: Map<string, any>
): ResolvedGeneric {
  // Handle Rust-specific patterns like lifetimes
  let cleaned_ref = type_ref.replace(/'[a-z]+/g, ''); // Remove lifetime annotations
  
  // Handle associated types (e.g., T::Item)
  if (cleaned_ref.includes('::')) {
    const parts = cleaned_ref.split('::');
    const base = parts[0];
    
    // Resolve the base type first
    const base_resolved = resolve_generic_type(base, context);
    if (base_resolved.resolved_type !== base) {
      cleaned_ref = cleaned_ref.replace(base, base_resolved.resolved_type);
    }
  }
  
  return resolve_generic_type(cleaned_ref, context);
}

/**
 * Python-specific generic resolution
 */
function resolve_python_generic(
  type_ref: string,
  context: GenericContext,
  type_registry?: Map<string, any>
): ResolvedGeneric {
  // Handle Python typing module generics
  const typing_aliases: Record<string, string> = {
    'List': 'list',
    'Dict': 'dict',
    'Set': 'set',
    'Tuple': 'tuple',
    'Optional': 'Union[T, None]',
    'Callable': 'callable'
  };
  
  const parsed = parse_generic_type(type_ref);
  if (parsed && typing_aliases[parsed.base_type]) {
    const base = typing_aliases[parsed.base_type];
    const resolved_args = parsed.type_arguments.map(arg => {
      const resolved = resolve_generic_type(arg, context);
      return resolved.resolved_type;
    });
    
    const resolved_type = resolved_args.length > 0
      ? `${base}[${resolved_args.join(', ')}]`
      : base;
    
    return {
      original_type: type_ref,
      resolved_type,
      type_substitutions: new Map(),
      confidence: 'exact'
    };
  }
  
  return resolve_generic_type(type_ref, context);
}
/**
 * TypeScript-specific generic type resolution
 * 
 * Handles TypeScript generics, utility types, and type parameter extraction
 */

import { SyntaxNode } from 'tree-sitter';
import {
  GenericParameter,
  GenericContext,
  ResolvedGeneric,
  parse_generic_type,
  resolve_generic_type
} from './generic_resolution';

/**
 * Extract TypeScript generic parameters from AST node
 */
export function extract_typescript_generics(
  node: SyntaxNode,
  source_code: string
): GenericParameter[] {
  const params: GenericParameter[] = [];
  
  // Look for type_parameters node
  const type_params = node.childForFieldName('type_parameters');
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
 * TypeScript-specific generic resolution with utility types
 */
export function resolve_typescript_generic(
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
 * Check if a type name is a TypeScript generic parameter
 */
export function is_typescript_generic(type_name: string): boolean {
  // Single uppercase letters are typically generic parameters
  if (/^[A-Z]$/.test(type_name)) return true;
  
  // Common generic parameter patterns
  const generic_patterns = [
    /^T[A-Z]?.*$/,  // T, TKey, TValue, etc.
    /^K$/,          // K for key
    /^V$/,          // V for value
    /^E$/,          // E for element
    /^R$/,          // R for return
  ];
  
  return generic_patterns.some(pattern => pattern.test(type_name));
}
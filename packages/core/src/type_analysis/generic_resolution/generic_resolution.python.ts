/**
 * Python-specific generic type resolution
 * 
 * Handles Python generics (PEP 484), TypeVar, Generic base class, and typing module types
 */

import { SyntaxNode } from 'tree-sitter';
import {
  GenericParameter,
  ResolvedGeneric
} from '@ariadnejs/types';
import {
  GenericContext,
  parse_generic_type,
  resolve_generic_type
} from './generic_resolution';

/**
 * Extract Python generic parameters from AST node (PEP 484 style)
 */
export function extract_python_generics(
  node: SyntaxNode,
  source_code: string
): GenericParameter[] {
  const params: GenericParameter[] = [];
  
  // Look for Generic[T] or TypeVar definitions
  if (node.type === 'subscript' || node.type === 'generic_type') {
    const value = node.childForFieldName('value');
    
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
  
  // Also look for TypeVar declarations
  if (node.type === 'assignment') {
    const right = node.childForFieldName('right');
    if (right?.type === 'call') {
      const function_node = right.childForFieldName('function');
      if (function_node && source_code.substring(function_node.startIndex, function_node.endIndex) === 'TypeVar') {
        const left = node.childForFieldName('left');
        if (left) {
          const name = source_code.substring(left.startIndex, left.endIndex);
          
          // Look for constraints in TypeVar arguments
          const args = right.childForFieldName('arguments');
          let constraint: string | undefined;
          
          if (args && args.childCount > 2) {
            // TypeVar('T', bound=Constraint) or TypeVar('T', Type1, Type2)
            const constraints: string[] = [];
            for (let i = 2; i < args.childCount; i++) {
              const arg = args.child(i);
              if (arg && arg.type !== ',' && arg.type !== ')') {
                constraints.push(source_code.substring(arg.startIndex, arg.endIndex));
              }
            }
            if (constraints.length > 0) {
              constraint = constraints.join(' | ');
            }
          }
          
          params.push({ name, constraint });
        }
      }
    }
  }
  
  return params;
}

/**
 * Python-specific generic resolution with typing module support
 */
export function resolve_python_generic(
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
    'Callable': 'callable',
    'Sequence': 'sequence',
    'Iterable': 'iterable',
    'Iterator': 'iterator',
    'Generator': 'generator',
    'Awaitable': 'awaitable',
    'Coroutine': 'coroutine',
    'AsyncIterator': 'async_iterator',
    'AsyncGenerator': 'async_generator',
  };
  
  const parsed = parse_generic_type(type_ref);
  if (parsed && typing_aliases[parsed.base_type]) {
    const base = typing_aliases[parsed.base_type];
    const resolved_args = parsed.type_arguments.map(arg => {
      const resolved = resolve_generic_type(arg, context);
      return resolved.resolved_type;
    });
    
    // Handle special cases
    if (parsed.base_type === 'Optional' && resolved_args.length === 1) {
      return {
        original_type: type_ref,
        resolved_type: `${resolved_args[0]} | None`,
        type_substitutions: new Map(),
        confidence: 'exact'
      };
    }
    
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

/**
 * Check if a type is a Python TypeVar
 */
export function is_python_typevar(type_name: string): boolean {
  // TypeVars typically start with uppercase letters
  return /^[A-Z][A-Za-z0-9_]*$/.test(type_name);
}

/**
 * Check if a type is from Python's typing module
 */
export function is_typing_generic(type_name: string): boolean {
  const typing_types = [
    'List', 'Dict', 'Set', 'Tuple', 'Optional',
    'Union', 'Callable', 'Sequence', 'Iterable',
    'Iterator', 'Generator', 'Awaitable', 'Coroutine',
    'AsyncIterator', 'AsyncGenerator', 'TypeVar',
    'Generic', 'Protocol', 'TypedDict', 'Literal'
  ];
  
  // Check if it's a typing module type (with or without brackets)
  const base = type_name.split('[')[0];
  return typing_types.includes(base);
}
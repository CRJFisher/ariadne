/**
 * Python-specific bespoke generic features
 * 
 * Handles Python TypeVar, Generic base class, and typing module special cases
 */

import { SyntaxNode } from 'tree-sitter';
import { GenericParameter, ResolvedGeneric } from '@ariadnejs/types';
import { GenericContext, resolve_generic_type } from './generic_resolution';

// =============================================================================
// PUBLIC API FUNCTIONS (in order of usage by main module)
// =============================================================================

/**
 * Handle Python's Optional type special case
 * Optional[T] is equivalent to Union[T, None]
 */
export function resolve_python_optional(
  type_ref: string,
  context: GenericContext
): ResolvedGeneric | null {
  const optional_match = type_ref.match(/^Optional\[(.+)\]$/);
  if (!optional_match) return null;
  
  const inner_type = optional_match[1];
  const resolved = resolve_generic_type(inner_type, context);
  
  return {
    original_type: type_ref,
    resolved_type: `${resolved.resolved_type} | None`,
    type_substitutions: resolved.type_substitutions,
    confidence: 'exact'
  };
}

/**
 * Handle Python's Union type
 * Union[A, B, C] represents a type that can be A or B or C
 */
export function resolve_python_union(
  type_ref: string,
  context: GenericContext
): ResolvedGeneric | null {
  const union_match = type_ref.match(/^Union\[(.+)\]$/);
  if (!union_match) return null;
  
  // Parse union members
  const members = union_match[1].split(',').map(m => m.trim());
  const resolved_members = members.map(member => {
    const resolved = resolve_generic_type(member, context);
    return resolved.resolved_type;
  });
  
  return {
    original_type: type_ref,
    resolved_type: resolved_members.join(' | '),
    type_substitutions: new Map(),
    confidence: 'exact'
  };
}

/**
 * Handle Python's Protocol (structural typing)
 * This is Python's equivalent to TypeScript's structural typing
 */
export function resolve_python_protocol(
  type_ref: string,
  context: GenericContext
): ResolvedGeneric | null {
  if (!type_ref.includes('Protocol')) return null;
  
  // Protocols are kept as-is since they define structural types
  return {
    original_type: type_ref,
    resolved_type: type_ref,
    type_substitutions: new Map(),
    confidence: 'exact'
  };
}

/**
 * Handle Python's TypedDict
 * TypedDict defines dictionary structure with specific keys and types
 */
export function resolve_python_typeddict(
  type_ref: string,
  context: GenericContext
): ResolvedGeneric | null {
  if (!type_ref.includes('TypedDict')) return null;
  
  // TypedDict definitions are kept as-is
  return {
    original_type: type_ref,
    resolved_type: type_ref,
    type_substitutions: new Map(),
    confidence: 'exact'
  };
}

// =============================================================================
// UTILITY FUNCTIONS (not used by main module)
// =============================================================================

/**
 * Extract TypeVar declarations from Python code
 * TypeVar is unique to Python's type system
 */
export function extract_python_typevar(
  node: SyntaxNode,
  source_code: string
): GenericParameter | null {
  // Check for TypeVar('T', bound=Type) or TypeVar('T', Type1, Type2)
  if (node.type !== 'assignment') return null;
  
  const right = node.childForFieldName('right');
  if (right?.type !== 'call') return null;
  
  const function_node = right.childForFieldName('function');
  if (!function_node) return null;
  
  const func_name = source_code.substring(function_node.startIndex, function_node.endIndex);
  if (func_name !== 'TypeVar') return null;
  
  const left = node.childForFieldName('left');
  if (!left) return null;
  
  const name = source_code.substring(left.startIndex, left.endIndex);
  
  // Parse TypeVar arguments for constraints
  const args = right.childForFieldName('arguments');
  let constraint: string | undefined;
  let variance: 'covariant' | 'contravariant' | undefined;
  
  if (args) {
    // Look for keyword arguments like bound=, covariant=, contravariant=
    for (let i = 0; i < args.childCount; i++) {
      const arg = args.child(i);
      if (arg?.type === 'keyword_argument') {
        const key = arg.childForFieldName('name');
        const value = arg.childForFieldName('value');
        
        if (key && value) {
          const key_text = source_code.substring(key.startIndex, key.endIndex);
          const value_text = source_code.substring(value.startIndex, value.endIndex);
          
          if (key_text === 'bound') {
            constraint = value_text;
          } else if (key_text === 'covariant' && value_text === 'True') {
            variance = 'covariant';
          } else if (key_text === 'contravariant' && value_text === 'True') {
            variance = 'contravariant';
          }
        }
      }
    }
    
    // Also handle positional constraints TypeVar('T', int, str)
    if (!constraint && args.childCount > 2) {
      const constraints: string[] = [];
      for (let i = 2; i < args.childCount; i++) {
        const arg = args.child(i);
        if (arg && arg.type !== ',' && arg.type !== ')' && arg.type !== 'keyword_argument') {
          constraints.push(source_code.substring(arg.startIndex, arg.endIndex));
        }
      }
      if (constraints.length > 0) {
        constraint = constraints.join(' | ');
      }
    }
  }
  
  return {
    name,
    constraint,
    variance: variance as any
  };
}

/**
 * Extract Generic[T] base class parameters
 * This is how Python classes declare they are generic
 */
export function extract_python_generic_base(
  node: SyntaxNode,
  source_code: string
): GenericParameter[] {
  const params: GenericParameter[] = [];
  
  // Look for class definition with Generic[T] base
  if (node.type === 'class_definition') {
    const bases = node.childForFieldName('superclasses');
    if (!bases) return params;
    
    for (let i = 0; i < bases.childCount; i++) {
      const base = bases.child(i);
      if (base?.type === 'subscript') {
        const value = base.childForFieldName('value');
        if (value && source_code.substring(value.startIndex, value.endIndex) === 'Generic') {
          const slice = base.childForFieldName('slice');
          if (slice) {
            const param_text = source_code.substring(slice.startIndex, slice.endIndex);
            const param_names = param_text.split(',').map(s => s.trim());
            
            for (const name of param_names) {
              params.push({ name });
            }
          }
        }
      }
    }
  }
  
  return params;
}
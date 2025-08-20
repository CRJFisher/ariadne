/**
 * Rust-specific parameter type inference
 * 
 * Handles Rust parameter patterns including:
 * - Explicit type annotations (required)
 * - Self parameters
 * - Lifetime parameters
 * - Generic type parameters
 */

// TODO: Type Propagation - Flow types into function body

import { SyntaxNode } from 'tree-sitter';
import { Def } from '@ariadnejs/types';
import {
  ParameterInfo,
  ParameterTypeInfo,
  ParameterInferenceContext,
  check_parameter_patterns
} from './parameter_type_inference';

/**
 * Infer Rust parameter types from function definition
 */
export function infer_rust_parameter_types(
  func_def: Def,
  func_node: SyntaxNode,
  parameters: ParameterInfo[],
  context: ParameterInferenceContext
): Map<string, ParameterTypeInfo> {
  const inferred_types = new Map<string, ParameterTypeInfo>();
  
  for (const param of parameters) {
    // Rust requires explicit type annotations (except for self)
    if (param.type_annotation) {
      inferred_types.set(param.name, {
        param_name: param.name,
        inferred_type: normalize_rust_type(param.type_annotation),
        confidence: 'explicit',
        source: 'annotation'
      });
      continue;
    }
    
    // Self parameter
    if (param.name === 'self') {
      const self_type = infer_self_type(func_node, context);
      inferred_types.set(param.name, {
        param_name: param.name,
        inferred_type: self_type,
        confidence: 'explicit',
        source: 'pattern'
      });
      continue;
    }
    
    // This shouldn't happen in valid Rust code
    // Parameters must have types
    inferred_types.set(param.name, {
      param_name: param.name,
      inferred_type: '_',  // Type hole
      confidence: 'assumed',
      source: 'pattern'
    });
  }
  
  return inferred_types;
}

/**
 * Normalize Rust type annotations
 */
function normalize_rust_type(type_annotation: string): string {
  // Remove extra whitespace
  let normalized = type_annotation.trim();
  
  // Handle references
  if (normalized.startsWith('&')) {
    if (normalized.startsWith('&mut ')) {
      normalized = normalized.replace('&mut ', '&mut ');
    } else if (normalized.startsWith('& mut ')) {
      normalized = normalized.replace('& mut ', '&mut ');
    } else if (normalized.startsWith('& ')) {
      normalized = normalized.replace('& ', '&');
    }
  }
  
  return normalized;
}

/**
 * Infer the type of self parameter
 */
function infer_self_type(func_node: SyntaxNode, context: ParameterInferenceContext): string {
  // Check if it's in an impl block
  let current = func_node.parent;
  while (current) {
    if (current.type === 'impl_item') {
      // Find the type being implemented
      const type_node = current.childForFieldName('type');
      if (type_node) {
        const type_name = context.source_code.substring(
          type_node.startIndex,
          type_node.endIndex
        );
        
        // Check for trait implementation
        const trait_node = current.childForFieldName('trait');
        if (trait_node) {
          const trait_name = context.source_code.substring(
            trait_node.startIndex,
            trait_node.endIndex
          );
          // Return the implementing type, not the trait
          return type_name;
        }
        
        return type_name;
      }
      break;
    }
    current = current.parent;
  }
  
  // Default to Self
  return 'Self';
}

/**
 * Extract lifetime parameters from function signature
 */
export function extract_lifetime_parameters(
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): string[] {
  const lifetimes: string[] = [];
  const type_params = func_node.childForFieldName('type_parameters');
  
  if (type_params) {
    for (let i = 0; i < type_params.childCount; i++) {
      const param = type_params.child(i);
      if (param && param.type === 'lifetime') {
        const lifetime = context.source_code.substring(
          param.startIndex,
          param.endIndex
        );
        lifetimes.push(lifetime);
      }
    }
  }
  
  return lifetimes;
}

/**
 * Extract generic type parameters and their bounds
 */
export function extract_generic_parameters(
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): Map<string, string[]> {
  const generics = new Map<string, string[]>();
  const type_params = func_node.childForFieldName('type_parameters');
  
  if (type_params) {
    for (let i = 0; i < type_params.childCount; i++) {
      const param = type_params.child(i);
      if (param && param.type === 'type_parameter') {
        const name_node = param.childForFieldName('name');
        const bounds_node = param.childForFieldName('bounds');
        
        if (name_node) {
          const name = context.source_code.substring(
            name_node.startIndex,
            name_node.endIndex
          );
          
          const bounds: string[] = [];
          if (bounds_node) {
            // Parse trait bounds
            for (let j = 0; j < bounds_node.childCount; j++) {
              const bound = bounds_node.child(j);
              if (bound && bound.type !== '+') {
                bounds.push(context.source_code.substring(
                  bound.startIndex,
                  bound.endIndex
                ));
              }
            }
          }
          
          generics.set(name, bounds);
        }
      }
    }
  }
  
  return generics;
}

/**
 * Handle where clauses for additional type constraints
 */
export function extract_where_clause_constraints(
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): Map<string, string[]> {
  const constraints = new Map<string, string[]>();
  const where_clause = func_node.childForFieldName('where_clause');
  
  if (where_clause) {
    for (let i = 0; i < where_clause.childCount; i++) {
      const predicate = where_clause.child(i);
      if (predicate && predicate.type === 'where_predicate') {
        const type_node = predicate.childForFieldName('type');
        const bounds_node = predicate.childForFieldName('bounds');
        
        if (type_node && bounds_node) {
          const type_name = context.source_code.substring(
            type_node.startIndex,
            type_node.endIndex
          );
          
          const bounds: string[] = [];
          for (let j = 0; j < bounds_node.childCount; j++) {
            const bound = bounds_node.child(j);
            if (bound && bound.type !== '+') {
              bounds.push(context.source_code.substring(
                bound.startIndex,
                bound.endIndex
              ));
            }
          }
          
          const existing = constraints.get(type_name) || [];
          constraints.set(type_name, [...existing, ...bounds]);
        }
      }
    }
  }
  
  return constraints;
}

/**
 * Check if a type is a Rust primitive
 */
export function is_rust_primitive(type_name: string): boolean {
  const primitives = [
    'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
    'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
    'f32', 'f64',
    'bool', 'char', 'str'
  ];
  
  // Remove references and check
  const clean_type = type_name.replace(/^&(mut\s+)?/, '');
  return primitives.includes(clean_type);
}

/**
 * Check if a type is a standard library type
 */
export function is_std_type(type_name: string): boolean {
  const std_types = [
    'String', 'Vec', 'HashMap', 'HashSet', 'BTreeMap', 'BTreeSet',
    'Option', 'Result', 'Box', 'Rc', 'Arc', 'Cell', 'RefCell',
    'Mutex', 'RwLock', 'Cow', 'Path', 'PathBuf'
  ];
  
  // Check if it starts with any std type
  return std_types.some(t => type_name.startsWith(t + '<') || type_name === t);
}

/**
 * Infer parameter types from Rust call sites
 */
export function infer_from_rust_call_sites(
  func_name: string,
  parameters: ParameterInfo[],
  call_sites: SyntaxNode[],
  context: ParameterInferenceContext
): Map<string, ParameterTypeInfo[]> {
  const call_site_types = new Map<string, ParameterTypeInfo[]>();
  
  // In Rust, we can't easily infer types from call sites
  // without a full type checker, but we can detect some patterns
  
  for (const param of parameters) {
    call_site_types.set(param.name, []);
  }
  
  for (const call of call_sites) {
    const args = extract_rust_call_arguments(call, context);
    
    for (let i = 0; i < Math.min(args.length, parameters.length); i++) {
      const param = parameters[i];
      const arg_type = infer_rust_argument_type(args[i], context);
      
      if (arg_type) {
        const types = call_site_types.get(param.name) || [];
        types.push({
          param_name: param.name,
          inferred_type: arg_type,
          confidence: 'inferred',
          source: 'call_site'
        });
        call_site_types.set(param.name, types);
      }
    }
  }
  
  return call_site_types;
}

/**
 * Extract arguments from Rust call expression
 */
function extract_rust_call_arguments(
  call_node: SyntaxNode,
  context: ParameterInferenceContext
): SyntaxNode[] {
  const args: SyntaxNode[] = [];
  const args_node = call_node.childForFieldName('arguments');
  
  if (args_node) {
    for (let i = 0; i < args_node.childCount; i++) {
      const child = args_node.child(i);
      if (child && child.type !== '(' && child.type !== ')' && child.type !== ',') {
        args.push(child);
      }
    }
  }
  
  return args;
}

/**
 * Infer type from Rust argument expression
 */
function infer_rust_argument_type(
  arg_node: SyntaxNode,
  context: ParameterInferenceContext
): string | undefined {
  const { source_code } = context;
  
  switch (arg_node.type) {
    case 'string_literal':
      return '&str';
    
    case 'integer_literal':
      // Could be various integer types, default to i32
      return 'i32';
    
    case 'float_literal':
      // Could be f32 or f64, default to f64
      return 'f64';
    
    case 'boolean_literal':
      return 'bool';
    
    case 'char_literal':
      return 'char';
    
    case 'array_expression':
      // Would need to infer element type
      return 'Vec<_>';
    
    case 'tuple_expression':
      // Would need to infer element types
      const tuple_size = arg_node.childCount - 2; // Exclude parens
      return `(${','.repeat(Math.max(0, tuple_size - 1))})`;
    
    case 'reference_expression':
      const value = arg_node.childForFieldName('value');
      if (value) {
        const inner_type = infer_rust_argument_type(value, context);
        if (inner_type) {
          const is_mut = arg_node.child(0)?.type === 'mutable_specifier';
          return is_mut ? `&mut ${inner_type}` : `&${inner_type}`;
        }
      }
      return '&_';
    
    case 'call_expression':
      // Constructor calls
      const func = arg_node.childForFieldName('function');
      if (func) {
        const text = source_code.substring(func.startIndex, func.endIndex);
        // Common constructors
        if (text === 'String::from' || text === 'String::new') {
          return 'String';
        }
        if (text === 'Vec::new' || text.startsWith('vec!')) {
          return 'Vec<_>';
        }
        if (text === 'HashMap::new') {
          return 'HashMap<_, _>';
        }
      }
      return undefined;
    
    default:
      return undefined;
  }
}

/**
 * Handle pattern matching in parameters
 */
export function handle_pattern_parameters(
  param_node: SyntaxNode,
  context: ParameterInferenceContext
): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  
  // Handle tuple patterns: fn foo((x, y): (i32, i32))
  if (param_node.type === 'tuple_pattern') {
    // Extract individual bindings
    for (let i = 0; i < param_node.childCount; i++) {
      const child = param_node.child(i);
      if (child && child.type === 'identifier') {
        params.push({
          name: context.source_code.substring(child.startIndex, child.endIndex),
          position: params.length,
          type_annotation: undefined  // Would need parent type info
        });
      }
    }
  }
  
  // Handle struct patterns: fn foo(Point { x, y }: Point)
  else if (param_node.type === 'struct_pattern') {
    const fields = param_node.childForFieldName('fields');
    if (fields) {
      for (let i = 0; i < fields.childCount; i++) {
        const field = fields.child(i);
        if (field && field.type === 'field_pattern') {
          const name = field.childForFieldName('name');
          if (name) {
            params.push({
              name: context.source_code.substring(name.startIndex, name.endIndex),
              position: params.length,
              type_annotation: undefined  // Would need struct field type
            });
          }
        }
      }
    }
  }
  
  return params;
}
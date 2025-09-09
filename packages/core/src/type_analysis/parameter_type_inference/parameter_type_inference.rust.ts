/**
 * Rust-specific bespoke parameter type inference
 * 
 * Handles unique Rust features that cannot be expressed through configuration:
 * - Lifetime parameters
 * - Generic type parameters with where clauses
 * - Pattern parameters and destructuring
 * - Trait bounds
 */

import { SyntaxNode } from 'tree-sitter';
import {
  ParameterInfo,
  ParameterTypeInfo,
  ParameterInferenceContext
} from './parameter_type_inference';

/**
 * Extract lifetime parameters from a Rust function
 */
export function extract_lifetime_parameters(
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): string[] {
  const lifetimes: string[] = [];
  const { source_code } = context;
  
  // Look for generic_parameters or type_parameters
  const generics = func_node.childForFieldName('type_parameters') ||
                   func_node.childForFieldName('generic_parameters');
  
  if (!generics) {
    return lifetimes;
  }
  
  // Parse lifetime parameters (start with ')
  for (let i = 0; i < generics.childCount; i++) {
    const param = generics.child(i);
    if (param && param.type === 'lifetime') {
      lifetimes.push(source_code.substring(param.startIndex, param.endIndex));
    }
  }
  
  return lifetimes;
}

/**
 * Extract generic type parameters with bounds
 */
export function extract_generic_parameters(
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): Map<string, string[]> {
  const generics = new Map<string, string[]>();
  const { source_code } = context;
  
  const type_params = func_node.childForFieldName('type_parameters') ||
                      func_node.childForFieldName('generic_parameters');
  
  if (!type_params) {
    return generics;
  }
  
  // Parse type parameters and their bounds
  for (let i = 0; i < type_params.childCount; i++) {
    const param = type_params.child(i);
    if (param && param.type === 'type_parameter') {
      const name_node = param.child(0);
      const bounds: string[] = [];
      
      if (name_node) {
        const name = source_code.substring(name_node.startIndex, name_node.endIndex);
        
        // Look for trait bounds after ':'
        for (let j = 1; j < param.childCount; j++) {
          const child = param.child(j);
          if (child && child.type === 'trait_bound') {
            bounds.push(source_code.substring(child.startIndex, child.endIndex));
          }
        }
        
        generics.set(name, bounds);
      }
    }
  }
  
  return generics;
}

/**
 * Extract where clause constraints
 */
export function extract_where_clause_constraints(
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): Map<string, string[]> {
  const constraints = new Map<string, string[]>();
  const { source_code } = context;
  
  const where_clause = func_node.childForFieldName('where_clause');
  if (!where_clause) {
    return constraints;
  }
  
  // Parse where predicates
  for (let i = 0; i < where_clause.childCount; i++) {
    const predicate = where_clause.child(i);
    if (predicate && predicate.type === 'where_predicate') {
      const type_node = predicate.childForFieldName('type');
      const bounds_node = predicate.childForFieldName('bounds');
      
      if (type_node && bounds_node) {
        const type_name = source_code.substring(type_node.startIndex, type_node.endIndex);
        const bounds = source_code.substring(bounds_node.startIndex, bounds_node.endIndex)
          .split('+')
          .map(b => b.trim());
        constraints.set(type_name, bounds);
      }
    }
  }
  
  return constraints;
}

/**
 * Handle Rust pattern parameters (destructuring)
 */
export function handle_pattern_parameters(
  param_node: SyntaxNode,
  context: ParameterInferenceContext
): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  const { source_code } = context;
  
  if (param_node.type !== 'parameter') {
    return params;
  }
  
  const pattern = param_node.childForFieldName('pattern');
  const type_node = param_node.childForFieldName('type');
  
  if (!pattern) {
    return params;
  }
  
  const type_annotation = type_node ? 
    source_code.substring(type_node.startIndex, type_node.endIndex) : undefined;
  
  // Handle different pattern types
  switch (pattern.type) {
    case 'identifier':
      params.push({
        name: source_code.substring(pattern.startIndex, pattern.endIndex),
        position: 0,
        type_annotation
      });
      break;
      
    case 'tuple_pattern':
      // Destructure tuple: (a, b, c): (Type1, Type2, Type3)
      const tuple_types = type_annotation ? parse_tuple_type(type_annotation) : [];
      let index = 0;
      
      for (let i = 0; i < pattern.childCount; i++) {
        const child = pattern.child(i);
        if (child && child.type === 'identifier') {
          params.push({
            name: source_code.substring(child.startIndex, child.endIndex),
            position: index,
            type_annotation: tuple_types[index] || undefined
          });
          index++;
        }
      }
      break;
      
    case 'struct_pattern':
      // Destructure struct: Point { x, y }: Point
      for (let i = 0; i < pattern.childCount; i++) {
        const field = pattern.child(i);
        if (field && field.type === 'field_pattern') {
          const name_node = field.childForFieldName('name');
          if (name_node) {
            params.push({
              name: source_code.substring(name_node.startIndex, name_node.endIndex),
              position: params.length,
              type_annotation: type_annotation ? `${type_annotation}::field` : undefined
            });
          }
        }
      }
      break;
      
    case 'ref_pattern':
    case 'mut_pattern':
      // Handle ref/mut patterns
      const inner = pattern.child(pattern.childCount - 1);
      if (inner && inner.type === 'identifier') {
        const is_ref = pattern.type === 'ref_pattern';
        const adjusted_type = type_annotation && is_ref ? `&${type_annotation}` : type_annotation;
        params.push({
          name: source_code.substring(inner.startIndex, inner.endIndex),
          position: 0,
          type_annotation: adjusted_type
        });
      }
      break;
  }
  
  return params;
}

/**
 * Parse tuple type string into component types
 */
function parse_tuple_type(tuple_type: string): string[] {
  if (!tuple_type.startsWith('(') || !tuple_type.endsWith(')')) {
    return [];
  }
  
  const inner = tuple_type.slice(1, -1);
  const types: string[] = [];
  let current = '';
  let depth = 0;
  
  for (const char of inner) {
    if (char === ',' && depth === 0) {
      types.push(current.trim());
      current = '';
    } else {
      if (char === '(' || char === '<') depth++;
      if (char === ')' || char === '>') depth--;
      current += char;
    }
  }
  
  if (current.trim()) {
    types.push(current.trim());
  }
  
  return types;
}

/**
 * Check if a type is a Rust primitive
 */
export function is_rust_primitive(type_name: string): boolean {
  const primitives = [
    'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
    'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
    'f32', 'f64',
    'bool', 'char', 'str',
    '()', // unit type
  ];
  
  return primitives.includes(type_name);
}

/**
 * Check if a type is from the Rust standard library
 */
export function is_std_type(type_name: string): boolean {
  const std_types = [
    'String', 'Vec', 'HashMap', 'HashSet', 'BTreeMap', 'BTreeSet',
    'Option', 'Result', 'Box', 'Rc', 'Arc', 'Mutex', 'RwLock',
    'Cell', 'RefCell', 'Cow', 'Path', 'PathBuf', 'OsStr', 'OsString'
  ];
  
  return std_types.some(t => type_name === t || type_name.startsWith(t + '<'));
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
  
  for (const call_site of call_sites) {
    const args = call_site.childForFieldName('arguments');
    if (!args) continue;
    
    // Check for turbofish syntax (explicit type parameters)
    const type_args = extract_turbofish_types(call_site, context);
    
    let arg_index = 0;
    for (let i = 0; i < args.childCount; i++) {
      const arg = args.child(i);
      if (arg && arg.type !== ',' && arg.type !== '(' && arg.type !== ')') {
        const param = parameters[arg_index];
        if (param) {
          const arg_type = infer_rust_argument_type(arg, type_args, context);
          if (arg_type) {
            if (!call_site_types.has(param.name)) {
              call_site_types.set(param.name, []);
            }
            call_site_types.get(param.name)!.push({
              param_name: param.name,
              inferred_type: arg_type,
              confidence: 'inferred',
              source: 'call_site'
            });
          }
        }
        arg_index++;
      }
    }
  }
  
  return call_site_types;
}

/**
 * Extract turbofish type parameters from a call
 */
function extract_turbofish_types(
  call_node: SyntaxNode,
  context: ParameterInferenceContext
): string[] {
  const types: string[] = [];
  const { source_code } = context;
  
  // Look for :: followed by <...>
  const func = call_node.childForFieldName('function');
  if (func && func.type === 'generic_function') {
    const type_args = func.childForFieldName('type_arguments');
    if (type_args) {
      for (let i = 0; i < type_args.childCount; i++) {
        const arg = type_args.child(i);
        if (arg && arg.type !== '<' && arg.type !== '>' && arg.type !== ',') {
          types.push(source_code.substring(arg.startIndex, arg.endIndex));
        }
      }
    }
  }
  
  return types;
}

/**
 * Infer type of a Rust argument expression
 */
function infer_rust_argument_type(
  arg_node: SyntaxNode,
  type_args: string[],
  context: ParameterInferenceContext
): string | undefined {
  const { source_code } = context;
  
  switch (arg_node.type) {
    case 'string_literal':
    case 'raw_string_literal':
      return '&str';
    case 'char_literal':
      return 'char';
    case 'integer_literal':
      // Try to determine integer type from suffix
      const int_text = source_code.substring(arg_node.startIndex, arg_node.endIndex);
      if (int_text.endsWith('i32')) return 'i32';
      if (int_text.endsWith('u32')) return 'u32';
      if (int_text.endsWith('i64')) return 'i64';
      if (int_text.endsWith('u64')) return 'u64';
      return 'i32'; // default integer type
    case 'float_literal':
      const float_text = source_code.substring(arg_node.startIndex, arg_node.endIndex);
      if (float_text.endsWith('f32')) return 'f32';
      return 'f64'; // default float type
    case 'boolean_literal':
      return 'bool';
    case 'unit_expression':
      return '()';
    case 'array_expression':
      return 'Vec<T>'; // Generic array type
    case 'tuple_expression':
      return '()'; // Generic tuple
    case 'struct_expression':
      // Try to get struct name
      const name_node = arg_node.childForFieldName('name');
      if (name_node) {
        return source_code.substring(name_node.startIndex, name_node.endIndex);
      }
      return undefined;
    case 'reference_expression':
      // Handle &expr
      const ref_expr = arg_node.child(1); // Skip '&'
      if (ref_expr) {
        const inner_type = infer_rust_argument_type(ref_expr, type_args, context);
        return inner_type ? `&${inner_type}` : '&T';
      }
      return '&T';
    case 'call_expression':
      // Check for common constructors
      const func = arg_node.childForFieldName('function');
      if (func) {
        const func_name = source_code.substring(func.startIndex, func.endIndex);
        if (func_name === 'String::from' || func_name === 'String::new') {
          return 'String';
        }
        if (func_name.startsWith('Vec::')) {
          return 'Vec<T>';
        }
        if (func_name.startsWith('HashMap::')) {
          return 'HashMap<K, V>';
        }
      }
      return undefined;
    default:
      return undefined;
  }
}
/**
 * Python-specific type tracking
 * 
 * Handles Python type tracking patterns including:
 * - Type hints (Python 3.5+)
 * - Duck typing
 * - Class definitions
 * - Dynamic typing
 */

// TODO: Return Type Inference - Update type map with inferred types

import { SyntaxNode } from 'tree-sitter';
import { Def } from '@ariadnejs/types';
import {
  TypeInfo,
  FileTypeTracker,
  TypeTrackingContext,
  set_variable_type,
  set_imported_class,
  infer_type_kind
} from './type_tracking';

/**
 * Track Python variable assignments
 */
export function track_python_assignment(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  // Handle assignments: x = value or x: Type = value
  if (node.type === 'assignment') {
    const left_node = node.childForFieldName('left');
    const right_node = node.childForFieldName('right');
    const type_node = node.childForFieldName('type');
    
    if (left_node && right_node) {
      const var_name = source_code.substring(left_node.startIndex, left_node.endIndex);
      
      // Check for type annotation first
      if (type_node) {
        const type_info = extract_python_type_hint(type_node, source_code, context);
        if (type_info) {
          return set_variable_type(tracker, var_name, type_info);
        }
      }
      
      // Infer type from value
      const type_info = infer_python_type(right_node, source_code, context);
      if (type_info) {
        return set_variable_type(tracker, var_name, type_info);
      }
    }
  }
  
  // Handle annotated assignments: x: Type = value
  if (node.type === 'annotated_assignment') {
    const target_node = node.childForFieldName('target');
    const annotation_node = node.childForFieldName('annotation');
    const value_node = node.childForFieldName('value');
    
    if (target_node && annotation_node) {
      const var_name = source_code.substring(target_node.startIndex, target_node.endIndex);
      const type_info = extract_python_type_hint(annotation_node, source_code, context);
      
      if (type_info) {
        return set_variable_type(tracker, var_name, type_info);
      }
    }
  }
  
  return tracker;
}

/**
 * Infer type from a Python expression
 */
export function infer_python_type(
  node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): TypeInfo | undefined {
  const position = {
    row: node.startPosition.row,
    column: node.startPosition.column
  };
  
  // Literal types
  if (node.type === 'string') {
    return {
      type_name: 'str',
      type_kind: 'primitive',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  if (node.type === 'integer' || node.type === 'float') {
    const text = source_code.substring(node.startIndex, node.endIndex);
    const type_name = text.includes('.') ? 'float' : 'int';
    return {
      type_name,
      type_kind: 'primitive',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  if (node.type === 'true' || node.type === 'false') {
    return {
      type_name: 'bool',
      type_kind: 'primitive',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  if (node.type === 'none') {
    return {
      type_name: 'None',
      type_kind: 'primitive',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  // Collection types
  if (node.type === 'list') {
    return {
      type_name: 'list',
      type_kind: 'array',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  if (node.type === 'dictionary') {
    return {
      type_name: 'dict',
      type_kind: 'object',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  if (node.type === 'set') {
    return {
      type_name: 'set',
      type_kind: 'object',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  if (node.type === 'tuple') {
    return {
      type_name: 'tuple',
      type_kind: 'array',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  // Function definitions
  if (node.type === 'lambda') {
    return {
      type_name: 'function',
      type_kind: 'function',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  // Call expressions - constructor calls
  if (node.type === 'call') {
    const function_node = node.childForFieldName('function');
    if (function_node) {
      const func_name = source_code.substring(
        function_node.startIndex,
        function_node.endIndex
      );
      
      // Check for built-in type constructors
      const built_in_types: Record<string, string> = {
        'str': 'str',
        'int': 'int',
        'float': 'float',
        'bool': 'bool',
        'list': 'list',
        'dict': 'dict',
        'set': 'set',
        'tuple': 'tuple'
      };
      
      if (built_in_types[func_name]) {
        return {
          type_name: built_in_types[func_name],
          type_kind: infer_type_kind(built_in_types[func_name], 'python'),
          position,
          confidence: 'inferred',
          source: 'assignment'
        };
      }
      
      // Assume class constructor if capitalized
      if (func_name[0] === func_name[0].toUpperCase()) {
        return {
          type_name: func_name,
          type_kind: 'class',
          position,
          confidence: 'explicit',
          source: 'constructor'
        };
      }
    }
  }
  
  return undefined;
}

/**
 * Extract Python type hint
 */
export function extract_python_type_hint(
  type_node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): TypeInfo | undefined {
  const position = {
    row: type_node.startPosition.row,
    column: type_node.startPosition.column
  };
  
  // Simple type identifier
  if (type_node.type === 'type' || type_node.type === 'identifier') {
    const type_name = source_code.substring(type_node.startIndex, type_node.endIndex);
    return {
      type_name: normalize_python_type(type_name),
      type_kind: infer_python_type_kind(type_name),
      position,
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  // Generic types: List[str], Dict[str, int], etc.
  if (type_node.type === 'subscript') {
    const value_node = type_node.childForFieldName('value');
    const subscript_node = type_node.childForFieldName('subscript');
    
    if (value_node) {
      const base_type = source_code.substring(value_node.startIndex, value_node.endIndex);
      
      if (subscript_node) {
        const type_args = source_code.substring(subscript_node.startIndex, subscript_node.endIndex);
        return {
          type_name: `${base_type}[${type_args}]`,
          type_kind: infer_python_type_kind(base_type),
          position,
          confidence: 'explicit',
          source: 'annotation'
        };
      }
      
      return {
        type_name: base_type,
        type_kind: infer_python_type_kind(base_type),
        position,
        confidence: 'explicit',
        source: 'annotation'
      };
    }
  }
  
  // Union types: Union[str, int] or str | int (Python 3.10+)
  if (type_node.type === 'union_type' || type_node.type === 'binary_operator') {
    const type_text = source_code.substring(type_node.startIndex, type_node.endIndex);
    return {
      type_name: type_text,
      type_kind: 'unknown',
      position,
      confidence: 'explicit',
      source: 'annotation'
    };
  }
  
  // Optional types: Optional[str]
  if (type_node.type === 'attribute') {
    const type_text = source_code.substring(type_node.startIndex, type_node.endIndex);
    if (type_text.startsWith('Optional')) {
      return {
        type_name: type_text,
        type_kind: 'unknown',
        position,
        confidence: 'explicit',
        source: 'annotation'
      };
    }
  }
  
  return undefined;
}

/**
 * Track Python imports
 */
export function track_python_imports(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  let updated_tracker = tracker;
  
  // from module import Class
  if (node.type === 'import_from_statement') {
    const module_node = node.childForFieldName('module_name');
    
    if (module_node) {
      const source_module = source_code.substring(module_node.startIndex, module_node.endIndex);
      
      // Process imports - they can be direct children
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          if (child.type === 'dotted_name' || child.type === 'identifier') {
            const import_name = source_code.substring(child.startIndex, child.endIndex);
            
            updated_tracker = set_imported_class(updated_tracker, import_name, {
              class_name: import_name,
              source_module,
              local_name: import_name,
              is_default: false
            });
          } else if (child.type === 'aliased_import') {
            const name_node = child.childForFieldName('name');
            const alias_node = child.childForFieldName('alias');
            
            if (name_node) {
              const import_name = source_code.substring(
                name_node.startIndex,
                name_node.endIndex
              );
              const local_name = alias_node
                ? source_code.substring(alias_node.startIndex, alias_node.endIndex)
                : import_name;
              
              updated_tracker = set_imported_class(updated_tracker, local_name, {
                class_name: import_name,
                source_module,
                local_name,
                is_default: false
              });
            }
          }
        }
      }
    }
  }
  
  // import module
  if (node.type === 'import_statement') {
    // Process direct children which are the imports
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        if (child.type === 'dotted_name') {
          const module_name = source_code.substring(child.startIndex, child.endIndex);
          
          // For module imports, we track the module itself
          updated_tracker = set_imported_class(updated_tracker, module_name, {
            class_name: module_name,
            source_module: module_name,
            local_name: module_name,
            is_default: true
          });
        } else if (child.type === 'aliased_import') {
          const name_node = child.childForFieldName('name');
          const alias_node = child.childForFieldName('alias');
          
          if (name_node) {
            const module_name = source_code.substring(
              name_node.startIndex,
              name_node.endIndex
            );
            const local_name = alias_node
              ? source_code.substring(alias_node.startIndex, alias_node.endIndex)
              : module_name;
            
            updated_tracker = set_imported_class(updated_tracker, local_name, {
              class_name: module_name,
              source_module: module_name,
              local_name,
              is_default: true
            });
          }
        }
      }
    }
  }
  
  return updated_tracker;
}

/**
 * Track Python function parameters with type hints
 */
export function track_python_parameters(
  tracker: FileTypeTracker,
  func_def: Def,
  params_node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  let updated_tracker = tracker;
  
  for (let i = 0; i < params_node.childCount; i++) {
    const param = params_node.child(i);
    if (param && (param.type === 'identifier' || param.type === 'typed_parameter')) {
      if (param.type === 'typed_parameter') {
        const name_node = param.childForFieldName('name');
        const type_node = param.childForFieldName('type');
        
        if (name_node && type_node) {
          const param_name = source_code.substring(name_node.startIndex, name_node.endIndex);
          const type_info = extract_python_type_hint(type_node, source_code, context);
          
          if (type_info) {
            updated_tracker = set_variable_type(updated_tracker, param_name, type_info);
          }
        }
      }
    }
  }
  
  return updated_tracker;
}

/**
 * Infer return type from Python function
 */
export function infer_python_return_type(
  func_node: SyntaxNode,
  source_code: string,
  tracker: FileTypeTracker,
  context: TypeTrackingContext
): TypeInfo | undefined {
  // Check for return type annotation (-> Type)
  const return_type_node = func_node.childForFieldName('return_type');
  if (return_type_node) {
    return extract_python_type_hint(return_type_node, source_code, context);
  }
  
  // Look for return statements
  const return_statements: SyntaxNode[] = [];
  find_return_statements(func_node, return_statements);
  
  if (return_statements.length === 0) {
    return {
      type_name: 'None',
      type_kind: 'primitive',
      position: {
        row: func_node.startPosition.row,
        column: func_node.startPosition.column
      },
      confidence: 'inferred',
      source: 'return'
    };
  }
  
  // Analyze return statements
  const return_types: TypeInfo[] = [];
  for (const return_stmt of return_statements) {
    const value_node = return_stmt.childForFieldName('value');
    if (value_node) {
      const type_info = infer_python_type(value_node, source_code, context);
      if (type_info) {
        return_types.push(type_info);
      }
    }
  }
  
  // If all returns have the same type, use it
  if (return_types.length > 0) {
    const first_type = return_types[0].type_name;
    if (return_types.every(t => t.type_name === first_type)) {
      return return_types[0];
    }
    
    // Mixed types - return Any
    return {
      type_name: 'Any',
      type_kind: 'primitive',
      position: {
        row: func_node.startPosition.row,
        column: func_node.startPosition.column
      },
      confidence: 'inferred',
      source: 'return'
    };
  }
  
  return undefined;
}

/**
 * Find all return statements in a function
 */
function find_return_statements(node: SyntaxNode, returns: SyntaxNode[]): void {
  if (node.type === 'return_statement') {
    returns.push(node);
    return;
  }
  
  // Don't descend into nested functions
  if (node.type === 'function_definition' || node.type === 'lambda') {
    if (node.parent?.type !== 'assignment' && 
        node.parent?.type !== 'function_definition') {
      return;
    }
  }
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      find_return_statements(child, returns);
    }
  }
}

/**
 * Normalize Python type names
 */
function normalize_python_type(type_name: string): string {
  const type_map: Record<string, string> = {
    'str': 'str',
    'int': 'int',
    'float': 'float',
    'bool': 'bool',
    'list': 'list',
    'dict': 'dict',
    'set': 'set',
    'tuple': 'tuple',
    'List': 'list',
    'Dict': 'dict',
    'Set': 'set',
    'Tuple': 'tuple',
    'Any': 'Any',
    'None': 'None'
  };
  
  return type_map[type_name] || type_name;
}

/**
 * Infer type kind for Python types
 */
function infer_python_type_kind(type_name: string): TypeInfo['type_kind'] {
  const primitives = ['str', 'int', 'float', 'bool', 'None', 'Any'];
  if (primitives.includes(type_name)) {
    return 'primitive';
  }
  
  const collections = ['list', 'List', 'dict', 'Dict', 'set', 'Set', 'tuple', 'Tuple'];
  if (collections.includes(type_name)) {
    return type_name.toLowerCase().startsWith('dict') ? 'object' : 'array';
  }
  
  if (type_name === 'function' || type_name.includes('Callable')) {
    return 'function';
  }
  
  // Assume class for capitalized names
  if (type_name[0] === type_name[0].toUpperCase()) {
    return 'class';
  }
  
  return 'unknown';
}

/**
 * Track Python class definitions
 */
export function track_python_class(
  tracker: FileTypeTracker,
  def: Def,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  // Mark class as exported if public
  if (!def.name.startsWith('_')) {
    return mark_as_exported(tracker, def.name);
  }
  return tracker;
}

/**
 * Track Python function definitions
 */
export function track_python_function(
  tracker: FileTypeTracker,
  def: Def,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  // Mark function as exported if public
  if (!def.name.startsWith('_')) {
    return mark_as_exported(tracker, def.name);
  }
  return tracker;
}

/**
 * Check if a type is a Python built-in type
 */
export function is_builtin_type(type_name: string): boolean {
  const builtins = [
    'str', 'int', 'float', 'bool', 'None', 'Any',
    'list', 'dict', 'set', 'tuple', 'bytes', 'bytearray',
    'object', 'type', 'complex', 'range', 'frozenset',
    'List', 'Dict', 'Set', 'Tuple', 'Optional', 'Union'
  ];
  return builtins.includes(type_name);
}
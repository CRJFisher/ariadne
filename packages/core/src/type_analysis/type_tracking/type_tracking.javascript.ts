/**
 * JavaScript-specific type tracking
 * 
 * Handles JavaScript type tracking patterns including:
 * - Constructor functions
 * - Prototype-based types
 * - Dynamic typing
 * - CommonJS imports
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
 * Track JavaScript variable assignments
 */
export function track_javascript_assignment(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  // Handle variable declarations: const x = value
  if (node.type === 'variable_declarator') {
    const name_node = node.childForFieldName('name');
    const value_node = node.childForFieldName('value');
    
    if (name_node && value_node) {
      const var_name = source_code.substring(name_node.startIndex, name_node.endIndex);
      const type_info = infer_javascript_type(value_node, source_code, context);
      
      if (type_info) {
        return set_variable_type(tracker, var_name, type_info);
      }
    }
  }
  
  // Handle assignments: x = value
  if (node.type === 'assignment_expression') {
    const left_node = node.childForFieldName('left');
    const right_node = node.childForFieldName('right');
    
    if (left_node && right_node && left_node.type === 'identifier') {
      const var_name = source_code.substring(left_node.startIndex, left_node.endIndex);
      const type_info = infer_javascript_type(right_node, source_code, context);
      
      if (type_info) {
        return set_variable_type(tracker, var_name, type_info);
      }
    }
  }
  
  return tracker;
}

/**
 * Infer type from a JavaScript expression
 */
export function infer_javascript_type(
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
      type_name: 'string',
      type_kind: 'primitive',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  if (node.type === 'number') {
    return {
      type_name: 'number',
      type_kind: 'primitive',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  if (node.type === 'true' || node.type === 'false') {
    return {
      type_name: 'boolean',
      type_kind: 'primitive',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  if (node.type === 'null') {
    return {
      type_name: 'null',
      type_kind: 'primitive',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  if (node.type === 'undefined') {
    return {
      type_name: 'undefined',
      type_kind: 'primitive',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  // Array literals
  if (node.type === 'array') {
    return {
      type_name: 'Array',
      type_kind: 'array',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  // Object literals
  if (node.type === 'object') {
    return {
      type_name: 'Object',
      type_kind: 'object',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  // Function expressions
  if (node.type === 'function' || node.type === 'arrow_function') {
    return {
      type_name: 'Function',
      type_kind: 'function',
      position,
      confidence: 'explicit',
      source: 'assignment'
    };
  }
  
  // New expressions (constructor calls)
  if (node.type === 'new_expression') {
    const constructor_node = node.childForFieldName('constructor');
    if (constructor_node) {
      const constructor_name = source_code.substring(
        constructor_node.startIndex,
        constructor_node.endIndex
      );
      
      return {
        type_name: constructor_name,
        type_kind: 'class',
        position,
        confidence: 'explicit',
        source: 'constructor'
      };
    }
  }
  
  // Call expressions - check for known type-returning functions
  if (node.type === 'call_expression') {
    const function_node = node.childForFieldName('function');
    if (function_node) {
      const func_name = source_code.substring(
        function_node.startIndex,
        function_node.endIndex
      );
      
      // Common type conversions
      if (func_name === 'String') {
        return {
          type_name: 'string',
          type_kind: 'primitive',
          position,
          confidence: 'inferred',
          source: 'assignment'
        };
      }
      if (func_name === 'Number') {
        return {
          type_name: 'number',
          type_kind: 'primitive',
          position,
          confidence: 'inferred',
          source: 'assignment'
        };
      }
      if (func_name === 'Boolean') {
        return {
          type_name: 'boolean',
          type_kind: 'primitive',
          position,
          confidence: 'inferred',
          source: 'assignment'
        };
      }
    }
  }
  
  // Identifier - might be a known type
  if (node.type === 'identifier') {
    const identifier = source_code.substring(node.startIndex, node.endIndex);
    
    // Check if it's a known constructor/class
    if (identifier[0] === identifier[0].toUpperCase()) {
      return {
        type_name: identifier,
        type_kind: 'class',
        position,
        confidence: 'assumed',
        source: 'assignment'
      };
    }
  }
  
  return undefined;
}

/**
 * Track JavaScript imports (CommonJS and ES6)
 */
export function track_javascript_imports(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  source_code: string,
  context: TypeTrackingContext
): FileTypeTracker {
  let updated_tracker = tracker;
  
  // ES6 imports: import ClassName from 'module'
  if (node.type === 'import_statement') {
    // Find import_clause by looking through children
    let import_clause = null;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === 'import_clause') {
        import_clause = child;
        break;
      }
    }
    
    const source = node.childForFieldName('source');
    
    if (import_clause && source) {
      const source_module = source_code.substring(source.startIndex + 1, source.endIndex - 1);
      
      // Check for default import
      // import_clause contains an identifier child for default import
      for (let i = 0; i < import_clause.childCount; i++) {
        const child = import_clause.child(i);
        if (child && child.type === 'identifier') {
          const local_name = source_code.substring(
            child.startIndex,
            child.endIndex
          );
          
          updated_tracker = set_imported_class(updated_tracker, local_name, {
            class_name: local_name,
            source_module,
            local_name,
            is_default: true
          });
          break; // Only first identifier is default import
        }
      }
      
      // Named imports: import { Class1, Class2 } from 'module'
      let named_imports = null;
      for (let i = 0; i < import_clause.childCount; i++) {
        const child = import_clause.child(i);
        if (child && child.type === 'named_imports') {
          named_imports = child;
          break;
        }
      }
      
      if (named_imports) {
        for (let i = 0; i < named_imports.childCount; i++) {
          const import_spec = named_imports.child(i);
          if (import_spec && import_spec.type === 'import_specifier') {
            const name_node = import_spec.childForFieldName('name');
            const alias_node = import_spec.childForFieldName('alias');
            
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
      
      // Check for namespace import: import * as utils from './utils'
      let namespace_import = null;
      for (let i = 0; i < import_clause.childCount; i++) {
        const child = import_clause.child(i);
        if (child && child.type === 'namespace_import') {
          namespace_import = child;
          break;
        }
      }
      
      if (namespace_import) {
        const alias_node = namespace_import.childForFieldName('alias');
        if (alias_node) {
          const local_name = source_code.substring(
            alias_node.startIndex,
            alias_node.endIndex
          );
          
          updated_tracker = set_imported_class(updated_tracker, local_name, {
            class_name: '*',
            source_module,
            local_name,
            is_default: false
          });
        }
      }
    }
  }
  
  // CommonJS: const ClassName = require('module')
  if (node.type === 'variable_declarator') {
    const name_node = node.childForFieldName('name');
    const value_node = node.childForFieldName('value');
    
    if (name_node && value_node && value_node.type === 'call_expression') {
      const function_node = value_node.childForFieldName('function');
      const args_node = value_node.childForFieldName('arguments');
      
      if (function_node && args_node) {
        const func_name = source_code.substring(
          function_node.startIndex,
          function_node.endIndex
        );
        
        if (func_name === 'require' && args_node.childCount > 0) {
          const arg_node = args_node.child(1); // Skip opening paren
          if (arg_node && arg_node.type === 'string') {
            const source_module = source_code.substring(
              arg_node.startIndex + 1,
              arg_node.endIndex - 1
            );
            const local_name = source_code.substring(
              name_node.startIndex,
              name_node.endIndex
            );
            
            updated_tracker = set_imported_class(updated_tracker, local_name, {
              class_name: local_name,
              source_module,
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
 * Track JavaScript function parameters
 */
export function track_javascript_parameters(
  tracker: FileTypeTracker,
  func_def: Def,
  param_types: Map<string, TypeInfo>
): FileTypeTracker {
  let updated_tracker = tracker;
  
  for (const [param_name, type_info] of param_types) {
    updated_tracker = set_variable_type(updated_tracker, param_name, type_info);
  }
  
  return updated_tracker;
}

/**
 * Infer return type from JavaScript function
 */
export function infer_javascript_return_type(
  func_node: SyntaxNode,
  source_code: string,
  tracker: FileTypeTracker,
  context: TypeTrackingContext
): TypeInfo | undefined {
  // Look for return statements
  const return_statements: SyntaxNode[] = [];
  find_return_statements(func_node, return_statements);
  
  if (return_statements.length === 0) {
    return {
      type_name: 'void',
      type_kind: 'primitive',
      position: {
        row: func_node.startPosition.row,
        column: func_node.startPosition.column
      },
      confidence: 'inferred',
      source: 'return'
    };
  }
  
  // Analyze return statements to determine type
  const return_types: TypeInfo[] = [];
  for (const return_stmt of return_statements) {
    const value_node = return_stmt.childForFieldName('value');
    if (value_node) {
      const type_info = infer_javascript_type(value_node, source_code, context);
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
    
    // Mixed types - return union type (simplified)
    return {
      type_name: 'any',
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
  if (node.type === 'function' || node.type === 'arrow_function') {
    if (node.parent?.type !== 'variable_declarator' && 
        node.parent?.type !== 'function_declaration') {
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
 * Check if a variable is a constructor function
 */
export function is_constructor_function(
  var_name: string,
  tracker: FileTypeTracker
): boolean {
  // Convention: constructor functions start with uppercase
  if (var_name[0] !== var_name[0].toUpperCase()) {
    return false;
  }
  
  // Check if it's an imported class
  const imported = tracker.imported_classes.get(var_name);
  if (imported) {
    return true;
  }
  
  // Check if it has been used with 'new'
  const type_info = tracker.variable_types.get(var_name);
  if (type_info && type_info.some(t => t.source === 'constructor')) {
    return true;
  }
  
  return false;
}
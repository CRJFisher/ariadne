/**
 * Constructor Type Extraction
 * 
 * Extracts type assignments from constructor calls to enable bidirectional flow
 * between constructor_calls and type_tracking. When we see `const foo = new Bar()`,
 * we extract the type assignment `foo: Bar`.
 * 
 * This enables type_tracking to receive type information discovered by constructor_calls,
 * creating a bidirectional flow of type information.
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, ConstructorCallInfo, Location } from '@ariadnejs/types';
import { TypeInfo } from '../../type_analysis/type_tracking';
import { 
  find_assignment_target,
  extract_constructor_name,
  is_constructor_call_node,
  walk_tree
} from './constructor_calls';

/**
 * Result containing both constructor calls and discovered type assignments
 */
export interface ConstructorCallResult {
  calls: ConstructorCallInfo[];
  type_assignments: Map<string, TypeInfo[]>;
}

/**
 * Type assignment discovered from a constructor call
 */
export interface ConstructorTypeAssignment {
  variable_name: string;
  type_name: string;
  location: Location;
  is_property_assignment?: boolean;
  is_return_value?: boolean;
}

/**
 * Extract both constructor calls and type assignments from AST
 * 
 * This is the main entry point for bidirectional type flow.
 * It finds constructor calls and extracts type assignments in a single pass.
 * 
 * @param ast_root The root AST node
 * @param source_code The source code string
 * @param file_path The file being analyzed
 * @param language The programming language
 * @returns Constructor calls and type assignments
 */
export function extract_constructor_calls_and_types(
  ast_root: SyntaxNode,
  source_code: string,
  file_path: string,
  language: Language
): ConstructorCallResult {
  const calls: ConstructorCallInfo[] = [];
  const type_assignments = new Map<string, TypeInfo[]>();
  
  // Walk the AST to find constructor calls
  walk_tree(ast_root, (node) => {
    if (is_constructor_call_node(node, language)) {
      // Extract constructor call info
      const class_name = extract_constructor_name(node, source_code, language);
      if (!class_name) return;
      
      // Create constructor call info
      const call_info: ConstructorCallInfo = {
        class_name,
        location: {
          line: node.startPosition.row,
          column: node.startPosition.column
        },
        file_path
      };
      calls.push(call_info);
      
      // Extract type assignment if present
      const assignment = extract_type_assignment(node, class_name, source_code, language);
      if (assignment) {
        add_type_assignment(type_assignments, assignment);
      }
    }
  });
  
  return { calls, type_assignments };
}

/**
 * Extract type assignment from a constructor call node
 */
function extract_type_assignment(
  node: SyntaxNode,
  class_name: string,
  source_code: string,
  language: Language
): ConstructorTypeAssignment | null {
  // Find what variable this constructor is assigned to
  const target = find_assignment_target(node, source_code, language);
  if (!target) {
    // Check if it's a return value
    if (is_return_value(node)) {
      return {
        variable_name: '<return>',
        type_name: class_name,
        location: {
          line: node.startPosition.row,
          column: node.startPosition.column
        },
        is_return_value: true
      };
    }
    return null;
  }
  
  // Check if it's a property assignment
  const is_property = is_property_assignment(node, target, language);
  
  return {
    variable_name: target,
    type_name: class_name,
    location: {
      line: node.startPosition.row,
      column: node.startPosition.column
    },
    is_property_assignment: is_property
  };
}

/**
 * Add a type assignment to the map
 */
function add_type_assignment(
  type_map: Map<string, TypeInfo[]>,
  assignment: ConstructorTypeAssignment
): void {
  const type_info: TypeInfo = {
    variable_name: assignment.variable_name,
    type_name: assignment.type_name,
    location: assignment.location,
    source: 'constructor',
    confidence: 1.0,
    is_return_value: assignment.is_return_value,
    is_property_assignment: assignment.is_property_assignment
  };
  
  const existing = type_map.get(assignment.variable_name) || [];
  existing.push(type_info);
  type_map.set(assignment.variable_name, existing);
}

/**
 * Check if a constructor call is a return value
 */
function is_return_value(node: SyntaxNode): boolean {
  let current = node.parent;
  
  while (current) {
    if (current.type === 'return_statement') {
      return true;
    }
    
    // Stop at statement boundaries
    if (is_statement_boundary(current)) {
      break;
    }
    
    current = current.parent;
  }
  
  return false;
}

/**
 * Check if an assignment is to a property (this.foo, self.bar, etc.)
 */
function is_property_assignment(
  node: SyntaxNode,
  target: string,
  language: Language
): boolean {
  // Check for this.property or self.property patterns
  switch (language) {
    case 'javascript':
    case 'typescript':
      return target.startsWith('this.');
    case 'python':
      return target.startsWith('self.');
    case 'rust':
      return target.startsWith('self.');
    default:
      return false;
  }
}

/**
 * Check if a node is a statement boundary
 */
function is_statement_boundary(node: SyntaxNode): boolean {
  const boundary_types = [
    'expression_statement',
    'if_statement',
    'while_statement',
    'for_statement',
    'block',
    'function_declaration',
    'class_declaration',
    'function_definition',
    'class_definition'
  ];
  
  return boundary_types.includes(node.type);
}


/**
 * Merge constructor-discovered types into an existing type map
 * 
 * This function is used by type_tracking to incorporate types discovered
 * from constructor calls.
 * 
 * @param existing_types The existing type map from type_tracking
 * @param constructor_types Types discovered from constructor calls
 * @returns Merged type map
 */
export function merge_constructor_types(
  existing_types: Map<string, TypeInfo[]>,
  constructor_types: Map<string, TypeInfo[]>
): Map<string, TypeInfo[]> {
  const merged = new Map(existing_types);
  
  for (const [variable, types] of constructor_types) {
    const existing = merged.get(variable) || [];
    
    // Add constructor-discovered types, avoiding duplicates
    for (const new_type of types) {
      const duplicate = existing.some(t => 
        t.type_name === new_type.type_name &&
        t.location.line === new_type.location.line &&
        t.location.column === new_type.location.column
      );
      
      if (!duplicate) {
        existing.push(new_type);
      }
    }
    
    merged.set(variable, existing);
  }
  
  return merged;
}

/**
 * Extract type assignments from nested patterns
 * 
 * Handles patterns like:
 * - const x = { y: new Z() }  // x.y: Z
 * - const [a, b] = [new A(), new B()]  // a: A, b: B
 * - const { foo } = { foo: new Foo() }  // foo: Foo
 */
export function extract_nested_assignments(
  node: SyntaxNode,
  source_code: string,
  language: Language
): ConstructorTypeAssignment[] {
  const assignments: ConstructorTypeAssignment[] = [];
  
  // Handle object property assignments
  if (node.type === 'object' || node.type === 'object_pattern') {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === 'pair') {
        const key = child.childForFieldName('key');
        const value = child.childForFieldName('value');
        
        if (key && value && is_constructor_call_node(value, language)) {
          const class_name = extract_constructor_name(value, source_code, language);
          const property_name = source_code.substring(key.startIndex, key.endIndex);
          
          if (class_name && property_name) {
            assignments.push({
              variable_name: property_name,
              type_name: class_name,
              location: {
                line: value.startPosition.row,
                column: value.startPosition.column
              }
            });
          }
        }
      }
    }
  }
  
  // Handle array destructuring
  if (node.type === 'array' || node.type === 'array_pattern') {
    // This would require more complex tracking of array indices
    // Skipping for now as it's less common
  }
  
  return assignments;
}

/**
 * Validate that a type assignment is valid
 * 
 * Filters out invalid or unwanted type assignments.
 */
export function is_valid_type_assignment(assignment: ConstructorTypeAssignment): boolean {
  // Filter out anonymous or temporary variables
  if (assignment.variable_name.startsWith('<')) {
    return assignment.is_return_value || false;
  }
  
  // Filter out array indices for now (e.g., items[0])
  if (assignment.variable_name.includes('[')) {
    return false;
  }
  
  // Valid assignment
  return true;
}
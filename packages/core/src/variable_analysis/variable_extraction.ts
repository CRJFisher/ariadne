/**
 * Core variable extraction types and utilities
 */

import { SyntaxNode } from 'tree-sitter';
import { 
  VariableDeclaration,
  Location,
  TypeInfo,
  Language
} from '@ariadnejs/types';

/**
 * Extract variable declarations from AST
 */
export function extract_variable_declarations(
  node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): VariableDeclaration[] {
  const variables: VariableDeclaration[] = [];
  
  // Traverse AST to find variable declarations
  traverse_for_variables(node, source_code, language, file_path, variables);
  
  return variables;
}

/**
 * Traverse AST to find variable declarations
 */
function traverse_for_variables(
  node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string,
  variables: VariableDeclaration[]
): void {
  // Check if this node is a variable declaration
  if (is_variable_declaration(node, language)) {
    const variable = extract_variable_from_node(node, source_code, language, file_path);
    if (variable) {
      variables.push(variable);
    }
  }
  
  // Recursively process children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      traverse_for_variables(child, source_code, language, file_path, variables);
    }
  }
}

/**
 * Check if node is a variable declaration
 */
function is_variable_declaration(node: SyntaxNode, language: Language): boolean {
  switch (language) {
    case 'javascript':
    case 'typescript':
    case 'tsx':
      return node.type === 'variable_declaration' ||
             node.type === 'lexical_declaration';
    case 'python':
      return node.type === 'assignment' ||
             node.type === 'annotated_assignment';
    case 'rust':
      return node.type === 'let_declaration';
    default:
      return false;
  }
}

/**
 * Extract variable from declaration node
 */
function extract_variable_from_node(
  node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): VariableDeclaration | null {
  switch (language) {
    case 'javascript':
    case 'typescript':
    case 'tsx':
      return extract_javascript_variable(node, source_code, file_path);
    case 'python':
      return extract_python_variable(node, source_code, file_path);
    case 'rust':
      return extract_rust_variable(node, source_code, file_path);
    default:
      return null;
  }
}

/**
 * Extract JavaScript/TypeScript variable
 */
function extract_javascript_variable(
  node: SyntaxNode,
  source_code: string,
  file_path: string
): VariableDeclaration | null {
  // Find the identifier
  const identifier = find_child_by_type(node, 'identifier');
  if (!identifier) return null;
  
  const name = source_code.substring(identifier.startIndex, identifier.endIndex);
  
  // Determine mutability based on declaration type
  const parent = node.parent;
  const is_const = parent?.type === 'lexical_declaration' && 
                   source_code.substring(parent.startIndex, parent.startIndex + 5) === 'const';
  
  // Find type annotation if present
  const type_annotation = find_child_by_type(node, 'type_annotation');
  let type_info: TypeInfo | undefined;
  
  if (type_annotation) {
    const type_text = source_code.substring(
      type_annotation.startIndex + 1, // Skip the colon
      type_annotation.endIndex
    ).trim();
    
    type_info = {
      type: type_text,
      nullable: type_text.includes('null') || type_text.includes('undefined'),
      is_collection: type_text.includes('[]') || type_text.includes('Array')
    };
  }
  
  // Create location
  const location: Location = {
    file_path,
    line: node.startPosition.row,
    column: node.startPosition.column,
    end_line: node.endPosition.row,
    end_column: node.endPosition.column
  };
  
  return {
    name,
    location,
    type: type_info,
    is_mutable: !is_const,
    initial_value: extract_initial_value(node, source_code)
  };
}

/**
 * Extract Python variable
 */
function extract_python_variable(
  node: SyntaxNode,
  source_code: string,
  file_path: string
): VariableDeclaration | null {
  // Find the identifier (left side of assignment)
  const identifier = node.childForFieldName('left') || 
                    find_child_by_type(node, 'identifier');
  if (!identifier) return null;
  
  const name = source_code.substring(identifier.startIndex, identifier.endIndex);
  
  // Python variables are always mutable
  const is_mutable = true;
  
  // Find type annotation if present
  const type_node = node.childForFieldName('type');
  let type_info: TypeInfo | undefined;
  
  if (type_node) {
    const type_text = source_code.substring(type_node.startIndex, type_node.endIndex);
    
    type_info = {
      type: type_text,
      nullable: type_text.includes('Optional') || type_text.includes('None'),
      is_collection: type_text.includes('List') || type_text.includes('Dict') || 
                    type_text.includes('Set') || type_text.includes('Tuple')
    };
  }
  
  // Create location
  const location: Location = {
    file_path,
    line: node.startPosition.row,
    column: node.startPosition.column,
    end_line: node.endPosition.row,
    end_column: node.endPosition.column
  };
  
  return {
    name,
    location,
    type: type_info,
    is_mutable,
    initial_value: extract_initial_value(node, source_code)
  };
}

/**
 * Extract Rust variable
 */
function extract_rust_variable(
  node: SyntaxNode,
  source_code: string,
  file_path: string
): VariableDeclaration | null {
  // Find the pattern (identifier)
  const pattern = node.childForFieldName('pattern');
  if (!pattern) return null;
  
  const identifier = pattern.type === 'identifier' ? pattern : 
                    find_child_by_type(pattern, 'identifier');
  if (!identifier) return null;
  
  const name = source_code.substring(identifier.startIndex, identifier.endIndex);
  
  // Check for mut keyword
  const mutable_node = find_child_by_type(node, 'mutable_specifier');
  const is_mutable = mutable_node !== null;
  
  // Find type annotation if present
  const type_node = node.childForFieldName('type');
  let type_info: TypeInfo | undefined;
  
  if (type_node) {
    const type_text = source_code.substring(type_node.startIndex, type_node.endIndex);
    
    type_info = {
      type: type_text,
      nullable: type_text.includes('Option'),
      is_collection: type_text.includes('Vec') || type_text.includes('HashMap') || 
                    type_text.includes('HashSet')
    };
  }
  
  // Create location
  const location: Location = {
    file_path,
    line: node.startPosition.row,
    column: node.startPosition.column,
    end_line: node.endPosition.row,
    end_column: node.endPosition.column
  };
  
  return {
    name,
    location,
    type: type_info,
    is_mutable,
    initial_value: extract_initial_value(node, source_code)
  };
}

/**
 * Extract initial value from variable declaration
 */
function extract_initial_value(node: SyntaxNode, source_code: string): string | undefined {
  // Find the value/right side of assignment
  const value_node = node.childForFieldName('value') || 
                    node.childForFieldName('right');
  
  if (value_node) {
    return source_code.substring(value_node.startIndex, value_node.endIndex);
  }
  
  return undefined;
}

/**
 * Find child node by type
 */
function find_child_by_type(node: SyntaxNode, type: string): SyntaxNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === type) {
      return child;
    }
  }
  return null;
}
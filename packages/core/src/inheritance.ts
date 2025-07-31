import { SyntaxNode, Tree } from "tree-sitter";
import { Def } from "./graph";

export interface ClassRelationship {
  parent_class?: string;           // Name of parent class
  parent_class_def?: Def;          // Definition of parent class (if found)
  implemented_interfaces: string[]; // Names of implemented interfaces
  interface_defs: Def[];           // Definitions of interfaces (if found)
}

/**
 * Extract class inheritance information from a definition by finding its node in the AST
 */
export function extract_class_relationships(
  class_def: Def,
  tree: Tree,
  language: string
): ClassRelationship | null {
  // Only process class definitions
  if (class_def.symbol_kind !== "class" && class_def.symbol_kind !== "interface") {
    return null;
  }

  // Find the class node in the AST based on the definition's position
  const class_node = tree.rootNode.descendantForPosition(
    { row: class_def.range.start.row, column: class_def.range.start.column },
    { row: class_def.range.end.row, column: class_def.range.end.column }
  );

  if (!class_node) {
    return null;
  }
  

  const relationships: ClassRelationship = {
    implemented_interfaces: [],
    interface_defs: []
  };

  switch (language.toLowerCase()) {
    case "typescript":
    case "tsx":
    case "javascript":
    case "jsx":
      extract_typescript_inheritance(class_node, relationships);
      break;
    case "python":
      extract_python_inheritance(class_node, relationships);
      break;
    // Other languages can be added here
    default:
      return null;
  }

  return relationships;
}

/**
 * Extract inheritance for TypeScript/JavaScript
 */
function extract_typescript_inheritance(
  node: SyntaxNode,
  relationships: ClassRelationship
): void {
  // Find the class_declaration node if we're at an identifier
  let class_node = node;
  if (node.type === "identifier" || node.type === "type_identifier") {
    if (node.parent && node.parent.type === "class_declaration") {
      class_node = node.parent;
    } else {
      return;
    }
  }

  
  // Look for class_heritage child by iterating through children
  let heritage: SyntaxNode | null = null;
  for (let i = 0; i < class_node.childCount; i++) {
    const child = class_node.child(i);
    if (child && child.type === "class_heritage") {
      heritage = child;
      break;
    }
  }
  
  if (!heritage) {
    return;
  }


  // Process extends clause
  for (let i = 0; i < heritage.childCount; i++) {
    const child = heritage.child(i);
    if (!child) continue;

    if (child.type === "extends_clause") {
      // TypeScript style: extends_clause node
      if (child.childCount >= 2) {
        const parent_identifier = child.child(1);
        if (parent_identifier && 
            (parent_identifier.type === "identifier" || 
             parent_identifier.type === "type_identifier")) {
          relationships.parent_class = parent_identifier.text;
        }
      }
    } else if (child.type === "extends" && i + 1 < heritage.childCount) {
      // JavaScript style: direct "extends" keyword followed by identifier
      const parent_identifier = heritage.child(i + 1);
      if (parent_identifier && 
          (parent_identifier.type === "identifier" || 
           parent_identifier.type === "type_identifier")) {
        relationships.parent_class = parent_identifier.text;
        break; // Found parent, no need to continue
      }
    } else if (child.type === "implements_clause") {
      // Extract all implemented interfaces
      for (let j = 0; j < child.childCount; j++) {
        const interface_node = child.child(j);
        if (interface_node && 
            (interface_node.type === "type_identifier" || 
             interface_node.type === "identifier")) {
          relationships.implemented_interfaces.push(interface_node.text);
        }
      }
    }
  }
}

/**
 * Extract inheritance for Python
 */
function extract_python_inheritance(
  node: SyntaxNode,
  relationships: ClassRelationship
): void {
  // Find the class_definition node if we're at an identifier
  let class_node = node;
  if (node.type === "identifier") {
    if (node.parent && node.parent.type === "class_definition") {
      class_node = node.parent;
    } else {
      return;
    }
  }

  // Look for superclasses (argument_list)
  const superclasses = class_node.childForFieldName("superclasses");
  if (!superclasses || superclasses.type !== "argument_list") {
    return;
  }

  // In Python, all superclasses are in the argument_list
  // The first one is considered the primary parent class
  let is_first = true;
  for (let i = 0; i < superclasses.childCount; i++) {
    const child = superclasses.child(i);
    if (child && child.type === "identifier") {
      if (is_first) {
        relationships.parent_class = child.text;
        is_first = false;
      } else {
        // Additional base classes are treated like interfaces
        relationships.implemented_interfaces.push(child.text);
      }
    }
  }
}


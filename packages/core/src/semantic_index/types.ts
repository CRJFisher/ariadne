/**
 * Internal types for semantic index processing
 */

import type { SyntaxNode } from "tree-sitter";

/**
 * Semantic capture from tree-sitter query
 */
export interface SemanticCapture {
  name: string;
  node: SyntaxNode;
  text: string;
  category: "scope" | "def" | "ref" | "import" | "export" | "type" | "assign" | "class" | "method" | "return";
  subcategory?: string;
  detail?: string;
}

/**
 * Assignment capture - links variable to its initializer
 */
export interface AssignmentCapture {
  target: SemanticCapture;
  source: SemanticCapture;
  constructor_name?: string;
}

/**
 * Method call capture - links receiver to method
 */
export interface MethodCallCapture {
  receiver: SemanticCapture;
  method: SemanticCapture;
  property_chain?: string[];
}

/**
 * Class inheritance capture
 */
export interface ClassInheritanceCapture {
  class_name: string;
  extends_class?: string;
  implements?: string[];
}
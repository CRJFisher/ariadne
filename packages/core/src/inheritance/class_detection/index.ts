/**
 * Class Detection - File-Level Class Identification
 * 
 * Identifies class definitions within a single file during Stage 1 analysis.
 * This module extracts class information that will be assembled into the
 * global ClassHierarchy during Stage 2.
 * 
 * This is a Stage 1 (Per-File Analysis) module.
 */

import { Language } from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';

/**
 * Class information extracted from a single file
 */
export interface DetectedClass {
  name: string;
  file_path: string;
  location: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  extends?: string; // Parent class name (if any)
  implements: string[]; // Interfaces implemented
  is_abstract: boolean;
  is_interface: boolean;
  methods: DetectedMethod[];
  properties: DetectedProperty[];
}

/**
 * Method information within a class
 */
export interface DetectedMethod {
  name: string;
  visibility: 'public' | 'private' | 'protected';
  is_static: boolean;
  is_abstract: boolean;
  is_constructor: boolean;
}

/**
 * Property information within a class
 */
export interface DetectedProperty {
  name: string;
  visibility: 'public' | 'private' | 'protected';
  is_static: boolean;
  is_readonly: boolean;
  type?: string; // Type annotation if available
}

/**
 * Context for class detection
 */
export interface ClassDetectionContext {
  source_code: string;
  file_path: string;
  language: Language;
  ast_root: SyntaxNode;
}

/**
 * Detect all class definitions in a file
 * 
 * @param context Class detection context
 * @returns Array of detected classes
 */
export function detect_classes(
  context: ClassDetectionContext
): DetectedClass[] {
  // TODO: Dispatch to language-specific detection
  // Each language has different class syntax
  
  return [];
}

/**
 * Extract methods from a class node
 * 
 * @param class_node The class AST node
 * @param context Detection context
 * @returns Array of detected methods
 */
export function extract_methods(
  class_node: SyntaxNode,
  context: ClassDetectionContext
): DetectedMethod[] {
  // TODO: Language-specific method extraction
  return [];
}

/**
 * Extract properties from a class node
 * 
 * @param class_node The class AST node
 * @param context Detection context
 * @returns Array of detected properties
 */
export function extract_properties(
  class_node: SyntaxNode,
  context: ClassDetectionContext
): DetectedProperty[] {
  // TODO: Language-specific property extraction
  return [];
}
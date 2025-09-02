/**
 * Class detection module
 * 
 * Identifies class definitions during per-file analysis phase.
 * This module was referenced in Architecture.md but was missing.
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, ClassDefinition } from '@ariadnejs/types';
import { find_class_definitions_javascript } from './class_detection.javascript';
import { find_class_definitions_typescript } from './class_detection.typescript';
import { find_class_definitions_python } from './class_detection.python';
import { find_struct_definitions_rust } from './class_detection.rust';

export interface ClassDetectionContext {
  source_code: string;
  file_path: string;
  language: Language;
  ast_root: SyntaxNode;
}

/**
 * Find all class definitions in a file
 * 
 * This is a per-file analysis function that extracts class definitions
 * without needing information from other files.
 */
export function find_class_definitions(
  context: ClassDetectionContext
): ClassDefinition[] {
  switch (context.language) {
    case 'javascript':
      return find_class_definitions_javascript(context);
    case 'typescript':
      return find_class_definitions_typescript(context);
    case 'python':
      return find_class_definitions_python(context);
    case 'rust':
      // Rust doesn't have classes, but has structs with impl blocks
      return find_struct_definitions_rust(context);
    default:
      return [];
  }
}

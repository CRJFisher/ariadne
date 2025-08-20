import Parser from 'tree-sitter';
import { SyntaxNode } from 'tree-sitter';
import { ExtractedContext } from '@ariadnejs/types';

// Re-export clean types from @ariadnejs/types
export { ExtractedContext } from '@ariadnejs/types';

// Types that depend on tree-sitter stay in core
export interface LanguageConfig {
  name: string;
  file_extensions: string[];
  parser: Parser;
  scope_query: string;
  namespaces: string[][];
  
  // Optional extraction methods for language-specific features
  extract_context?: (
    node: SyntaxNode,
    source_lines: string[],
    start_line: number
  ) => ExtractedContext;
}
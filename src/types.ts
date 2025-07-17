import Parser from 'tree-sitter';
import { SyntaxNode } from 'tree-sitter';

export interface ExtractedContext {
  docstring?: string;
  decorators?: string[];
}

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
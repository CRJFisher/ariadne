import Parser from 'tree-sitter';

export interface LanguageConfig {
  name: string;
  file_extensions: string[];
  parser: Parser;
  scope_query: string;
  namespaces: string[][];
} 
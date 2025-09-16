import * as fs from 'fs';
import * as path from 'path';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import { Language } from '@ariadnejs/types';

// File extension to language mapping - single source of truth
const FILE_EXTENSIONS: Record<string, Language> = {
  'js': 'javascript',
  'mjs': 'javascript',
  'cjs': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'mts': 'typescript',
  'cts': 'typescript',
  'py': 'python',
  'pyw': 'python',
  'rs': 'rust',
};

export function get_language_for_file(file_path: string): Language | null {
  const ext = path.extname(file_path).slice(1).toLowerCase();
  return FILE_EXTENSIONS[ext] || null;
}

export function load_scope_query(language: Language): string {
  // Queries live in the queries/ subdirectory relative to this file
  const query_path = path.join(__dirname, 'queries', `${language}.scm`);
  
  try {
    return fs.readFileSync(query_path, 'utf8');
  } catch (e) {
    // For now, return empty query since queries are being implemented
    // TODO: Once all query files are in place, throw error instead
    console.warn(`Scope query not found for ${language} at ${query_path}, using empty query`);
    throw new Error(`Scope query not found for ${language} at ${query_path}`);
  }
}

function create_javascript_parser(): Parser {
  const parser = new Parser();
  parser.setLanguage(JavaScript as any);
  parser.setTimeoutMicros(5000000); // 5 seconds
  return parser;
}

function create_typescript_parser(): Parser {
  const parser = new Parser();
  // Use TSX variant which is a superset of TypeScript and includes JSX support
  const typescript = TypeScript.tsx;
  parser.setLanguage(typescript as any);
  parser.setTimeoutMicros(5000000); // 5 seconds
  return parser;
}

function create_python_parser(): Parser {
  const parser = new Parser();
  parser.setLanguage(Python as any);
  parser.setTimeoutMicros(5000000); // 5 seconds
  return parser;
}

function create_rust_parser(): Parser {
  const parser = new Parser();
  parser.setLanguage(Rust as any);
  parser.setTimeoutMicros(5000000); // 5 seconds
  return parser;
}

export function get_language_parser(language: Language): Parser {
  const parsers = {
    javascript: create_javascript_parser,
    typescript: create_typescript_parser,
    python: create_python_parser,
    rust: create_rust_parser
  };
  
  const create_parser = parsers[language];
  if (!create_parser) {
    throw new Error(`Unsupported language: ${language}`);
  }
  return create_parser();
}

// Export supported languages
export const SUPPORTED_LANGUAGES: Language[] = ['javascript', 'typescript', 'python', 'rust'];

// Export file extension mapping for external use
export { FILE_EXTENSIONS };

// Re-export Language type from @ariadnejs/types
export type { Language } from '@ariadnejs/types';
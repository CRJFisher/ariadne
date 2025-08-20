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
  const query_path = path.join(__dirname, `${language}.scm`);
  
  // Try multiple paths to handle both compiled and source scenarios
  const possible_paths = [
    query_path,
    path.join(__dirname, '..', '..', 'src', 'scope_queries', `${language}.scm`),
    path.join(process.cwd(), 'src', 'scope_queries', `${language}.scm`),
    path.join(process.cwd(), 'dist', 'scope_queries', `${language}.scm`),
  ];

  for (const p of possible_paths) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf8');
      }
    } catch (e) {
      // Continue to next path
    }
  }

  throw new Error(`Could not find scope query for language: ${language}`);
}

export function load_language_metadata(language: Language): any {
  const meta_path = path.join(__dirname, `${language}.meta.json`);
  
  // For now, return default metadata since we haven't created the meta files yet
  // TODO: Create and load actual metadata files
  return {
    language,
    symbolKinds: [],
    captureNames: []
  };
}

function create_javascript_parser(): Parser {
  const parser = new Parser();
  parser.setLanguage(JavaScript as any);
  parser.setTimeoutMicros(5000000); // 5 seconds
  return parser;
}

function create_typescript_parser(): Parser {
  const parser = new Parser();
  const typescript = TypeScript.typescript;
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

export function get_language_parser(language: Language): Parser | null {
  const parsers = {
    javascript: create_javascript_parser,
    typescript: create_typescript_parser,
    python: create_python_parser,
    rust: create_rust_parser
  };
  
  const create_parser = parsers[language];
  return create_parser ? create_parser() : null;
}

// Export supported languages
export const SUPPORTED_LANGUAGES: Language[] = ['javascript', 'typescript', 'python', 'rust'];

// Export file extension mapping for external use
export { FILE_EXTENSIONS };

// Re-export Language type from @ariadnejs/types
export type { Language } from '@ariadnejs/types';
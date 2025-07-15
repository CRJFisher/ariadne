import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import fs from 'fs';
import path from 'path';
import { LanguageConfig } from '../../types';

function initialize_parser(): Parser {
  const parser = new Parser();
  // We use `as any` here to bypass a type mismatch caused by
  // the peer dependency conflict between tree-sitter and tree-sitter-javascript.
  parser.setLanguage(JavaScript as any);
  
  // Set a reasonable timeout (default is very low)
  parser.setTimeoutMicros(5000000); // 5 seconds
  
  return parser;
}

// Try multiple paths to find the scopes.scm file
function get_scope_query(): string {
  const possible_paths = [
    path.join(__dirname, 'scopes.scm'),
    path.join(__dirname, '..', '..', '..', 'src', 'languages', 'javascript', 'scopes.scm'),
    path.join(process.cwd(), 'src', 'languages', 'javascript', 'scopes.scm'),
    path.join(process.cwd(), 'dist', 'languages', 'javascript', 'scopes.scm'),
  ];
  
  for (const p of possible_paths) {
    try {
      return fs.readFileSync(p, 'utf8');
    } catch (e) {
      // Continue to next path
    }
  }
  
  throw new Error(`Could not find scopes.scm for JavaScript. Tried paths: ${possible_paths.join(', ')}`);
}

export const javascript_config: LanguageConfig = {
  name: 'javascript',
  file_extensions: ['js', 'mjs', 'cjs', 'jsx'],
  parser: initialize_parser(),
  scope_query: get_scope_query(),
  namespaces: [
    [
      // functions
      'function',
      'generator',
      'method',
      'class',
      'constructor',
    ],
    [
      // variables
      'variable',
      'constant',
      'parameter',
      'property',
      'label',
    ],
  ],
};
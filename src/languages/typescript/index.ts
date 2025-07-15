import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import fs from 'fs';
import path from 'path';
import { LanguageConfig } from '../../types';

function initialize_parser(): Parser {
  const parser = new Parser();
  // We use `as any` here to bypass a type mismatch caused by
  // the peer dependency conflict between tree-sitter and tree-sitter-typescript.
  // Use tsx language which includes TypeScript + JSX support
  parser.setLanguage(TypeScript.tsx as any);
  return parser;
}

// Try multiple paths to find the scopes.scm file
function get_scope_query(): string {
  const possible_paths = [
    path.join(__dirname, 'scopes.scm'),
    path.join(__dirname, '..', '..', '..', 'src', 'languages', 'typescript', 'scopes.scm'),
    path.join(process.cwd(), 'src', 'languages', 'typescript', 'scopes.scm'),
    path.join(process.cwd(), 'dist', 'languages', 'typescript', 'scopes.scm'),
  ];
  
  for (const p of possible_paths) {
    try {
      return fs.readFileSync(p, 'utf8');
    } catch (e) {
      // Continue to next path
    }
  }
  
  throw new Error(`Could not find scopes.scm for TypeScript. Tried paths: ${possible_paths.join(', ')}`);
}

export const typescript_config: LanguageConfig = {
  name: 'typescript',
  file_extensions: ['ts', 'tsx'],
  parser: initialize_parser(),
  scope_query: get_scope_query(),
  namespaces: [
    [
      // functions
      'function',
      'generator',
      'method',
      'class',
      'interface',
      'enum',
      'alias',
    ],
    [
      // variables
      'variable',
      'constant',
      'parameter',
      'property',
      'enumerator',
      'label',
    ],
  ],
}; 
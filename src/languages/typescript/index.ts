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

export const typescript_config: LanguageConfig = {
  name: 'typescript',
  file_extensions: ['ts', 'tsx'],
  parser: initialize_parser(),
  scope_query: fs.readFileSync(path.join(__dirname, 'scopes.scm'), 'utf8'),
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
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
  return parser;
}

export const javascript_config: LanguageConfig = {
  name: 'javascript',
  file_extensions: ['js', 'mjs', 'cjs', 'jsx'],
  parser: initialize_parser(),
  scope_query: fs.readFileSync(path.join(__dirname, 'scopes.scm'), 'utf8'),
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
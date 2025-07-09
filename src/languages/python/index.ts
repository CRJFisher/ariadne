import Parser from 'tree-sitter';
import Python from 'tree-sitter-python';
import fs from 'fs';
import path from 'path';
import { LanguageConfig } from '../../types';

function initialize_parser(): Parser {
  const parser = new Parser();
  // We use `as any` here to bypass a type mismatch caused by
  // the peer dependency conflict between tree-sitter and tree-sitter-python.
  parser.setLanguage(Python as any);
  return parser;
}

export const python_config: LanguageConfig = {
  name: 'python',
  file_extensions: ['py', 'pyi', 'pyw'],
  parser: initialize_parser(),
  scope_query: fs.readFileSync(path.join(__dirname, 'scopes.scm'), 'utf8'),
  namespaces: [
    [
      // functions and classes
      'function',
      'method',
      'class',
      'async_function',
      'async_method',
      'generator',
      'async_generator',
      'decorator',
    ],
    [
      // variables
      'variable',
      'constant',
      'parameter',
      'attribute',
      'property',
      'global',
      'nonlocal',
    ],
  ],
};
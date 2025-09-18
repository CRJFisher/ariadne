import { readFileSync } from 'fs';
import { join } from 'path';
import type { Language } from '@ariadnejs/types';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import TypeScript from 'tree-sitter-typescript';

/**
 * Language to tree-sitter parser mapping
 */
export const LANGUAGE_TO_TREESITTER_LANG = new Map([
  ['javascript', JavaScript],
  ['typescript', TypeScript.tsx],
  ['python', Python],
  ['rust', Rust],
]);

/**
 * Load a tree-sitter query for a specific language
 */
export function load_query(language: Language): string {
  const queryPath = join(__dirname, 'queries', `${language}.scm`);

  try {
    return readFileSync(queryPath, 'utf-8');
  } catch (error) {
    throw new Error(`No semantic index query found for language: ${language}`);
  }
}

/**
 * Check if a query exists for a language
 */
export function has_query(language: Language): boolean {
  try {
    load_query(language);
    return true;
  } catch {
    return false;
  }
}
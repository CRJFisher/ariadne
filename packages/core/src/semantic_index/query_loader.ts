import { readFileSync } from 'fs';
import { join } from 'path';
import type { Language } from '@ariadnejs/types';

/**
 * Load a tree-sitter query for a specific language
 */
export function load_query(language: Language): string {
  const queryPath = join(__dirname, 'queries', `${language}.scm`);

  try {
    return readFileSync(queryPath, 'utf-8');
  } catch (error) {
    // For TypeScript, fall back to JavaScript query
    if (language === 'typescript') {
      const jsPath = join(__dirname, 'queries', 'javascript.scm');
      return readFileSync(jsPath, 'utf-8');
    }
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
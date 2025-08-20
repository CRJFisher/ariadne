/**
 * Tree-sitter query execution utilities
 * 
 * Provides functions for running tree-sitter queries on AST nodes
 */

import { Query, SyntaxNode } from 'tree-sitter';
import Parser from 'tree-sitter';
import { Language } from '@ariadnejs/types';

/**
 * Query result with captured nodes
 */
export interface QueryMatch {
  pattern: number;
  captures: Array<{
    name: string;
    node: SyntaxNode;
  }>;
}

/**
 * Execute a tree-sitter query on an AST
 */
export function execute_query(
  node: SyntaxNode,
  queryString: string,
  language: any // Tree-sitter language object from parser.getLanguage()
): QueryMatch[] {
  const query = new Query(language, queryString);
  const matches = query.matches(node);
  
  return matches.map(match => ({
    pattern: match.pattern,
    captures: match.captures.map(capture => ({
      name: capture.name,
      node: capture.node
    }))
  }));
}

/**
 * Execute a query and return only specific captures
 */
export function get_captures(
  node: SyntaxNode,
  queryString: string,
  language: any, // Tree-sitter language object from parser.getLanguage()
  captureName: string
): SyntaxNode[] {
  const matches = execute_query(node, queryString, language);
  const captures: SyntaxNode[] = [];
  
  for (const match of matches) {
    for (const capture of match.captures) {
      if (capture.name === captureName) {
        captures.push(capture.node);
      }
    }
  }
  
  return captures;
}

/**
 * Find nodes matching a query pattern
 */
export function find_nodes(
  node: SyntaxNode,
  pattern: string,
  language: any // Tree-sitter language object from parser.getLanguage()
): SyntaxNode[] {
  const queryString = `${pattern} @match`;
  return get_captures(node, queryString, language, 'match');
}

/**
 * Execute a query with predicates
 */
export function execute_query_with_predicates(
  node: SyntaxNode,
  queryString: string,
  language: any, // Tree-sitter language object from parser.getLanguage()
  source: string
): QueryMatch[] {
  const query = new Query(language, queryString);
  const matches = query.matches(node);
  
  // Filter matches based on predicates
  // TODO: Fix predicatesForPattern - method doesn't exist on Query type
  // const predicates = query.predicatesForPattern(match.pattern);
  return matches.map(match => ({
    pattern: match.pattern,
    captures: match.captures.map(capture => ({
      name: capture.name,
      node: capture.node
    }))
  }));
}

/**
 * Evaluate a query predicate
 */
function evaluate_predicate(
  predicate: any[],
  match: any,
  source: string
): boolean {
  const [type, ...args] = predicate;
  
  switch (type) {
    case 'eq?': {
      // Check equality between capture and string
      const [captureRef, value] = args;
      const capture = get_capture_from_ref(captureRef, match);
      if (!capture) return false;
      
      const nodeText = source.substring(capture.node.startIndex, capture.node.endIndex);
      return nodeText === value;
    }
    
    case 'match?': {
      // Check regex match
      const [captureRef, pattern] = args;
      const capture = get_capture_from_ref(captureRef, match);
      if (!capture) return false;
      
      const nodeText = source.substring(capture.node.startIndex, capture.node.endIndex);
      const regex = new RegExp(pattern);
      return regex.test(nodeText);
    }
    
    case 'not-eq?': {
      // Check inequality
      const [captureRef, value] = args;
      const capture = get_capture_from_ref(captureRef, match);
      if (!capture) return false;
      
      const nodeText = source.substring(capture.node.startIndex, capture.node.endIndex);
      return nodeText !== value;
    }
    
    default:
      // Unknown predicate type - default to true
      return true;
  }
}

/**
 * Get a capture from a reference like "@name"
 */
function get_capture_from_ref(ref: string, match: any): any {
  if (!ref.startsWith('@')) return null;
  
  const captureName = ref.substring(1);
  return match.captures.find((c: any) => c.name === captureName);
}

/**
 * Create a simple query for finding function definitions
 */
export function create_function_query(language: Language): string {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return `
        (function_declaration name: (identifier) @name)
        (function_expression name: (identifier) @name)
        (arrow_function) @name
        (method_definition key: (property_identifier) @name)
      `;
    
    case 'python':
      return `
        (function_definition name: (identifier) @name)
      `;
    
    case 'rust':
      return `
        (function_item name: (identifier) @name)
      `;
    
    default:
      return '';
  }
}

/**
 * Create a query for finding class definitions
 */
export function create_class_query(language: Language): string {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return `
        (class_declaration name: (identifier) @name)
        (class_expression name: (identifier) @name)
      `;
    
    case 'python':
      return `
        (class_definition name: (identifier) @name)
      `;
    
    case 'rust':
      return `
        (struct_item name: (type_identifier) @name)
        (impl_item type: (type_identifier) @name)
      `;
    
    default:
      return '';
  }
}
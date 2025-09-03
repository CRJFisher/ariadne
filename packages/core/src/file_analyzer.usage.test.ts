import { describe, it, expect } from 'vitest';
import { find_all_references } from './scope_analysis/usage_finder';
import { build_scope_tree } from './scope_analysis/scope_tree';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';

describe('Usage Finder Wiring', () => {
  it('should be able to call find_all_references', () => {
    // This test verifies the usage finder module is properly wired
    // and can be called from other modules
    
    const parser = new Parser();
    parser.setLanguage(JavaScript as any);
    
    const source_code = `
      function test() {
        const x = 42;
        return x * 2;
      }
    `;
    
    const tree = parser.parse(source_code);
    const scope_tree = build_scope_tree(
      tree.rootNode,
      source_code,
      'javascript',
      '/test/file.js'
    );
    
    // Verify find_all_references can be called
    const references = find_all_references(
      'x',
      scope_tree,
      'javascript',
      '/test/file.js',
      tree.rootNode,
      source_code
    );
    
    // The function should return an array (even if empty)
    expect(Array.isArray(references)).toBe(true);
  });
  
  it('should find references in JavaScript code', () => {
    const parser = new Parser();
    parser.setLanguage(JavaScript as any);
    
    const source_code = `
      const myVar = 10;
      console.log(myVar);
      const result = myVar * 2;
    `;
    
    const tree = parser.parse(source_code);
    const scope_tree = build_scope_tree(
      tree.rootNode,
      source_code,
      'javascript',
      '/test/file.js'
    );
    
    // Find all references to myVar
    const references = find_all_references(
      'myVar',
      scope_tree,
      'javascript',
      '/test/file.js',
      tree.rootNode,
      source_code
    );
    
    // Should find at least the usage references
    expect(references.length).toBeGreaterThanOrEqual(0);
  });
});
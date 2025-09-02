/**
 * Test variable extraction from scope tree
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import { build_scope_tree } from './scope_tree';
import { extract_variables_from_symbols } from './enhanced_symbols';

describe('Variable Extraction from Scope Tree', () => {
  describe('JavaScript/TypeScript', () => {
    it('should extract variables with declaration types', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript as any);
      
      const code = `
        const constVar = 1;
        let letVar = 2;
        var varVar = 3;
        function fn(param) {
          const inner = 4;
        }
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(
        tree.rootNode,
        code,
        'javascript',
        'test.js'
      );
      
      // Extract all variables from all scopes
      const all_variables: any[] = [];
      for (const [_, scope] of scope_tree.nodes) {
        const vars = extract_variables_from_symbols(scope.symbols);
        all_variables.push(...vars);
      }
      
      // Check we found the variables
      const varNames = all_variables.map(v => v.name);
      expect(varNames).toContain('constVar');
      expect(varNames).toContain('letVar');
      expect(varNames).toContain('varVar');
      expect(varNames).toContain('inner');
      
      // Check declaration types
      const constVar = all_variables.find(v => v.name === 'constVar');
      expect(constVar?.declaration_type).toBe('const');
      
      const letVar = all_variables.find(v => v.name === 'letVar');
      expect(letVar?.declaration_type).toBe('let');
      
      const varVar = all_variables.find(v => v.name === 'varVar');
      expect(varVar?.declaration_type).toBe('var');
    });
    
    it('should track mutability correctly', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript as any);
      
      const code = `
        const immutable = 1;
        let mutable = 2;
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(
        tree.rootNode,
        code,
        'javascript',
        'test.js'
      );
      
      // Extract variables
      const all_variables: any[] = [];
      for (const [_, scope] of scope_tree.nodes) {
        const vars = extract_variables_from_symbols(scope.symbols);
        all_variables.push(...vars);
      }
      
      const immutable = all_variables.find(v => v.name === 'immutable');
      expect(immutable?.is_mutable).toBe(false);
      
      const mutable = all_variables.find(v => v.name === 'mutable');
      expect(mutable?.is_mutable).toBe(true);
    });
    
    it('should extract initial values', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript as any);
      
      const code = `
        const withValue = "hello";
        let withoutValue;
      `;
      
      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(
        tree.rootNode,
        code,
        'javascript',
        'test.js'
      );
      
      // Extract variables
      const all_variables: any[] = [];
      for (const [_, scope] of scope_tree.nodes) {
        const vars = extract_variables_from_symbols(scope.symbols);
        all_variables.push(...vars);
      }
      
      const withValue = all_variables.find(v => v.name === 'withValue');
      expect(withValue?.initial_value).toBe('"hello"');
      
      const withoutValue = all_variables.find(v => v.name === 'withoutValue');
      expect(withoutValue?.initial_value).toBeUndefined();
    });
  });
  
  describe('Python', () => {
    it('should extract Python variables', () => {
      const parser = new Parser();
      parser.setLanguage(Python as any);
      
      const code = `
x = 1
y: int = 2

def fn(param):
    local = 3
    return local
`;
      
      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(
        tree.rootNode,
        code,
        'python',
        'test.py'
      );
      
      // Extract variables
      const all_variables: any[] = [];
      for (const [_, scope] of scope_tree.nodes) {
        const vars = extract_variables_from_symbols(scope.symbols);
        all_variables.push(...vars);
      }
      
      const varNames = all_variables.map(v => v.name);
      expect(varNames).toContain('x');
      expect(varNames).toContain('y');
      expect(varNames).toContain('local');
      
      // Python variables are always mutable
      const x = all_variables.find(v => v.name === 'x');
      expect(x?.is_mutable).toBe(true);
    });
  });
  
  describe('Rust', () => {
    it('should extract Rust variables with mutability', () => {
      const parser = new Parser();
      parser.setLanguage(Rust as any);
      
      const code = `
fn main() {
    let immutable = 1;
    let mut mutable = 2;
}
`;
      
      const tree = parser.parse(code);
      const scope_tree = build_scope_tree(
        tree.rootNode,
        code,
        'rust',
        'test.rs'
      );
      
      // Extract variables
      const all_variables: any[] = [];
      for (const [_, scope] of scope_tree.nodes) {
        const vars = extract_variables_from_symbols(scope.symbols);
        all_variables.push(...vars);
      }
      
      const immutable = all_variables.find(v => v.name === 'immutable');
      expect(immutable?.is_mutable).toBe(false);
      
      const mutable = all_variables.find(v => v.name === 'mutable');
      expect(mutable?.is_mutable).toBe(true);
    });
  });
});
/**
 * Tests for generic function call processor
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import { find_function_calls_generic } from './generic_processor';
import { FunctionCallContext } from './function_calls';

describe('Generic Function Call Processor', () => {
  
  describe('JavaScript configuration', () => {
    const parser = new Parser();
    parser.setLanguage(JavaScript);
    
    it('should detect simple function calls using config', () => {
      const source = `console.log("test");`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe('log');
      expect(calls[0].is_method_call).toBe(true);
    });
    
    it('should detect new expressions using config', () => {
      const source = `const obj = new MyClass();`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe('MyClass');
      expect(calls[0].is_constructor_call).toBe(true);
    });
    
    it('should count arguments correctly', () => {
      const source = `func(1, 2, 3);`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].arguments_count).toBe(3);
    });
  });
  
  describe('TypeScript configuration', () => {
    const parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
    
    it('should handle generic type arguments', () => {
      const source = `const result = identity<string>('test');`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.ts',
        language: 'typescript',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe('identity');
    });
    
    it('should skip decorator calls (handled by bespoke)', () => {
      const source = `
        @Component()
        class MyClass {}
      `;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.ts',
        language: 'typescript',
        ast_root: tree.rootNode
      };
      
      // Generic processor should skip decorator calls
      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(0);
    });
  });
  
  describe('Python configuration', () => {
    const parser = new Parser();
    parser.setLanguage(Python);
    
    it('should detect Python calls using config', () => {
      const source = `print("hello")`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe('print');
    });
    
    it('should detect method calls using attribute syntax', () => {
      const source = `obj.method()`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe('method');
      expect(calls[0].is_method_call).toBe(true);
    });
    
    it('should detect constructor by capitalization', () => {
      const source = `person = Person("John")`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].is_constructor_call).toBe(true);
    });
  });
  
  describe('Rust configuration', () => {
    const parser = new Parser();
    parser.setLanguage(Rust);
    
    it('should detect Rust function calls', () => {
      const source = `fn main() { println!("hello"); }`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.rs',
        language: 'rust',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      const macro_call = calls.find(c => c.callee_name === 'println!');
      expect(macro_call).toBeDefined();
      expect(macro_call?.is_macro_call).toBe(true);
    });
    
    it('should detect method calls via field expression', () => {
      const source = `let len = s.len();`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.rs',
        language: 'rust',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe('len');
      expect(calls[0].is_method_call).toBe(true);
    });
    
    it('should detect associated functions', () => {
      const source = `let s = String::new();`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.rs',
        language: 'rust',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe('new');
    });
  });
  
  describe('Edge cases', () => {
    const parser = new Parser();
    parser.setLanguage(JavaScript);
    
    it('should handle nested calls', () => {
      const source = `outer(inner(42));`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(2);
      expect(calls.map(c => c.callee_name).sort()).toEqual(['inner', 'outer']);
    });
    
    it('should handle empty argument lists', () => {
      const source = `func();`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      expect(calls[0].arguments_count).toBe(0);
    });
    
    it('should track location correctly', () => {
      const source = `
        // Line 1
        func(); // Line 2
      `;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      expect(calls[0].location.line).toBe(3); // 1-based line numbers
    });
  });
  
  describe('Enclosing function detection', () => {
    const parser = new Parser();
    parser.setLanguage(JavaScript);
    
    it('should detect calls within functions', () => {
      const source = `
        function outer() {
          inner();
        }
      `;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      expect(calls[0].caller_name).toBe('outer');
    });
    
    it('should use <module> for top-level calls', () => {
      const source = `console.log('top level');`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      expect(calls[0].caller_name).toBe('<module>');
    });
    
    it('should handle anonymous functions', () => {
      const source = `
        const fn = () => {
          test();
        };
      `;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls_generic(context);
      expect(calls[0].caller_name).toMatch(/^<anonymous@/);
    });
  });
});
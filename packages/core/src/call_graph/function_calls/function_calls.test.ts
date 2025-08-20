/**
 * Tests for function call detection across all languages
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import { Language } from '@ariadnejs/types';
import { 
  find_function_calls,
  FunctionCallContext,
  FunctionCallInfo
} from './index';

describe('Function Call Detection', () => {
  
  describe('JavaScript', () => {
    const parser = new Parser();
    parser.setLanguage(JavaScript);
    
    it('should detect simple function calls', () => {
      const source = `
        function greet() {
          console.log('Hello');
        }
        greet();
      `;
      
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls(context);
      
      expect(calls).toHaveLength(2);
      expect(calls[0].callee_name).toBe('log');
      expect(calls[0].is_method_call).toBe(true);
      expect(calls[1].callee_name).toBe('greet');
      expect(calls[1].is_method_call).toBe(false);
    });
    
    it('should detect constructor calls', () => {
      const source = `
        class Person {}
        const p = new Person();
      `;
      
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls(context);
      
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe('Person');
      expect(calls[0].is_constructor_call).toBe(true);
    });
    
    it('should detect method calls', () => {
      const source = `
        const obj = { method: () => {} };
        obj.method();
        array.push(1);
      `;
      
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls(context);
      
      expect(calls).toHaveLength(2);
      expect(calls[0].callee_name).toBe('method');
      expect(calls[0].is_method_call).toBe(true);
      expect(calls[1].callee_name).toBe('push');
      expect(calls[1].is_method_call).toBe(true);
    });
  });
  
  describe('TypeScript', () => {
    const parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
    
    it('should detect decorator calls', () => {
      const source = `
        @Component()
        class MyComponent {
          @Input() value: string;
        }
      `;
      
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.ts',
        language: 'typescript',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls(context);
      
      // Should find Component() and Input() decorator calls
      const decoratorCalls = calls.filter(c => 
        c.callee_name === 'Component' || c.callee_name === 'Input'
      );
      expect(decoratorCalls).toHaveLength(2);
    });
    
    it('should detect generic function calls', () => {
      const source = `
        function identity<T>(x: T): T { return x; }
        const result = identity<string>('hello');
      `;
      
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.ts',
        language: 'typescript',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls(context);
      
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe('identity');
    });
  });
  
  describe('Python', () => {
    const parser = new Parser();
    parser.setLanguage(Python);
    
    it('should detect function and method calls', () => {
      const source = `
def greet():
    print("Hello")

greet()
obj.method()
      `;
      
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls(context);
      
      expect(calls).toHaveLength(3);
      expect(calls[0].callee_name).toBe('print');
      expect(calls[1].callee_name).toBe('greet');
      expect(calls[2].callee_name).toBe('method');
      expect(calls[2].is_method_call).toBe(true);
    });
    
    it('should detect class instantiation', () => {
      const source = `
class Person:
    pass

p = Person()
      `;
      
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls(context);
      
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe('Person');
      expect(calls[0].is_constructor_call).toBe(true);
    });
  });
  
  describe('Rust', () => {
    const parser = new Parser();
    parser.setLanguage(Rust);
    
    it('should detect function and method calls', () => {
      const source = `
fn main() {
    println!("Hello");
    let s = String::new();
    s.len();
}
      `;
      
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.rs',
        language: 'rust',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls(context);
      
      // Should find println! macro, String::new(), and s.len()
      expect(calls.length).toBeGreaterThanOrEqual(3);
      
      const printlnCall = calls.find(c => c.callee_name === 'println!');
      expect(printlnCall).toBeDefined();
      
      const newCall = calls.find(c => c.callee_name === 'new');
      expect(newCall).toBeDefined();
      
      const lenCall = calls.find(c => c.callee_name === 'len');
      expect(lenCall).toBeDefined();
      expect(lenCall?.is_method_call).toBe(true);
    });
    
    it('should detect macro invocations', () => {
      const source = `
fn main() {
    vec![1, 2, 3];
    dbg!(42);
}
      `;
      
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.rs',
        language: 'rust',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls(context);
      
      const macros = calls.filter(c => c.callee_name.endsWith('!'));
      expect(macros.length).toBeGreaterThanOrEqual(2);
    });
  });
  
  describe('Cross-language consistency', () => {
    it('should have consistent structure across languages', () => {
      // Test that all languages return the same structure
      const languages: Language[] = ['javascript', 'typescript', 'python', 'rust'];
      
      for (const lang of languages) {
        const context: FunctionCallContext = {
          source_code: '',
          file_path: `test.${lang}`,
          language: lang,
          ast_root: {} as any // Mock empty AST
        };
        
        const calls = find_function_calls(context);
        
        // Should return array even for empty input
        expect(Array.isArray(calls)).toBe(true);
      }
    });
  });
});
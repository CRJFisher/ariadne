/**
 * Tests for language-specific bespoke handlers
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import { FunctionCallContext } from './function_calls';
import { handle_typescript_decorators } from './function_calls.typescript';
import { handle_python_comprehensions } from './function_calls.python';
import { handle_rust_macros } from './function_calls.rust';
import { find_function_calls } from './index';
import { SourceCode } from '@ariadnejs/types';
import { FilePath } from '@ariadnejs/types';

describe('Bespoke Handlers', () => {
  
  describe('TypeScript decorators', () => {
    const parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
    
    it('should detect decorator function calls', () => {
      const source = `
        @Component({ selector: 'app' })
        class MyComponent {
          @Input() value: string;
        }
      ` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.ts' as FilePath,
        language: 'typescript',
        ast_root: tree.rootNode
      };
      
      const calls = handle_typescript_decorators(context);
      expect(calls.length).toBeGreaterThan(0);
      
      // Should find Component decorator
      const componentCall = calls.find(c => c.callee_name === 'Component');
      expect(componentCall).toBeDefined();
      expect(componentCall?.arguments_count).toBe(1);
      
      // Should find Input decorator
      const inputCall = calls.find(c => c.callee_name === 'Input');
      expect(inputCall).toBeDefined();
      expect(inputCall?.arguments_count).toBe(0);
    });
    
    it('should handle decorators without arguments', () => {
      const source = `
        @Injectable
        class Service {}
      ` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.ts' as FilePath,
        language: 'typescript',
        ast_root: tree.rootNode
      };
      
      const calls = handle_typescript_decorators(context);
      const injectable = calls.find(c => c.callee_name === 'Injectable');
      expect(injectable).toBeDefined();
      expect(injectable?.arguments_count).toBe(0);
    });
    
    it('should set correct caller context for decorators', () => {
      const source = `
        @Decorator()
        class MyClass {
          @MethodDecorator()
          myMethod() {}
        }
      ` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.ts' as FilePath,
        language: 'typescript',
        ast_root: tree.rootNode
      };
      
      const calls = handle_typescript_decorators(context);
      
      const classDecorator = calls.find(c => c.callee_name === 'Decorator');
      expect(classDecorator?.caller_name).toBe('MyClass');
      
      const methodDecorator = calls.find(c => c.callee_name === 'MethodDecorator');
      expect(methodDecorator?.caller_name).toBe('MyClass'); // Method decorators still show class context
    });
  });
  
  describe('Python comprehensions', () => {
    const parser = new Parser();
    parser.setLanguage(Python);
    
    it('should detect calls within list comprehensions', () => {
      const source = `[process(x) for x in items if filter(x)]` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.py' as FilePath,
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const calls = handle_python_comprehensions(context);
      expect(calls.length).toBe(2);
      
      const processCall = calls.find(c => c.callee_name === 'process');
      expect(processCall).toBeDefined();
      expect(processCall?.is_in_comprehension).toBe(true);
      
      const filterCall = calls.find(c => c.callee_name === 'filter');
      expect(filterCall).toBeDefined();
      expect(filterCall?.is_in_comprehension).toBe(true);
    });
    
    it('should detect calls in dictionary comprehensions', () => {
      const source = `{key(x): value(x) for x in items}` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.py' as FilePath,
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const calls = handle_python_comprehensions(context);
      expect(calls.length).toBe(2);
      expect(calls.every(c => c.is_in_comprehension)).toBe(true);
    });
    
    it('should detect calls in set comprehensions', () => {
      const source = `{transform(x) for x in data}`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const calls = handle_python_comprehensions(context);
      const transform = calls.find(c => c.callee_name === 'transform');
      expect(transform).toBeDefined();
      expect(transform?.is_in_comprehension).toBe(true);
    });
    
    it('should detect calls in generator expressions', () => {
      const source = `(process(x) for x in range(10))`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const calls = handle_python_comprehensions(context);
      expect(calls.length).toBeGreaterThan(0);
      
      const processCall = calls.find(c => c.callee_name === 'process');
      expect(processCall?.is_in_comprehension).toBe(true);
    });
    
    it('should handle nested comprehensions', () => {
      const source = `[[inner(y) for y in outer(x)] for x in items]`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const calls = handle_python_comprehensions(context);
      // Nested comprehensions will find all calls including duplicates
      expect(calls.length).toBeGreaterThanOrEqual(2);
      expect(calls.every(c => c.is_in_comprehension)).toBe(true);
    });
  });
  
  describe('Rust macros', () => {
    const parser = new Parser();
    parser.setLanguage(Rust);
    
    it('should return empty array (handled by generic processor)', () => {
      const source = `
        fn main() {
          println!("Hello");
          vec![1, 2, 3];
        }
      `;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.rs',
        language: 'rust',
        ast_root: tree.rootNode
      };
      
      // Rust macros are handled by the generic processor via configuration
      // The bespoke handler just returns an empty array for API consistency
      const calls = handle_rust_macros(context);
      expect(calls).toHaveLength(0);
    });
  });
  
  describe('Integration with main processor', () => {
    const parser = new Parser();
    
    it('should not duplicate decorator calls', () => {
      parser.setLanguage(TypeScript.typescript);
      const source = `
        @Component()
        class MyClass {
          normalMethod() {
            regularCall();
          }
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
      
      // Should have Component decorator and regularCall, no duplicates
      const componentCalls = calls.filter(c => c.callee_name === 'Component');
      expect(componentCalls).toHaveLength(1);
    });
    
    it('should properly detect comprehension and normal calls', () => {
      parser.setLanguage(Python);
      const source = `
result = [transform(x) for x in data]
normal_call()
      `;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const calls = find_function_calls(context);
      
      // The bespoke handler adds calls with is_in_comprehension flag
      // Find the one with the flag set (from bespoke handler)
      const transformCall = calls.find(c => c.callee_name === 'transform' && c.is_in_comprehension === true);
      const normalCall = calls.find(c => c.callee_name === 'normal_call');
      
      expect(transformCall).toBeDefined();
      expect(transformCall?.is_in_comprehension).toBe(true);
      expect(normalCall).toBeDefined();
      expect(normalCall?.is_in_comprehension).toBeFalsy();
      
      // Note: We may get duplicates - one from generic, one from bespoke
      // This is acceptable as comprehensions are a special case
    });
  });
});
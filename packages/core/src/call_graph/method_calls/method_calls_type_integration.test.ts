/**
 * Integration tests for method calls with type tracking
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import { find_method_calls } from './index';
import { MethodCallContext } from './method_calls';
import { TypeInfo } from '../../type_analysis/type_tracking';

describe('method_calls with type tracking integration', () => {
  describe('JavaScript', () => {
    it('should include receiver_type when type_map is provided', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `
class MyClass {
  method() {
    const obj = new MyClass();
    obj.doSomething();
  }
}`;
      
      const tree = parser.parse(source);
      
      const type_map = new Map<string, TypeInfo[]>();
      type_map.set('obj', [{
        variable_name: 'obj',
        type_name: 'MyClass',
        location: { line: 3, column: 10 }
      }]);
      
      const context: MethodCallContext = {
        ast_root: tree.rootNode,
        file_path: 'test.js',
        source_code: source,
        language: 'javascript'
      };
      
      const calls = find_method_calls(context, type_map);
      
      const objCall = calls.find(c => c.receiver_name === 'obj');
      expect(objCall).toBeDefined();
      expect(objCall?.receiver_type).toBe('MyClass');
      expect(objCall?.defining_class).toBe('MyClass');
    });

    it('should work without type_map (backward compatibility)', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = 'obj.method()';
      const tree = parser.parse(source);
      
      const context: MethodCallContext = {
        ast_root: tree.rootNode,
        file_path: 'test.js',
        source_code: source,
        language: 'javascript'
      };
      
      const calls = find_method_calls(context);
      
      expect(calls).toHaveLength(1);
      expect(calls[0].receiver_name).toBe('obj');
      expect(calls[0].method_name).toBe('method');
      expect(calls[0].receiver_type).toBeUndefined();
    });
  });

  describe('TypeScript', () => {
    it('should resolve this keyword type', () => {
      const parser = new Parser();
      parser.setLanguage(TypeScript.typescript);
      
      const source = `
class Component {
  render() {
    this.setState({ value: 1 });
  }
}`;
      
      const tree = parser.parse(source);
      
      const type_map = new Map<string, TypeInfo[]>();
      type_map.set('this', [{
        variable_name: 'this',
        type_name: 'Component',
        location: { line: 0, column: 0 }
      }]);
      
      const context: MethodCallContext = {
        ast_root: tree.rootNode,
        file_path: 'test.ts',
        source_code: source,
        language: 'typescript'
      };
      
      const calls = find_method_calls(context, type_map);
      
      const thisCall = calls.find(c => c.receiver_name === 'this');
      expect(thisCall).toBeDefined();
      expect(thisCall?.receiver_type).toBe('Component');
      expect(thisCall?.method_name).toBe('setState');
    });
  });

  describe('Python', () => {
    it('should resolve self type in methods', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      
      const source = `
class MyClass:
    def method(self):
        self.helper()
        cls.class_method()`;
      
      const tree = parser.parse(source);
      
      const type_map = new Map<string, TypeInfo[]>();
      type_map.set('self', [{
        variable_name: 'self',
        type_name: 'MyClass',
        location: { line: 0, column: 0 }
      }]);
      type_map.set('cls', [{
        variable_name: 'cls',
        type_name: 'MyClass',
        location: { line: 0, column: 0 }
      }]);
      
      const context: MethodCallContext = {
        ast_root: tree.rootNode,
        file_path: 'test.py',
        source_code: source,
        language: 'python'
      };
      
      const calls = find_method_calls(context, type_map);
      
      const selfCall = calls.find(c => c.receiver_name === 'self');
      expect(selfCall).toBeDefined();
      expect(selfCall?.receiver_type).toBe('MyClass');
      expect(selfCall?.method_name).toBe('helper');
      
      const clsCall = calls.find(c => c.receiver_name === 'cls');
      expect(clsCall).toBeDefined();
      expect(clsCall?.receiver_type).toBe('MyClass');
      expect(clsCall?.is_static_method).toBe(true);
    });

    it('should handle Python literal types', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      
      const source = '"hello".upper()';
      const tree = parser.parse(source);
      
      const context: MethodCallContext = {
        ast_root: tree.rootNode,
        file_path: 'test.py',
        source_code: source,
        language: 'python'
      };
      
      const calls = find_method_calls(context);
      
      expect(calls).toHaveLength(1);
      expect(calls[0].receiver_type).toBe('str');
      expect(calls[0].method_name).toBe('upper');
    });
  });

  describe('Rust', () => {
    it('should resolve self type in impl blocks', () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      
      const source = `
impl MyStruct {
    fn method(&self) {
        self.helper();
    }
}`;
      
      const tree = parser.parse(source);
      
      const type_map = new Map<string, TypeInfo[]>();
      type_map.set('self', [{
        variable_name: 'self',
        type_name: 'MyStruct',
        location: { line: 0, column: 0 }
      }]);
      
      const context: MethodCallContext = {
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        source_code: source,
        language: 'rust'
      };
      
      const calls = find_method_calls(context, type_map);
      
      const selfCall = calls.find(c => c.receiver_name === 'self');
      expect(selfCall).toBeDefined();
      expect(selfCall?.receiver_type).toBe('MyStruct');
      expect(selfCall?.method_name).toBe('helper');
    });

    it('should handle associated function calls', () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      
      const source = 'String::from("hello")';
      const tree = parser.parse(source);
      
      const context: MethodCallContext = {
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        source_code: source,
        language: 'rust'
      };
      
      const calls = find_method_calls(context);
      
      expect(calls).toHaveLength(1);
      expect(calls[0].receiver_name).toBe('String');
      expect(calls[0].method_name).toBe('from');
      expect(calls[0].is_static_method).toBe(true);
      expect(calls[0].receiver_type).toBe('String');
      expect(calls[0].defining_class).toBe('String');
    });
  });

  describe('Type history', () => {
    it('should use the most recent type assignment', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `
let x = new OldClass();
x = new NewClass();
x.method();`;
      
      const tree = parser.parse(source);
      
      const type_map = new Map<string, TypeInfo[]>();
      type_map.set('x', [
        {
          variable_name: 'x',
          type_name: 'OldClass',
          location: { line: 1, column: 4 }
        },
        {
          variable_name: 'x',
          type_name: 'NewClass',
          location: { line: 2, column: 0 }
        }
      ]);
      
      const context: MethodCallContext = {
        ast_root: tree.rootNode,
        file_path: 'test.js',
        source_code: source,
        language: 'javascript'
      };
      
      const calls = find_method_calls(context, type_map);
      
      const xCall = calls.find(c => c.receiver_name === 'x');
      expect(xCall).toBeDefined();
      expect(xCall?.receiver_type).toBe('NewClass');
    });
  });
});
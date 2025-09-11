/**
 * Tests for generic method call processor
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import TypeScript from 'tree-sitter-typescript/typescript';
import {
  MethodCallContext,
  find_method_calls_generic,
  is_method_call_node,
  extract_receiver_name,
  extract_method_name,
  is_chained_method_call,
  count_method_arguments,
  get_enclosing_class
} from './method_calls';

describe('Generic Method Call Processor', () => {
  describe('find_method_calls_generic', () => {
    it('should detect JavaScript method calls using configuration', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `
        object.method();
        console.log("test");
        Math.random();
      `;
      
      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const calls = find_method_calls_generic(context);
      
      expect(calls).toHaveLength(3);
      expect(calls[0].method_name).toBe('method');
      expect(calls[0].receiver_name).toBe('object');
      expect(calls[1].method_name).toBe('log');
      expect(calls[1].receiver_name).toBe('console');
      expect(calls[2].method_name).toBe('random');
      expect(calls[2].receiver_name).toBe('Math');
      expect(calls[2].is_static_method).toBe(true); // Math is uppercase
    });

    it('should detect Python method calls using configuration', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      
      const source = `
obj.method()
self.helper()
cls.create()
MyClass.static_method()
      `;
      
      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };
      
      const calls = find_method_calls_generic(context);
      
      expect(calls).toHaveLength(4);
      expect(calls[0].method_name).toBe('method');
      expect(calls[1].receiver_name).toBe('self');
      expect(calls[2].receiver_name).toBe('cls');
      expect(calls[2].is_static_method).toBe(true); // cls is a static indicator
      expect(calls[3].receiver_name).toBe('MyClass');
      expect(calls[3].is_static_method).toBe(true); // Uppercase indicates static
    });

    it('should detect Rust method calls using configuration', () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      
      const source = `
fn main() {
    instance.method();
    String::from("hello");
    vec.push(1);
}
      `;
      
      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: 'test.rs',
        language: 'rust',
        ast_root: tree.rootNode
      };
      
      const calls = find_method_calls_generic(context);
      
      expect(calls.length).toBeGreaterThan(0);
      
      const instanceCall = calls.find(c => c.method_name === 'method');
      expect(instanceCall).toBeDefined();
      expect(instanceCall?.receiver_name).toBe('instance');
      
      const stringCall = calls.find(c => c.method_name === 'from');
      expect(stringCall).toBeDefined();
      expect(stringCall?.receiver_name).toBe('String');
      expect(stringCall?.is_static_method).toBe(true); // :: indicates static
      
      const pushCall = calls.find(c => c.method_name === 'push');
      expect(pushCall).toBeDefined();
      expect(pushCall?.receiver_name).toBe('vec');
    });

    it('should handle TypeScript with type_map', () => {
      const parser = new Parser();
      parser.setLanguage(TypeScript);
      
      const source = `
const arr: Array<string> = [];
arr.push("test");
      `;
      
      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: 'test.ts',
        language: 'typescript',
        ast_root: tree.rootNode
      };
      
      // Mock type map
      const typeMap = new Map([
        ['arr', [{ 
          variable_name: 'arr',
          type_name: 'Array<string>',
          location: { line: 1, column: 6 },
          source: 'annotation',
          confidence: 'explicit' as const
        }]]
      ]);
      
      const calls = find_method_calls_generic(context, typeMap);
      
      expect(calls).toHaveLength(1);
      expect(calls[0].method_name).toBe('push');
      expect(calls[0].receiver_name).toBe('arr');
      expect(calls[0].receiver_type).toBe('Array<string>');
    });
  });

  describe('is_method_call_node', () => {
    it('should identify JavaScript method calls', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `obj.method()`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      expect(is_method_call_node(callNode, 'javascript')).toBe(true);
    });

    it('should identify Python method calls', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      
      const source = `obj.method()`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call')[0];
      
      expect(is_method_call_node(callNode, 'python')).toBe(true);
    });

    it('should reject non-method calls', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `func()`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      expect(is_method_call_node(callNode, 'javascript')).toBe(false);
    });
  });

  describe('extract_receiver_name', () => {
    it('should extract JavaScript receiver', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `myObject.doSomething()`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const receiver = extract_receiver_name(callNode, source, 'javascript');
      expect(receiver).toBe('myObject');
    });

    it('should extract Python receiver', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      
      const source = `self.helper()`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call')[0];
      
      const receiver = extract_receiver_name(callNode, source, 'python');
      expect(receiver).toBe('self');
    });

    it('should extract Rust field expression receiver', () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      
      const source = `value.method()`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const receiver = extract_receiver_name(callNode, source, 'rust');
      expect(receiver).toBe('value');
    });

    it('should extract Rust scoped identifier receiver', () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      
      const source = `Vec::new()`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const receiver = extract_receiver_name(callNode, source, 'rust');
      expect(receiver).toBe('Vec');
    });
  });

  describe('extract_method_name', () => {
    it('should extract JavaScript method name', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `object.methodName()`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const method = extract_method_name(callNode, source, 'javascript');
      expect(method).toBe('methodName');
    });

    it('should extract Python method name', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      
      const source = `obj.process_data()`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call')[0];
      
      const method = extract_method_name(callNode, source, 'python');
      expect(method).toBe('process_data');
    });

    it('should extract Rust method name', () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      
      const source = `instance.do_work()`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const method = extract_method_name(callNode, source, 'rust');
      expect(method).toBe('do_work');
    });
  });

  describe('is_chained_method_call', () => {
    it('should detect JavaScript chained calls', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `str.trim().toLowerCase()`;
      const tree = parser.parse(source);
      const calls = tree.rootNode.descendantsOfType('call_expression');
      
      // The toLowerCase() call should be chained
      const lowerCall = calls.find(n => 
        source.substring(n.startIndex, n.endIndex).includes('toLowerCase')
      );
      
      expect(lowerCall).toBeDefined();
      if (lowerCall) {
        expect(is_chained_method_call(lowerCall, 'javascript')).toBe(true);
      }
    });

    it('should detect Python chained calls', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      
      const source = `text.strip().lower()`;
      const tree = parser.parse(source);
      const calls = tree.rootNode.descendantsOfType('call');
      
      // The lower() call should be chained
      const lowerCall = calls.find(n => 
        source.substring(n.startIndex, n.endIndex).includes('lower')
      );
      
      expect(lowerCall).toBeDefined();
      if (lowerCall) {
        expect(is_chained_method_call(lowerCall, 'python')).toBe(true);
      }
    });

    it('should return false for non-chained calls', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `object.method()`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      expect(is_chained_method_call(callNode, 'javascript')).toBe(false);
    });
  });

  describe('count_method_arguments', () => {
    it('should count JavaScript arguments', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `func(a, b, c)`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      expect(count_method_arguments(callNode, 'javascript')).toBe(3);
    });

    it('should count Python arguments correctly', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      
      const source = `obj.method(arg1, arg2)`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call')[0];
      
      // Should count all arguments passed
      expect(count_method_arguments(callNode, 'python')).toBe(2);
    });

    it('should handle empty argument lists', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `func()`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      expect(count_method_arguments(callNode, 'javascript')).toBe(0);
    });

    it('should count all Python arguments including cls', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      
      const source = `MyClass.method(data)`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call')[0];
      
      // Should count all arguments passed
      expect(count_method_arguments(callNode, 'python')).toBe(1);
    });
  });

  describe('get_enclosing_class', () => {
    it('should find JavaScript class', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `
class MyClass {
  method() {
    this.helper();
  }
}`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const className = get_enclosing_class(callNode, source, 'javascript');
      expect(className).toBe('MyClass');
    });

    it('should find Python class', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      
      const source = `
class MyClass:
    def method(self):
        self.helper()
`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call')[0];
      
      const className = get_enclosing_class(callNode, source, 'python');
      expect(className).toBe('MyClass');
    });

    it('should find Rust struct in impl block', () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      
      const source = `
impl MyStruct {
    fn method(&self) {
        self.helper();
    }
}`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const className = get_enclosing_class(callNode, source, 'rust');
      expect(className).toBe('MyStruct');
    });

    it('should return null when not in a class', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `function standalone() { obj.method(); }`;
      const tree = parser.parse(source);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const className = get_enclosing_class(callNode, source, 'javascript');
      expect(className).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle complex nested structures', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `
class Outer {
  method() {
    const inner = {
      nested: function() {
        deeply.nested.call();
      }
    };
  }
}`;
      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const calls = find_method_calls_generic(context);
      
      const nestedCall = calls.find(c => c.method_name === 'call');
      expect(nestedCall).toBeDefined();
      expect(nestedCall?.receiver_name).toBe('deeply.nested');
    });

    it('should handle multiline method calls', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      
      const source = `
object
  .method1()
  .method2()
  .method3();
`;
      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };
      
      const calls = find_method_calls_generic(context);
      
      expect(calls.length).toBeGreaterThanOrEqual(3);
      const methods = calls.map(c => c.method_name);
      expect(methods).toContain('method1');
      expect(methods).toContain('method2');
      expect(methods).toContain('method3');
    });
  });
});
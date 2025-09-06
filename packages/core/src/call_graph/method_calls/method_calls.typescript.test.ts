/**
 * Tests for TypeScript bespoke method call features
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript/typescript';
import {
  extract_type_arguments,
  has_type_arguments,
  enhance_typescript_method_call,
  find_typescript_bespoke_method_calls
} from './method_calls.typescript';
import { MethodCallInfo } from '@ariadnejs/types';

describe('TypeScript bespoke method calls', () => {
  let parser: Parser;
  
  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript);
  });

  describe('extract_type_arguments', () => {
    it('should extract single type argument', () => {
      const code = `array.map<string>(x => x.toString())`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const types = extract_type_arguments(callNode, code);
      
      expect(types).toEqual(['string']);
    });

    it('should extract multiple type arguments', () => {
      const code = `func<T, U, V>(arg)`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const types = extract_type_arguments(callNode, code);
      
      expect(types).toEqual(['T', 'U', 'V']);
    });

    it('should extract complex generic types', () => {
      const code = `service.get<Array<User>>(url)`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const types = extract_type_arguments(callNode, code);
      
      expect(types).toEqual(['Array<User>']);
    });

    it('should extract union and intersection types', () => {
      const code = `process<string | number, A & B>(data)`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const types = extract_type_arguments(callNode, code);
      
      expect(types).toEqual(['string | number', 'A & B']);
    });

    it('should return empty array for calls without type arguments', () => {
      const code = `regular.method()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const types = extract_type_arguments(callNode, code);
      
      expect(types).toEqual([]);
    });
  });

  describe('has_type_arguments', () => {
    it('should detect method calls with type arguments', () => {
      const code = `obj.method<T>()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      expect(has_type_arguments(callNode)).toBe(true);
    });

    it('should return false for regular method calls', () => {
      const code = `obj.method()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      expect(has_type_arguments(callNode)).toBe(false);
    });

    it('should return false for non-call expressions', () => {
      const code = `obj.property`;
      const tree = parser.parse(code);
      const node = tree.rootNode.descendantsOfType('member_expression')[0];
      
      expect(has_type_arguments(node)).toBe(false);
    });
  });

  describe('enhance_typescript_method_call', () => {
    it('should add type arguments to method call info', () => {
      const baseInfo: MethodCallInfo = {
        caller_name: 'Component',
        method_name: 'setState',
        receiver_name: 'this',
        location: { line: 0, column: 0 },
        is_static_method: false,
        is_chained_call: false,
        arguments_count: 1
      };
      
      const code = `this.setState<State>({ value: 1 })`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const enhanced = enhance_typescript_method_call(baseInfo, callNode, code);
      
      expect(enhanced.type_arguments).toEqual(['State']);
    });

    it('should handle multiple type arguments', () => {
      const baseInfo: MethodCallInfo = {
        caller_name: 'function',
        method_name: 'convert',
        receiver_name: 'util',
        location: { line: 0, column: 0 },
        is_static_method: false,
        is_chained_call: false,
        arguments_count: 1
      };
      
      const code = `util.convert<Input, Output>(data)`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const enhanced = enhance_typescript_method_call(baseInfo, callNode, code);
      
      expect(enhanced.type_arguments).toEqual(['Input', 'Output']);
    });

    it('should not modify calls without type arguments', () => {
      const baseInfo: MethodCallInfo = {
        caller_name: 'function',
        method_name: 'process',
        receiver_name: 'handler',
        location: { line: 0, column: 0 },
        is_static_method: false,
        is_chained_call: false,
        arguments_count: 2
      };
      
      const code = `handler.process(a, b)`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const enhanced = enhance_typescript_method_call(baseInfo, callNode, code);
      
      expect(enhanced).toEqual(baseInfo);
      expect(enhanced.type_arguments).toBeUndefined();
    });
  });

  describe('find_typescript_bespoke_method_calls', () => {
    it('should return null for standard method calls', () => {
      const code = `console.log("test")`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = find_typescript_bespoke_method_calls(callNode, code);
      
      expect(result).toBeNull();
    });

    it('should return null even for generic calls (handled by enhancement)', () => {
      const code = `array.filter<number>(x => x > 0)`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = find_typescript_bespoke_method_calls(callNode, code);
      
      // TypeScript doesn't have truly bespoke patterns that need separate detection
      // Generic type arguments are handled as enhancements
      expect(result).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle nested generic types', () => {
      const code = `method<Promise<Array<User>>>()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const types = extract_type_arguments(callNode, code);
      
      expect(types).toEqual(['Promise<Array<User>>']);
    });

    it('should handle conditional types', () => {
      const code = `check<T extends string ? true : false>()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const types = extract_type_arguments(callNode, code);
      
      expect(types).toEqual(['T extends string ? true : false']);
    });

    it('should handle mapped types', () => {
      const code = `transform<{ [K in keyof T]: string }>()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const types = extract_type_arguments(callNode, code);
      
      expect(types).toEqual(['{ [K in keyof T]: string }']);
    });

    it('should handle tuple types', () => {
      const code = `func<[string, number, boolean]>()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const types = extract_type_arguments(callNode, code);
      
      expect(types).toEqual(['[string, number, boolean]']);
    });
  });
});
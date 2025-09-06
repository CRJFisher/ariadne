/**
 * Tests for Python bespoke method call features
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Parser from 'tree-sitter';
import Python from 'tree-sitter-python';
import {
  detect_super_method_call,
  is_dunder_method,
  enhance_python_method_call,
  find_python_bespoke_method_calls
} from './method_calls.python';
import { MethodCallInfo } from '@ariadnejs/types';

describe('Python bespoke method calls', () => {
  let parser: Parser;
  
  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(Python);
  });

  describe('detect_super_method_call', () => {
    it('should detect super() method calls', () => {
      const code = `super().__init__()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call')[0];
      
      const result = detect_super_method_call(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.method_name).toBe('__init__');
      expect(result?.receiver_name).toBe('super()');
      expect(result?.is_super_call).toBe(true);
    });

    it('should detect super() with arguments', () => {
      const code = `super(MyClass, self).method(arg1, arg2)`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call').find(
        n => code.substring(n.startIndex, n.endIndex).includes('.method')
      );
      
      if (callNode) {
        const result = detect_super_method_call(callNode, code);
        
        expect(result).toBeDefined();
        expect(result?.method_name).toBe('method');
        expect(result?.receiver_name).toBe('super()');
        expect(result?.arguments_count).toBe(2);
      }
    });

    it('should return null for non-super calls', () => {
      const code = `self.method()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call')[0];
      
      const result = detect_super_method_call(callNode, code);
      
      expect(result).toBeNull();
    });
  });

  describe('is_dunder_method', () => {
    it('should identify dunder methods', () => {
      expect(is_dunder_method('__init__')).toBe(true);
      expect(is_dunder_method('__str__')).toBe(true);
      expect(is_dunder_method('__repr__')).toBe(true);
      expect(is_dunder_method('__add__')).toBe(true);
      expect(is_dunder_method('__getitem__')).toBe(true);
    });

    it('should reject non-dunder methods', () => {
      expect(is_dunder_method('init')).toBe(false);
      expect(is_dunder_method('_private')).toBe(false);
      expect(is_dunder_method('__single')).toBe(false);
      expect(is_dunder_method('double__')).toBe(false);
      expect(is_dunder_method('regular_method')).toBe(false);
    });
  });

  describe('enhance_python_method_call', () => {
    it('should mark dunder methods', () => {
      const baseInfo: MethodCallInfo = {
        caller_name: 'MyClass',
        method_name: '__init__',
        receiver_name: 'self',
        location: { line: 0, column: 0 },
        is_static_method: false,
        is_chained_call: false,
        arguments_count: 0
      };
      
      const code = `self.__init__()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call')[0];
      
      const enhanced = enhance_python_method_call(baseInfo, callNode, code);
      
      expect(enhanced.is_magic_method).toBe(true);
    });

    it('should mark classmethod calls', () => {
      const baseInfo: MethodCallInfo = {
        caller_name: 'MyClass',
        method_name: 'create',
        receiver_name: 'cls',
        location: { line: 0, column: 0 },
        is_static_method: false,
        is_chained_call: false,
        arguments_count: 1
      };
      
      const code = `cls.create(data)`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call')[0];
      
      const enhanced = enhance_python_method_call(baseInfo, callNode, code);
      
      expect(enhanced.is_classmethod).toBe(true);
      expect(enhanced.is_static_method).toBe(true);
    });

    it('should not modify regular method calls', () => {
      const baseInfo: MethodCallInfo = {
        caller_name: 'function',
        method_name: 'process',
        receiver_name: 'obj',
        location: { line: 0, column: 0 },
        is_static_method: false,
        is_chained_call: false,
        arguments_count: 0
      };
      
      const code = `obj.process()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call')[0];
      
      const enhanced = enhance_python_method_call(baseInfo, callNode, code);
      
      expect(enhanced).toEqual(baseInfo);
      expect(enhanced.is_magic_method).toBeUndefined();
      expect(enhanced.is_classmethod).toBeUndefined();
    });
  });

  describe('find_python_bespoke_method_calls', () => {
    it('should detect super() calls', () => {
      const code = `super().parent_method()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call')[0];
      
      const result = find_python_bespoke_method_calls(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.is_super_call).toBe(true);
    });

    it('should return null for regular method calls', () => {
      const code = `instance.method()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call')[0];
      
      const result = find_python_bespoke_method_calls(callNode, code);
      
      expect(result).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle super() in nested classes', () => {
      const code = `
class Outer:
    class Inner:
        def method(self):
            super().__init__()
      `;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call').find(
        n => code.substring(n.startIndex, n.endIndex).includes('super()')
      );
      
      if (callNode) {
        const result = detect_super_method_call(callNode, code);
        expect(result).toBeDefined();
        expect(result?.method_name).toBe('__init__');
      }
    });

    it('should handle multiple dunder method calls', () => {
      const code = `obj.__str__().__len__()`;
      const tree = parser.parse(code);
      const callNodes = tree.rootNode.descendantsOfType('call');
      
      callNodes.forEach(node => {
        const text = code.substring(node.startIndex, node.endIndex);
        if (text.includes('__len__')) {
          // This would be enhanced as a dunder method
          const baseInfo: MethodCallInfo = {
            caller_name: '<module>',
            method_name: '__len__',
            receiver_name: 'obj.__str__()',
            location: { line: 0, column: 0 },
            is_static_method: false,
            is_chained_call: true,
            arguments_count: 0
          };
          
          const enhanced = enhance_python_method_call(baseInfo, node, code);
          expect(enhanced.is_magic_method).toBe(true);
        }
      });
    });

    it('should count arguments correctly', () => {
      const code = `super().method(arg1, arg2)`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call')[0];
      
      const result = detect_super_method_call(callNode, code);
      
      if (result) {
        // Should count all arguments passed
        expect(result.arguments_count).toBe(2);
      }
    });
  });
});
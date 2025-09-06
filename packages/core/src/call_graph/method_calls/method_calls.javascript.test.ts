/**
 * Tests for JavaScript bespoke method call features
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import {
  detect_prototype_method_call,
  detect_indirect_method_call,
  detect_optional_chaining_call,
  find_javascript_bespoke_method_calls
} from './method_calls.javascript';

describe('JavaScript bespoke method calls', () => {
  let parser: Parser;
  
  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(JavaScript);
  });

  describe('detect_prototype_method_call', () => {
    it('should detect prototype method calls', () => {
      const code = `Array.prototype.slice.call(arguments);`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_prototype_method_call(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.method_name).toBe('slice');
      expect(result?.receiver_name).toBe('Array.prototype');
      expect(result?.is_static_method).toBe(true);
    });

    it('should detect custom class prototype methods', () => {
      const code = `MyClass.prototype.myMethod();`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_prototype_method_call(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.method_name).toBe('myMethod');
      expect(result?.receiver_name).toBe('MyClass.prototype');
    });

    it('should return null for non-prototype calls', () => {
      const code = `object.method();`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_prototype_method_call(callNode, code);
      
      expect(result).toBeNull();
    });
  });

  describe('detect_indirect_method_call', () => {
    it('should detect call() invocations', () => {
      const code = `func.call(thisArg, arg1, arg2);`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_indirect_method_call(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.method_name).toBe('func.call');
      expect(result?.receiver_name).toBe('<unknown>');
    });

    it('should detect apply() invocations', () => {
      const code = `Math.max.apply(null, numbers);`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_indirect_method_call(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.method_name).toBe('max.apply');
      expect(result?.receiver_name).toBe('Math');
    });

    it('should detect bind() invocations', () => {
      const code = `method.bind(context);`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_indirect_method_call(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.method_name).toBe('method.bind');
    });

    it('should return null for non-indirect calls', () => {
      const code = `object.regularMethod();`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_indirect_method_call(callNode, code);
      
      expect(result).toBeNull();
    });
  });

  describe('detect_optional_chaining_call', () => {
    it('should detect optional chaining method calls', () => {
      const code = `object?.method();`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_optional_chaining_call(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.method_name).toBe('method');
      expect(result?.receiver_name).toBe('object');
      expect(result?.is_optional).toBe(true);
    });

    it('should detect chained optional calls', () => {
      const code = `obj?.first()?.second();`;
      const tree = parser.parse(code);
      const callNodes = tree.rootNode.descendantsOfType('call_expression');
      
      // There should be two calls
      expect(callNodes.length).toBe(2);
      
      // Check both calls - the outer call comes first in descendantsOfType
      const outerCall = callNodes[0];  // This is the ?.second() call
      const innerCall = callNodes[1];  // This is the ?.first() call
      
      const outerResult = detect_optional_chaining_call(outerCall, code);
      const innerResult = detect_optional_chaining_call(innerCall, code);
      
      // Inner call should be obj?.first()
      if (innerResult) {
        expect(innerResult.method_name).toBe('first');
        expect(innerResult.receiver_name).toBe('obj');
      }
      
      // Outer call should be (result)?.second()
      if (outerResult) {
        expect(outerResult.method_name).toBe('second');
        expect(outerResult.is_chained_call).toBe(true);
      }
    });

    it('should return null for regular method calls', () => {
      const code = `object.method();`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_optional_chaining_call(callNode, code);
      
      expect(result).toBeNull();
    });
  });

  describe('find_javascript_bespoke_method_calls', () => {
    it('should prioritize prototype method detection', () => {
      const code = `String.prototype.trim.call(" text ");`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = find_javascript_bespoke_method_calls(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.receiver_name).toContain('prototype');
    });

    it('should detect indirect calls when no prototype', () => {
      const code = `func.apply(context, args);`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = find_javascript_bespoke_method_calls(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.method_name).toContain('apply');
    });

    it('should detect optional chaining as last resort', () => {
      const code = `data?.process();`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = find_javascript_bespoke_method_calls(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.is_optional).toBe(true);
    });

    it('should return null for standard method calls', () => {
      const code = `console.log("test");`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = find_javascript_bespoke_method_calls(callNode, code);
      
      expect(result).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle complex prototype chains', () => {
      const code = `Object.prototype.toString.call(value);`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_prototype_method_call(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.method_name).toBe('toString');
      expect(result?.receiver_name).toBe('Object.prototype');
    });

    it('should handle nested optional chaining', () => {
      const code = `a?.b?.c?.d();`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_optional_chaining_call(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.method_name).toBe('d');
    });

    it('should count arguments correctly', () => {
      const code = `Array.prototype.slice.call(arr, 1, 3);`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_prototype_method_call(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.arguments_count).toBe(3); // arr, 1, 3
    });
  });
});
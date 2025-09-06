/**
 * Tests for Rust bespoke method call features
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Parser from 'tree-sitter';
import Rust from 'tree-sitter-rust';
import {
  detect_trait_method_call,
  is_in_unsafe_block,
  extract_turbofish_types,
  get_impl_trait_context,
  enhance_rust_method_call,
  find_rust_bespoke_method_calls
} from './method_calls.rust';
import { MethodCallInfo } from '@ariadnejs/types';

describe('Rust bespoke method calls', () => {
  let parser: Parser;
  
  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  describe('detect_trait_method_call', () => {
    it('should detect UFCS trait method calls', () => {
      const code = `<String as Display>::fmt(&s, &mut f)`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_trait_method_call(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.method_name).toBe('fmt');
      expect(result?.trait_impl).toBe('Display');
      expect(result?.impl_type).toBe('String');
      expect(result?.is_static_method).toBe(true);
    });

    it('should detect complex trait bounds', () => {
      const code = `<Vec<T> as IntoIterator>::into_iter(vec)`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_trait_method_call(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.method_name).toBe('into_iter');
      expect(result?.trait_impl).toBe('IntoIterator');
      expect(result?.impl_type).toBe('Vec<T>');
    });

    it('should return null for regular method calls', () => {
      const code = `instance.method()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_trait_method_call(callNode, code);
      
      expect(result).toBeNull();
    });
  });

  describe('is_in_unsafe_block', () => {
    it('should detect calls in unsafe blocks', () => {
      const code = `
unsafe {
    ptr.offset(1)
}`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      expect(is_in_unsafe_block(callNode)).toBe(true);
    });

    it('should detect nested unsafe blocks', () => {
      const code = `
fn func() {
    unsafe {
        let x = unsafe {
            dangerous_call()
        };
    }
}`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      expect(is_in_unsafe_block(callNode)).toBe(true);
    });

    it('should return false for safe code', () => {
      const code = `safe_function()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      expect(is_in_unsafe_block(callNode)).toBe(false);
    });
  });

  describe('extract_turbofish_types', () => {
    it('should extract turbofish type parameters', () => {
      const code = `vec.iter().collect::<Vec<String>>()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression').find(
        n => code.substring(n.startIndex, n.endIndex).includes('collect')
      );
      
      if (callNode) {
        const types = extract_turbofish_types(callNode, code);
        expect(types).toEqual(['Vec<String>']);
      }
    });

    it('should extract multiple type parameters', () => {
      const code = `function::<T, U, V>()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const types = extract_turbofish_types(callNode, code);
      expect(types).toEqual(['T', 'U', 'V']);
    });

    it('should return null for calls without turbofish', () => {
      const code = `regular_call()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const types = extract_turbofish_types(callNode, code);
      expect(types).toBeNull();
    });
  });

  describe('get_impl_trait_context', () => {
    it('should extract impl trait context', () => {
      const code = `
impl Display for MyStruct {
    fn fmt(&self, f: &mut Formatter) -> Result {
        write!(f, "test")
    }
}`;
      const tree = parser.parse(code);
      const macroNode = tree.rootNode.descendantsOfType('macro_invocation')[0];
      
      if (!macroNode) {
        // If there's no macro_invocation, the test setup is wrong
        throw new Error('Test code should contain a macro invocation');
      }
      
      const context = get_impl_trait_context(macroNode, code);
      
      expect(context).toBeDefined();
      expect(context?.type_name).toBe('MyStruct');
      expect(context?.trait_name).toBe('Display');
    });

    it('should handle inherent impl blocks', () => {
      const code = `
impl MyStruct {
    fn method(&self) {
        self.helper()
    }
}`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const context = get_impl_trait_context(callNode, code);
      
      expect(context).toBeDefined();
      expect(context?.type_name).toBe('MyStruct');
      expect(context?.trait_name).toBe('');
    });

    it('should return null outside impl blocks', () => {
      const code = `fn standalone() { call() }`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const context = get_impl_trait_context(callNode, code);
      
      expect(context).toBeNull();
    });
  });

  describe('enhance_rust_method_call', () => {
    it('should mark unsafe method calls', () => {
      const baseInfo: MethodCallInfo = {
        caller_name: 'function',
        method_name: 'offset',
        receiver_name: 'ptr',
        location: { line: 0, column: 0 },
        is_static_method: false,
        is_chained_call: false,
        arguments_count: 1
      };
      
      const code = `unsafe { ptr.offset(1) }`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const enhanced = enhance_rust_method_call(baseInfo, callNode, code);
      
      expect(enhanced.is_unsafe).toBe(true);
    });

    it('should add turbofish types', () => {
      const baseInfo: MethodCallInfo = {
        caller_name: 'function',
        method_name: 'collect',
        receiver_name: 'iter',
        location: { line: 0, column: 0 },
        is_static_method: false,
        is_chained_call: true,
        arguments_count: 0
      };
      
      const code = `iter.collect::<Vec<_>>()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const enhanced = enhance_rust_method_call(baseInfo, callNode, code);
      
      expect(enhanced.turbofish_types).toEqual(['Vec<_>']);
    });

    it('should mark reference method calls', () => {
      const baseInfo: MethodCallInfo = {
        caller_name: 'function',
        method_name: 'len',
        receiver_name: '&s',
        location: { line: 0, column: 0 },
        is_static_method: false,
        is_chained_call: false,
        arguments_count: 0
      };
      
      const code = `(&s).len()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const enhanced = enhance_rust_method_call(baseInfo, callNode, code);
      
      expect(enhanced.is_ref_method).toBe(true);
      expect(enhanced.is_mut_ref).toBe(false);
    });

    it('should mark mutable reference method calls', () => {
      const baseInfo: MethodCallInfo = {
        caller_name: 'function',
        method_name: 'push',
        receiver_name: '&mut vec',
        location: { line: 0, column: 0 },
        is_static_method: false,
        is_chained_call: false,
        arguments_count: 1
      };
      
      const code = `(&mut vec).push(item)`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const enhanced = enhance_rust_method_call(baseInfo, callNode, code);
      
      expect(enhanced.is_ref_method).toBe(true);
      expect(enhanced.is_mut_ref).toBe(true);
    });
  });

  describe('find_rust_bespoke_method_calls', () => {
    it('should detect UFCS calls', () => {
      const code = `<T as Clone>::clone(&value)`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = find_rust_bespoke_method_calls(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.trait_impl).toBe('Clone');
    });

    it('should return null for regular method calls', () => {
      const code = `value.clone()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = find_rust_bespoke_method_calls(callNode, code);
      
      expect(result).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle complex generic types in UFCS', () => {
      const code = `<HashMap<String, Vec<T>> as Default>::default()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const result = detect_trait_method_call(callNode, code);
      
      expect(result).toBeDefined();
      expect(result?.method_name).toBe('default');
      expect(result?.trait_impl).toBe('Default');
      expect(result?.impl_type).toBe('HashMap<String, Vec<T>>');
    });

    it('should handle lifetime parameters in turbofish', () => {
      const code = `function::<'a, 'b, T>()`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const types = extract_turbofish_types(callNode, code);
      expect(types).toEqual(["'a", "'b", 'T']);
    });

    it('should handle associated types in impl blocks', () => {
      const code = `
impl Iterator for MyIter {
    type Item = String;
    fn next(&mut self) -> Option<Self::Item> {
        self.internal.next()
    }
}`;
      const tree = parser.parse(code);
      const callNode = tree.rootNode.descendantsOfType('call_expression')[0];
      
      const context = get_impl_trait_context(callNode, code);
      
      expect(context).toBeDefined();
      expect(context?.type_name).toBe('MyIter');
      expect(context?.trait_name).toBe('Iterator');
    });
  });
});
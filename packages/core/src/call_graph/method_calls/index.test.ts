/**
 * Integration tests for method_calls module
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript/typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import { find_method_calls } from './index';
import { MethodCallContext } from './method_calls';

describe('Method Calls Integration', () => {
  describe('JavaScript integration', () => {
    const parser = new Parser();
    parser.setLanguage(JavaScript);

    it('should combine generic and bespoke JavaScript patterns', () => {
      const source = `
        // Generic method call
        object.method();
        
        // Bespoke: prototype method
        Array.prototype.slice.call(arguments);
        
        // Bespoke: indirect call
        func.apply(context, args);
        
        // Bespoke: optional chaining
        data?.process();
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };

      const calls = find_method_calls(context);

      // Should find all patterns
      expect(calls.length).toBeGreaterThanOrEqual(4);

      // Generic pattern
      const genericCall = calls.find(c => c.method_name === 'method');
      expect(genericCall).toBeDefined();

      // Prototype pattern (bespoke)
      const prototypeCall = calls.find(c => 
        c.receiver_name === 'Array.prototype' && c.method_name === 'slice'
      );
      expect(prototypeCall).toBeDefined();
      expect(prototypeCall?.is_static_method).toBe(true);

      // Indirect call pattern (bespoke)
      const applyCall = calls.find(c => c.method_name?.includes('apply'));
      expect(applyCall).toBeDefined();

      // Optional chaining (bespoke)
      const optionalCall = calls.find(c => 
        c.method_name === 'process' && c.is_optional === true
      );
      expect(optionalCall).toBeDefined();
    });

    it('should not duplicate calls when both generic and bespoke match', () => {
      const source = `console.log("test");`;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };

      const calls = find_method_calls(context);

      // Should only have one console.log call
      const logCalls = calls.filter(c => 
        c.method_name === 'log' && c.receiver_name === 'console'
      );
      expect(logCalls).toHaveLength(1);
    });
  });

  describe('TypeScript integration', () => {
    const parser = new Parser();
    parser.setLanguage(TypeScript);

    it('should enhance generic calls with TypeScript features', () => {
      const source = `
        // Generic call
        object.method();
        
        // Generic call with type arguments (enhanced)
        service.get<User>(url);
        
        // Chained generic calls
        array.map<string>(x => x).filter(Boolean);
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: 'test.ts',
        language: 'typescript',
        ast_root: tree.rootNode
      };

      const calls = find_method_calls(context);

      // Regular method call
      const regularCall = calls.find(c => c.method_name === 'method');
      expect(regularCall).toBeDefined();
      expect(regularCall?.type_arguments).toBeUndefined();

      // Enhanced with type arguments
      const getCall = calls.find(c => c.method_name === 'get');
      expect(getCall).toBeDefined();
      expect(getCall?.type_arguments).toEqual(['User']);

      // Chained with type arguments
      const mapCall = calls.find(c => c.method_name === 'map');
      expect(mapCall).toBeDefined();
      expect(mapCall?.type_arguments).toEqual(['string']);

      const filterCall = calls.find(c => c.method_name === 'filter');
      expect(filterCall).toBeDefined();
      expect(filterCall?.is_chained_call).toBe(true);
    });
  });

  describe('Python integration', () => {
    const parser = new Parser();
    parser.setLanguage(Python);

    it('should combine generic and bespoke Python patterns', () => {
      const source = `
# Generic method call
obj.method()

# Bespoke: super() call
super().__init__()

# Generic with enhancement: dunder method
obj.__str__()

# Generic with enhancement: classmethod
cls.create()
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: 'test.py',
        language: 'python',
        ast_root: tree.rootNode
      };

      const calls = find_method_calls(context);

      // Generic call
      const genericCall = calls.find(c => c.method_name === 'method');
      expect(genericCall).toBeDefined();

      // Bespoke super() call
      const superCall = calls.find(c => 
        c.receiver_name === 'super()' && c.method_name === '__init__'
      );
      expect(superCall).toBeDefined();
      expect(superCall?.is_super_call).toBe(true);

      // Enhanced dunder method
      const dunderCall = calls.find(c => c.method_name === '__str__');
      expect(dunderCall).toBeDefined();
      expect(dunderCall?.is_magic_method).toBe(true);

      // Enhanced classmethod
      const classmethodCall = calls.find(c => 
        c.receiver_name === 'cls' && c.method_name === 'create'
      );
      expect(classmethodCall).toBeDefined();
      expect(classmethodCall?.is_classmethod).toBe(true);
      expect(classmethodCall?.is_static_method).toBe(true);
    });
  });

  describe('Rust integration', () => {
    const parser = new Parser();
    parser.setLanguage(Rust);

    it('should combine generic and bespoke Rust patterns', () => {
      const source = `
fn main() {
    // Generic method call
    instance.method();
    
    // Generic associated function
    String::from("hello");
    
    // Bespoke: UFCS trait method
    <Vec<T> as IntoIterator>::into_iter(vec);
    
    // Enhanced: unsafe block
    unsafe {
        ptr.offset(1);
    }
    
    // Enhanced: turbofish
    iter.collect::<Vec<_>>();
}
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: 'test.rs',
        language: 'rust',
        ast_root: tree.rootNode
      };

      const calls = find_method_calls(context);

      // Generic instance method
      const instanceCall = calls.find(c => c.method_name === 'method');
      expect(instanceCall).toBeDefined();

      // Generic associated function
      const fromCall = calls.find(c => c.method_name === 'from');
      expect(fromCall).toBeDefined();
      expect(fromCall?.is_static_method).toBe(true);

      // Bespoke UFCS
      const ufcsCall = calls.find(c => 
        c.method_name === 'into_iter' && c.trait_impl === 'IntoIterator'
      );
      expect(ufcsCall).toBeDefined();

      // Enhanced unsafe
      const unsafeCall = calls.find(c => c.method_name === 'offset');
      expect(unsafeCall).toBeDefined();
      expect(unsafeCall?.is_unsafe).toBe(true);

      // Enhanced turbofish
      const turbofishCall = calls.find(c => c.method_name === 'collect');
      expect(turbofishCall).toBeDefined();
      expect(turbofishCall?.turbofish_types).toEqual(['Vec<_>']);
    });
  });

  describe('Type resolution integration', () => {
    it('should resolve types using type_map', () => {
      const parser = new Parser();
      parser.setLanguage(TypeScript);

      const source = `
const user: User = getUser();
user.getName();
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: 'test.ts',
        language: 'typescript',
        ast_root: tree.rootNode
      };

      // Create type map
      const typeMap = new Map([
        ['user', [{
          variable_name: 'user',
          type_name: 'User',
          location: { line: 1, column: 6 },
          source: 'annotation',
          confidence: 'explicit' as const
        }]]
      ]);

      const calls = find_method_calls(context, typeMap);

      const getNameCall = calls.find(c => c.method_name === 'getName');
      expect(getNameCall).toBeDefined();
      expect(getNameCall?.receiver_type).toBe('User');
      expect(getNameCall?.defining_class).toBe('User');
    });
  });

  describe('Performance and correctness', () => {
    it('should handle large files efficiently', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);

      // Generate a large source with many method calls
      const methods = Array.from({ length: 100 }, (_, i) => 
        `obj${i}.method${i}();`
      ).join('\n');

      const source = `
class LargeClass {
  complexMethod() {
    ${methods}
  }
}
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: 'large.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };

      const startTime = Date.now();
      const calls = find_method_calls(context);
      const endTime = Date.now();

      // Should find all 100 method calls
      expect(calls.length).toBeGreaterThanOrEqual(100);

      // Should complete in reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // All calls should have proper caller context
      const methodCalls = calls.filter(c => c.method_name?.startsWith('method'));
      methodCalls.forEach(call => {
        // Check that calls are from within complexMethod or the class
        expect(call.caller_name).toMatch(/complexMethod|LargeClass/);
      });
    });

    it('should not crash on malformed code', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);

      const source = `
        obj.method(
        // Missing closing parenthesis
        obj2.
        // Incomplete method call
      `;

      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: 'malformed.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };

      // Should not throw
      expect(() => find_method_calls(context)).not.toThrow();

      const calls = find_method_calls(context);
      // May find partial calls
      expect(Array.isArray(calls)).toBe(true);
    });
  });

  describe('Backwards compatibility', () => {
    it('should maintain same API surface', () => {
      // Verify exports
      expect(typeof find_method_calls).toBe('function');
      
      // find_method_calls should accept context and optional type_map
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const tree = parser.parse('test()');
      
      const context: MethodCallContext = {
        source_code: 'test()',
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };

      // Should work with just context
      const calls1 = find_method_calls(context);
      expect(Array.isArray(calls1)).toBe(true);

      // Should work with context and type_map
      const calls2 = find_method_calls(context, new Map());
      expect(Array.isArray(calls2)).toBe(true);
    });

    it('should return same result structure', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);

      const source = `obj.method(arg1, arg2);`;
      const tree = parser.parse(source);
      const context: MethodCallContext = {
        source_code: source,
        file_path: 'test.js',
        language: 'javascript',
        ast_root: tree.rootNode
      };

      const calls = find_method_calls(context);

      expect(calls).toHaveLength(1);
      const call = calls[0];

      // Verify required fields
      expect(call).toHaveProperty('caller_name');
      expect(call).toHaveProperty('method_name');
      expect(call).toHaveProperty('receiver_name');
      expect(call).toHaveProperty('location');
      expect(call.location).toHaveProperty('line');
      expect(call.location).toHaveProperty('column');
      expect(call).toHaveProperty('is_static_method');
      expect(call).toHaveProperty('is_chained_call');
      expect(call).toHaveProperty('arguments_count');

      // Values should be correct
      expect(call.method_name).toBe('method');
      expect(call.receiver_name).toBe('obj');
      expect(call.arguments_count).toBe(2);
    });
  });
});
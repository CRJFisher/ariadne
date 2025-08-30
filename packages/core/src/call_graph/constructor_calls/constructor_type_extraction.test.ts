/**
 * Tests for constructor type extraction and bidirectional flow
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import {
  extract_constructor_calls_and_types,
  merge_constructor_types,
  extract_nested_assignments,
  is_valid_type_assignment
} from './constructor_type_extraction';
import { TypeInfo } from '../../type_analysis/type_tracking';

describe('constructor_type_extraction', () => {
  describe('extract_constructor_calls_and_types', () => {
    describe('JavaScript', () => {
      it('should extract type from simple constructor assignment', () => {
        const parser = new Parser();
        parser.setLanguage(JavaScript);
        
        const source = 'const foo = new Bar();';
        const tree = parser.parse(source);
        
        const result = extract_constructor_calls_and_types(
          tree.rootNode,
          source,
          'test.js',
          'javascript'
        );
        
        expect(result.calls).toHaveLength(1);
        expect(result.calls[0].class_name).toBe('Bar');
        
        expect(result.type_assignments.has('foo')).toBe(true);
        const types = result.type_assignments.get('foo')!;
        expect(types).toHaveLength(1);
        expect(types[0].type_name).toBe('Bar');
        expect(types[0].source).toBe('constructor');
      });

      it('should handle let and var declarations', () => {
        const parser = new Parser();
        parser.setLanguage(JavaScript);
        
        const source = `
          let x = new ClassA();
          var y = new ClassB();
        `;
        const tree = parser.parse(source);
        
        const result = extract_constructor_calls_and_types(
          tree.rootNode,
          source,
          'test.js',
          'javascript'
        );
        
        expect(result.calls).toHaveLength(2);
        expect(result.type_assignments.has('x')).toBe(true);
        expect(result.type_assignments.has('y')).toBe(true);
        expect(result.type_assignments.get('x')![0].type_name).toBe('ClassA');
        expect(result.type_assignments.get('y')![0].type_name).toBe('ClassB');
      });

      it('should handle property assignments', () => {
        const parser = new Parser();
        parser.setLanguage(JavaScript);
        
        const source = 'this.myProp = new MyClass();';
        const tree = parser.parse(source);
        
        const result = extract_constructor_calls_and_types(
          tree.rootNode,
          source,
          'test.js',
          'javascript'
        );
        
        expect(result.calls).toHaveLength(1);
        expect(result.type_assignments.has('this.myProp')).toBe(true);
        const types = result.type_assignments.get('this.myProp')!;
        expect(types[0].type_name).toBe('MyClass');
      });

      it('should handle return values', () => {
        const parser = new Parser();
        parser.setLanguage(JavaScript);
        
        const source = 'function create() { return new Factory(); }';
        const tree = parser.parse(source);
        
        const result = extract_constructor_calls_and_types(
          tree.rootNode,
          source,
          'test.js',
          'javascript'
        );
        
        expect(result.calls).toHaveLength(1);
        expect(result.type_assignments.has('<return>')).toBe(true);
        const types = result.type_assignments.get('<return>')!;
        expect(types[0].type_name).toBe('Factory');
        expect(types[0].is_return_value).toBe(true);
      });

      it('should handle namespaced constructors', () => {
        const parser = new Parser();
        parser.setLanguage(JavaScript);
        
        const source = 'const obj = new namespace.MyClass();';
        const tree = parser.parse(source);
        
        const result = extract_constructor_calls_and_types(
          tree.rootNode,
          source,
          'test.js',
          'javascript'
        );
        
        expect(result.calls).toHaveLength(1);
        expect(result.calls[0].class_name).toBe('MyClass');
        expect(result.type_assignments.has('obj')).toBe(true);
        expect(result.type_assignments.get('obj')![0].type_name).toBe('MyClass');
      });
    });

    describe('TypeScript', () => {
      it('should handle TypeScript type annotations', () => {
        const parser = new Parser();
        parser.setLanguage(TypeScript.typescript);
        
        const source = 'const foo: Foo = new Foo();';
        const tree = parser.parse(source);
        
        const result = extract_constructor_calls_and_types(
          tree.rootNode,
          source,
          'test.ts',
          'typescript'
        );
        
        expect(result.calls).toHaveLength(1);
        expect(result.type_assignments.has('foo')).toBe(true);
        expect(result.type_assignments.get('foo')![0].type_name).toBe('Foo');
      });

      it('should handle generic constructors', () => {
        const parser = new Parser();
        parser.setLanguage(TypeScript.typescript);
        
        const source = 'const list = new Array<string>();';
        const tree = parser.parse(source);
        
        const result = extract_constructor_calls_and_types(
          tree.rootNode,
          source,
          'test.ts',
          'typescript'
        );
        
        expect(result.calls).toHaveLength(1);
        expect(result.calls[0].class_name).toBe('Array');
        expect(result.type_assignments.has('list')).toBe(true);
        expect(result.type_assignments.get('list')![0].type_name).toBe('Array');
      });
    });

    describe('Python', () => {
      it('should handle Python class instantiation', () => {
        const parser = new Parser();
        parser.setLanguage(Python);
        
        const source = 'foo = Bar()';
        const tree = parser.parse(source);
        
        const result = extract_constructor_calls_and_types(
          tree.rootNode,
          source,
          'test.py',
          'python'
        );
        
        expect(result.calls).toHaveLength(1);
        expect(result.calls[0].class_name).toBe('Bar');
        expect(result.type_assignments.has('foo')).toBe(true);
        expect(result.type_assignments.get('foo')![0].type_name).toBe('Bar');
      });

      it('should handle self property assignments', () => {
        const parser = new Parser();
        parser.setLanguage(Python);
        
        const source = 'self.prop = MyClass()';
        const tree = parser.parse(source);
        
        const result = extract_constructor_calls_and_types(
          tree.rootNode,
          source,
          'test.py',
          'python'
        );
        
        expect(result.calls).toHaveLength(1);
        expect(result.type_assignments.has('self.prop')).toBe(true);
        expect(result.type_assignments.get('self.prop')![0].type_name).toBe('MyClass');
      });

      it('should handle module.Class pattern', () => {
        const parser = new Parser();
        parser.setLanguage(Python);
        
        const source = 'obj = module.SubClass()';
        const tree = parser.parse(source);
        
        const result = extract_constructor_calls_and_types(
          tree.rootNode,
          source,
          'test.py',
          'python'
        );
        
        expect(result.calls).toHaveLength(1);
        expect(result.calls[0].class_name).toBe('SubClass');
        expect(result.type_assignments.has('obj')).toBe(true);
        expect(result.type_assignments.get('obj')![0].type_name).toBe('SubClass');
      });
    });

    describe('Rust', () => {
      it('should handle Rust Type::new() pattern', () => {
        const parser = new Parser();
        parser.setLanguage(Rust);
        
        const source = 'let foo = Bar::new();';
        const tree = parser.parse(source);
        
        const result = extract_constructor_calls_and_types(
          tree.rootNode,
          source,
          'test.rs',
          'rust'
        );
        
        expect(result.calls).toHaveLength(1);
        expect(result.calls[0].class_name).toBe('Bar');
        expect(result.type_assignments.has('foo')).toBe(true);
        expect(result.type_assignments.get('foo')![0].type_name).toBe('Bar');
      });

      it('should handle struct literals', () => {
        const parser = new Parser();
        parser.setLanguage(Rust);
        
        const source = 'let point = Point { x: 1, y: 2 };';
        const tree = parser.parse(source);
        
        const result = extract_constructor_calls_and_types(
          tree.rootNode,
          source,
          'test.rs',
          'rust'
        );
        
        expect(result.calls).toHaveLength(1);
        expect(result.calls[0].class_name).toBe('Point');
        expect(result.type_assignments.has('point')).toBe(true);
        expect(result.type_assignments.get('point')![0].type_name).toBe('Point');
      });

      it('should handle mutable bindings', () => {
        const parser = new Parser();
        parser.setLanguage(Rust);
        
        const source = 'let mut vec = Vec::new();';
        const tree = parser.parse(source);
        
        const result = extract_constructor_calls_and_types(
          tree.rootNode,
          source,
          'test.rs',
          'rust'
        );
        
        expect(result.calls).toHaveLength(1);
        expect(result.type_assignments.has('vec')).toBe(true);
        expect(result.type_assignments.get('vec')![0].type_name).toBe('Vec');
      });
    });
  });

  describe('merge_constructor_types', () => {
    it('should merge constructor types with existing types', () => {
      const existing = new Map<string, TypeInfo[]>();
      existing.set('foo', [{
        variable_name: 'foo',
        type_name: 'string',
        location: { line: 1, column: 0 },
        source: 'inference',
        confidence: 0.8
      }]);
      
      const constructor_types = new Map<string, TypeInfo[]>();
      constructor_types.set('foo', [{
        variable_name: 'foo',
        type_name: 'Foo',
        location: { line: 5, column: 0 },
        source: 'constructor',
        confidence: 1.0
      }]);
      constructor_types.set('bar', [{
        variable_name: 'bar',
        type_name: 'Bar',
        location: { line: 10, column: 0 },
        source: 'constructor',
        confidence: 1.0
      }]);
      
      const merged = merge_constructor_types(existing, constructor_types);
      
      // Should have both types for 'foo'
      expect(merged.get('foo')).toHaveLength(2);
      expect(merged.get('foo')![0].type_name).toBe('string');
      expect(merged.get('foo')![1].type_name).toBe('Foo');
      
      // Should have new type for 'bar'
      expect(merged.get('bar')).toHaveLength(1);
      expect(merged.get('bar')![0].type_name).toBe('Bar');
    });

    it('should avoid duplicate entries', () => {
      const existing = new Map<string, TypeInfo[]>();
      existing.set('foo', [{
        variable_name: 'foo',
        type_name: 'Foo',
        location: { line: 1, column: 0 },
        source: 'constructor',
        confidence: 1.0
      }]);
      
      const constructor_types = new Map<string, TypeInfo[]>();
      constructor_types.set('foo', [{
        variable_name: 'foo',
        type_name: 'Foo',
        location: { line: 1, column: 0 },
        source: 'constructor',
        confidence: 1.0
      }]);
      
      const merged = merge_constructor_types(existing, constructor_types);
      
      // Should not duplicate the same type assignment
      expect(merged.get('foo')).toHaveLength(1);
    });
  });

  describe('is_valid_type_assignment', () => {
    it('should accept valid assignments', () => {
      expect(is_valid_type_assignment({
        variable_name: 'foo',
        type_name: 'Foo',
        location: { line: 1, column: 0 }
      })).toBe(true);
      
      expect(is_valid_type_assignment({
        variable_name: 'this.prop',
        type_name: 'MyClass',
        location: { line: 1, column: 0 }
      })).toBe(true);
    });

    it('should accept return values', () => {
      expect(is_valid_type_assignment({
        variable_name: '<return>',
        type_name: 'Result',
        location: { line: 1, column: 0 },
        is_return_value: true
      })).toBe(true);
    });

    it('should reject array indices', () => {
      expect(is_valid_type_assignment({
        variable_name: 'items[0]',
        type_name: 'Item',
        location: { line: 1, column: 0 }
      })).toBe(false);
    });

    it('should reject anonymous variables without return flag', () => {
      expect(is_valid_type_assignment({
        variable_name: '<temp>',
        type_name: 'Temp',
        location: { line: 1, column: 0 }
      })).toBe(false);
    });
  });
});
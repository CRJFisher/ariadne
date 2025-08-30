/**
 * Tests for receiver type resolution
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import { resolve_receiver_type, MethodCallWithType, infer_defining_class } from './receiver_type_resolver';
import { TypeInfo } from '../../type_analysis/type_tracking';
import { Language } from '@ariadnejs/types';

describe('receiver_type_resolver', () => {
  describe('resolve_receiver_type', () => {
    it('should resolve JavaScript variable types from type_map', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const source = 'myObject.method()';
      const tree = parser.parse(source);
      
      const type_map = new Map<string, TypeInfo[]>();
      type_map.set('myObject', [{
        variable_name: 'myObject',
        type_name: 'MyClass',
        location: { line: 0, column: 0 }
      }]);
      
      // Find the receiver node (myObject)
      const call = tree.rootNode.firstChild!;
      const memberExpr = call.childForFieldName('function')!;
      const receiver = memberExpr.childForFieldName('object')!;
      
      const resolved = resolve_receiver_type(receiver, type_map, source, 'javascript');
      expect(resolved).toBe('MyClass');
    });

    it('should resolve TypeScript this keyword', () => {
      const parser = new Parser();
      parser.setLanguage(TypeScript.typescript);
      const source = 'this.method()';
      const tree = parser.parse(source);
      
      const type_map = new Map<string, TypeInfo[]>();
      type_map.set('this', [{
        variable_name: 'this',
        type_name: 'CurrentClass',
        location: { line: 0, column: 0 }
      }]);
      
      const call = tree.rootNode.firstChild!;
      const memberExpr = call.childForFieldName('function')!;
      const receiver = memberExpr.childForFieldName('object')!;
      
      const resolved = resolve_receiver_type(receiver, type_map, source, 'typescript');
      expect(resolved).toBe('CurrentClass');
    });

    it('should resolve Python self keyword', () => {
      const parser = new Parser();
      parser.setLanguage(Python);
      const source = 'self.method()';
      const tree = parser.parse(source);
      
      const type_map = new Map<string, TypeInfo[]>();
      type_map.set('self', [{
        variable_name: 'self',
        type_name: 'MyClass',
        location: { line: 0, column: 0 }
      }]);
      
      const call = tree.rootNode.firstChild!.firstChild!; // module -> expression_statement -> call
      const attribute = call.childForFieldName('function')!;
      const receiver = attribute.childForFieldName('object')!;
      
      const resolved = resolve_receiver_type(receiver, type_map, source, 'python');
      expect(resolved).toBe('MyClass');
    });

    it('should resolve Rust self keyword', () => {
      const parser = new Parser();
      parser.setLanguage(Rust);
      const source = 'self.method()';
      const tree = parser.parse(source);
      
      const type_map = new Map<string, TypeInfo[]>();
      type_map.set('self', [{
        variable_name: 'self',
        type_name: 'MyStruct',
        location: { line: 0, column: 0 }
      }]);
      
      // Navigate to the receiver node
      const exprStmt = tree.rootNode.firstChild!;
      const call = exprStmt.firstChild!;
      const fieldExpr = call.childForFieldName('function')!;
      const receiver = fieldExpr.childForFieldName('value')!;
      
      const resolved = resolve_receiver_type(receiver, type_map, source, 'rust');
      expect(resolved).toBe('MyStruct');
    });

    it('should handle literal types in JavaScript', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const source = '"hello".toUpperCase()';
      const tree = parser.parse(source);
      
      const call = tree.rootNode.firstChild!;
      const memberExpr = call.childForFieldName('function')!;
      const receiver = memberExpr.childForFieldName('object')!;
      
      const resolved = resolve_receiver_type(receiver, undefined, source, 'javascript');
      expect(resolved).toBe('string');
    });

    it('should handle array literals', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const source = '[1, 2, 3].map(x => x * 2)';
      const tree = parser.parse(source);
      
      const call = tree.rootNode.firstChild!;
      const memberExpr = call.childForFieldName('function')!;
      const receiver = memberExpr.childForFieldName('object')!;
      
      const resolved = resolve_receiver_type(receiver, undefined, source, 'javascript');
      expect(resolved).toBe('Array');
    });

    it('should return undefined for unknown receivers', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const source = 'unknownVar.method()';
      const tree = parser.parse(source);
      
      const call = tree.rootNode.firstChild!;
      const memberExpr = call.childForFieldName('function')!;
      const receiver = memberExpr.childForFieldName('object')!;
      
      const resolved = resolve_receiver_type(receiver, undefined, source, 'javascript');
      expect(resolved).toBeUndefined();
    });

    it('should use the most recent type from type history', () => {
      const parser = new Parser();
      parser.setLanguage(JavaScript);
      const source = 'myVar.method()';
      const tree = parser.parse(source);
      
      const type_map = new Map<string, TypeInfo[]>();
      type_map.set('myVar', [
        {
          variable_name: 'myVar',
          type_name: 'OldType',
          location: { line: 0, column: 0 }
        },
        {
          variable_name: 'myVar',
          type_name: 'NewType',
          location: { line: 5, column: 0 }
        }
      ]);
      
      const call = tree.rootNode.firstChild!;
      const memberExpr = call.childForFieldName('function')!;
      const receiver = memberExpr.childForFieldName('object')!;
      
      const resolved = resolve_receiver_type(receiver, type_map, source, 'javascript');
      expect(resolved).toBe('NewType');
    });
  });

  describe('infer_defining_class', () => {
    it('should return receiver type as defining class', () => {
      const result = infer_defining_class('toString', 'Object');
      expect(result).toBe('Object');
    });

    it('should return undefined for undefined receiver type', () => {
      const result = infer_defining_class('method', undefined);
      expect(result).toBeUndefined();
    });
  });
});
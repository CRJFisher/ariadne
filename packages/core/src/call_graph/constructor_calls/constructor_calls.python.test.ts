/**
 * Tests for Python bespoke constructor features
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import Python from 'tree-sitter-python';
import {
  handle_super_init_call,
  detect_classmethod_factory
} from "./constructor_calls.python";
import { FilePath } from "@ariadnejs/types";
import { ConstructorCallContext } from "./constructor_calls";

describe("Python Bespoke Handlers", () => {
  const parser = new Parser();
  parser.setLanguage(Python);

  describe("handle_super_init_call", () => {
    it("should detect super().__init__() calls", () => {
      const source = `super().__init__(name, age)`;
      const tree = parser.parse(source);
      
      // Find the call node
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call');
      expect(callNode).toBeDefined();
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.py' as FilePath,
        language: 'python'
      };
      
      const result = handle_super_init_call(callNode, context);
      expect(result).toBeDefined();
      expect(result?.constructor_name).toBe('super');
      expect(result?.is_super_call).toBe(true);
    });

    it("should detect super() calls without __init__", () => {
      const source = `super().some_method()`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.py' as FilePath,
        language: 'python'
      };
      
      // Should return null for non-__init__ super calls
      if (callNode) {
        const result = handle_super_init_call(callNode, context);
        expect(result).toBeNull();
      }
    });

    it("should return null for regular method calls", () => {
      const source = `self.method().__init__()`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.py' as FilePath,
        language: 'python'
      };
      
      if (callNode) {
        const result = handle_super_init_call(callNode, context);
        // Should only detect actual super() calls
        expect(result === null || result.constructor_name !== 'super').toBe(true);
      }
    });
  });

  describe("detect_classmethod_factory", () => {
    it("should detect classmethod factory patterns", () => {
      const source = `MyClass.from_string("data")`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call');
      expect(callNode).toBeDefined();
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.py' as FilePath,
        language: 'python'
      };
      
      const result = detect_classmethod_factory(callNode, context);
      expect(result).toBeDefined();
      expect(result?.constructor_name).toBe('MyClass');
      expect(result?.is_factory_method).toBe(true);
    });

    it("should detect from_dict factory pattern", () => {
      const source = `User.from_dict({"name": "John", "age": 30})`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.py' as FilePath,
        language: 'python'
      };
      
      const result = detect_classmethod_factory(callNode, context);
      expect(result).toBeDefined();
      expect(result?.constructor_name).toBe('User');
      expect(result?.is_factory_method).toBe(true);
    });

    it("should detect create factory pattern", () => {
      const source = `Connection.create(host="localhost", port=5432)`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.py' as FilePath,
        language: 'python'
      };
      
      const result = detect_classmethod_factory(callNode, context);
      expect(result).toBeDefined();
      expect(result?.constructor_name).toBe('Connection');
    });

    it("should return null for regular method calls", () => {
      const source = `instance.regular_method()`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.py' as FilePath,
        language: 'python'
      };
      
      if (callNode) {
        const result = detect_classmethod_factory(callNode, context);
        expect(result).toBeNull();
      }
    });

    it("should detect from_json factory pattern", () => {
      const source = `Model.from_json('{"key": "value"}')`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.py' as FilePath,
        language: 'python'
      };
      
      const result = detect_classmethod_factory(callNode, context);
      expect(result).toBeDefined();
      expect(result?.constructor_name).toBe('Model');
      expect(result?.is_factory_method).toBe(true);
    });
  });
});
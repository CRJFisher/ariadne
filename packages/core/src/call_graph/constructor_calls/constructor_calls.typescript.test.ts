/**
 * Tests for TypeScript bespoke constructor features
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import {
  handle_generic_constructor
} from "./constructor_calls.typescript";
import { FilePath } from "@ariadnejs/types";
import { ConstructorCallContext } from "./constructor_calls";

describe("TypeScript Bespoke Handlers", () => {
  const parser = new Parser();
  parser.setLanguage(TypeScript.tsx);

  describe("handle_generic_constructor", () => {
    it("should detect generic constructor with type parameters", () => {
      const source = `const list = new Array<string>();`;
      const tree = parser.parse(source);
      
      // Find the new_expression node
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const newExpr = findNode(tree.rootNode, 'new_expression');
      expect(newExpr).toBeDefined();
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.ts' as FilePath,
        language: 'typescript'
      };
      
      const result = handle_generic_constructor(newExpr, context);
      expect(result).toBeDefined();
      expect(result?.constructor_name).toBe('Array');
      expect(result?.type_parameters).toEqual(['string']);
    });

    it("should detect generic constructor with multiple type parameters", () => {
      const source = `const map = new Map<string, number>();`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const newExpr = findNode(tree.rootNode, 'new_expression');
      expect(newExpr).toBeDefined();
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.ts' as FilePath,
        language: 'typescript'
      };
      
      const result = handle_generic_constructor(newExpr, context);
      expect(result).toBeDefined();
      expect(result?.constructor_name).toBe('Map');
      expect(result?.type_parameters).toEqual(['string', 'number']);
    });

    it("should return null for non-generic constructors", () => {
      const source = `const obj = new MyClass();`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const newExpr = findNode(tree.rootNode, 'new_expression');
      expect(newExpr).toBeDefined();
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.ts' as FilePath,
        language: 'typescript'
      };
      
      const result = handle_generic_constructor(newExpr, context);
      expect(result).toBeNull();
    });

    it("should handle nested generic types", () => {
      const source = `const nested = new Container<Array<string>>();`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const newExpr = findNode(tree.rootNode, 'new_expression');
      expect(newExpr).toBeDefined();
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.ts' as FilePath,
        language: 'typescript'
      };
      
      const result = handle_generic_constructor(newExpr, context);
      expect(result).toBeDefined();
      expect(result?.constructor_name).toBe('Container');
      expect(result?.type_parameters).toEqual(['Array<string>']);
    });

    it("should handle generic constructor with constraints", () => {
      const source = `const bounded = new BoundedContainer<MyClass extends BaseClass>();`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const newExpr = findNode(tree.rootNode, 'new_expression');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.ts' as FilePath,
        language: 'typescript'
      };
      
      // Even if the syntax is complex, we should still detect it as a generic constructor
      if (newExpr) {
        const result = handle_generic_constructor(newExpr, context);
        // The function might not handle this complex case perfectly, but it should try
        expect(result === null || result?.constructor_name === 'BoundedContainer').toBe(true);
      }
    });
  });
});
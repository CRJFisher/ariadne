/**
 * Tests for JavaScript bespoke constructor features
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import {
  handle_object_create_pattern,
  extract_class_inheritance,
  detect_advanced_factory_pattern
} from "./constructor_calls.javascript";
import { FilePath } from "@ariadnejs/types";
import { ConstructorCallContext } from "./constructor_calls";

describe("JavaScript Bespoke Handlers", () => {
  const parser = new Parser();
  parser.setLanguage(JavaScript);

  describe("Object.create() pattern", () => {
    it("should detect Object.create with prototype", () => {
      const source = `const obj = Object.create(Person.prototype);`;
      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      // Find the call_expression node
      function findCallNode(node: any): any {
        if (node.type === 'call_expression') {
          return node;
        }
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) {
            const result = findCallNode(child);
            if (result) return result;
          }
        }
        return null;
      }

      const call_node = findCallNode(tree.rootNode);
      const result = handle_object_create_pattern(call_node, context);

      expect(result).toBeDefined();
      expect(result?.constructor_name).toBe("Person");
      expect(result?.assigned_to).toBe("obj");
      expect(result?.is_factory_method).toBe(true);
    });

    it("should return null for non-Object.create calls", () => {
      const source = `const obj = SomeObject.create();`;
      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      function findCallNode(node: any): any {
        if (node.type === 'call_expression') {
          return node;
        }
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) {
            const result = findCallNode(child);
            if (result) return result;
          }
        }
        return null;
      }

      const call_node = findCallNode(tree.rootNode);
      const result = handle_object_create_pattern(call_node, context);

      expect(result).toBeNull();
    });
  });

  describe("Class inheritance", () => {
    it("should extract parent-child class relationship", () => {
      const source = `class Dog extends Animal {}`;
      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      // Find the class_declaration node
      function findClassNode(node: any): any {
        if (node.type === 'class_declaration') {
          return node;
        }
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) {
            const result = findClassNode(child);
            if (result) return result;
          }
        }
        return null;
      }

      const class_node = findClassNode(tree.rootNode);
      const result = extract_class_inheritance(class_node, context);

      expect(result).toBeDefined();
      expect(result?.child_class).toBe("Dog");
      expect(result?.parent_class).toBe("Animal");
    });

    it("should return null for class without extends", () => {
      const source = `class Person {}`;
      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      function findClassNode(node: any): any {
        if (node.type === 'class_declaration') {
          return node;
        }
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) {
            const result = findClassNode(child);
            if (result) return result;
          }
        }
        return null;
      }

      const class_node = findClassNode(tree.rootNode);
      const result = extract_class_inheritance(class_node, context);

      expect(result).toBeNull();
    });
  });

  describe("Advanced factory patterns", () => {
    it("should detect factory functions with prefixes", () => {
      const source = `const widget = createWidget();`;
      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      function findCallNode(node: any): any {
        if (node.type === 'call_expression') {
          return node;
        }
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) {
            const result = findCallNode(child);
            if (result) return result;
          }
        }
        return null;
      }

      const call_node = findCallNode(tree.rootNode);
      const result = detect_advanced_factory_pattern(call_node, context);

      expect(result).toBe(true);
    });

    it("should detect makeXxx pattern", () => {
      const source = `const obj = makeObject();`;
      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      function findCallNode(node: any): any {
        if (node.type === 'call_expression') {
          return node;
        }
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) {
            const result = findCallNode(child);
            if (result) return result;
          }
        }
        return null;
      }

      const call_node = findCallNode(tree.rootNode);
      const result = detect_advanced_factory_pattern(call_node, context);

      expect(result).toBe(true);
    });

    it("should not detect regular function calls", () => {
      const source = `const result = processData();`;
      const tree = parser.parse(source);
      const context: ConstructorCallContext = {
        source_code: source,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      function findCallNode(node: any): any {
        if (node.type === 'call_expression') {
          return node;
        }
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) {
            const result = findCallNode(child);
            if (result) return result;
          }
        }
        return null;
      }

      const call_node = findCallNode(tree.rootNode);
      const result = detect_advanced_factory_pattern(call_node, context);

      expect(result).toBe(false);
    });
  });
});
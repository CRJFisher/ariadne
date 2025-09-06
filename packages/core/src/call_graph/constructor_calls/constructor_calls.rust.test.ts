/**
 * Tests for Rust bespoke constructor features
 */

import { describe, it, expect } from 'vitest';
import Parser from 'tree-sitter';
import Rust from 'tree-sitter-rust';
import {
  handle_enum_variant_construction,
  handle_tuple_struct_construction,
  handle_macro_construction,
  handle_smart_pointer_construction,
  handle_default_construction
} from "./constructor_calls.rust";
import { ConstructorCallContext } from "./constructor_calls";

describe("Rust Bespoke Handlers", () => {
  const parser = new Parser();
  parser.setLanguage(Rust);

  describe("handle_enum_variant_construction", () => {
    it("should detect enum variant construction", () => {
      const source = `let opt = Option::Some(42);`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call_expression');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        language: 'rust'
      };
      
      if (callNode) {
        const result = handle_enum_variant_construction(callNode, context);
        expect(result).toBeDefined();
        expect(result?.constructor_name).toContain('Some');
        expect(result?.is_enum_variant).toBe(true);
      }
    });

    it("should detect Result::Ok variant", () => {
      const source = `Result::Ok("success")`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call_expression');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        language: 'rust'
      };
      
      if (callNode) {
        const result = handle_enum_variant_construction(callNode, context);
        expect(result).toBeDefined();
        expect(result?.constructor_name).toContain('Ok');
      }
    });

    it("should return null for regular function calls", () => {
      const source = `let x = regular_function();`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call_expression');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        language: 'rust'
      };
      
      if (callNode) {
        const result = handle_enum_variant_construction(callNode, context);
        expect(result).toBeNull();
      }
    });
  });

  describe("handle_tuple_struct_construction", () => {
    it("should detect tuple struct construction", () => {
      const source = `let point = Point(10, 20);`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call_expression');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        language: 'rust'
      };
      
      if (callNode) {
        const result = handle_tuple_struct_construction(callNode, context);
        expect(result).toBeDefined();
        expect(result?.constructor_name).toBe('Point');
        expect(result?.is_tuple_struct).toBe(true);
      }
    });

    it("should detect Color tuple struct", () => {
      const source = `Color(255, 0, 128)`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call_expression');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        language: 'rust'
      };
      
      if (callNode) {
        const result = handle_tuple_struct_construction(callNode, context);
        expect(result).toBeDefined();
        expect(result?.constructor_name).toBe('Color');
      }
    });
  });

  describe("handle_macro_construction", () => {
    it("should detect vec! macro", () => {
      const source = `let v = vec![1, 2, 3];`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const macroNode = findNode(tree.rootNode, 'macro_invocation');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        language: 'rust'
      };
      
      if (macroNode) {
        const result = handle_macro_construction(macroNode, context);
        expect(result).toBeDefined();
        expect(result?.constructor_name).toBe('vec');
        expect(result?.is_macro_invocation).toBe(true);
      }
    });

    it("should detect hashmap! macro", () => {
      const source = `hashmap!{ "key" => "value" }`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const macroNode = findNode(tree.rootNode, 'macro_invocation');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        language: 'rust'
      };
      
      if (macroNode) {
        const result = handle_macro_construction(macroNode, context);
        expect(result).toBeDefined();
        expect(result?.constructor_name).toBe('hashmap');
      }
    });

    it("should return null for non-constructor macros", () => {
      const source = `println!("Hello");`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const macroNode = findNode(tree.rootNode, 'macro_invocation');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        language: 'rust'
      };
      
      if (macroNode) {
        const result = handle_macro_construction(macroNode, context);
        expect(result).toBeNull();
      }
    });
  });

  describe("handle_smart_pointer_construction", () => {
    it("should detect Box::new", () => {
      const source = `let boxed = Box::new(42);`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call_expression');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        language: 'rust'
      };
      
      if (callNode) {
        const result = handle_smart_pointer_construction(callNode, context);
        expect(result).toBeDefined();
        expect(result?.constructor_name).toBe('Box');
        expect(result?.is_smart_pointer).toBe(true);
      }
    });

    it("should detect Arc::new", () => {
      const source = `Arc::new(Mutex::new(0))`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call_expression');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        language: 'rust'
      };
      
      if (callNode) {
        const result = handle_smart_pointer_construction(callNode, context);
        expect(result).toBeDefined();
        expect(result?.constructor_name).toBe('Arc');
      }
    });

    it("should detect Rc::new", () => {
      const source = `Rc::new(value)`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call_expression');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        language: 'rust'
      };
      
      if (callNode) {
        const result = handle_smart_pointer_construction(callNode, context);
        expect(result).toBeDefined();
        expect(result?.constructor_name).toBe('Rc');
      }
    });
  });

  describe("handle_default_construction", () => {
    it("should detect Default::default()", () => {
      const source = `let config = Config::default();`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call_expression');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        language: 'rust'
      };
      
      if (callNode) {
        const result = handle_default_construction(callNode, context);
        expect(result).toBeDefined();
        expect(result?.constructor_name).toBe('Config');
        expect(result?.is_default_construction).toBe(true);
      }
    });

    it("should detect Default::default() standalone", () => {
      const source = `Default::default()`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call_expression');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        language: 'rust'
      };
      
      if (callNode) {
        const result = handle_default_construction(callNode, context);
        expect(result).toBeDefined();
        expect(result?.constructor_name).toBe('Default');
      }
    });

    it("should return null for non-default methods", () => {
      const source = `Config::custom()`;
      const tree = parser.parse(source);
      
      function findNode(node: any, type: string): any {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
          const result = findNode(node.child(i), type);
          if (result) return result;
        }
        return null;
      }
      
      const callNode = findNode(tree.rootNode, 'call_expression');
      
      const context: ConstructorCallContext = {
        source_code: source,
        ast_root: tree.rootNode,
        file_path: 'test.rs',
        language: 'rust'
      };
      
      if (callNode) {
        const result = handle_default_construction(callNode, context);
        expect(result).toBeNull();
      }
    });
  });
});
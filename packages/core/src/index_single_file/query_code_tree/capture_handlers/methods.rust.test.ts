/**
 * Tests for Rust method capture handlers
 */

import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import {
  handle_definition_method,
  handle_definition_method_associated,
  handle_definition_method_default,
  handle_definition_method_async,
  handle_definition_constructor,
} from "./methods.rust";
import { RUST_HANDLERS } from "./capture_handlers.rust";
import { DefinitionBuilder } from "../../definitions/definitions";
import type {
  ProcessingContext,
  CaptureNode,
} from "../../index_single_file";
import type { Location, SymbolName, ScopeId } from "@ariadnejs/types";
import type { FilePath } from "@ariadnejs/types";
import { node_to_location } from "../../node_utils";

describe("Rust Method Handlers", () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  // Helper to find node by type and optional text
  function find_node(root: any, type: string, text?: string): any {
    if (root.type === type && (!text || root.text === text)) {
      return root;
    }
    for (const child of root.children) {
      const found = find_node(child, type, text);
      if (found) return found;
    }
    return null;
  }

  function create_context(): ProcessingContext {
    const root_scope_id = "module:test.rs:1:0:100:0:<module>" as ScopeId;
    return {
      captures: [],
      scopes: new Map(),
      scope_depths: new Map(),
      root_scope_id,
      get_scope_id: (_location: Location) => root_scope_id,
      get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
        throw new Error(`Child scope not found`);
      },
    };
  }

  describe("handle_definition_method", () => {
    it("should add instance method to struct", () => {
      const code = `struct MyStruct { value: String }
impl MyStruct {
    pub fn get_value(&self) -> String {
        self.value.clone()
    }
}`;
      const tree = parser.parse(code);
      const struct_node = find_node(tree.rootNode, "type_identifier", "MyStruct");
      const method_node = find_node(tree.rootNode, "identifier", "get_value");
      const context = create_context();
      const builder = new DefinitionBuilder(context);

      // Add struct
      RUST_HANDLERS["definition.class"]({
        category: "definition" as any,
        entity: "class" as any,
        node: struct_node,
        text: "MyStruct" as SymbolName,
        name: "definition.class",
        location: node_to_location(struct_node, "test.rs" as FilePath),
      }, builder, context);

      // Add method
      handle_definition_method(
        {
          category: "definition" as any,
          entity: "method" as any,
          node: method_node,
          text: "get_value" as SymbolName,
          name: "definition.method",
          location: node_to_location(method_node, "test.rs" as FilePath),
        },
        builder,
        context
      );

      const result = builder.build();
      const classes = Array.from(result.classes.values());
      expect(classes).toHaveLength(1);
      expect(classes[0].methods).toHaveLength(1);
      expect(classes[0].methods[0].name).toBe("get_value");
      expect(classes[0].methods[0].return_type).toBe("String");
    });

    it("should skip method when no containing impl block found", () => {
      const code = "fn standalone() {}";
      const tree = parser.parse(code);
      const fn_node = find_node(tree.rootNode, "identifier", "standalone");
      const context = create_context();
      const builder = new DefinitionBuilder(context);

      handle_definition_method(
        {
          category: "definition" as any,
          entity: "method" as any,
          node: fn_node,
          text: "standalone" as SymbolName,
          name: "definition.method",
          location: node_to_location(fn_node, "test.rs" as FilePath),
        },
        builder,
        context
      );

      const result = builder.build();
      expect(Array.from(result.classes.values())).toHaveLength(0);
      expect(Array.from(result.functions.values())).toHaveLength(0);
    });
  });

  describe("handle_definition_method_associated", () => {
    it("should add associated function (static) to struct", () => {
      const code = `struct MyStruct { value: String }
impl MyStruct {
    pub fn from_str(s: &str) -> Self {
        MyStruct { value: s.to_string() }
    }
}`;
      const tree = parser.parse(code);
      const struct_node = find_node(tree.rootNode, "type_identifier", "MyStruct");
      const method_node = find_node(tree.rootNode, "identifier", "from_str");
      const context = create_context();
      const builder = new DefinitionBuilder(context);

      // Add struct
      RUST_HANDLERS["definition.class"]({
        category: "definition" as any,
        entity: "class" as any,
        node: struct_node,
        text: "MyStruct" as SymbolName,
        name: "definition.class",
        location: node_to_location(struct_node, "test.rs" as FilePath),
      }, builder, context);

      // Add associated function
      handle_definition_method_associated(
        {
          category: "definition" as any,
          entity: "method" as any,
          node: method_node,
          text: "from_str" as SymbolName,
          name: "definition.method.associated",
          location: node_to_location(method_node, "test.rs" as FilePath),
        },
        builder,
        context
      );

      const result = builder.build();
      const classes = Array.from(result.classes.values());
      expect(classes).toHaveLength(1);
      expect(classes[0].methods).toHaveLength(1);
      expect(classes[0].methods[0].name).toBe("from_str");
      expect(classes[0].methods[0].static).toBe(true);
      expect(classes[0].methods[0].return_type).toBe("Self");
    });
  });

  describe("handle_definition_method_default", () => {
    it("should add default method to trait", () => {
      const code = `trait Greet {
    fn greet(&self) -> String {
        String::from("Hello")
    }
}`;
      const tree = parser.parse(code);
      const trait_node = find_node(tree.rootNode, "type_identifier", "Greet");
      const method_node = find_node(tree.rootNode, "identifier", "greet");
      const context = create_context();
      const builder = new DefinitionBuilder(context);

      // Add trait
      RUST_HANDLERS["definition.interface"]({
        category: "definition" as any,
        entity: "interface" as any,
        node: trait_node,
        text: "Greet" as SymbolName,
        name: "definition.interface",
        location: node_to_location(trait_node, "test.rs" as FilePath),
      }, builder, context);

      // Add default method
      handle_definition_method_default(
        {
          category: "definition" as any,
          entity: "method" as any,
          node: method_node,
          text: "greet" as SymbolName,
          name: "definition.method.default",
          location: node_to_location(method_node, "test.rs" as FilePath),
        },
        builder,
        context
      );

      const result = builder.build();
      const interfaces = Array.from(result.interfaces.values());
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].name).toBe("Greet");
      expect(interfaces[0].methods).toHaveLength(1);
      expect(interfaces[0].methods[0].name).toBe("greet");
      expect(interfaces[0].methods[0].return_type).toBe("String");
    });

    it("should skip default method when no containing trait found", () => {
      const code = "fn standalone() -> bool { true }";
      const tree = parser.parse(code);
      const fn_node = find_node(tree.rootNode, "identifier", "standalone");
      const context = create_context();
      const builder = new DefinitionBuilder(context);

      handle_definition_method_default(
        {
          category: "definition" as any,
          entity: "method" as any,
          node: fn_node,
          text: "standalone" as SymbolName,
          name: "definition.method.default",
          location: node_to_location(fn_node, "test.rs" as FilePath),
        },
        builder,
        context
      );

      const result = builder.build();
      expect(Array.from(result.interfaces.values())).toHaveLength(0);
    });
  });

  describe("handle_definition_method_async", () => {
    it("should add async method to struct", () => {
      const code = `struct Store {}
impl Store {
    async fn load(&self) -> String {
        String::new()
    }
}`;
      const tree = parser.parse(code);
      const struct_node = find_node(tree.rootNode, "type_identifier", "Store");
      const method_node = find_node(tree.rootNode, "identifier", "load");
      const context = create_context();
      const builder = new DefinitionBuilder(context);

      // Add struct
      RUST_HANDLERS["definition.class"]({
        category: "definition" as any,
        entity: "class" as any,
        node: struct_node,
        text: "Store" as SymbolName,
        name: "definition.class",
        location: node_to_location(struct_node, "test.rs" as FilePath),
      }, builder, context);

      // Add async method
      handle_definition_method_async(
        {
          category: "definition" as any,
          entity: "method" as any,
          node: method_node,
          text: "load" as SymbolName,
          name: "definition.method.async",
          location: node_to_location(method_node, "test.rs" as FilePath),
        },
        builder,
        context
      );

      const result = builder.build();
      const classes = Array.from(result.classes.values());
      expect(classes).toHaveLength(1);
      expect(classes[0].methods).toHaveLength(1);
      expect(classes[0].methods[0].name).toBe("load");
      expect(classes[0].methods[0].async).toBe(true);
      expect(classes[0].methods[0].return_type).toBe("String");
    });
  });

  describe("handle_definition_constructor", () => {
    it("should add constructor (fn new) to struct", () => {
      const code = `struct Counter { value: u32 }
impl Counter {
    fn new() -> Self {
        Counter { value: 0 }
    }
}`;
      const tree = parser.parse(code);
      const struct_node = find_node(tree.rootNode, "type_identifier", "Counter");
      const method_node = find_node(tree.rootNode, "identifier", "new");
      const context = create_context();
      const builder = new DefinitionBuilder(context);

      // Add struct
      RUST_HANDLERS["definition.class"]({
        category: "definition" as any,
        entity: "class" as any,
        node: struct_node,
        text: "Counter" as SymbolName,
        name: "definition.class",
        location: node_to_location(struct_node, "test.rs" as FilePath),
      }, builder, context);

      // Add constructor
      handle_definition_constructor(
        {
          category: "definition" as any,
          entity: "constructor" as any,
          node: method_node,
          text: "new" as SymbolName,
          name: "definition.constructor",
          location: node_to_location(method_node, "test.rs" as FilePath),
        },
        builder,
        context
      );

      const result = builder.build();
      const classes = Array.from(result.classes.values());
      expect(classes).toHaveLength(1);
      expect(classes[0].methods).toHaveLength(1);
      expect(classes[0].methods[0].name).toBe("new");
      expect(classes[0].methods[0].static).toBe(true);
      expect(classes[0].methods[0].return_type).toBe("Self");
    });

    it("should skip non-new constructor names", () => {
      const code = `struct MyStruct {}
impl MyStruct {
    fn create() -> Self {
        MyStruct {}
    }
}`;
      const tree = parser.parse(code);
      const struct_node = find_node(tree.rootNode, "type_identifier", "MyStruct");
      const method_node = find_node(tree.rootNode, "identifier", "create");
      const context = create_context();
      const builder = new DefinitionBuilder(context);

      // Add struct
      RUST_HANDLERS["definition.class"]({
        category: "definition" as any,
        entity: "class" as any,
        node: struct_node,
        text: "MyStruct" as SymbolName,
        name: "definition.class",
        location: node_to_location(struct_node, "test.rs" as FilePath),
      }, builder, context);

      // Try to add constructor with non-"new" name
      handle_definition_constructor(
        {
          category: "definition" as any,
          entity: "constructor" as any,
          node: method_node,
          text: "create" as SymbolName,
          name: "definition.constructor",
          location: node_to_location(method_node, "test.rs" as FilePath),
        },
        builder,
        context
      );

      const result = builder.build();
      const classes = Array.from(result.classes.values());
      expect(classes).toHaveLength(1);
      // Constructor handler only processes "new", so no method should be added
      expect(classes[0].methods).toHaveLength(0);
    });
  });
});

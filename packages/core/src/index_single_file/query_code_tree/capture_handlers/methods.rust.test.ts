/**
 * Tests for Rust method capture handlers
 */

import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import {
  handle_definition_method,
  handle_definition_method_default,
  handle_definition_method_async,
  handle_definition_constructor,
} from "./methods.rust";
import { RUST_HANDLERS } from "./capture_handlers.rust";
import { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode } from "../../capture_types";
import type { ProcessingContext } from "../../scopes/processing_context";
import type { Location, SymbolName, ScopeId } from "@ariadnejs/types";
import type { FilePath } from "@ariadnejs/types";
import { node_to_location } from "../../node_to_location";

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

    it("records the impl's self type and trait on a method attached to the struct", () => {
      const code = `struct CacheBuilder {}
trait DocFolder { fn fold_item(&mut self); }
impl DocFolder for CacheBuilder {
    fn fold_item(&mut self) {}
}`;
      const tree = parser.parse(code);
      const struct_node = find_node(tree.rootNode, "type_identifier", "CacheBuilder");
      const method_node = find_node(find_node(tree.rootNode, "impl_item"), "identifier", "fold_item");
      const context = create_context();
      const builder = new DefinitionBuilder(context);
      RUST_HANDLERS["definition.class"]({
        category: "definition" as any,
        entity: "class" as any,
        node: struct_node,
        text: "CacheBuilder" as SymbolName,
        name: "definition.class",
        location: node_to_location(struct_node, "test.rs" as FilePath),
      }, builder, context);

      handle_definition_method(
        {
          category: "definition" as any,
          entity: "method" as any,
          node: method_node,
          text: "fold_item" as SymbolName,
          name: "definition.method",
          location: node_to_location(method_node, "test.rs" as FilePath),
        },
        builder,
        context
      );

      const result = builder.build();
      const [method] = Array.from(result.classes.values())[0].methods;
      expect([method.name, method.impl_self_type, method.impl_trait_name]).toEqual([
        "fold_item",
        "CacheBuilder",
        "DocFolder",
      ]);
      expect(result.unattached_impl_methods.size).toBe(0);
    });

    it("keeps a method unattached, with its parameters, when the file declares no type for the impl", () => {
      const code = `impl<'hir> LoweringContext<'_, 'hir> {
    fn lower_qpath(&mut self, depth: usize) {}
}`;
      const tree = parser.parse(code);
      const method_node = find_node(tree.rootNode, "identifier", "lower_qpath");
      const param_node = find_node(tree.rootNode, "identifier", "depth");
      const self_node = find_node(tree.rootNode, "self");
      const context = create_context();
      const builder = new DefinitionBuilder(context);

      handle_definition_method(
        {
          category: "definition" as any,
          entity: "method" as any,
          node: method_node,
          text: "lower_qpath" as SymbolName,
          name: "definition.method",
          location: node_to_location(method_node, "test.rs" as FilePath),
        },
        builder,
        context
      );
      RUST_HANDLERS["definition.parameter.self"]({
        category: "definition" as any,
        entity: "parameter" as any,
        node: self_node,
        text: "self" as SymbolName,
        name: "definition.parameter.self",
        location: node_to_location(self_node, "test.rs" as FilePath),
      }, builder, context);
      RUST_HANDLERS["definition.parameter"]({
        category: "definition" as any,
        entity: "parameter" as any,
        node: param_node,
        text: "depth" as SymbolName,
        name: "definition.parameter",
        location: node_to_location(param_node, "test.rs" as FilePath),
      }, builder, context);

      const result = builder.build();
      expect(Array.from(result.classes.values())).toHaveLength(0);
      const unattached = Array.from(result.unattached_impl_methods.values());
      expect(
        unattached.map((method) => ({
          name: method.name,
          impl_self_type: method.impl_self_type,
          impl_trait_name: method.impl_trait_name,
          parameters: method.parameters.map((parameter) => [parameter.name, parameter.type]),
        }))
      ).toEqual([
        {
          name: "lower_qpath",
          impl_self_type: "LoweringContext",
          impl_trait_name: undefined,
          parameters: [
            ["self", "LoweringContext"],
            ["depth", "usize"],
          ],
        },
      ]);
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

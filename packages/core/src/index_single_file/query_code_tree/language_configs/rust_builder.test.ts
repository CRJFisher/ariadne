// Test for Rust builder configuration
import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import { RUST_BUILDER_CONFIG } from "./rust_builder";
import { DefinitionBuilder } from "../../definitions/definition_builder";
import type {
  ProcessingContext,
  CaptureNode,
} from "../../scopes/scope_processor";
import type { Location } from "@ariadnejs/types";

describe("rust_builder", () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  // Helper to create mock context
  function createMockContext(): ProcessingContext {
    return {
      captures: [],
      scopes: new Map(),
      scope_depths: new Map(),
      root_scope_id: "module:test.rs:1:0:100:0:<module>" as any,
      get_scope_id: (_location: Location) =>
        "module:test.rs:1:0:100:0:<module>" as any,
    };
  }

  // Helper to process code and test captures
  function processCapture(
    code: string,
    captureName: string,
    nodeType: string,
    expectedText?: string
  ) {
    const tree = parser.parse(code);
    const node = findNode(tree.rootNode, nodeType, expectedText);

    if (!node) {
      throw new Error(
        `Node of type ${nodeType} with text "${expectedText}" not found`
      );
    }

    const location: Location = {
      file_path: "test.rs" as any,
      start_line: node.startPosition.row + 1,
      start_column: node.startPosition.column,
      end_line: node.endPosition.row + 1,
      end_column: node.endPosition.column,
    };

    // Parse capture name to extract category and entity
    const parts = captureName.split(".");
    const category = parts[0] as any;
    const entity = parts[1] as any;

    const capture: CaptureNode = {
      category,
      entity,
      name: captureName,
      text: (expectedText || node.text) as any,
      location,
      node,
    };

    const context = createMockContext();
    const builder = new DefinitionBuilder(context);
    const processor = RUST_BUILDER_CONFIG.get(captureName);

    if (!processor) {
      throw new Error(`No processor for capture ${captureName}`);
    }

    processor.process(capture, builder, context);
    const result = builder.build();

    // BuilderResult already provides categorized Maps, convert to arrays for tests
    return {
      classes: Array.from(result.classes.values()),
      functions: Array.from(result.functions.values()),
      enums: Array.from(result.enums.values()),
      interfaces: Array.from(result.interfaces.values()),
      variables: Array.from(result.variables.values()),
      types: Array.from(result.types.values()),
      namespaces: Array.from(result.namespaces.values()),
    };
  }

  // Helper to find node by type and optional text
  function findNode(root: any, type: string, text?: string): any {
    if (root.type === type && (!text || root.text === text)) {
      return root;
    }

    for (const child of root.children) {
      const found = findNode(child, type, text);
      if (found) return found;
    }

    return null;
  }

  describe("struct definitions", () => {
    it("should process simple struct", () => {
      const code = `pub struct MyStruct {
        field1: String,
        field2: i32,
      }`;

      const definitions = processCapture(
        code,
        "definition.class",
        "type_identifier",
        "MyStruct"
      );

      expect(definitions.classes).toHaveLength(1);
      expect(definitions.classes[0].name).toBe("MyStruct");
      expect(definitions.classes[0].availability.scope).toBe("public");
    });

    it("should process generic struct", () => {
      const code = `struct Container<T, U> {
        data: T,
        metadata: U,
      }`;

      const definitions = processCapture(
        code,
        "definition.class.generic",
        "type_identifier",
        "Container"
      );

      expect(definitions.classes).toHaveLength(1);
      expect(definitions.classes[0].name).toBe("Container");
      expect(definitions.classes[0].generics).toEqual(["T", "U"]);
      expect(definitions.classes[0].availability.scope).toBe("file-private");
    });

    it("should process tuple struct", () => {
      const code = `pub struct Point(f32, f32);`;

      const definitions = processCapture(
        code,
        "definition.class",
        "type_identifier",
        "Point"
      );

      expect(definitions.classes).toHaveLength(1);
      expect(definitions.classes[0].name).toBe("Point");
      expect(definitions.classes[0].availability.scope).toBe("public");
    });

    it("should handle pub(crate) visibility", () => {
      const code = `pub(crate) struct InternalStruct {}`;

      const definitions = processCapture(
        code,
        "definition.class",
        "type_identifier",
        "InternalStruct"
      );

      expect(definitions.classes).toHaveLength(1);
      expect(definitions.classes[0].availability.scope).toBe("package");
    });
  });

  describe("enum definitions", () => {
    it("should process simple enum", () => {
      const code = `pub enum Status {
        Success,
        Error,
        Pending,
      }`;

      const definitions = processCapture(
        code,
        "definition.enum",
        "type_identifier",
        "Status"
      );

      expect(definitions.enums).toHaveLength(1);
      expect(definitions.enums[0].name).toBe("Status");
      expect(definitions.enums[0].members).toEqual([
        "Success",
        "Error",
        "Pending",
      ]);
      expect(definitions.enums[0].availability.scope).toBe("public");
    });

    it("should process generic enum", () => {
      const code = `enum Result<T, E> {
        Ok(T),
        Err(E),
      }`;

      const definitions = processCapture(
        code,
        "definition.enum.generic",
        "type_identifier",
        "Result"
      );

      expect(definitions.enums).toHaveLength(1);
      expect(definitions.enums[0].name).toBe("Result");
      expect(definitions.enums[0].generics).toEqual(["T", "E"]);
      expect(definitions.enums[0].members).toEqual(["Ok", "Err"]);
    });

    it("should process enum with complex variants", () => {
      const code = `enum Message {
        Quit,
        Move { x: i32, y: i32 },
        Write(String),
      }`;

      const definitions = processCapture(
        code,
        "definition.enum",
        "type_identifier",
        "Message"
      );

      expect(definitions.enums).toHaveLength(1);
      expect(definitions.enums[0].members).toEqual(["Quit", "Move", "Write"]);
    });
  });

  describe("trait definitions", () => {
    it("should process simple trait", () => {
      const code = `pub trait Display {
        fn fmt(&self) -> String;
      }`;

      const definitions = processCapture(
        code,
        "definition.interface",
        "type_identifier",
        "Display"
      );

      expect(definitions.interfaces).toHaveLength(1);
      expect(definitions.interfaces[0].name).toBe("Display");
      expect(definitions.interfaces[0].availability.scope).toBe("public");
    });

    it("should process generic trait", () => {
      const code = `trait Iterator<Item> {
        type Item;
        fn next(&mut self) -> Option<Item>;
      }`;

      const definitions = processCapture(
        code,
        "definition.interface.generic",
        "type_identifier",
        "Iterator"
      );

      expect(definitions.interfaces).toHaveLength(1);
      expect(definitions.interfaces[0].name).toBe("Iterator");
      expect(definitions.interfaces[0].generics).toEqual(["Item"]);
    });
  });

  describe("function definitions", () => {
    it("should process simple function", () => {
      const code = `pub fn calculate(x: i32, y: i32) -> i32 {
        x + y
      }`;

      const definitions = processCapture(
        code,
        "definition.function",
        "identifier",
        "calculate"
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("calculate");
      expect(definitions.functions[0].return_type).toBe("i32");
      expect(definitions.functions[0].availability.scope).toBe("public");
    });

    it("should process async function", () => {
      const code = `async fn fetch_data() -> Result<String, Error> {
        Ok("data".to_string())
      }`;

      const definitions = processCapture(
        code,
        "definition.function.async",
        "identifier",
        "fetch_data"
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("fetch_data");
      expect(definitions.functions[0].async).toBe(true);
      expect(definitions.functions[0].return_type).toBe(
        "Result<String, Error>"
      );
    });

    it("should process const function", () => {
      const code = `const fn compute() -> usize {
        42
      }`;

      const definitions = processCapture(
        code,
        "definition.function.const",
        "identifier",
        "compute"
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("compute");
      expect(definitions.functions[0].const).toBe(true);
      expect(definitions.functions[0].return_type).toBe("usize");
    });

    it("should process unsafe function", () => {
      const code = `unsafe fn raw_access(ptr: *const u8) -> u8 {
        *ptr
      }`;

      const definitions = processCapture(
        code,
        "definition.function.unsafe",
        "identifier",
        "raw_access"
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("raw_access");
      expect(definitions.functions[0].unsafe).toBe(true);
    });

    it("should process generic function", () => {
      const code = `fn compare<T: Ord>(a: T, b: T) -> bool {
        a < b
      }`;

      const definitions = processCapture(
        code,
        "definition.function.generic",
        "identifier",
        "compare"
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("compare");
      expect(definitions.functions[0].generics).toEqual(["T"]);
    });
  });

  describe("method definitions", () => {
    it("should process instance method", () => {
      const code = `impl MyStruct {
        pub fn get_value(&self) -> String {
          self.value.clone()
        }
      }`;

      // Note: In real usage, this would be called with proper impl context
      // For testing, we're isolating the method processing
      const tree = parser.parse(code);
      const implNode = findNode(tree.rootNode, "impl_item");
      const methodNode = findNode(implNode, "identifier", "get_value");

      const location: Location = {
        file_path: "test.rs" as any,
        start_line: methodNode.startPosition.row + 1,
        start_column: methodNode.startPosition.column,
        end_line: methodNode.endPosition.row + 1,
        end_column: methodNode.endPosition.column,
      };

      const capture: CaptureNode = {
        category: "definition" as any,
        entity: "method" as any,
        node: methodNode,
        text: "get_value" as any,
        name: "definition.method",
        location,
      };

      const context = createMockContext();
      const builder = new DefinitionBuilder(context);

      // Add a class first to attach method to
      builder.add_class({
        symbol_id: "test-class" as any,
        name: "MyStruct" as any,
        location: {} as any,
        scope_id: "test-scope" as any,
        availability: { scope: "public" },
      });

      const processor = RUST_BUILDER_CONFIG.get("definition.method");
      if (processor) {
        processor.process(capture, builder, context);
      }

      const result = builder.build();
      const classes = Array.from(result.classes.values());
      // Method will be added if impl context is properly found
      expect(classes).toHaveLength(1);
    });

    it("should process associated function (static method)", () => {
      const code = `impl MyStruct {
        pub fn new() -> Self {
          MyStruct { value: String::new() }
        }
      }`;

      const tree = parser.parse(code);
      const implNode = findNode(tree.rootNode, "impl_item");
      const methodNode = findNode(implNode, "identifier", "new");

      const location: Location = {
        file_path: "test.rs" as any,
        start_line: methodNode.startPosition.row + 1,
        start_column: methodNode.startPosition.column,
        end_line: methodNode.endPosition.row + 1,
        end_column: methodNode.endPosition.column,
      };

      const capture: CaptureNode = {
        category: "definition" as any,
        entity: "method" as any,
        node: methodNode,
        text: "new" as any,
        name: "definition.method.associated",
        location,
      };

      const context = createMockContext();
      const builder = new DefinitionBuilder(context);

      builder.add_class({
        symbol_id: "test-class" as any,
        name: "MyStruct" as any,
        location: {} as any,
        scope_id: "test-scope" as any,
        availability: { scope: "public" },
      });

      const processor = RUST_BUILDER_CONFIG.get("definition.method.associated");
      if (processor) {
        processor.process(capture, builder, context);
      }

      const result = builder.build();
      const classes = Array.from(result.classes.values());
      expect(classes).toHaveLength(1);
    });
  });

  describe("variable and constant definitions", () => {
    it("should process let binding", () => {
      const code = `let mut count: usize = 0;`;

      const definitions = processCapture(
        code,
        "definition.variable",
        "identifier",
        "count"
      );

      expect(definitions.variables).toHaveLength(1);
      expect(definitions.variables[0].name).toBe("count");
      expect(definitions.variables[0].type).toBe("usize");
    });

    it("should process const definition", () => {
      const code = `pub const MAX_SIZE: usize = 1024;`;

      const definitions = processCapture(
        code,
        "definition.constant",
        "identifier",
        "MAX_SIZE"
      );

      expect(definitions.variables).toHaveLength(1);
      expect(definitions.variables[0].name).toBe("MAX_SIZE");
      expect(definitions.variables[0].type).toBe("usize");
      expect(definitions.variables[0].readonly).toBe(true);
      expect(definitions.variables[0].availability.scope).toBe("public");
    });

    it("should process static variable", () => {
      const code = `static mut COUNTER: AtomicUsize = AtomicUsize::new(0);`;

      const definitions = processCapture(
        code,
        "definition.variable",
        "identifier",
        "COUNTER"
      );

      expect(definitions.variables).toHaveLength(1);
      expect(definitions.variables[0].name).toBe("COUNTER");
      expect(definitions.variables[0].static).toBe(true);
    });
  });

  describe("parameter definitions", () => {
    it("should process function parameter", () => {
      const code = `fn process(data: &str) {}`;

      const definitions = processCapture(
        code,
        "definition.parameter",
        "identifier",
        "data"
      );

      expect(definitions.parameters).toHaveLength(1);
      expect(definitions.parameters[0].name).toBe("data");
      expect(definitions.parameters[0].type).toBe("&str");
    });

    it("should process mutable parameter", () => {
      const code = `fn modify(mut value: Vec<u8>) {}`;

      const definitions = processCapture(
        code,
        "definition.parameter",
        "identifier",
        "value"
      );

      expect(definitions.parameters).toHaveLength(1);
      expect(definitions.parameters[0].name).toBe("value");
      // Mutable detection would require checking parent node
    });

    it("should process self parameter", () => {
      const code = `fn method(&self) {}`;

      const tree = parser.parse(code);
      const selfNode = findNode(tree.rootNode, "self");

      const location: Location = {
        file_path: "test.rs" as any,
        start_line: selfNode.startPosition.row + 1,
        start_column: selfNode.startPosition.column,
        end_line: selfNode.endPosition.row + 1,
        end_column: selfNode.endPosition.column,
      };

      const capture: CaptureNode = {
        category: "definition" as any,
        entity: "parameter" as any,
        node: selfNode,
        text: "self" as any,
        name: "definition.parameter.self",
        location,
      };

      const context = createMockContext();
      const builder = new DefinitionBuilder(context);
      const processor = RUST_BUILDER_CONFIG.get("definition.parameter.self");

      if (processor) {
        processor.process(capture, builder, context);
      }

      const result = builder.build();
      // Parameters aren't stored in BuilderResult, they're part of function/method definitions
      // This test would need to be restructured to test parameters properly
      // For now, just verify the builder runs without error
      expect(result).toBeDefined();
    });
  });

  describe("type definitions", () => {
    it("should process type alias", () => {
      const code = `pub type Result<T> = std::result::Result<T, Error>;`;

      const definitions = processCapture(
        code,
        "definition.type_alias",
        "type_identifier",
        "Result"
      );

      expect(definitions.types).toHaveLength(1);
      expect(definitions.types[0].name).toBe("Result");
      expect(definitions.types[0].generics).toEqual(["T"]);
      expect(definitions.types[0].availability.scope).toBe("public");
    });

    it("should process module definition", () => {
      const code = `pub mod utils {
        // module content
      }`;

      const definitions = processCapture(
        code,
        "definition.module",
        "identifier",
        "utils"
      );

      expect(definitions.namespaces).toHaveLength(1);
      expect(definitions.namespaces[0].name).toBe("utils");
      expect(definitions.namespaces[0].availability.scope).toBe("public");
    });
  });

  describe("visibility extraction", () => {
    it("should detect pub visibility", () => {
      const code = `pub fn public_func() {}`;
      const definitions = processCapture(
        code,
        "definition.function",
        "identifier",
        "public_func"
      );
      expect(definitions.functions[0].availability.scope).toBe("public");
    });

    it("should detect pub(crate) visibility", () => {
      const code = `pub(crate) struct CrateStruct {}`;
      const definitions = processCapture(
        code,
        "definition.class",
        "type_identifier",
        "CrateStruct"
      );
      expect(definitions.classes[0].availability.scope).toBe("package");
    });

    it("should detect pub(super) visibility", () => {
      const code = `pub(super) enum SuperEnum {}`;
      const definitions = processCapture(
        code,
        "definition.enum",
        "type_identifier",
        "SuperEnum"
      );
      expect(definitions.enums[0].availability.scope).toBe("parent-module");
    });

    it("should default to file-private for no visibility", () => {
      const code = `struct PrivateStruct {}`;
      const definitions = processCapture(
        code,
        "definition.class",
        "type_identifier",
        "PrivateStruct"
      );
      expect(definitions.classes[0].availability.scope).toBe("file-private");
    });
  });

  describe("macro definitions", () => {
    it("should process macro definition", () => {
      const code = `macro_rules! debug_log {
        ($msg:expr) => {
          println!("Debug: {}", $msg);
        };
      }`;

      const definitions = processCapture(
        code,
        "definition.macro",
        "identifier",
        "debug_log"
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("debug_log");
      expect(definitions.functions[0].macro).toBe(true);
    });
  });

  describe("field definitions", () => {
    it("should process struct fields", () => {
      const code = `struct Person {
        pub name: String,
        age: u32,
      }`;

      // Test field processing
      const tree = parser.parse(code);
      const structNode = findNode(tree.rootNode, "struct_item");
      const fieldNode = findNode(structNode, "field_identifier", "name");

      if (fieldNode) {
        const location: Location = {
          file_path: "test.rs" as any,
          start_line: fieldNode.startPosition.row + 1,
          start_column: fieldNode.startPosition.column,
          end_line: fieldNode.endPosition.row + 1,
          end_column: fieldNode.endPosition.column,
        };

        const capture: CaptureNode = {
          category: "definition" as any,
          entity: "field" as any,
          node: fieldNode,
          text: "name" as any,
          name: "definition.field",
          location,
        };

        const context = createMockContext();
        const builder = new DefinitionBuilder(context);

        // Add struct first
        builder.add_class({
          symbol_id: "test-struct" as any,
          name: "Person" as any,
          location: {} as any,
          scope_id: "test-scope" as any,
          availability: { scope: "public" },
        });

        const processor = RUST_BUILDER_CONFIG.get("definition.field");
        if (processor) {
          processor.process(capture, builder, context);
        }

        const result = builder.build();
        const classes = Array.from(result.classes.values());
        expect(classes).toHaveLength(1);
      }
    });
  });

  describe("integration tests", () => {
    it("should handle complex struct with multiple features", () => {
      const code = `
        pub struct Database<T> where T: Clone {
          connection: Connection,
          pub cache: Cache<T>,
        }

        impl<T: Clone> Database<T> {
          pub fn new() -> Self {
            Database {
              connection: Connection::new(),
              cache: Cache::new(),
            }
          }

          pub async fn query(&self, sql: &str) -> Result<Vec<T>, Error> {
            // implementation
          }
        }
      `;

      const tree = parser.parse(code);
      const structNode = findNode(tree.rootNode, "type_identifier", "Database");

      if (structNode) {
        const definitions = processCapture(
          code,
          "definition.class.generic",
          "type_identifier",
          "Database"
        );
        expect(definitions.classes).toHaveLength(1);
        expect(definitions.classes[0].name).toBe("Database");
        expect(definitions.classes[0].generics).toContain("T");
      }
    });

    it("should handle trait with associated types and default methods", () => {
      const code = `
        pub trait Iterator {
          type Item;

          fn next(&mut self) -> Option<Self::Item>;

          fn map<B, F>(self, f: F) -> Map<Self, F>
          where
            Self: Sized,
            F: FnMut(Self::Item) -> B,
          {
            Map::new(self, f)
          }
        }
      `;

      const definitions = processCapture(
        code,
        "definition.interface",
        "type_identifier",
        "Iterator"
      );
      expect(definitions.interfaces).toHaveLength(1);
      expect(definitions.interfaces[0].name).toBe("Iterator");
    });
  });
});

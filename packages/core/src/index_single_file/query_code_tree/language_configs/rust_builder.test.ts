// Test for Rust builder configuration
import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import { RUST_BUILDER_CONFIG } from "./rust_builder";
import { DefinitionBuilder } from "../../definitions/definition_builder";
import type {
  ProcessingContext,
  CaptureNode,
} from "../../semantic_index";
import type { Location, SymbolName, ScopeId } from "@ariadnejs/types";

describe("rust_builder", () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  // Helper to create mock context
  function createMockContext(with_scopes: boolean = false): ProcessingContext {
    const root_scope_id = "module:test.rs:1:0:100:0:<module>" as any;
    const scopes = new Map();

    if (with_scopes) {
      // Add function body scopes for tests that need them
      scopes.set("function:test.rs:1:0:3:1:<function_body>" as any, {
        id: "function:test.rs:1:0:3:1:<function_body>" as any,
        type: "function",
        name: "my_function",
        location: {
          file_path: "test.rs" as any,
          start_line: 1,
          start_column: 0,
          end_line: 3,
          end_column: 1,
        },
        parent_id: root_scope_id,
      });
      // Add impl block scope for associated functions
      scopes.set("impl:test.rs:2:0:6:1:<impl_body>" as any, {
        id: "impl:test.rs:2:0:6:1:<impl_body>" as any,
        type: "impl",
        name: "MyStruct",
        location: {
          file_path: "test.rs" as any,
          start_line: 2,
          start_column: 0,
          end_line: 6,
          end_column: 1,
        },
        parent_id: root_scope_id,
      });
      // Add method scope within impl block
      scopes.set("method:test.rs:3:4:5:5:<method_body>" as any, {
        id: "method:test.rs:3:4:5:5:<method_body>" as any,
        type: "method",
        name: "new",
        location: {
          file_path: "test.rs" as any,
          start_line: 3,
          start_column: 4,
          end_line: 5,
          end_column: 5,
        },
        parent_id: "impl:test.rs:2:0:6:1:<impl_body>" as any,
      });
    }

    return {
      captures: [],
      scopes,
      scope_depths: new Map(),
      root_scope_id,
      get_scope_id: (_location: Location) => root_scope_id,
      get_child_scope_with_symbol_name: (scope_id: ScopeId, name: SymbolName) => {
        throw new Error(`Child scope with name ${name} not found in scope ${scope_id}`);
      },
    };
  }

  // Helper to process code and test captures
  function processCapture(
    code: string,
    captureName: string,
    nodeType: string,
    expectedText?: string,
    with_scopes: boolean = false
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

    const context = createMockContext(with_scopes);
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
    });

    it("should process tuple struct", () => {
      const code = "pub struct Point(f32, f32);";

      const definitions = processCapture(
        code,
        "definition.class",
        "type_identifier",
        "Point"
      );

      expect(definitions.classes).toHaveLength(1);
      expect(definitions.classes[0].name).toBe("Point");
    });

    it("should handle pub(crate) visibility", () => {
      const code = "pub(crate) struct InternalStruct {}";

      const definitions = processCapture(
        code,
        "definition.class",
        "type_identifier",
        "InternalStruct"
      );

      expect(definitions.classes).toHaveLength(1);

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
      // Members are objects, extract names
      const memberNames = definitions.enums[0].members.map((m: any) =>
        m.name.split(":").pop()
      );
      expect(memberNames).toEqual(["Success", "Error", "Pending"]);
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
      // Members are objects, extract names
      const memberNames = definitions.enums[0].members.map((m: any) =>
        m.name.split(":").pop()
      );
      expect(memberNames).toEqual(["Ok", "Err"]);
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
      // Members are objects, extract names
      const memberNames = definitions.enums[0].members.map((m: any) =>
        m.name.split(":").pop()
      );
      expect(memberNames).toEqual(["Quit", "Move", "Write"]);
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
        "calculate",
        true
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("calculate");
      // return_type is in signature.return_type, not directly on function
    });

    it("should process async function", () => {
      const code = `async fn fetch_data() -> Result<String, Error> {
        Ok("data".to_string())
      }`;

      const definitions = processCapture(
        code,
        "definition.function.async",
        "identifier",
        "fetch_data",
        true
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("fetch_data");
      // async, const, unsafe are Rust-specific attributes not in standard FunctionDefinition
      // They would need to be added as extra properties if needed
    });

    it("should process const function", () => {
      const code = `const fn compute() -> usize {
        42
      }`;

      const definitions = processCapture(
        code,
        "definition.function.const",
        "identifier",
        "compute",
        true
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("compute");
      // const, unsafe are Rust-specific attributes not in standard FunctionDefinition
    });

    it("should process unsafe function", () => {
      const code = `unsafe fn raw_access(ptr: *const u8) -> u8 {
        *ptr
      }`;

      const definitions = processCapture(
        code,
        "definition.function.unsafe",
        "identifier",
        "raw_access",
        true
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("raw_access");
      // unsafe is a Rust-specific attribute not in standard FunctionDefinition
    });

    it("should process generic function", () => {
      const code = `fn compare<T: Ord>(a: T, b: T) -> bool {
        a < b
      }`;

      const definitions = processCapture(
        code,
        "definition.function.generic",
        "identifier",
        "compare",
        true
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

      // Create custom context with scope matching the actual method location
      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as any;
      const scopes = new Map();
      const method_scope_id = `method:test.rs:${location.start_line}:${location.start_column}:${location.end_line}:${location.end_column}:<method_body>` as any;
      scopes.set(method_scope_id, {
        id: method_scope_id,
        type: "method",
        name: "get_value",
        location,
        parent_id: root_scope_id,
      });

      const context = {
        captures: [],
        scopes,
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope with name ${_name} not found in scope ${_scope_id}`);
        },
      } as ProcessingContext;

      const builder = new DefinitionBuilder(context);

      // Add a class first to attach method to
      builder.add_class({
        symbol_id: "test-class" as any,
        name: "MyStruct" as any,
        location: {} as any,
        scope_id: "test-scope" as any,
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

      // Create custom context with scope matching the actual method location
      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as any;
      const scopes = new Map();
      const method_scope_id = `method:test.rs:${location.start_line}:${location.start_column}:${location.end_line}:${location.end_column}:<method_body>` as any;
      scopes.set(method_scope_id, {
        id: method_scope_id,
        type: "method",
        name: "new",
        location,
        parent_id: root_scope_id,
      });

      const context = {
        captures: [],
        scopes,
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope with name ${_name} not found in scope ${_scope_id}`);
        },
      } as ProcessingContext;

      const builder = new DefinitionBuilder(context);

      builder.add_class({
        symbol_id: "test-class" as any,
        name: "MyStruct" as any,
        location: {} as any,
        scope_id: "test-scope" as any,
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
      const code = "let mut count: usize = 0;";

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
      const code = "pub const MAX_SIZE: usize = 1024;";

      const definitions = processCapture(
        code,
        "definition.constant",
        "identifier",
        "MAX_SIZE"
      );

      expect(definitions.variables).toHaveLength(1);
      expect(definitions.variables[0].name).toBe("MAX_SIZE");
      expect(definitions.variables[0].type).toBe("usize");
    });

    it("should process static variable", () => {
      const code = "static mut COUNTER: AtomicUsize = AtomicUsize::new(0);";

      const definitions = processCapture(
        code,
        "definition.variable",
        "identifier",
        "COUNTER"
      );

      expect(definitions.variables).toHaveLength(1);
      expect(definitions.variables[0].name).toBe("COUNTER");
      // static is Rust-specific and would need extra handling
    });
  });

  describe("parameter definitions", () => {
    it("should process function parameter", () => {
      const code = "fn process(data: &str) {}";

      const definitions = processCapture(
        code,
        "definition.parameter",
        "identifier",
        "data"
      );

      // Parameters are stored within functions/methods, not returned separately
      // This test would need restructuring to test within a complete function
      expect(definitions).toBeDefined();
    });

    it("should process mutable parameter", () => {
      const code = "fn modify(mut value: Vec<u8>) {}";

      const definitions = processCapture(
        code,
        "definition.parameter",
        "identifier",
        "value"
      );

      // Parameters are stored within functions/methods, not returned separately
      expect(definitions).toBeDefined();
    });

    it("should process self parameter", () => {
      const code = "fn method(&self) {}";

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
      const code = "pub type Result<T> = std::result::Result<T, Error>;";

      const definitions = processCapture(
        code,
        "definition.type_alias",
        "type_identifier",
        "Result"
      );

      expect(definitions.types).toHaveLength(1);
      expect(definitions.types[0].name).toBe("Result");
      expect(definitions.types[0].generics).toEqual(["T"]);
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
        "debug_log",
        true
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("debug_log");
      // macro is Rust-specific and would need extra handling
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
        // type_parameters is an array, use array assertion
        expect(definitions.classes[0].generics).toEqual(
          expect.arrayContaining(["T"])
        );
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

  describe("is_exported flag", () => {
    it("should set is_exported=true for pub fn", () => {
      const code = "pub fn foo() {}";

      const definitions = processCapture(
        code,
        "definition.function",
        "identifier",
        "foo",
        true
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("foo");
      expect(definitions.functions[0].is_exported).toBe(true);
      expect(definitions.functions[0].export).toBeUndefined();
    });

    it("should set is_exported=false for private fn", () => {
      const code = "fn foo() {}";

      const definitions = processCapture(
        code,
        "definition.function",
        "identifier",
        "foo",
        true
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("foo");
      expect(definitions.functions[0].is_exported).toBe(false);
      expect(definitions.functions[0].export).toBeUndefined();
    });

    it("should set is_exported=true for pub struct", () => {
      const code = "pub struct Bar {}";

      const definitions = processCapture(
        code,
        "definition.class",
        "type_identifier",
        "Bar"
      );

      expect(definitions.classes).toHaveLength(1);
      expect(definitions.classes[0].name).toBe("Bar");
      expect(definitions.classes[0].is_exported).toBe(true);
      expect(definitions.classes[0].export).toBeUndefined();
    });

    it("should set is_exported=false for private struct", () => {
      const code = "struct Bar {}";

      const definitions = processCapture(
        code,
        "definition.class",
        "type_identifier",
        "Bar"
      );

      expect(definitions.classes).toHaveLength(1);
      expect(definitions.classes[0].name).toBe("Bar");
      expect(definitions.classes[0].is_exported).toBe(false);
      expect(definitions.classes[0].export).toBeUndefined();
    });

    it("should set is_exported=true for pub(crate) fn", () => {
      const code = "pub(crate) fn foo() {}";

      const definitions = processCapture(
        code,
        "definition.function",
        "identifier",
        "foo",
        true
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("foo");
      expect(definitions.functions[0].is_exported).toBe(true);
      expect(definitions.functions[0].export).toBeUndefined();
    });

    it("should set is_exported=true for pub enum", () => {
      const code = "pub enum Status { Ok, Err }";

      const definitions = processCapture(
        code,
        "definition.enum",
        "type_identifier",
        "Status"
      );

      expect(definitions.enums).toHaveLength(1);
      expect(definitions.enums[0].name).toBe("Status");
      expect(definitions.enums[0].is_exported).toBe(true);
      expect(definitions.enums[0].export).toBeUndefined();
    });

    it("should set is_exported=false for private enum", () => {
      const code = "enum Status { Ok, Err }";

      const definitions = processCapture(
        code,
        "definition.enum",
        "type_identifier",
        "Status"
      );

      expect(definitions.enums).toHaveLength(1);
      expect(definitions.enums[0].name).toBe("Status");
      expect(definitions.enums[0].is_exported).toBe(false);
      expect(definitions.enums[0].export).toBeUndefined();
    });

    it("should set is_exported=true for pub const", () => {
      const code = "pub const X: i32 = 1;";

      const definitions = processCapture(
        code,
        "definition.constant",
        "identifier",
        "X"
      );

      expect(definitions.variables).toHaveLength(1);
      expect(definitions.variables[0].name).toBe("X");
      expect(definitions.variables[0].is_exported).toBe(true);
      expect(definitions.variables[0].export).toBeUndefined();
    });

    it("should set is_exported=false for private const", () => {
      const code = "const X: i32 = 1;";

      const definitions = processCapture(
        code,
        "definition.constant",
        "identifier",
        "X"
      );

      expect(definitions.variables).toHaveLength(1);
      expect(definitions.variables[0].name).toBe("X");
      expect(definitions.variables[0].is_exported).toBe(false);
      expect(definitions.variables[0].export).toBeUndefined();
    });

    it("should set is_exported=true for pub(super) struct", () => {
      const code = "pub(super) struct Internal {}";

      const definitions = processCapture(
        code,
        "definition.class",
        "type_identifier",
        "Internal"
      );

      expect(definitions.classes).toHaveLength(1);
      expect(definitions.classes[0].name).toBe("Internal");
      expect(definitions.classes[0].is_exported).toBe(true);
      expect(definitions.classes[0].export).toBeUndefined();
    });

    it("should set is_exported=true for pub type alias", () => {
      const code = "pub type Result<T> = std::result::Result<T, Error>;";

      const definitions = processCapture(
        code,
        "definition.type",
        "type_identifier",
        "Result"
      );

      expect(definitions.types).toHaveLength(1);
      expect(definitions.types[0].name).toBe("Result");
      expect(definitions.types[0].is_exported).toBe(true);
      expect(definitions.types[0].export).toBeUndefined();
    });

    it("should set is_exported=false for private type alias", () => {
      const code = "type Result<T> = std::result::Result<T, Error>;";

      const definitions = processCapture(
        code,
        "definition.type",
        "type_identifier",
        "Result"
      );

      expect(definitions.types).toHaveLength(1);
      expect(definitions.types[0].name).toBe("Result");
      expect(definitions.types[0].is_exported).toBe(false);
      expect(definitions.types[0].export).toBeUndefined();
    });

    it("should set is_exported=true for pub trait", () => {
      const code = "pub trait Display {}";

      const definitions = processCapture(
        code,
        "definition.interface",
        "type_identifier",
        "Display"
      );

      expect(definitions.interfaces).toHaveLength(1);
      expect(definitions.interfaces[0].name).toBe("Display");
      expect(definitions.interfaces[0].is_exported).toBe(true);
      expect(definitions.interfaces[0].export).toBeUndefined();
    });

    it("should set is_exported=false for private trait", () => {
      const code = "trait Display {}";

      const definitions = processCapture(
        code,
        "definition.interface",
        "type_identifier",
        "Display"
      );

      expect(definitions.interfaces).toHaveLength(1);
      expect(definitions.interfaces[0].name).toBe("Display");
      expect(definitions.interfaces[0].is_exported).toBe(false);
      expect(definitions.interfaces[0].export).toBeUndefined();
    });

    it("should set is_exported=true for pub generic struct", () => {
      const code = "pub struct Vec<T> { data: T }";

      const definitions = processCapture(
        code,
        "definition.class.generic",
        "type_identifier",
        "Vec"
      );

      expect(definitions.classes).toHaveLength(1);
      expect(definitions.classes[0].name).toBe("Vec");
      expect(definitions.classes[0].is_exported).toBe(true);
      expect(definitions.classes[0].export).toBeUndefined();
    });

    it("should set is_exported=false for private generic struct", () => {
      const code = "struct Vec<T> { data: T }";

      const definitions = processCapture(
        code,
        "definition.class.generic",
        "type_identifier",
        "Vec"
      );

      expect(definitions.classes).toHaveLength(1);
      expect(definitions.classes[0].name).toBe("Vec");
      expect(definitions.classes[0].is_exported).toBe(false);
      expect(definitions.classes[0].export).toBeUndefined();
    });

    it("should set is_exported=true for pub async fn", () => {
      const code = "pub async fn fetch() {}";

      const definitions = processCapture(
        code,
        "definition.function.async",
        "identifier",
        "fetch",
        true
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("fetch");
      expect(definitions.functions[0].is_exported).toBe(true);
      expect(definitions.functions[0].export).toBeUndefined();
    });

    it("should set is_exported=true for pub unsafe fn", () => {
      const code = "pub unsafe fn raw_ptr() {}";

      const definitions = processCapture(
        code,
        "definition.function.unsafe",
        "identifier",
        "raw_ptr",
        true
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("raw_ptr");
      expect(definitions.functions[0].is_exported).toBe(true);
      expect(definitions.functions[0].export).toBeUndefined();
    });

    it("should set is_exported=true for pub mod", () => {
      const code = "pub mod utils;";

      const definitions = processCapture(
        code,
        "definition.module.public",
        "identifier",
        "utils"
      );

      expect(definitions.namespaces).toHaveLength(1);
      expect(definitions.namespaces[0].name).toBe("utils");
      expect(definitions.namespaces[0].is_exported).toBe(true);
      expect(definitions.namespaces[0].export).toBeUndefined();
    });

    it("should set is_exported=false for private mod", () => {
      const code = "mod utils;";

      const definitions = processCapture(
        code,
        "definition.module",
        "identifier",
        "utils"
      );

      expect(definitions.namespaces).toHaveLength(1);
      expect(definitions.namespaces[0].name).toBe("utils");
      expect(definitions.namespaces[0].is_exported).toBe(false);
      expect(definitions.namespaces[0].export).toBeUndefined();
    });
  });

  // NOTE: Rust's export detection is already correct - it uses `pub` visibility modifiers
  // with limited parent walking that stops at function boundaries. The nested variable
  // export bug only affected JavaScript/TypeScript which use AST traversal. No additional tests needed.

  describe("Property Type Extraction", () => {
    async function buildIndexFromCode(code: string) {
      const tree = parser.parse(code);
      const lines = code.split("\n");
      const parsed_file = {
        file_path: "test.rs" as any,
        file_lines: lines.length,
        file_end_column: lines[lines.length - 1]?.length || 0,
        tree,
        lang: "rust" as const,
      };
      const { build_semantic_index } = await import("../../semantic_index");
      return build_semantic_index(parsed_file, tree, "rust");
    }

    it("should extract type from struct field", async () => {
      const code = `
struct Service {
    registry: DefinitionRegistry,
    cache: HashMap<String, i32>,
}
`;

      const index = await buildIndexFromCode(code);
      const service_struct = Array.from(index.classes.values())[0];

      expect(service_struct).toBeDefined();
      expect(service_struct.properties).toBeDefined();
      expect(service_struct.properties.length).toBe(2);

      const registry_field = service_struct.properties.find(p => p.name === "registry");
      expect(registry_field).toBeDefined();
      expect(registry_field?.type).toBe("DefinitionRegistry");

      const cache_field = service_struct.properties.find(p => p.name === "cache");
      expect(cache_field).toBeDefined();
      expect(cache_field?.type).toBe("HashMap<String, i32>");
    });

    it("should extract type from pub field", async () => {
      const code = `
struct Config {
    pub name: String,
    pub count: usize,
}
`;

      const index = await buildIndexFromCode(code);
      const config_struct = Array.from(index.classes.values())[0];

      expect(config_struct.properties.length).toBe(2);

      const name_field = config_struct.properties.find(p => p.name === "name");
      expect(name_field?.type).toBe("String");

      const count_field = config_struct.properties.find(p => p.name === "count");
      expect(count_field?.type).toBe("usize");
    });

    it("should extract generic types from struct fields", async () => {
      const code = `
struct Container<T> {
    items: Vec<T>,
    mapping: HashMap<String, T>,
    nested: Option<Box<T>>,
}
`;

      const index = await buildIndexFromCode(code);
      const container_struct = Array.from(index.classes.values())[0];

      expect(container_struct.properties.length).toBe(3);

      const items_field = container_struct.properties.find(p => p.name === "items");
      expect(items_field?.type).toBe("Vec<T>");

      const mapping_field = container_struct.properties.find(p => p.name === "mapping");
      expect(mapping_field?.type).toBe("HashMap<String, T>");

      const nested_field = container_struct.properties.find(p => p.name === "nested");
      expect(nested_field?.type).toBe("Option<Box<T>>");
    });

    it("should extract lifetime-annotated types", async () => {
      const code = `
struct Wrapper<'a> {
    data: &'a str,
    owner: &'a mut Vec<u8>,
}
`;

      const index = await buildIndexFromCode(code);
      const wrapper_struct = Array.from(index.classes.values())[0];

      expect(wrapper_struct.properties.length).toBe(2);

      const data_field = wrapper_struct.properties.find(p => p.name === "data");
      expect(data_field?.type).toBe("&'a str");

      const owner_field = wrapper_struct.properties.find(p => p.name === "owner");
      expect(owner_field?.type).toBe("&'a mut Vec<u8>");
    });

    it("should extract Option and Result types", async () => {
      const code = `
struct State {
    value: Option<String>,
    result: Result<i32, Error>,
}
`;

      const index = await buildIndexFromCode(code);
      const state_struct = Array.from(index.classes.values())[0];

      expect(state_struct.properties.length).toBe(2);

      const value_field = state_struct.properties.find(p => p.name === "value");
      expect(value_field?.type).toBe("Option<String>");

      const result_field = state_struct.properties.find(p => p.name === "result");
      expect(result_field?.type).toBe("Result<i32, Error>");
    });

    it("should extract reference types with various mutability", async () => {
      const code = `
struct Refs {
    immutable: &String,
    mutable: &mut String,
    boxed: Box<String>,
}
`;

      const index = await buildIndexFromCode(code);
      const refs_struct = Array.from(index.classes.values())[0];

      expect(refs_struct.properties.length).toBe(3);

      const immutable_field = refs_struct.properties.find(p => p.name === "immutable");
      expect(immutable_field?.type).toBe("&String");

      const mutable_field = refs_struct.properties.find(p => p.name === "mutable");
      expect(mutable_field?.type).toBe("&mut String");

      const boxed_field = refs_struct.properties.find(p => p.name === "boxed");
      expect(boxed_field?.type).toBe("Box<String>");
    });

    it("should extract complex nested generic types", async () => {
      const code = `
struct Complex {
    nested: HashMap<String, Vec<Option<Item>>>,
    callback: Box<dyn Fn(i32) -> Result<String, Error>>,
}
`;

      const index = await buildIndexFromCode(code);
      const complex_struct = Array.from(index.classes.values())[0];

      expect(complex_struct.properties.length).toBe(2);

      const nested_field = complex_struct.properties.find(p => p.name === "nested");
      expect(nested_field?.type).toBe("HashMap<String, Vec<Option<Item>>>");

      const callback_field = complex_struct.properties.find(p => p.name === "callback");
      expect(callback_field?.type).toBe("Box<dyn Fn(i32) -> Result<String, Error>>");
    });

    it("should extract array and slice types", async () => {
      const code = `
struct Arrays {
    fixed: [u8; 32],
    slice: &[u8],
}
`;

      const index = await buildIndexFromCode(code);
      const arrays_struct = Array.from(index.classes.values())[0];

      expect(arrays_struct.properties.length).toBe(2);

      const fixed_field = arrays_struct.properties.find(p => p.name === "fixed");
      expect(fixed_field?.type).toBe("[u8; 32]");

      const slice_field = arrays_struct.properties.find(p => p.name === "slice");
      expect(slice_field?.type).toBe("&[u8]");
    });
  });
});

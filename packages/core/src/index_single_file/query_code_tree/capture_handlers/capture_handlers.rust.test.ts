// Test for Rust builder configuration
import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import { RUST_HANDLERS } from "./capture_handlers.rust";
import { detect_callback_context } from "../symbol_factories/symbol_factories.rust";
import { DefinitionBuilder } from "../../definitions/definitions";
import { build_index_single_file } from "../../index_single_file";
import type {
  ProcessingContext,
  CaptureNode,
} from "../../index_single_file";
import type { Location, SymbolName, ScopeId, FilePath } from "@ariadnejs/types";
import type { SyntaxNode } from "tree-sitter";
import { node_to_location } from "../../node_utils";

describe("rust_builder", () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  // Helper to create mock context
  function create_mock_context(with_scopes: boolean = false): ProcessingContext {
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
  function process_capture(
    code: string,
    capture_name: string,
    node_type: string,
    expected_text?: string,
    with_scopes: boolean = false
  ) {
    const tree = parser.parse(code);
    const node = find_node(tree.rootNode, node_type, expected_text);

    if (!node) {
      throw new Error(
        `Node of type ${node_type} with text "${expected_text}" not found`
      );
    }

    const location: Location = node_to_location(node, "test.rs" as FilePath);

    // Parse capture name to extract category and entity
    const parts = capture_name.split(".");
    const category = parts[0] as any;
    const entity = parts[1] as any;

    const capture: CaptureNode = {
      category,
      entity,
      name: capture_name,
      text: (expected_text || node.text) as any,
      location,
      node,
    };

    const context = create_mock_context(with_scopes);
    const builder = new DefinitionBuilder(context);
    const handler = RUST_HANDLERS[capture_name];

    if (!handler) {
      throw new Error(`No handler for capture ${capture_name}`);
    }

    handler(capture, builder, context);
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

  describe("struct definitions", () => {
    it("should process simple struct", () => {
      const code = `pub struct MyStruct {
        field1: String,
        field2: i32,
      }`;

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
        code,
        "definition.class",
        "type_identifier",
        "InternalStruct"
      );

      expect(definitions.classes).toHaveLength(1);
      expect(definitions.classes[0].name).toBe("InternalStruct");
      expect(definitions.classes[0].is_exported).toBe(true);
    });
  });

  describe("enum definitions", () => {
    it("should process simple enum", () => {
      const code = `pub enum Status {
        Success,
        Error,
        Pending,
      }`;

      const definitions = process_capture(
        code,
        "definition.enum",
        "type_identifier",
        "Status"
      );

      expect(definitions.enums).toHaveLength(1);
      expect(definitions.enums[0].name).toBe("Status");
      // Members are objects, extract names
      const member_names = definitions.enums[0].members.map((m: any) =>
        m.name.split(":").pop()
      );
      expect(member_names).toEqual(["Success", "Error", "Pending"]);
    });

    it("should process generic enum", () => {
      const code = `enum Result<T, E> {
        Ok(T),
        Err(E),
      }`;

      const definitions = process_capture(
        code,
        "definition.enum.generic",
        "type_identifier",
        "Result"
      );

      expect(definitions.enums).toHaveLength(1);
      expect(definitions.enums[0].name).toBe("Result");
      expect(definitions.enums[0].generics).toEqual(["T", "E"]);
      // Members are objects, extract names
      const member_names = definitions.enums[0].members.map((m: any) =>
        m.name.split(":").pop()
      );
      expect(member_names).toEqual(["Ok", "Err"]);
    });

    it("should process enum with complex variants", () => {
      const code = `enum Message {
        Quit,
        Move { x: i32, y: i32 },
        Write(String),
      }`;

      const definitions = process_capture(
        code,
        "definition.enum",
        "type_identifier",
        "Message"
      );

      expect(definitions.enums).toHaveLength(1);
      // Members are objects, extract names
      const member_names = definitions.enums[0].members.map((m: any) =>
        m.name.split(":").pop()
      );
      expect(member_names).toEqual(["Quit", "Move", "Write"]);
    });
  });

  describe("trait definitions", () => {
    it("should process simple trait", () => {
      const code = `pub trait Display {
        fn fmt(&self) -> String;
      }`;

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
        code,
        "definition.function",
        "identifier",
        "calculate",
        true
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("calculate");
      expect(definitions.functions[0].return_type).toBe("i32");
      expect(definitions.functions[0].is_exported).toBe(true);
    });

    it("should process async function", () => {
      const code = `async fn fetch_data() -> Result<String, Error> {
        Ok("data".to_string())
      }`;

      const definitions = process_capture(
        code,
        "definition.function.async",
        "identifier",
        "fetch_data",
        true
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("fetch_data");
      expect(definitions.functions[0].return_type).toBe("Result<String, Error>");
    });

    it("should process const function", () => {
      const code = `const fn compute() -> usize {
        42
      }`;

      const definitions = process_capture(
        code,
        "definition.function.const",
        "identifier",
        "compute",
        true
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("compute");
      expect(definitions.functions[0].return_type).toBe("usize");
    });

    it("should process unsafe function", () => {
      const code = `unsafe fn raw_access(ptr: *const u8) -> u8 {
        *ptr
      }`;

      const definitions = process_capture(
        code,
        "definition.function.unsafe",
        "identifier",
        "raw_access",
        true
      );

      expect(definitions.functions).toHaveLength(1);
      expect(definitions.functions[0].name).toBe("raw_access");
      expect(definitions.functions[0].return_type).toBe("u8");
    });

    it("should process generic function", () => {
      const code = `fn compare<T: Ord>(a: T, b: T) -> bool {
        a < b
      }`;

      const definitions = process_capture(
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
      const code = `struct MyStruct { value: String }
impl MyStruct {
    pub fn get_value(&self) -> String {
        self.value.clone()
    }
}`;

      const tree = parser.parse(code);
      const struct_node = find_node(tree.rootNode, "type_identifier", "MyStruct");
      const method_node = find_node(tree.rootNode, "identifier", "get_value");

      const struct_location = node_to_location(struct_node, "test.rs" as FilePath);
      const method_location = node_to_location(method_node, "test.rs" as FilePath);

      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as ScopeId;
      const context: ProcessingContext = {
        captures: [],
        scopes: new Map(),
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope with name ${_name} not found in scope ${_scope_id}`);
        },
      };

      const builder = new DefinitionBuilder(context);

      // Add struct first using the same tree's node
      const struct_capture: CaptureNode = {
        category: "definition" as any,
        entity: "class" as any,
        node: struct_node,
        text: "MyStruct" as SymbolName,
        name: "definition.class",
        location: struct_location,
      };
      RUST_HANDLERS["definition.class"](struct_capture, builder, context);

      // Now process the method
      const method_capture: CaptureNode = {
        category: "definition" as any,
        entity: "method" as any,
        node: method_node,
        text: "get_value" as SymbolName,
        name: "definition.method",
        location: method_location,
      };
      RUST_HANDLERS["definition.method"](method_capture, builder, context);

      const result = builder.build();
      const classes = Array.from(result.classes.values());
      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe("MyStruct");
      expect(classes[0].methods).toHaveLength(1);
      expect(classes[0].methods[0].name).toBe("get_value");
      expect(classes[0].methods[0].return_type).toBe("String");
    });

    it("should process associated function (static method)", () => {
      const code = `struct MyStruct { value: String }
impl MyStruct {
    pub fn new() -> Self {
        MyStruct { value: String::new() }
    }
}`;

      const tree = parser.parse(code);
      const struct_node = find_node(tree.rootNode, "type_identifier", "MyStruct");
      const method_node = find_node(tree.rootNode, "identifier", "new");

      const struct_location = node_to_location(struct_node, "test.rs" as FilePath);
      const method_location = node_to_location(method_node, "test.rs" as FilePath);

      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as ScopeId;
      const context: ProcessingContext = {
        captures: [],
        scopes: new Map(),
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope with name ${_name} not found in scope ${_scope_id}`);
        },
      };

      const builder = new DefinitionBuilder(context);

      // Add struct first
      const struct_capture: CaptureNode = {
        category: "definition" as any,
        entity: "class" as any,
        node: struct_node,
        text: "MyStruct" as SymbolName,
        name: "definition.class",
        location: struct_location,
      };
      RUST_HANDLERS["definition.class"](struct_capture, builder, context);

      // Now process the associated function
      const method_capture: CaptureNode = {
        category: "definition" as any,
        entity: "method" as any,
        node: method_node,
        text: "new" as SymbolName,
        name: "definition.method.associated",
        location: method_location,
      };
      RUST_HANDLERS["definition.method.associated"](method_capture, builder, context);

      const result = builder.build();
      const classes = Array.from(result.classes.values());
      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe("MyStruct");
      expect(classes[0].methods).toHaveLength(1);
      expect(classes[0].methods[0].name).toBe("new");
      expect(classes[0].methods[0].static).toBe(true);
      expect(classes[0].methods[0].return_type).toBe("Self");
    });
  });

  describe("variable and constant definitions", () => {
    it("should process let binding", () => {
      const code = "let mut count: usize = 0;";

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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
      const tree = parser.parse(code);

      const fn_node = find_node(tree.rootNode, "identifier", "process");
      const param_node = find_node(tree.rootNode, "identifier", "data");

      const fn_location = node_to_location(fn_node, "test.rs" as FilePath);
      const param_location = node_to_location(param_node, "test.rs" as FilePath);

      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as ScopeId;
      const context: ProcessingContext = {
        captures: [],
        scopes: new Map(),
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope not found`);
        },
      };

      const builder = new DefinitionBuilder(context);

      // Add function first
      const fn_capture: CaptureNode = {
        category: "definition" as any,
        entity: "function" as any,
        node: fn_node,
        text: "process" as SymbolName,
        name: "definition.function",
        location: fn_location,
      };
      RUST_HANDLERS["definition.function"](fn_capture, builder, context);

      // Now add parameter
      const param_capture: CaptureNode = {
        category: "definition" as any,
        entity: "parameter" as any,
        node: param_node,
        text: "data" as SymbolName,
        name: "definition.parameter",
        location: param_location,
      };
      RUST_HANDLERS["definition.parameter"](param_capture, builder, context);

      const result = builder.build();
      const functions = Array.from(result.functions.values());
      expect(functions).toHaveLength(1);
      expect(functions[0].name).toBe("process");
      expect(functions[0].signature.parameters).toHaveLength(1);
      expect(functions[0].signature.parameters[0].name).toBe("data");
      expect(functions[0].signature.parameters[0].type).toBe("&str");
    });

    it("should process mutable parameter", () => {
      const code = "fn modify(mut value: Vec<u8>) {}";
      const tree = parser.parse(code);

      const fn_node = find_node(tree.rootNode, "identifier", "modify");
      const param_node = find_node(tree.rootNode, "identifier", "value");

      const fn_location = node_to_location(fn_node, "test.rs" as FilePath);
      const param_location = node_to_location(param_node, "test.rs" as FilePath);

      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as ScopeId;
      const context: ProcessingContext = {
        captures: [],
        scopes: new Map(),
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope not found`);
        },
      };

      const builder = new DefinitionBuilder(context);

      // Add function first
      const fn_capture: CaptureNode = {
        category: "definition" as any,
        entity: "function" as any,
        node: fn_node,
        text: "modify" as SymbolName,
        name: "definition.function",
        location: fn_location,
      };
      RUST_HANDLERS["definition.function"](fn_capture, builder, context);

      // Now add parameter
      const param_capture: CaptureNode = {
        category: "definition" as any,
        entity: "parameter" as any,
        node: param_node,
        text: "value" as SymbolName,
        name: "definition.parameter",
        location: param_location,
      };
      RUST_HANDLERS["definition.parameter"](param_capture, builder, context);

      const result = builder.build();
      const functions = Array.from(result.functions.values());
      expect(functions).toHaveLength(1);
      expect(functions[0].signature.parameters).toHaveLength(1);
      expect(functions[0].signature.parameters[0].name).toBe("value");
      expect(functions[0].signature.parameters[0].type).toBe("Vec<u8>");
    });

    it("should process self parameter", () => {
      const code = `struct MyStruct {}
impl MyStruct {
    fn method(&self) {}
}`;
      const tree = parser.parse(code);
      const struct_node = find_node(tree.rootNode, "type_identifier", "MyStruct");
      const method_node = find_node(tree.rootNode, "identifier", "method");
      const self_node = find_node(tree.rootNode, "self");

      const struct_location = node_to_location(struct_node, "test.rs" as FilePath);
      const method_location = node_to_location(method_node, "test.rs" as FilePath);
      const self_location = node_to_location(self_node, "test.rs" as FilePath);

      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as ScopeId;
      const context: ProcessingContext = {
        captures: [],
        scopes: new Map(),
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope not found`);
        },
      };

      const builder = new DefinitionBuilder(context);

      // Add struct
      RUST_HANDLERS["definition.class"]({
        category: "definition" as any,
        entity: "class" as any,
        node: struct_node,
        text: "MyStruct" as SymbolName,
        name: "definition.class",
        location: struct_location,
      }, builder, context);

      // Add method
      RUST_HANDLERS["definition.method"]({
        category: "definition" as any,
        entity: "method" as any,
        node: method_node,
        text: "method" as SymbolName,
        name: "definition.method",
        location: method_location,
      }, builder, context);

      // Add self parameter
      RUST_HANDLERS["definition.parameter.self"]({
        category: "definition" as any,
        entity: "parameter" as any,
        node: self_node,
        text: "self" as SymbolName,
        name: "definition.parameter.self",
        location: self_location,
      }, builder, context);

      const result = builder.build();
      const classes = Array.from(result.classes.values());
      expect(classes).toHaveLength(1);
      const method = classes[0].methods[0];
      expect(method.name).toBe("method");
      expect(method.parameters).toHaveLength(1);
      expect(method.parameters[0].name).toBe("self");
      expect(method.parameters[0].type).toBe("MyStruct");
    });
  });

  describe("type definitions", () => {
    it("should process type alias", () => {
      const code = "pub type Result<T> = std::result::Result<T, Error>;";

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const tree = parser.parse(code);
      const struct_type_node = find_node(tree.rootNode, "type_identifier", "Person");
      const name_field_node = find_node(tree.rootNode, "field_identifier", "name");
      const age_field_node = find_node(tree.rootNode, "field_identifier", "age");

      const struct_location = node_to_location(struct_type_node, "test.rs" as FilePath);
      const name_location = node_to_location(name_field_node, "test.rs" as FilePath);
      const age_location = node_to_location(age_field_node, "test.rs" as FilePath);

      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as ScopeId;
      const context: ProcessingContext = {
        captures: [],
        scopes: new Map(),
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope not found`);
        },
      };

      const builder = new DefinitionBuilder(context);

      // Add struct first using the handler
      RUST_HANDLERS["definition.class"]({
        category: "definition" as any,
        entity: "class" as any,
        node: struct_type_node,
        text: "Person" as SymbolName,
        name: "definition.class",
        location: struct_location,
      }, builder, context);

      // Add fields
      RUST_HANDLERS["definition.field"]({
        category: "definition" as any,
        entity: "field" as any,
        node: name_field_node,
        text: "name" as SymbolName,
        name: "definition.field",
        location: name_location,
      }, builder, context);

      RUST_HANDLERS["definition.field"]({
        category: "definition" as any,
        entity: "field" as any,
        node: age_field_node,
        text: "age" as SymbolName,
        name: "definition.field",
        location: age_location,
      }, builder, context);

      const result = builder.build();
      const classes = Array.from(result.classes.values());
      expect(classes).toHaveLength(1);
      expect(classes[0].properties).toHaveLength(2);
      expect(classes[0].properties[0].name).toBe("name");
      expect(classes[0].properties[0].type).toBe("String");
      expect(classes[0].properties[1].name).toBe("age");
      expect(classes[0].properties[1].type).toBe("u32");
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
      const struct_node = find_node(tree.rootNode, "type_identifier", "Database");

      if (struct_node) {
        const definitions = process_capture(
          code,
          "definition.class.generic",
          "type_identifier",
          "Database"
        );
        expect(definitions.classes).toHaveLength(1);
        expect(definitions.classes[0].name).toBe("Database");
        expect(definitions.classes[0].generics).toEqual(["T"]);
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

      const definitions = process_capture(
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

  describe("import definitions (use declarations)", () => {
    it("should process simple use declaration", () => {
      const code = "use std::fmt::Display;";
      const tree = parser.parse(code);
      const use_node = find_node(tree.rootNode, "use_declaration");

      const use_location = node_to_location(use_node, "test.rs" as FilePath);

      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as ScopeId;
      const context: ProcessingContext = {
        captures: [],
        scopes: new Map(),
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope not found`);
        },
      };

      const builder = new DefinitionBuilder(context);
      RUST_HANDLERS["definition.import"]({
        category: "definition" as any,
        entity: "import" as any,
        node: use_node,
        text: use_node.text as SymbolName,
        name: "definition.import",
        location: use_location,
      }, builder, context);

      const result = builder.build();
      const imports = Array.from(result.imports.values());
      expect(imports).toHaveLength(1);
      expect(imports[0].name).toBe("Display");
      expect(imports[0].import_kind).toBe("named");
    });

    it("should process use declaration with alias", () => {
      const code = "use std::collections::HashMap as Map;";
      const tree = parser.parse(code);
      const use_node = find_node(tree.rootNode, "use_declaration");

      const use_location = node_to_location(use_node, "test.rs" as FilePath);

      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as ScopeId;
      const context: ProcessingContext = {
        captures: [],
        scopes: new Map(),
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope not found`);
        },
      };

      const builder = new DefinitionBuilder(context);
      RUST_HANDLERS["definition.import"]({
        category: "definition" as any,
        entity: "import" as any,
        node: use_node,
        text: use_node.text as SymbolName,
        name: "definition.import",
        location: use_location,
      }, builder, context);

      const result = builder.build();
      const imports = Array.from(result.imports.values());
      expect(imports).toHaveLength(1);
      expect(imports[0].name).toBe("Map");
      expect(imports[0].original_name).toBe("std::collections::HashMap");
      expect(imports[0].import_kind).toBe("named");
    });

    it("should process use declaration with braced group", () => {
      const code = "use std::io::{Read, Write};";
      const tree = parser.parse(code);
      const use_node = find_node(tree.rootNode, "use_declaration");

      const use_location = node_to_location(use_node, "test.rs" as FilePath);

      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as ScopeId;
      const context: ProcessingContext = {
        captures: [],
        scopes: new Map(),
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope not found`);
        },
      };

      const builder = new DefinitionBuilder(context);
      RUST_HANDLERS["definition.import"]({
        category: "definition" as any,
        entity: "import" as any,
        node: use_node,
        text: use_node.text as SymbolName,
        name: "definition.import",
        location: use_location,
      }, builder, context);

      const result = builder.build();
      const imports = Array.from(result.imports.values());
      expect(imports).toHaveLength(2);
      const import_names = imports.map(i => i.name).sort();
      expect(import_names).toEqual(["Read", "Write"]);
    });

    it("should process wildcard use declaration", () => {
      const code = "use std::io::*;";
      const tree = parser.parse(code);
      const use_node = find_node(tree.rootNode, "use_declaration");

      const use_location = node_to_location(use_node, "test.rs" as FilePath);

      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as ScopeId;
      const context: ProcessingContext = {
        captures: [],
        scopes: new Map(),
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope not found`);
        },
      };

      const builder = new DefinitionBuilder(context);
      RUST_HANDLERS["definition.import"]({
        category: "definition" as any,
        entity: "import" as any,
        node: use_node,
        text: use_node.text as SymbolName,
        name: "definition.import",
        location: use_location,
      }, builder, context);

      const result = builder.build();
      const imports = Array.from(result.imports.values());
      expect(imports).toHaveLength(1);
      expect(imports[0].import_kind).toBe("namespace");
    });

    it("should process extern crate declaration", () => {
      const code = "extern crate serde;";
      const tree = parser.parse(code);
      const extern_node = find_node(tree.rootNode, "extern_crate_declaration")!;
      const context = create_mock_context();
      const use_location = node_to_location(extern_node, "test.rs" as FilePath);

      const builder = new DefinitionBuilder(context);
      RUST_HANDLERS["definition.import"]({
        category: "definition" as any,
        entity: "import" as any,
        node: extern_node,
        text: extern_node.text as SymbolName,
        name: "definition.import",
        location: use_location,
      }, builder, context);

      const result = builder.build();
      const imports = Array.from(result.imports.values());
      expect(imports).toHaveLength(1);
      expect(imports[0].name).toBe("serde");
    });
  });

  describe("interface method definitions (trait methods)", () => {
    it("should process trait method signature", () => {
      const code = `trait Display {
    fn fmt(&self) -> String;
}`;
      const tree = parser.parse(code);
      const trait_node = find_node(tree.rootNode, "type_identifier", "Display");
      const method_node = find_node(tree.rootNode, "identifier", "fmt");

      const trait_location = node_to_location(trait_node, "test.rs" as FilePath);
      const method_location = node_to_location(method_node, "test.rs" as FilePath);

      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as ScopeId;
      const context: ProcessingContext = {
        captures: [],
        scopes: new Map(),
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope not found`);
        },
      };

      const builder = new DefinitionBuilder(context);

      // Add trait first
      RUST_HANDLERS["definition.interface"]({
        category: "definition" as any,
        entity: "interface" as any,
        node: trait_node,
        text: "Display" as SymbolName,
        name: "definition.interface",
        location: trait_location,
      }, builder, context);

      // Add trait method
      RUST_HANDLERS["definition.interface.method"]({
        category: "definition" as any,
        entity: "interface" as any,
        node: method_node,
        text: "fmt" as SymbolName,
        name: "definition.interface.method",
        location: method_location,
      }, builder, context);

      const result = builder.build();
      const interfaces = Array.from(result.interfaces.values());
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].name).toBe("Display");
      expect(interfaces[0].methods).toHaveLength(1);
      expect(interfaces[0].methods[0].name).toBe("fmt");
      expect(interfaces[0].methods[0].return_type).toBe("String");
    });
  });

  describe("anonymous function definitions (closures)", () => {
    it("should process closure as anonymous function", () => {
      const code = "let f = |x: i32| x * 2;";
      const tree = parser.parse(code);
      const closure_node = find_node(tree.rootNode, "closure_expression");

      const closure_location = node_to_location(closure_node, "test.rs" as FilePath);

      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as ScopeId;
      const context: ProcessingContext = {
        captures: [],
        scopes: new Map(),
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope not found`);
        },
      };

      const builder = new DefinitionBuilder(context);
      RUST_HANDLERS["definition.anonymous_function"]({
        category: "definition" as any,
        entity: "anonymous_function" as any,
        node: closure_node,
        text: closure_node.text as SymbolName,
        name: "definition.anonymous_function",
        location: closure_location,
      }, builder, context);

      const result = builder.build();
      const functions = Array.from(result.functions.values());
      expect(functions).toHaveLength(1);
      expect(functions[0].name).toBe("<anonymous>");
      expect(functions[0].callback_context?.is_callback).toBe(false);
    });

    it("should detect callback closure", () => {
      const code = "items.iter().map(|x| x * 2);";
      const tree = parser.parse(code);
      const closure_node = find_node(tree.rootNode, "closure_expression");

      const closure_location = node_to_location(closure_node, "test.rs" as FilePath);

      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as ScopeId;
      const context: ProcessingContext = {
        captures: [],
        scopes: new Map(),
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope not found`);
        },
      };

      const builder = new DefinitionBuilder(context);
      RUST_HANDLERS["definition.anonymous_function"]({
        category: "definition" as any,
        entity: "anonymous_function" as any,
        node: closure_node,
        text: closure_node.text as SymbolName,
        name: "definition.anonymous_function",
        location: closure_location,
      }, builder, context);

      const result = builder.build();
      const functions = Array.from(result.functions.values());
      expect(functions).toHaveLength(1);
      expect(functions[0].callback_context?.is_callback).toBe(true);
    });
  });

  describe("mutable variable definitions", () => {
    it("should process let mut binding", () => {
      const code = "let mut count: usize = 0;";

      const definitions = process_capture(
        code,
        "definition.variable.mut",
        "identifier",
        "count"
      );

      expect(definitions.variables).toHaveLength(1);
      expect(definitions.variables[0].name).toBe("count");
      expect(definitions.variables[0].type).toBe("usize");
      expect(definitions.variables[0].kind).toBe("variable");
    });

    it("should process let mut without type annotation", () => {
      const code = "let mut items = Vec::new();";

      const definitions = process_capture(
        code,
        "definition.variable.mut",
        "identifier",
        "items"
      );

      expect(definitions.variables).toHaveLength(1);
      expect(definitions.variables[0].name).toBe("items");
      expect(definitions.variables[0].kind).toBe("variable");
    });
  });

  describe("type alias in impl block", () => {
    it("should process type alias in impl", () => {
      const code = "type Output = String;";

      const definitions = process_capture(
        code,
        "definition.type_alias.impl",
        "type_identifier",
        "Output"
      );

      expect(definitions.types).toHaveLength(1);
      expect(definitions.types[0].name).toBe("Output");
      expect(definitions.types[0].is_exported).toBe(true);
    });
  });

  describe("closure parameter definitions", () => {
    it("should process closure parameter", () => {
      const code = "fn apply(f: impl Fn(i32) -> i32) {}";
      const tree = parser.parse(code);

      const fn_node = find_node(tree.rootNode, "identifier", "apply");
      const param_node = find_node(tree.rootNode, "identifier", "f");

      const fn_location = node_to_location(fn_node, "test.rs" as FilePath);
      const param_location = node_to_location(param_node, "test.rs" as FilePath);

      const root_scope_id = "module:test.rs:1:0:100:0:<module>" as ScopeId;
      const context: ProcessingContext = {
        captures: [],
        scopes: new Map(),
        scope_depths: new Map(),
        root_scope_id,
        get_scope_id: (_location: Location) => root_scope_id,
        get_child_scope_with_symbol_name: (_scope_id: ScopeId, _name: SymbolName) => {
          throw new Error(`Child scope not found`);
        },
      };

      const builder = new DefinitionBuilder(context);

      // Add function first
      RUST_HANDLERS["definition.function"]({
        category: "definition" as any,
        entity: "function" as any,
        node: fn_node,
        text: "apply" as SymbolName,
        name: "definition.function",
        location: fn_location,
      }, builder, context);

      // Add closure parameter
      RUST_HANDLERS["definition.parameter.closure"]({
        category: "definition" as any,
        entity: "parameter" as any,
        node: param_node,
        text: "f" as SymbolName,
        name: "definition.parameter.closure",
        location: param_location,
      }, builder, context);

      const result = builder.build();
      const functions = Array.from(result.functions.values());
      expect(functions).toHaveLength(1);
      expect(functions[0].name).toBe("apply");
      expect(functions[0].signature.parameters).toHaveLength(1);
      expect(functions[0].signature.parameters[0].name).toBe("f");
    });
  });

  describe("Property Type Extraction", () => {
    async function build_index_from_code(code: string) {
      const tree = parser.parse(code);
      const lines = code.split("\n");
      const parsed_file = {
        file_path: "test.rs" as any,
        file_lines: lines.length,
        file_end_column: lines[lines.length - 1]?.length || 0,
        tree,
        lang: "rust" as const,
      };
      return build_index_single_file(parsed_file, tree, "rust");
    }

    it("should extract type from struct field", async () => {
      const code = `
struct Service {
    registry: DefinitionRegistry,
    cache: HashMap<String, i32>,
}
`;

      const index = await build_index_from_code(code);
      const service_struct = Array.from(index.classes.values())[0];

      expect(service_struct.name).toBe("Service");
      expect(service_struct.properties.length).toBe(2);

      const registry_field = service_struct.properties.find(p => p.name === "registry");
      expect(registry_field?.name).toBe("registry");
      expect(registry_field?.type).toBe("DefinitionRegistry");

      const cache_field = service_struct.properties.find(p => p.name === "cache");
      expect(cache_field?.name).toBe("cache");
      expect(cache_field?.type).toBe("HashMap<String, i32>");
    });

    it("should extract type from pub field", async () => {
      const code = `
struct Config {
    pub name: String,
    pub count: usize,
}
`;

      const index = await build_index_from_code(code);
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

      const index = await build_index_from_code(code);
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

      const index = await build_index_from_code(code);
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

      const index = await build_index_from_code(code);
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

      const index = await build_index_from_code(code);
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

      const index = await build_index_from_code(code);
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

      const index = await build_index_from_code(code);
      const arrays_struct = Array.from(index.classes.values())[0];

      expect(arrays_struct.properties.length).toBe(2);

      const fixed_field = arrays_struct.properties.find(p => p.name === "fixed");
      expect(fixed_field?.type).toBe("[u8; 32]");

      const slice_field = arrays_struct.properties.find(p => p.name === "slice");
      expect(slice_field?.type).toBe("&[u8]");
    });
  });

  describe("detect_callback_context", () => {
    function find_closure(node: SyntaxNode): SyntaxNode | null {
      if (node.type === "closure_expression") {
        return node;
      }
      for (const child of node.children) {
        const result = find_closure(child);
        if (result) return result;
      }
      return null;
    }

    describe("Callback detection - positive cases", () => {
      it("should detect callback in iter().map()", () => {
        const code = "items.iter().map(|x| x * 2)";
        const tree = parser.parse(code);
        const closure = find_closure(tree.rootNode);
        expect(closure).not.toBeNull();

        const context = detect_callback_context(closure!, "test.rs" as FilePath);
        expect(context.is_callback).toBe(true);
        expect(context.receiver_is_external).toBeNull();
        expect(context.receiver_location).not.toBeNull();
      });

      it("should detect callback in iter().filter()", () => {
        const code = "items.iter().filter(|x| *x > 0)";
        const tree = parser.parse(code);
        const closure = find_closure(tree.rootNode);
        expect(closure).not.toBeNull();

        const context = detect_callback_context(closure!, "test.rs" as FilePath);
        expect(context.is_callback).toBe(true);
        expect(context.receiver_is_external).toBeNull();
        expect(context.receiver_location).not.toBeNull();
      });

      it("should detect callback in for_each()", () => {
        const code = "items.iter().for_each(|x| println!(\"{}\", x))";
        const tree = parser.parse(code);
        const closure = find_closure(tree.rootNode);
        expect(closure).not.toBeNull();

        const context = detect_callback_context(closure!, "test.rs" as FilePath);
        expect(context.is_callback).toBe(true);
        expect(context.receiver_is_external).toBeNull();
        expect(context.receiver_location).not.toBeNull();
      });

      it("should detect callback in sort_by()", () => {
        const code = "items.sort_by(|a, b| a.cmp(b))";
        const tree = parser.parse(code);
        const closure = find_closure(tree.rootNode);
        expect(closure).not.toBeNull();

        const context = detect_callback_context(closure!, "test.rs" as FilePath);
        expect(context.is_callback).toBe(true);
        expect(context.receiver_is_external).toBeNull();
        expect(context.receiver_location).not.toBeNull();
      });

      it("should detect callback in nested iterator chains", () => {
        const code = "items.iter().map(|x| x * 2).filter(|y| *y > 0)";
        const tree = parser.parse(code);
        // Find first closure (the one in map)
        const closure = find_closure(tree.rootNode);
        expect(closure).not.toBeNull();

        const context = detect_callback_context(closure!, "test.rs" as FilePath);
        expect(context.is_callback).toBe(true);
        expect(context.receiver_is_external).toBeNull();
        expect(context.receiver_location).not.toBeNull();
      });

      it("should detect callback in method call", () => {
        const code = "obj.process(|x| x.to_string())";
        const tree = parser.parse(code);
        const closure = find_closure(tree.rootNode);
        expect(closure).not.toBeNull();

        const context = detect_callback_context(closure!, "test.rs" as FilePath);
        expect(context.is_callback).toBe(true);
        expect(context.receiver_is_external).toBeNull();
        expect(context.receiver_location).not.toBeNull();
      });
    });

    describe("Non-callback detection - negative cases", () => {
      it("should NOT detect callback in variable assignment", () => {
        const code = "let f = |x| x * 2;";
        const tree = parser.parse(code);
        const closure = find_closure(tree.rootNode);
        expect(closure).not.toBeNull();

        const context = detect_callback_context(closure!, "test.rs" as FilePath);
        expect(context.is_callback).toBe(false);
        expect(context.receiver_location).toBeNull();
      });

      it("should NOT detect callback in return statement", () => {
        const code = "fn foo() -> impl Fn(i32) -> i32 { |x| x * 2 }";
        const tree = parser.parse(code);
        const closure = find_closure(tree.rootNode);
        expect(closure).not.toBeNull();

        const context = detect_callback_context(closure!, "test.rs" as FilePath);
        expect(context.is_callback).toBe(false);
        expect(context.receiver_location).toBeNull();
      });

      it("should NOT detect callback in struct initialization", () => {
        const code = "Handler { func: |x| x * 2 }";
        const tree = parser.parse(code);
        const closure = find_closure(tree.rootNode);
        expect(closure).not.toBeNull();

        const context = detect_callback_context(closure!, "test.rs" as FilePath);
        expect(context.is_callback).toBe(false);
        expect(context.receiver_location).toBeNull();
      });

      it("should NOT detect callback in array literal", () => {
        const code = "let funcs = [|x| x * 2, |y| y + 1];";
        const tree = parser.parse(code);
        const closure = find_closure(tree.rootNode);
        expect(closure).not.toBeNull();

        const context = detect_callback_context(closure!, "test.rs" as FilePath);
        expect(context.is_callback).toBe(false);
        expect(context.receiver_location).toBeNull();
      });
    });

    describe("Receiver location capture", () => {
      it("should capture correct receiver location for map call", () => {
        const code = "items.iter().map(|x| x * 2)";
        const tree = parser.parse(code);
        const closure = find_closure(tree.rootNode);
        expect(closure).not.toBeNull();

        const context = detect_callback_context(closure!, "test.rs" as FilePath);
        expect(context.receiver_location).toEqual({
          file_path: "test.rs",
          start_line: 1,
          start_column: 1,
          end_line: 1,
          end_column: 27,
        });
      });

      it("should capture correct receiver location for multi-line call", () => {
        const code = "result = items.sort_by(\n    |a, b| a.cmp(b)\n)";
        const tree = parser.parse(code);
        const closure = find_closure(tree.rootNode);
        expect(closure).not.toBeNull();

        const context = detect_callback_context(closure!, "test.rs" as FilePath);
        expect(context.receiver_location).toEqual({
          file_path: "test.rs",
          start_line: 1,
          start_column: 10,
          end_line: 3,
          end_column: 1,
        });
      });
    });
  });

  describe("Documentation Extraction", () => {
    async function build_index_from_code_doc(code: string) {
      const tree = parser.parse(code);
      const lines = code.split("\n");
      const parsed_file = {
        file_path: "test.rs" as any,
        file_lines: lines.length,
        file_end_column: lines[lines.length - 1]?.length || 0,
        tree,
        lang: "rust" as const,
      };
      return build_index_single_file(parsed_file, tree, "rust");
    }

    it("should extract doc comment on a function", async () => {
      const code = `/// Calculate the sum of two numbers.
fn add(a: i32, b: i32) -> i32 {
    a + b
}
`;
      const index = await build_index_from_code_doc(code);
      const fn_def = Array.from(index.functions.values()).find(f => f.name === "add");
      expect(fn_def?.name).toBe("add");
      expect(fn_def!.docstring).toBe("/// Calculate the sum of two numbers.");
    });

    it("should extract doc comment on a struct", async () => {
      const code = `/// A point in 2D space.
struct Point {
    x: f64,
    y: f64,
}
`;
      const index = await build_index_from_code_doc(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Point");
      expect(cls?.name).toBe("Point");
      expect(cls!.docstring).toEqual(["/// A point in 2D space."]);
    });

    it("should concatenate multi-line doc comments", async () => {
      const code = `/// First line.
/// Second line.
fn described() -> bool {
    true
}
`;
      const index = await build_index_from_code_doc(code);
      const fn_def = Array.from(index.functions.values()).find(f => f.name === "described");
      expect(fn_def?.name).toBe("described");
      expect(fn_def!.docstring).toBe("/// First line.\n/// Second line.");
    });

    it("should NOT capture a regular // comment as docstring", async () => {
      const code = `// Internal helper, not a doc comment.
fn helper() {}
`;
      const index = await build_index_from_code_doc(code);
      const fn_def = Array.from(index.functions.values()).find(f => f.name === "helper");
      expect(fn_def?.name).toBe("helper");
      expect(fn_def!.docstring).toBeUndefined();
    });

    it("should extract doc comment on an impl method", async () => {
      const code = `
struct Calculator {}
impl Calculator {
    /// Add two integers.
    fn add(&self, a: i32, b: i32) -> i32 {
        a + b
    }
}
`;
      const index = await build_index_from_code_doc(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Calculator");
      const method = cls!.methods.find(m => m.name === "add");
      expect(method?.name).toBe("add");
      expect(method!.docstring).toBe("/// Add two integers.");
    });

    it("should extract doc comment on a static (associated) impl method", async () => {
      const code = `
struct Point { x: f64, y: f64 }
impl Point {
    /// Create a Point from coordinates.
    fn make(x: f64, y: f64) -> Self {
        Point { x, y }
    }
}
`;
      const index = await build_index_from_code_doc(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Point");
      const method = cls!.methods.find(m => m.name === "make");
      expect(method?.name).toBe("make");
      expect(method!.docstring).toBe("/// Create a Point from coordinates.");
    });

    it("should extract doc comment on a generic struct", async () => {
      const code = `/// A generic box.
struct Box<T> {
    value: T,
}
`;
      const index = await build_index_from_code_doc(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Box");
      expect(cls?.name).toBe("Box");
      expect(cls!.docstring).toEqual(["/// A generic box."]);
    });

    it("should extract doc comment on a generic function", async () => {
      const code = `/// Process items.
fn process<T>(v: T) -> T {
    v
}
`;
      const index = await build_index_from_code_doc(code);
      const fn_def = Array.from(index.functions.values()).find(f => f.name === "process");
      expect(fn_def?.name).toBe("process");
      expect(fn_def!.docstring).toBe("/// Process items.");
    });

    it("should extract doc comment on an async free function", async () => {
      const code = `/// Fetch data.
async fn fetch() {}
`;
      const index = await build_index_from_code_doc(code);
      const fn_def = Array.from(index.functions.values()).find(f => f.name === "fetch");
      expect(fn_def?.name).toBe("fetch");
      expect(fn_def!.docstring).toBe("/// Fetch data.");
    });

    it("should extract doc comment on a const function", async () => {
      const code = `/// Compute hash.
const fn hash(x: u32) -> u32 { x }
`;
      const index = await build_index_from_code_doc(code);
      const fn_def = Array.from(index.functions.values()).find(f => f.name === "hash");
      expect(fn_def?.name).toBe("hash");
      expect(fn_def!.docstring).toBe("/// Compute hash.");
    });

    it("should extract doc comment on an unsafe function", async () => {
      const code = `/// Raw write.
unsafe fn raw_write() {}
`;
      const index = await build_index_from_code_doc(code);
      const fn_def = Array.from(index.functions.values()).find(f => f.name === "raw_write");
      expect(fn_def?.name).toBe("raw_write");
      expect(fn_def!.docstring).toBe("/// Raw write.");
    });

    it("should extract doc comment on an async impl method", async () => {
      const code = `
struct Store {}
impl Store {
    /// Load from disk.
    async fn load(&self) -> String {
        String::new()
    }
}
`;
      const index = await build_index_from_code_doc(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Store");
      const method = cls!.methods.find(m => m.name === "load");
      expect(method?.name).toBe("load");
      expect(method!.docstring).toBe("/// Load from disk.");
    });

    it("should extract doc comment on a trait default method", async () => {
      const code = `trait Greet {
    /// Greet someone.
    fn greet(&self) -> String {
        String::from("Hello")
    }
}
`;
      const index = await build_index_from_code_doc(code);
      const iface = Array.from(index.interfaces.values()).find(i => i.name === "Greet");
      const method = iface!.methods.find(m => m.name === "greet");
      expect(method?.name).toBe("greet");
      expect(method!.docstring).toBe("/// Greet someone.");
    });

    it("should extract doc comment on fn new constructor", async () => {
      const code = `
struct Counter { value: u32 }
impl Counter {
    /// Creates a new Counter.
    fn new() -> Self {
        Counter { value: 0 }
    }
}
`;
      const index = await build_index_from_code_doc(code);
      const cls = Array.from(index.classes.values()).find(c => c.name === "Counter");
      const ctor = cls!.methods.find(m => m.name === "new");
      expect(ctor?.name).toBe("new");
      expect(ctor!.docstring).toBe("/// Creates a new Counter.");
    });

    it("should extract doc comment when an attribute separates the comment and fn", async () => {
      const code = `/// Inline helper.
#[inline]
fn helper() {}
`;
      const index = await build_index_from_code_doc(code);
      const fn_def = Array.from(index.functions.values()).find(f => f.name === "helper");
      expect(fn_def?.name).toBe("helper");
      expect(fn_def!.docstring).toBe("/// Inline helper.");
    });
  });
});

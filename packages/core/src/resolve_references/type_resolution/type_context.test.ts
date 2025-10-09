/**
 * Tests for Type Context
 *
 * Tests type tracking and member lookup functionality.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { build_type_context } from "./type_context";
import { build_scope_resolver_index } from "../scope_resolver_index/scope_resolver_index";
import { create_resolution_cache } from "../resolution_cache/resolution_cache";
import { build_semantic_index } from "../../index_single_file/semantic_index";
import type {
  FilePath,
  Language,
  SymbolId,
  ScopeId,
  SymbolName,
} from "@ariadnejs/types";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import type { ParsedFile } from "../../index_single_file/file_utils";
import { build_file_tree } from "../symbol_resolution.test_helpers";

// Helper to create ParsedFile
function create_parsed_file(
  code: string,
  file_path: FilePath,
  tree: Parser.Tree,
  language: Language
): ParsedFile {
  const lines = code.split("\n");
  return {
    file_path,
    file_lines: lines.length,
    file_end_column: (lines[lines.length - 1]?.length || 0) + 1,
    tree,
    lang: language,
  };
}

describe("Type Context", () => {
  let js_parser: Parser;
  let ts_parser: Parser;
  let py_parser: Parser;
  let rust_parser: Parser;

  beforeAll(() => {
    js_parser = new Parser();
    js_parser.setLanguage(JavaScript);

    ts_parser = new Parser();
    ts_parser.setLanguage(TypeScript.typescript);

    py_parser = new Parser();
    py_parser.setLanguage(Python);

    rust_parser = new Parser();
    rust_parser.setLanguage(Rust);
  });

  describe("Basic Smoke Tests", () => {
    it("should build type context without errors", () => {
      const code = `
class MyClass {
  doSomething() { return 42; }
}
const instance = new MyClass();
      `;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      expect(type_context).toBeDefined();
      expect(typeof type_context.get_symbol_type).toBe("function");
      expect(typeof type_context.get_type_member).toBe("function");
    });
  });

  describe("TypeScript - Type Annotation Tracking", () => {
    it("should track variable type annotation", () => {
      const code = `
class User {
  getName() { return "John"; }
}
const user: User = new User();
      `;
      const tree = ts_parser.parse(code);
      const file_path = "test.ts" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
      const index = build_semantic_index(parsed_file, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'user' variable
      const user_var = Array.from(index.variables.values()).find(
        (v) => v.name === "user"
      );
      expect(user_var).toBeDefined();

      // Get the type of 'user'
      const user_type = type_context.get_symbol_type(user_var!.symbol_id);
      expect(user_type).toBeDefined();

      // Verify it's the User class
      const user_class = Array.from(index.classes.values()).find(
        (c) => c.name === "User"
      );
      expect(user_type).toBe(user_class!.symbol_id);
    });

    it("should track parameter type annotation", () => {
      const code = `
interface Data {
  process(): void;
}
function processData(data: Data) {
  return data;
}
      `;
      const tree = ts_parser.parse(code);
      const file_path = "test.ts" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
      const index = build_semantic_index(parsed_file, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'data' parameter
      const process_func = Array.from(index.functions.values()).find(
        (f) => f.name === "processData"
      );
      expect(process_func).toBeDefined();
      const data_param = process_func!.signature.parameters[0];
      expect(data_param.name).toBe("data");

      // Get the type of 'data' parameter
      const data_type = type_context.get_symbol_type(data_param.symbol_id);
      expect(data_type).toBeDefined();

      // Verify it's the Data interface
      const data_interface = Array.from(index.interfaces.values()).find(
        (i) => i.name === "Data"
      );
      expect(data_type).toBe(data_interface!.symbol_id);
    });

    it("should track function return type annotation", () => {
      const code = `
class Result {
  getValue(): string { return "ok"; }
}
function getResult(): Result {
  return new Result();
}
      `;
      const tree = ts_parser.parse(code);
      const file_path = "test.ts" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
      const index = build_semantic_index(parsed_file, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'getResult' function
      const get_result_func = Array.from(index.functions.values()).find(
        (f) => f.name === "getResult"
      );
      expect(get_result_func).toBeDefined();

      // Get the return type
      const return_type = type_context.get_symbol_type(
        get_result_func!.symbol_id
      );
      expect(return_type).toBeDefined();

      // Verify it's the Result class
      const result_class = Array.from(index.classes.values()).find(
        (c) => c.name === "Result"
      );
      expect(return_type).toBe(result_class!.symbol_id);
    });

    it("should track generic type arguments", () => {
      const code = `
class Container<T> {
  get(): T { return null as any; }
}
const items: Container<string> = new Container();
      `;
      const tree = ts_parser.parse(code);
      const file_path = "test.ts" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
      const index = build_semantic_index(parsed_file, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'items' variable
      const items_var = Array.from(index.variables.values()).find(
        (v) => v.name === "items"
      );
      expect(items_var).toBeDefined();

      // Get the type of 'items'
      // Note: Generic arguments are extracted but not fully resolved in this phase
      const items_type = type_context.get_symbol_type(items_var!.symbol_id);
      expect(items_type).toBeDefined();

      // Verify it's the Container class
      const container_class = Array.from(index.classes.values()).find(
        (c) => c.name === "Container"
      );
      expect(items_type).toBe(container_class!.symbol_id);
    });
  });

  describe("JavaScript - Constructor Assignment Tracking", () => {
    it("should track direct construction", () => {
      const code = `
class MyClass {
  doSomething() { return 42; }
}
const instance = new MyClass();
      `;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'instance' variable
      const instance_var = Array.from(index.variables.values()).find(
        (v) => v.name === "instance"
      );
      expect(instance_var).toBeDefined();

      // Get the type of 'instance'
      const instance_type = type_context.get_symbol_type(
        instance_var!.symbol_id
      );
      expect(instance_type).toBeDefined();

      // Verify it's the MyClass class
      const my_class = Array.from(index.classes.values()).find(
        (c) => c.name === "MyClass"
      );
      expect(instance_type).toBe(my_class!.symbol_id);
    });

    it("should track nested construction in object property", () => {
      const code = `
class Service {
  start() { return true; }
}
const config = {
  service: new Service()
};
      `;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'service' variable (if extracted as a separate symbol)
      // Note: This depends on how the semantic index handles object properties
      const service_class = Array.from(index.classes.values()).find(
        (c) => c.name === "Service"
      );
      expect(service_class).toBeDefined();

      // Type bindings should include the constructor assignment
      expect(index.type_bindings.size).toBeGreaterThan(0);
    });
  });

  describe("Python - Type Hints", () => {
    it("should track variable type hint", () => {
      const code = `
class MyClass:
    def method(self):
        return 42

value: MyClass = MyClass()
      `;
      const tree = py_parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "python");
      const index = build_semantic_index(parsed_file, tree, "python");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'value' variable
      const value_var = Array.from(index.variables.values()).find(
        (v) => v.name === "value"
      );
      expect(value_var).toBeDefined();

      // Get the type of 'value'
      const value_type = type_context.get_symbol_type(value_var!.symbol_id);
      expect(value_type).toBeDefined();

      // Verify it's the MyClass class
      const my_class = Array.from(index.classes.values()).find(
        (c) => c.name === "MyClass"
      );
      expect(value_type).toBe(my_class!.symbol_id);
    });

    it("should track parameter type hint", () => {
      const code = `
class Data:
    def process(self):
        pass

def handle_data(data: Data):
    return data
      `;
      const tree = py_parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "python");
      const index = build_semantic_index(parsed_file, tree, "python");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'data' parameter
      const handle_func = Array.from(index.functions.values()).find(
        (f) => f.name === "handle_data"
      );
      expect(handle_func).toBeDefined();
      const data_param = handle_func!.signature.parameters.find(
        (p) => p.name === "data"
      );
      expect(data_param).toBeDefined();

      // Get the type of 'data' parameter
      const data_type = type_context.get_symbol_type(data_param!.symbol_id);
      expect(data_type).toBeDefined();

      // Verify it's the Data class
      const data_class = Array.from(index.classes.values()).find(
        (c) => c.name === "Data"
      );
      expect(data_type).toBe(data_class!.symbol_id);
    });

    it("should track function return type hint", () => {
      const code = `
class Result:
    def get_value(self):
        return "ok"

def get_result() -> Result:
    return Result()
      `;
      const tree = py_parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "python");
      const index = build_semantic_index(parsed_file, tree, "python");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'get_result' function
      const get_result_func = Array.from(index.functions.values()).find(
        (f) => f.name === "get_result"
      );
      expect(get_result_func).toBeDefined();

      // Get the return type
      const return_type = type_context.get_symbol_type(
        get_result_func!.symbol_id
      );
      expect(return_type).toBeDefined();

      // Verify it's the Result class
      const result_class = Array.from(index.classes.values()).find(
        (c) => c.name === "Result"
      );
      expect(return_type).toBe(result_class!.symbol_id);
    });

    it("should track Python constructor assignment", () => {
      const code = `
class Service:
    def start(self):
        return True

instance = Service()
      `;
      const tree = py_parser.parse(code);
      const file_path = "test.py" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "python");
      const index = build_semantic_index(parsed_file, tree, "python");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'instance' variable
      const instance_var = Array.from(index.variables.values()).find(
        (v) => v.name === "instance"
      );
      expect(instance_var).toBeDefined();

      // Get the type of 'instance'
      const instance_type = type_context.get_symbol_type(
        instance_var!.symbol_id
      );
      expect(instance_type).toBeDefined();

      // Verify it's the Service class
      const service_class = Array.from(index.classes.values()).find(
        (c) => c.name === "Service"
      );
      expect(instance_type).toBe(service_class!.symbol_id);
    });
  });

  describe("Rust - Type System", () => {
    it("should track struct type annotation", () => {
      const code = `
struct User {
    name: String,
}

impl User {
    fn get_name(&self) -> String {
        self.name.clone()
    }
}

fn main() {
    let user: User = User { name: String::from("John") };
}
      `;
      const tree = rust_parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "rust");
      const index = build_semantic_index(parsed_file, tree, "rust");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'user' variable
      const user_var = Array.from(index.variables.values()).find(
        (v) => v.name === "user"
      );
      expect(user_var).toBeDefined();

      // Get the type of 'user'
      const user_type = type_context.get_symbol_type(user_var!.symbol_id);
      expect(user_type).toBeDefined();

      // Verify it's the User struct
      const user_struct = Array.from(index.classes.values()).find(
        (c) => c.name === "User"
      );
      expect(user_type).toBe(user_struct!.symbol_id);
    });

    it("should track parameter type annotation", () => {
      const code = `
struct Data {
    value: i32,
}

impl Data {
    fn process(&self) {}
}

fn handle_data(data: Data) {
    data.process();
}
      `;
      const tree = rust_parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "rust");
      const index = build_semantic_index(parsed_file, tree, "rust");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'data' parameter
      const handle_func = Array.from(index.functions.values()).find(
        (f) => f.name === "handle_data"
      );
      expect(handle_func).toBeDefined();
      const data_param = handle_func!.signature.parameters.find(
        (p) => p.name === "data"
      );
      expect(data_param).toBeDefined();

      // Get the type of 'data' parameter
      const data_type = type_context.get_symbol_type(data_param!.symbol_id);
      expect(data_type).toBeDefined();

      // Verify it's the Data struct
      const data_struct = Array.from(index.classes.values()).find(
        (c) => c.name === "Data"
      );
      expect(data_type).toBe(data_struct!.symbol_id);
    });

    it("should track function return type", () => {
      const code = `
struct Result {
    value: String,
}

impl Result {
    fn get_value(&self) -> String {
        self.value.clone()
    }
}

fn get_result() -> Result {
    Result { value: String::from("ok") }
}
      `;
      const tree = rust_parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "rust");
      const index = build_semantic_index(parsed_file, tree, "rust");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'get_result' function
      const get_result_func = Array.from(index.functions.values()).find(
        (f) => f.name === "get_result"
      );
      expect(get_result_func).toBeDefined();

      // Get the return type
      const return_type = type_context.get_symbol_type(
        get_result_func!.symbol_id
      );
      expect(return_type).toBeDefined();

      // Verify it's the Result struct
      const result_struct = Array.from(index.classes.values()).find(
        (c) => c.name === "Result"
      );
      expect(return_type).toBe(result_struct!.symbol_id);
    });
  });

  describe("Member Lookup", () => {
    it("should look up method from class", () => {
      const code = `
class MyClass {
  myMethod() { return 42; }
  myProperty = "test";
}
      `;
      const tree = ts_parser.parse(code);
      const file_path = "test.ts" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
      const index = build_semantic_index(parsed_file, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find MyClass
      const my_class = Array.from(index.classes.values()).find(
        (c) => c.name === "MyClass"
      );
      expect(my_class).toBeDefined();

      // Look up method
      const method = type_context.get_type_member(
        my_class!.symbol_id,
        "myMethod" as SymbolName
      );
      expect(method).toBeDefined();

      // Verify it's the correct method
      const method_def = my_class!.methods.find((m) => m.name === "myMethod");
      expect(method).toBe(method_def!.symbol_id);
    });

    it("should look up property from class", () => {
      const code = `
class MyClass {
  myMethod() { return 42; }
  myProperty = "test";
}
      `;
      const tree = ts_parser.parse(code);
      const file_path = "test.ts" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
      const index = build_semantic_index(parsed_file, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find MyClass
      const my_class = Array.from(index.classes.values()).find(
        (c) => c.name === "MyClass"
      );
      expect(my_class).toBeDefined();

      // Look up property
      const prop = type_context.get_type_member(
        my_class!.symbol_id,
        "myProperty" as SymbolName
      );
      expect(prop).toBeDefined();

      // Verify it's the correct property
      const prop_def = my_class!.properties.find((p) => p.name === "myProperty");
      expect(prop).toBe(prop_def!.symbol_id);
    });

    it("should look up method from interface", () => {
      const code = `
interface MyInterface {
  myMethod(): number;
  myProperty: string;
}
      `;
      const tree = ts_parser.parse(code);
      const file_path = "test.ts" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
      const index = build_semantic_index(parsed_file, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find MyInterface
      const my_interface = Array.from(index.interfaces.values()).find(
        (i) => i.name === "MyInterface"
      );
      expect(my_interface).toBeDefined();

      // Look up method
      const method = type_context.get_type_member(
        my_interface!.symbol_id,
        "myMethod" as SymbolName
      );
      expect(method).toBeDefined();
    });

    it("should return null for non-existent member", () => {
      const code = `
class MyClass {
  myMethod() { return 42; }
}
      `;
      const tree = ts_parser.parse(code);
      const file_path = "test.ts" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
      const index = build_semantic_index(parsed_file, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find MyClass
      const my_class = Array.from(index.classes.values()).find(
        (c) => c.name === "MyClass"
      );
      expect(my_class).toBeDefined();

      // Look up non-existent member
      const member = type_context.get_type_member(
        my_class!.symbol_id,
        "nonExistent" as SymbolName
      );
      expect(member).toBeNull();
    });
  });

  describe("Resolver Index Integration", () => {
    it("should use resolver index for type name resolution", () => {
      const code = `
class LocalType {
  method() { return 1; }
}
const value: LocalType = new LocalType();
      `;
      const tree = ts_parser.parse(code);
      const file_path = "test.ts" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
      const index = build_semantic_index(parsed_file, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'value' variable
      const value_var = Array.from(index.variables.values()).find(
        (v) => v.name === "value"
      );
      expect(value_var).toBeDefined();

      // Get the type - should resolve through resolver index
      const value_type = type_context.get_symbol_type(value_var!.symbol_id);
      expect(value_type).toBeDefined();

      // Verify cache was used
      const stats = cache.get_stats();
      expect(stats.total_entries).toBeGreaterThan(0);
    });

    it("should handle type shadowing correctly", () => {
      const code = `
class Outer {
  outerMethod() { return 1; }
}
function test() {
  class Outer {
    innerMethod() { return 2; }
  }
  const value: Outer = new Outer();
}
      `;
      const tree = ts_parser.parse(code);
      const file_path = "test.ts" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
      const index = build_semantic_index(parsed_file, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'value' variable (should be in function scope)
      const value_var = Array.from(index.variables.values()).find(
        (v) => v.name === "value"
      );
      expect(value_var).toBeDefined();

      // Get the type - should resolve to inner Outer class
      const value_type = type_context.get_symbol_type(value_var!.symbol_id);
      expect(value_type).toBeDefined();

      // Find both Outer classes
      const outer_classes = Array.from(index.classes.values()).filter(
        (c) => c.name === "Outer"
      );
      expect(outer_classes.length).toBe(2);

      // The inner class should have innerMethod
      const inner_class = outer_classes.find((c) =>
        c.methods.some((m) => m.name === "innerMethod")
      );
      expect(inner_class).toBeDefined();

      // value_type should be the inner class
      expect(value_type).toBe(inner_class!.symbol_id);
    });
  });

  describe("Edge Cases", () => {
    it("should return null for symbol without type", () => {
      const code = `
const value = 42;
      `;
      const tree = js_parser.parse(code);
      const file_path = "test.js" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "javascript");
      const index = build_semantic_index(parsed_file, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'value' variable
      const value_var = Array.from(index.variables.values()).find(
        (v) => v.name === "value"
      );
      expect(value_var).toBeDefined();

      // Get the type - should be null (no annotation, no constructor)
      const value_type = type_context.get_symbol_type(value_var!.symbol_id);
      expect(value_type).toBeNull();
    });

    it("should handle unknown type names gracefully", () => {
      const code = `
const value: UnknownType = null as any;
      `;
      const tree = ts_parser.parse(code);
      const file_path = "test.ts" as FilePath;
      const parsed_file = create_parsed_file(code, file_path, tree, "typescript");
      const index = build_semantic_index(parsed_file, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const root_folder = build_file_tree([file_path]);
      const resolver_index = build_scope_resolver_index(indices, root_folder);
      const cache = create_resolution_cache();
      const namespace_sources = new Map<SymbolId, FilePath>();
      const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

      // Find the 'value' variable
      const value_var = Array.from(index.variables.values()).find(
        (v) => v.name === "value"
      );
      expect(value_var).toBeDefined();

      // Get the type - should be null (UnknownType doesn't exist)
      const value_type = type_context.get_symbol_type(value_var!.symbol_id);
      expect(value_type).toBeNull();
    });
  });
});

/**
 * Tests for generic scope tree processor
 */

import { describe, it, expect } from "vitest";
import { get_language_parser } from "./loader";
import { Language } from "@ariadnejs/types";
import {
  build_generic_scope_tree,
  create_scope_tree,
  find_scope_at_position,
  get_scope_chain,
  find_symbol_in_scope_chain,
  get_visible_symbols,
  SCOPE_TREE_CONTEXT,
  BespokeHandlers,
} from "./scope_tree";
// TODO: Re-enable after implementing tree-sitter query-based approach
// import { create_javascript_handlers } from "./scope_tree.javascript";
// import { create_python_handlers } from "./scope_tree.python";
// import { create_rust_handlers } from "./scope_tree.rust";
// import { create_typescript_handlers } from "./scope_tree.typescript";

// Helper function to parse code
function parse_code(code: string, language: Language) {
  const parser = get_language_parser(language);
  if (!parser) throw new Error(`Parser not found for ${language}`);
  const tree = parser.parse(code);
  return tree;
}

// Helper function to get bespoke handlers
function get_handlers(language: Language): BespokeHandlers | undefined {
  switch (language) {
    case "javascript":
      return create_javascript_handlers();
    case "typescript":
      return create_typescript_handlers();
    case "python":
      return create_python_handlers();
    case "rust":
      return create_rust_handlers();
    default:
      return undefined;
  }
}

describe("Generic Scope Tree Processor", () => {
  describe("Module context", () => {
    it("should have correct module context", () => {
      expect(SCOPE_TREE_CONTEXT.module).toBe("scope_tree");
      expect(SCOPE_TREE_CONTEXT.refactored).toBe(true);
    });
  });

  describe("JavaScript scope tree", () => {
    it("should build basic scope tree", () => {
      const code = `
        let global = 1;
        function test(param) {
          let local = 2;
          return local + param;
        }
      `;

      const tree = parse_code(code, "javascript");
      const scope_tree = build_generic_scope_tree(
        tree.rootNode,
        code,
        "javascript",
        "test.js",
        get_handlers("javascript")
      );

      expect(scope_tree.nodes.size).toBeGreaterThan(1);
      
      // Check global scope has the function
      const global_scope = scope_tree.nodes.get(scope_tree.root_id);
      expect(global_scope).toBeDefined();
      expect(global_scope!.symbols.has("global")).toBe(true);
      expect(global_scope!.symbols.has("test")).toBe(true);
    });

    it("should handle block scopes", () => {
      const code = `
        {
          let block1 = 1;
        }
        {
          let block2 = 2;
        }
      `;

      const tree = parse_code(code, "javascript");
      const scope_tree = build_generic_scope_tree(
        tree.rootNode,
        code,
        "javascript",
        "test.js",
        get_handlers("javascript")
      );

      // Should have root + 2 block scopes
      expect(scope_tree.nodes.size).toBe(3);
    });

    it("should extract parameters", () => {
      const code = `
        function test(a, b, ...rest) {
          return a + b;
        }
      `;

      const tree = parse_code(code, "javascript");
      const scope_tree = build_generic_scope_tree(
        tree.rootNode,
        code,
        "javascript",
        "test.js",
        get_handlers("javascript")
      );

      // Find function scope
      let function_scope;
      for (const [_, scope] of scope_tree.nodes) {
        if (scope.type === "function") {
          function_scope = scope;
          break;
        }
      }

      expect(function_scope).toBeDefined();
      expect(function_scope!.symbols.has("a")).toBe(true);
      expect(function_scope!.symbols.has("b")).toBe(true);
      expect(function_scope!.symbols.has("rest")).toBe(true);
    });
  });

  describe("Python scope tree", () => {
    it("should build basic scope tree", () => {
      const code = `
global_var = 1

def test_function(param):
    local_var = 2
    return local_var + param

class TestClass:
    def method(self):
        return self.value
`;

      const tree = parse_code(code, "python");
      const scope_tree = build_generic_scope_tree(
        tree.rootNode,
        code,
        "python",
        "test.py",
        get_handlers("python")
      );

      expect(scope_tree.nodes.size).toBeGreaterThan(1);
      
      // Check global scope
      const global_scope = scope_tree.nodes.get(scope_tree.root_id);
      expect(global_scope).toBeDefined();
      expect(global_scope!.symbols.has("global_var")).toBe(true);
      expect(global_scope!.symbols.has("test_function")).toBe(true);
      expect(global_scope!.symbols.has("TestClass")).toBe(true);
    });

    it("should handle comprehension scopes", () => {
      const code = `
result = [x * 2 for x in range(10)]
`;

      const tree = parse_code(code, "python");
      const scope_tree = build_generic_scope_tree(
        tree.rootNode,
        code,
        "python",
        "test.py",
        get_handlers("python")
      );

      // Should have root + comprehension scope
      expect(scope_tree.nodes.size).toBe(2);
    });
  });

  describe("Rust scope tree", () => {
    it("should build basic scope tree", () => {
      const code = `
fn main() {
    let x = 1;
    let y = 2;
}

struct MyStruct {
    field: i32,
}

impl MyStruct {
    fn method(&self) -> i32 {
        self.field
    }
}
`;

      const tree = parse_code(code, "rust");
      const scope_tree = build_generic_scope_tree(
        tree.rootNode,
        code,
        "rust",
        "test.rs",
        get_handlers("rust")
      );

      expect(scope_tree.nodes.size).toBeGreaterThan(1);
      
      // Check root is module type
      const root_scope = scope_tree.nodes.get(scope_tree.root_id);
      expect(root_scope).toBeDefined();
      expect(root_scope!.type).toBe("module");
    });

    it("should handle block scopes", () => {
      const code = `
fn test() {
    {
        let inner = 1;
    }
    if true {
        let cond = 2;
    }
}
`;

      const tree = parse_code(code, "rust");
      const scope_tree = build_generic_scope_tree(
        tree.rootNode,
        code,
        "rust",
        "test.rs",
        get_handlers("rust")
      );

      // Should have multiple block scopes
      let block_count = 0;
      for (const [_, scope] of scope_tree.nodes) {
        if (scope.type === "block") {
          block_count++;
        }
      }
      expect(block_count).toBeGreaterThan(0);
    });
  });

  describe("TypeScript scope tree", () => {
    it("should build basic scope tree", () => {
      const code = `
interface MyInterface {
    method(): void;
}

class MyClass implements MyInterface {
    method(): void {
        console.log("test");
    }
}

namespace MyNamespace {
    export const value = 1;
}
`;

      const tree = parse_code(code, "typescript");
      const scope_tree = build_generic_scope_tree(
        tree.rootNode,
        code,
        "typescript",
        "test.ts",
        get_handlers("typescript")
      );

      expect(scope_tree.nodes.size).toBeGreaterThan(1);
      
      // Check global scope
      const global_scope = scope_tree.nodes.get(scope_tree.root_id);
      expect(global_scope).toBeDefined();
      expect(global_scope!.symbols.has("MyInterface")).toBe(true);
      expect(global_scope!.symbols.has("MyClass")).toBe(true);
      expect(global_scope!.symbols.has("MyNamespace")).toBe(true);
    });

    it("should handle type parameters", () => {
      const code = `
function identity<T>(value: T): T {
    return value;
}

class Container<T> {
    value: T;
    constructor(value: T) {
        this.value = value;
    }
}
`;

      const tree = parse_code(code, "typescript");
      const scope_tree = build_generic_scope_tree(
        tree.rootNode,
        code,
        "typescript",
        "test.ts",
        get_handlers("typescript")
      );

      // Check that type parameters are captured
      let function_scope;
      for (const [_, scope] of scope_tree.nodes) {
        if (scope.type === "function" && scope.symbols.has("value")) {
          function_scope = scope;
          break;
        }
      }

      expect(function_scope).toBeDefined();
    });
  });

  describe("Scope navigation", () => {
    it("should find scope at position", () => {
      const code = `
function outer() {
    function inner() {
        let x = 1;
    }
}
`;

      const tree = parse_code(code, "javascript");
      const scope_tree = build_generic_scope_tree(
        tree.rootNode,
        code,
        "javascript",
        "test.js",
        get_handlers("javascript")
      );

      // Position inside inner function
      const scope = find_scope_at_position(scope_tree, { row: 3, column: 12 });
      expect(scope).toBeDefined();
      expect(scope!.type).toBe("function");
    });

    it("should get scope chain", () => {
      const code = `
function outer() {
    function inner() {
        let x = 1;
    }
}
`;

      const tree = parse_code(code, "javascript");
      const scope_tree = build_generic_scope_tree(
        tree.rootNode,
        code,
        "javascript",
        "test.js",
        get_handlers("javascript")
      );

      // Find innermost scope
      let inner_scope_id;
      for (const [id, scope] of scope_tree.nodes) {
        if (scope.symbols.has("x")) {
          inner_scope_id = id;
          break;
        }
      }

      expect(inner_scope_id).toBeDefined();
      const chain = get_scope_chain(scope_tree, inner_scope_id!);
      expect(chain.length).toBeGreaterThanOrEqual(2);
    });

    it("should find symbol in scope chain", () => {
      const code = `
let global = 1;
function test() {
    let local = 2;
    console.log(global);
}
`;

      const tree = parse_code(code, "javascript");
      const scope_tree = build_generic_scope_tree(
        tree.rootNode,
        code,
        "javascript",
        "test.js",
        get_handlers("javascript")
      );

      // Find function scope
      let function_scope_id;
      for (const [id, scope] of scope_tree.nodes) {
        if (scope.type === "function") {
          function_scope_id = id;
          break;
        }
      }

      expect(function_scope_id).toBeDefined();
      const symbol = find_symbol_in_scope_chain(scope_tree, function_scope_id!, "global");
      expect(symbol).toBeDefined();
      expect(symbol!.name).toBe("global");
    });

    it("should get visible symbols", () => {
      const code = `
let global = 1;
function test(param) {
    let local = 2;
}
`;

      const tree = parse_code(code, "javascript");
      const scope_tree = build_generic_scope_tree(
        tree.rootNode,
        code,
        "javascript",
        "test.js",
        get_handlers("javascript")
      );

      // Find function scope
      let function_scope_id;
      for (const [id, scope] of scope_tree.nodes) {
        if (scope.type === "function") {
          function_scope_id = id;
          break;
        }
      }

      expect(function_scope_id).toBeDefined();
      const visible = get_visible_symbols(scope_tree, function_scope_id!);
      expect(visible.has("global")).toBe(true);
      expect(visible.has("param")).toBe(true);
      expect(visible.has("local")).toBe(true);
    });
  });
});
/**
 * Tests for function call detection across all languages
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import { Language, SourceCode, FilePath, ImportInfo } from "@ariadnejs/types";
import { find_function_calls } from "./function_calls";
import {
  FunctionCallContext,
  EnhancedFunctionCallInfo,
  find_function_calls_generic,
} from "./function_calls";
import { build_language_scope_tree } from "../../scope_analysis/scope_tree";

describe("Function Call Detection", () => {
  describe("JavaScript", () => {
    const parser = new Parser();
    parser.setLanguage(JavaScript);

    it("should detect simple function calls", () => {
      const source = `
        function greet() {
          console.log('Hello');
        }
        greet();
      `;

      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.js",
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls(context);

      expect(calls).toHaveLength(2);
      expect(calls[0].callee_name).toBe("log");
      expect(calls[0].is_method_call).toBe(true);
      expect(calls[1].callee_name).toBe("greet");
      expect(calls[1].is_method_call).toBe(false);
    });

    it("should detect constructor calls", () => {
      const source = `
        class Person {}
        const p = new Person();
      `;

      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.js",
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls(context);

      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe("Person");
      expect(calls[0].is_constructor_call).toBe(true);
    });

    it("should detect method calls", () => {
      const source = `
        const obj = { method: () => {} };
        obj.method();
        array.push(1);
      `;

      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.js",
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls(context);

      expect(calls).toHaveLength(2);
      expect(calls[0].callee_name).toBe("method");
      expect(calls[0].is_method_call).toBe(true);
      expect(calls[1].callee_name).toBe("push");
      expect(calls[1].is_method_call).toBe(true);
    });

    it("should resolve local functions when scope tree is provided", () => {
      const source = `function helper() {
  return 42;
}

function main() {
  helper();
  unknown();
}

main();`;

      const tree = parser.parse(source);
      const scope_tree = build_language_scope_tree(tree.rootNode, source, "javascript", "test.js");
      
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.js",
        language: "javascript",
        ast_root: tree.rootNode,
        scope_tree: scope_tree,
      };

      const calls = find_function_calls(context) as EnhancedFunctionCallInfo[];

      // Should find helper(), unknown(), and main()
      expect(calls).toHaveLength(3);
      
      // Check that helper() call is resolved
      const helperCall = calls.find(c => c.callee_name === "helper");
      expect(helperCall).toBeDefined();
      expect(helperCall?.resolved_target).toBeDefined();
      expect(helperCall?.resolved_target?.is_local).toBe(true);
      
      // Check that unknown() call is NOT resolved
      const unknownCall = calls.find(c => c.callee_name === "unknown");
      expect(unknownCall).toBeDefined();
      expect(unknownCall?.resolved_target).toBeUndefined();
      
      // Check that main() call is resolved
      const mainCall = calls.find(c => c.callee_name === "main");
      expect(mainCall).toBeDefined();
      expect(mainCall?.resolved_target).toBeDefined();
      expect(mainCall?.resolved_target?.is_local).toBe(true);
    });

    it("should identify imported functions when imports are provided", () => {
      const source = `import { readFile } from "fs";
import lodash from "lodash";
import * as path from "path";

readFile("test.txt");
lodash.debounce(fn, 100);
path.join("/", "test");
localFunc();`;

      const tree = parser.parse(source);
      
      const imports: ImportInfo[] = [
        { 
          name: "readFile", 
          source: "fs", 
          kind: "named",
          location: { file_path: "test.js", line: 1, column: 1, end_line: 1, end_column: 30 }
        },
        { 
          name: "default", 
          source: "lodash",
          alias: "lodash",
          kind: "default",
          location: { file_path: "test.js", line: 2, column: 1, end_line: 2, end_column: 26 }
        },
        { 
          name: "*",
          source: "path",
          kind: "namespace",
          namespace_name: "path",
          location: { file_path: "test.js", line: 3, column: 1, end_line: 3, end_column: 26 }
        }
      ];
      
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.js",
        language: "javascript",
        ast_root: tree.rootNode,
        imports: imports,
      };

      const calls = find_function_calls(context) as EnhancedFunctionCallInfo[];

      // Should find all function calls
      expect(calls).toHaveLength(4);
      
      // Check readFile is identified as imported
      const readFileCall = calls.find(c => c.callee_name === "readFile");
      expect(readFileCall).toBeDefined();
      expect(readFileCall?.is_imported).toBe(true);
      expect(readFileCall?.source_module).toBe("fs");
      
      // Check default import (lodash.debounce)
      const debounceCall = calls.find(c => c.callee_name === "debounce");
      expect(debounceCall).toBeDefined();
      expect(debounceCall?.is_method_call).toBe(true);
      
      // Check namespace import (path.join)
      const joinCall = calls.find(c => c.callee_name === "join");
      expect(joinCall).toBeDefined();
      expect(joinCall?.is_method_call).toBe(true);
      
      // Check that localFunc is NOT marked as imported
      const localCall = calls.find(c => c.callee_name === "localFunc");
      expect(localCall).toBeDefined();
      expect(localCall?.is_imported).toBeUndefined();
    });
  });

  describe("TypeScript", () => {
    const parser = new Parser();
    parser.setLanguage(TypeScript.typescript);

    it("should detect decorator calls", () => {
      const source = `
        @Component()
        class MyComponent {
          @Input() value: string;
        }
      `;

      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.ts",
        language: "typescript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls(context);

      // Should find Component() and Input() decorator calls
      const decoratorCalls = calls.filter(
        (c) => c.callee_name === "Component" || c.callee_name === "Input"
      );
      expect(decoratorCalls).toHaveLength(2);
    });

    it("should detect generic function calls", () => {
      const source = `
        function identity<T>(x: T): T { return x; }
        const result = identity<string>('hello');
      `;

      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.ts",
        language: "typescript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls(context);

      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe("identity");
    });
  });

  describe("Python", () => {
    const parser = new Parser();
    parser.setLanguage(Python);

    it("should detect function and method calls", () => {
      const source = `
def greet():
    print("Hello")

greet()
obj.method()
      `;

      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.py",
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls(context);

      expect(calls).toHaveLength(3);
      expect(calls[0].callee_name).toBe("print");
      expect(calls[1].callee_name).toBe("greet");
      expect(calls[2].callee_name).toBe("method");
      expect(calls[2].is_method_call).toBe(true);
    });

    it("should detect class instantiation", () => {
      const source = `
class Person:
    pass

p = Person()
      `;

      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.py",
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls(context);

      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe("Person");
      expect(calls[0].is_constructor_call).toBe(true);
    });
  });

  describe("Rust", () => {
    const parser = new Parser();
    parser.setLanguage(Rust);

    it("should detect function and method calls", () => {
      const source = `
fn main() {
    println!("Hello");
    let s = String::new();
    s.len();
}
      `;

      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.rs",
        language: "rust",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls(context);

      // Should find println! macro, String::new(), and s.len()
      expect(calls.length).toBeGreaterThanOrEqual(3);

      const printlnCall = calls.find((c) => c.callee_name === "println!");
      expect(printlnCall).toBeDefined();

      const newCall = calls.find((c) => c.callee_name === "new");
      expect(newCall).toBeDefined();

      const lenCall = calls.find((c) => c.callee_name === "len");
      expect(lenCall).toBeDefined();
      expect(lenCall?.is_method_call).toBe(true);
    });

    it("should detect macro invocations", () => {
      const source = `
fn main() {
    vec![1, 2, 3];
    dbg!(42);
}
      `;

      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.rs",
        language: "rust",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls(context);

      const macros = calls.filter((c) => c.callee_name.endsWith("!"));
      expect(macros.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Cross-language consistency", () => {
    it("should have consistent structure across languages", () => {
      // Test that all languages return the same structure
      const languages: Language[] = [
        "javascript",
        "typescript",
        "python",
        "rust",
      ];

      for (const lang of languages) {
        const context: FunctionCallContext = {
          source_code: "",
          file_path: `test.${lang}`,
          language: lang,
          ast_root: {} as any, // Mock empty AST
        };

        const calls = find_function_calls(context);

        // Should return array even for empty input
        expect(Array.isArray(calls)).toBe(true);
      }
    });
  });
});

describe("Generic Function Call Processor", () => {
  describe("JavaScript configuration", () => {
    const parser = new Parser();
    parser.setLanguage(JavaScript);

    it("should detect simple function calls using config", () => {
      const source = `console.log("test");`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe("log");
      expect(calls[0].is_method_call).toBe(true);
    });

    it("should detect new expressions using config", () => {
      const source = `const obj = new MyClass();`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe("MyClass");
      expect(calls[0].is_constructor_call).toBe(true);
    });

    it("should count arguments correctly", () => {
      const source = `func(1, 2, 3);`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].arguments_count).toBe(3);
    });
  });

  describe("TypeScript configuration", () => {
    const parser = new Parser();
    parser.setLanguage(TypeScript.typescript);

    it("should handle generic type arguments", () => {
      const source = `const result = identity<string>('test');`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.ts" as FilePath,
        language: "typescript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe("identity");
    });

    it("should skip decorator calls (handled by bespoke)", () => {
      const source = `
        @Component()
        class MyClass {}
      `;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.ts" as FilePath,
        language: "typescript",
        ast_root: tree.rootNode,
      };

      // Generic processor should skip decorator calls
      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(0);
    });
  });

  describe("Python configuration", () => {
    const parser = new Parser();
    parser.setLanguage(Python);

    it("should detect Python calls using config", () => {
      const source = `print("hello")`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.py" as FilePath,
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe("print");
    });

    it("should detect method calls using attribute syntax", () => {
      const source = `obj.method()`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.py" as FilePath,
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe("method");
      expect(calls[0].is_method_call).toBe(true);
    });

    it("should detect constructor by capitalization", () => {
      const source = `person = Person("John")`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.py" as FilePath,
        language: "python",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].is_constructor_call).toBe(true);
    });
  });

  describe("Rust configuration", () => {
    const parser = new Parser();
    parser.setLanguage(Rust);

    it("should not detect macros (handled by bespoke)", () => {
      const source = `fn main() { println!("hello"); }`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.rs" as FilePath,
        language: "rust",
        ast_root: tree.rootNode,
      };

      // Macros are now handled by the bespoke handler
      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(0);
    });

    it("should detect method calls via field expression", () => {
      const source = `let len = s.len();`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.rs" as FilePath,
        language: "rust",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe("len");
      expect(calls[0].is_method_call).toBe(true);
    });

    it("should detect associated functions", () => {
      const source = `let s = String::new();`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.rs" as FilePath,
        language: "rust",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe("new");
    });
  });

  describe("Edge cases", () => {
    const parser = new Parser();
    parser.setLanguage(JavaScript);

    it("should handle nested calls", () => {
      const source = `outer(inner(42));`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls_generic(context);
      expect(calls).toHaveLength(2);
      expect(calls.map((c) => c.callee_name).sort()).toEqual([
        "inner",
        "outer",
      ]);
    });

    it("should handle empty argument lists", () => {
      const source = `func();`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls_generic(context);
      expect(calls[0].arguments_count).toBe(0);
    });

    it("should track location correctly", () => {
      const source = `
        // Line 1
        func(); // Line 2
      `;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls_generic(context);
      expect(calls[0].location.line).toBe(3); // 1-based line numbers
    });
  });

  describe("Enclosing function detection", () => {
    const parser = new Parser();
    parser.setLanguage(JavaScript);

    it("should detect calls within functions", () => {
      const source = `
        function outer() {
          inner();
        }
      `;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls_generic(context);
      expect(calls[0].caller_name).toBe("outer");
    });

    it("should use <module> for top-level calls", () => {
      const source = `console.log('top level');`;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls_generic(context);
      expect(calls[0].caller_name).toBe("<module>");
    });

    it("should handle anonymous functions", () => {
      const source = `
        const fn = () => {
          test();
        };
      `;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source as SourceCode,
        file_path: "test.js" as FilePath,
        language: "javascript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls_generic(context);
      expect(calls[0].caller_name).toMatch(/^<anonymous@/);
    });
  });
});

/**
 * Tests for Rust-specific function call detection
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import { FunctionCallContext } from "./function_calls";
// TODO: Re-enable after implementing tree-sitter query-based approach
// import { handle_rust_macros } from "./function_calls.rust";
import { find_function_calls } from "./function_calls";
import { SourceCode, FilePath } from "@ariadnejs/types";

// TODO: Re-enable after implementing tree-sitter query-based approach
describe.skip("Rust-specific Function Calls", () => {
  describe("Rust macros", () => {
    const parser = new Parser();
    parser.setLanguage(Rust);

    it("should detect macro invocations", () => {
      const source = `
        fn main() {
          println!("Hello");
          vec![1, 2, 3];
        }
      ` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.rs" as FilePath,
        language: "rust",
        ast_root: tree.rootNode,
      };

      // Rust macros are now handled by the bespoke handler
      const calls = handle_rust_macros(context);
      expect(calls).toHaveLength(2);
      expect(calls[0].callee_name).toBe("println!");
      expect(calls[1].callee_name).toBe("vec!");

      // All macro calls should have the is_macro_call flag
      calls.forEach((call) => {
        expect(call.is_macro_call).toBe(true);
      });
    });

    it("should detect various macro types", () => {
      const source = `
        fn test() {
          dbg!(42);
          assert_eq!(a, b);
          format!("hello {}", name);
          include_str!("file.txt");
        }
      ` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.rs" as FilePath,
        language: "rust",
        ast_root: tree.rootNode,
      };

      const calls = handle_rust_macros(context);
      const macroNames = calls.map((c) => c.callee_name).sort();
      expect(macroNames).toEqual([
        "assert_eq!",
        "dbg!",
        "format!",
        "include_str!",
      ]);

      // All should be marked as macro calls
      calls.forEach((call) => {
        expect(call.is_macro_call).toBe(true);
        expect(call.is_method_call).toBe(false);
        expect(call.is_constructor_call).toBe(false);
      });
    });

    it("should track enclosing function for macros", () => {
      const source = `
        fn outer() {
          println!("in outer");
        }
        
        fn main() {
          dbg!("in main");
        }
        
        // Top level macro
        assert_eq!(1, 1);
      ` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.rs" as FilePath,
        language: "rust",
        ast_root: tree.rootNode,
      };

      const calls = handle_rust_macros(context);

      const printlnCall = calls.find((c) => c.callee_name === "println!");
      expect(printlnCall?.caller_name).toBe("outer");

      const dbgCall = calls.find((c) => c.callee_name === "dbg!");
      expect(dbgCall?.caller_name).toBe("main");

      const assertCall = calls.find((c) => c.callee_name === "assert_eq!");
      expect(assertCall?.caller_name).toBe("<module>");
    });
  });

  describe("Integration with main processor", () => {
    const parser = new Parser();
    parser.setLanguage(Rust);

    it("should detect both macros and regular calls", () => {
      const source = `
        fn main() {
          println!("Starting");
          let s = String::new();
          s.push_str("hello");
          vec![1, 2, 3];
        }
      ` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.rs" as FilePath,
        language: "rust",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls(context);

      // Should find macros
      const printlnCall = calls.find((c) => c.callee_name === "println!");
      expect(printlnCall).toBeDefined();
      expect(printlnCall?.is_macro_call).toBe(true);

      const vecCall = calls.find((c) => c.callee_name === "vec!");
      expect(vecCall).toBeDefined();
      expect(vecCall?.is_macro_call).toBe(true);

      // Should find regular function calls
      const newCall = calls.find((c) => c.callee_name === "new");
      expect(newCall).toBeDefined();
      expect(newCall?.is_macro_call).not.toBe(true);

      const pushStrCall = calls.find((c) => c.callee_name === "push_str");
      expect(pushStrCall).toBeDefined();
      expect(pushStrCall?.is_method_call).toBe(true);
    });
  });
});

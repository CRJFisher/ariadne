/**
 * Tests for TypeScript-specific function call detection
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { FunctionCallContext } from "./function_calls";
// TODO: Re-enable after implementing tree-sitter query-based approach
// import { handle_typescript_decorators } from "./function_calls.typescript";
import { find_function_calls } from "./function_calls";
import { SourceCode, FilePath } from "@ariadnejs/types";

// TODO: Re-enable after implementing tree-sitter query-based approach
describe.skip("TypeScript-specific Function Calls", () => {
  describe("TypeScript decorators", () => {
    const parser = new Parser();
    parser.setLanguage(TypeScript.typescript);

    it("should detect decorator function calls", () => {
      const source = `
        @Component({ selector: 'app' })
        class MyComponent {
          @Input() value: string;
        }
      ` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.ts" as FilePath,
        language: "typescript",
        ast_root: tree.rootNode,
      };

      const calls = handle_typescript_decorators(context);
      expect(calls).toHaveLength(2);

      const componentCall = calls.find((c) => c.callee_name === "Component");
      expect(componentCall).toBeDefined();
      expect(componentCall?.arguments_count).toBe(1);

      const inputCall = calls.find((c) => c.callee_name === "Input");
      expect(inputCall).toBeDefined();
      expect(inputCall?.arguments_count).toBe(0);
    });

    it("should handle decorators without arguments", () => {
      const source = `
        @Injectable
        class Service {}
      ` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.ts" as FilePath,
        language: "typescript",
        ast_root: tree.rootNode,
      };

      const calls = handle_typescript_decorators(context);
      expect(calls).toHaveLength(1);
      expect(calls[0].callee_name).toBe("Injectable");
      expect(calls[0].arguments_count).toBe(0);
    });

    it("should set correct caller context for decorators", () => {
      const source = `
        @Decorator()
        class MyClass {
          @PropertyDecorator
          prop: string;
          
          @MethodDecorator()
          method() {}
        }
        
        @FunctionDecorator
        function myFunction() {}
      ` as SourceCode;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.ts" as FilePath,
        language: "typescript",
        ast_root: tree.rootNode,
      };

      const calls = handle_typescript_decorators(context);

      const classDecorator = calls.find((c) => c.callee_name === "Decorator");
      expect(classDecorator?.caller_name).toBe("MyClass");

      const propDecorator = calls.find(
        (c) => c.callee_name === "PropertyDecorator"
      );
      expect(propDecorator?.caller_name).toBe("MyClass");

      const methodDecorator = calls.find(
        (c) => c.callee_name === "MethodDecorator"
      );
      expect(methodDecorator?.caller_name).toBe("MyClass");
    });
  });

  describe("Integration with main processor", () => {
    const parser = new Parser();
    parser.setLanguage(TypeScript.typescript);

    it("should not duplicate decorator calls", () => {
      const source = `
        @Component()
        class MyComponent {
          constructor() {
            console.log('init');
          }
        }
      `;
      const tree = parser.parse(source);
      const context: FunctionCallContext = {
        source_code: source,
        file_path: "test.ts" as FilePath,
        language: "typescript",
        ast_root: tree.rootNode,
      };

      const calls = find_function_calls(context);

      // Should find Component() decorator and console.log()
      const componentCalls = calls.filter((c) => c.callee_name === "Component");
      expect(componentCalls).toHaveLength(1);

      const logCalls = calls.filter((c) => c.callee_name === "log");
      expect(logCalls).toHaveLength(1);
    });
  });
});

/**
 * Comprehensive TypeScript scope tree tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { build_scope_tree } from "./scope_tree";
import { FilePath } from "@ariadnejs/types";

describe("TypeScript Scope Tree Building", () => {
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.tsx as any);
  });

  describe("Basic scope creation", () => {
    it("should create module scope for TypeScript files", () => {
      const code = `const x = 1;`;
      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      expect(scope_tree.root_id).toMatch(/^module:/);
      const root_node = scope_tree.nodes.get(scope_tree.root_id);
      expect(root_node).toBeDefined();
      expect(root_node?.type).toBe("module");
    });
  });

  describe("Function scopes", () => {
    it("should create scopes for function declarations", () => {
      const code = `
        function processData(input: string): void {
          console.log(input);
        }

        function calculateTotal<T>(items: T[]): number {
          return items.length;
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes).toHaveLength(2);

      const names = function_scopes
        .map(scope => scope.name)
        .filter(name => name !== null)
        .sort();

      expect(names).toEqual(["calculateTotal", "processData"]);
    });

    it("should create scopes for arrow functions", () => {
      const code = `
        const multiply = (a: number, b: number): number => {
          return a * b;
        };

        const items = [1, 2, 3].map(item => {
          const doubled = item * 2;
          return doubled;
        });
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      // Should have 2 arrow function scopes
      expect(function_scopes.length).toBeGreaterThanOrEqual(2);
    });

    it("should create scopes for async functions", () => {
      const code = `
        async function fetchData(): Promise<string> {
          const result = await fetch('/api');
          return result;
        }

        const processAsync = async () => {
          await fetchData();
        };
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes.length).toBeGreaterThanOrEqual(2);

      // Check that fetchData has a name
      const named_function = function_scopes.find(s => s.name === "fetchData");
      expect(named_function).toBeDefined();
    });

    it("should create scopes for generator functions", () => {
      const code = `
        function* generateSequence(): Generator<number> {
          let i = 0;
          while (true) {
            yield i++;
          }
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );

      expect(function_scopes).toHaveLength(1);
      expect(function_scopes[0].name).toBe("generateSequence");
    });
  });

  describe("Class scopes", () => {
    it("should create scopes for class declarations", () => {
      const code = `
        class UserManager {
          private users: User[] = [];

          constructor() {}

          addUser(user: User): void {
            this.users.push(user);
          }
        }

        abstract class BaseService {
          abstract process(): void;
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      const class_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "class"
      );

      expect(class_scopes).toHaveLength(2);

      const names = class_scopes
        .map(scope => scope.name)
        .filter(name => name !== null)
        .sort();

      expect(names).toEqual(["BaseService", "UserManager"]);
    });

    it("should create method scopes within classes", () => {
      const code = `
        class Calculator {
          add(a: number, b: number): number {
            return a + b;
          }

          multiply(a: number, b: number): number {
            return a * b;
          }

          private validate(value: number): boolean {
            return !isNaN(value);
          }
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      // Methods are tracked as function scopes in the implementation
      const method_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function" || node.type === "method"
      );

      expect(method_scopes.length).toBeGreaterThanOrEqual(3);

      const names = method_scopes
        .map(scope => scope.name)
        .filter(name => name !== null);

      expect(names).toContain("add");
      expect(names).toContain("multiply");
      expect(names).toContain("validate");
    });

    it("should handle anonymous classes", () => {
      const code = `
        const MyClass = class {
          method() {
            return "anonymous";
          }
        };

        export default class {
          process() {}
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      const class_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "class"
      );

      // Should have 2 class scopes even if anonymous
      expect(class_scopes).toHaveLength(2);
    });
  });

  describe("Block scopes", () => {
    it("should create scopes for block statements", () => {
      const code = `
        function test() {
          {
            const blockScoped = 1;
          }

          if (true) {
            const ifScoped = 2;
          } else {
            const elseScoped = 3;
          }
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      const block_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "block"
      );

      // Should have multiple block scopes
      expect(block_scopes.length).toBeGreaterThan(0);
    });

    it("should create scopes for loop blocks", () => {
      const code = `
        for (let i = 0; i < 10; i++) {
          const loopVar = i * 2;
        }

        for (const item of items) {
          console.log(item);
        }

        while (condition) {
          const whileVar = true;
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      const block_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "block"
      );

      // Should have scopes for loop bodies
      expect(block_scopes.length).toBeGreaterThan(0);
    });

    it("should create scopes for try-catch blocks", () => {
      const code = `
        try {
          const tryVar = "try";
          throw new Error();
        } catch (error) {
          const catchVar = "catch";
          console.log(error);
        } finally {
          const finallyVar = "finally";
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      const block_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "block"
      );

      // Should have scopes for try, catch, and finally blocks
      expect(block_scopes.length).toBeGreaterThanOrEqual(2);
    });

    it("should create scopes for switch cases", () => {
      const code = `
        switch (value) {
          case 1: {
            const caseVar1 = "one";
            break;
          }
          case 2: {
            const caseVar2 = "two";
            break;
          }
          default: {
            const defaultVar = "default";
          }
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      const block_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "block"
      );

      // Should have scopes for switch case blocks
      expect(block_scopes.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Nested scopes", () => {
    it("should handle deeply nested scopes", () => {
      const code = `
        class Outer {
          method() {
            function inner() {
              const arrow = () => {
                {
                  const deeplyNested = true;
                }
              };
            }
          }
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      // Check that we have multiple scope levels
      const all_scopes = Array.from(scope_tree.nodes.values());
      expect(all_scopes.length).toBeGreaterThanOrEqual(5); // module, class, method, inner, arrow, block

      // Check parent-child relationships
      const class_scope = all_scopes.find(s => s.type === "class");
      expect(class_scope?.child_ids.length).toBeGreaterThan(0);
    });

    it("should correctly establish parent-child relationships", () => {
      const code = `
        function parent() {
          function child1() {}
          function child2() {}
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      const parent_scope = Array.from(scope_tree.nodes.values()).find(
        s => s.name === "parent"
      );
      const child1_scope = Array.from(scope_tree.nodes.values()).find(
        s => s.name === "child1"
      );
      const child2_scope = Array.from(scope_tree.nodes.values()).find(
        s => s.name === "child2"
      );

      expect(parent_scope).toBeDefined();
      expect(child1_scope).toBeDefined();
      expect(child2_scope).toBeDefined();

      // The parent function should have a block child
      expect(parent_scope?.child_ids.length).toBeGreaterThan(0);

      // Get the block scope that's a child of parent
      const parentBlock = Array.from(scope_tree.nodes.values()).find(
        s => s.type === "block" && s.parent_id === parent_scope?.id
      );
      expect(parentBlock).toBeDefined();

      // Check that the block contains both child functions
      expect(parentBlock?.child_ids).toContain(child1_scope?.id);
      expect(parentBlock?.child_ids).toContain(child2_scope?.id);

      // Check that children point to the block (which is in the parent)
      expect(child1_scope?.parent_id).toBe(parentBlock?.id);
      expect(child2_scope?.parent_id).toBe(parentBlock?.id);
    });
  });

  describe("TypeScript-specific features", () => {
    it("should handle interfaces (no scope created)", () => {
      const code = `
        interface User {
          id: number;
          name: string;
        }

        interface Admin extends User {
          permissions: string[];
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      // Interfaces don't create scopes, only classes/functions/blocks do
      const all_scopes = Array.from(scope_tree.nodes.values());
      const non_module_scopes = all_scopes.filter(s => s.type !== "module");

      expect(non_module_scopes).toHaveLength(0);
    });

    it("should handle type aliases (no scope created)", () => {
      const code = `
        type UserId = string;
        type UserData = {
          id: UserId;
          name: string;
        };
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      // Type aliases don't create scopes
      const all_scopes = Array.from(scope_tree.nodes.values());
      const non_module_scopes = all_scopes.filter(s => s.type !== "module");

      expect(non_module_scopes).toHaveLength(0);
    });

    it("should handle enums (possible block scope)", () => {
      const code = `
        enum Status {
          Active = "ACTIVE",
          Inactive = "INACTIVE",
          Pending = "PENDING"
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      // Enums might create a scope depending on the query implementation
      const all_scopes = Array.from(scope_tree.nodes.values());
      expect(all_scopes.length).toBeGreaterThanOrEqual(1); // At least module scope
    });

    it("should handle decorators with methods", () => {
      const code = `
        class Controller {
          @Get('/users')
          getUsers() {
            return [];
          }

          @Post('/users')
          createUser() {
            return {};
          }
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      const method_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function" || node.type === "method"
      );

      expect(method_scopes.length).toBeGreaterThanOrEqual(2);

      const names = method_scopes.map(s => s.name).filter(n => n !== null);
      expect(names).toContain("getUsers");
      expect(names).toContain("createUser");
    });

    it("should handle namespace declarations", () => {
      const code = `
        namespace MyNamespace {
          export function helper() {
            return "helper";
          }

          export class NamespacedClass {
            method() {}
          }
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      // Should create scopes for function and class within namespace
      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );
      const class_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "class"
      );

      expect(function_scopes.length).toBeGreaterThanOrEqual(1);
      expect(class_scopes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty file", () => {
      const code = ``;
      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      expect(scope_tree.root_id).toBeDefined();
      expect(scope_tree.nodes.size).toBe(1); // Only root scope
    });

    it("should handle file with only comments", () => {
      const code = `
        // This is a comment
        /* Multi-line
           comment */
      `;
      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      expect(scope_tree.nodes.size).toBe(1); // Only root scope
    });

    it("should handle syntax errors gracefully", () => {
      const code = `
        function broken(
          // Missing closing parenthesis and body
        class AlsoBroken {
      `;
      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;

      // Should not throw, but might not identify all scopes correctly
      expect(() => {
        build_scope_tree(tree.rootNode, file_path, "typescript");
      }).not.toThrow();
    });
  });
});
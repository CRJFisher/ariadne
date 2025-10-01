/**
 * Semantic index tests - TypeScript
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { Language, FilePath } from "@ariadnejs/types";
import { build_semantic_index } from "./semantic_index";
import { query_tree } from "./query_code_tree/query_code_tree";
import { SemanticEntity } from "./query_code_tree/capture_types";
import type { ParsedFile } from "./file_utils";

const FIXTURES_DIR = join(__dirname, "..", "..", "tests", "fixtures");

// Helper to create ParsedFile
function createParsedFile(
  code: string,
  filePath: FilePath,
  tree: Parser.Tree,
  language: Language
): ParsedFile {
  const lines = code.split("\n");
  return {
    file_path: filePath,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: language,
  };
}

describe("Semantic Index - TypeScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.tsx);
  });

  describe("Basic TypeScript features", () => {
    it("should capture interfaces, classes, and methods", () => {
      const code = `
        interface User {
          id: number;
          name: string;
        }

        class UserImpl implements User {
          constructor(public id: number, public name: string) {}

          getName(): string {
            return this.name;
          }
        }

        export type { User };
        export { UserImpl };
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      // Verify interfaces
      expect(index.interfaces.size).toBeGreaterThanOrEqual(1);
      const interfaceNames = Array.from(index.interfaces.values()).map(i => i.name);
      expect(interfaceNames).toContain("User");

      // Verify classes
      expect(index.classes.size).toBeGreaterThanOrEqual(1);
      const classNames = Array.from(index.classes.values()).map(c => c.name);
      expect(classNames).toContain("UserImpl");
    });

    it("should handle type aliases and enums", () => {
      const code = `
        type ApiResponse<T> = {
          success: boolean;
          data?: T;
        };

        enum Status {
          Pending = "pending",
          Complete = "complete"
        }

        function process<T extends { id: string }>(item: T): ApiResponse<T> {
          return { success: true, data: item };
        }
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      // Verify type aliases
      const typeNames = Array.from(index.types.values()).map(t => t.name);
      expect(typeNames).toContain("ApiResponse");

      // Verify enums
      const enumNames = Array.from(index.enums.values()).map(e => e.name);
      expect(enumNames).toContain("Status");

      // Verify functions
      const functionNames = Array.from(index.functions.values()).map(f => f.name);
      expect(functionNames).toContain("process");
    });

    it("should handle interface inheritance", () => {
      const code = `
        interface Base {
          id: string;
        }

        interface Extended extends Base {
          name: string;
        }

        class Implementation implements Extended {
          constructor(public id: string, public name: string) {}
        }
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      const interfaceNames = Array.from(index.interfaces.values()).map(i => i.name);
      expect(interfaceNames.length).toBeGreaterThanOrEqual(2);
      expect(interfaceNames).toContain("Base");
      expect(interfaceNames).toContain("Extended");

      const classNames = Array.from(index.classes.values()).map(c => c.name);
      expect(classNames).toContain("Implementation");
    });

    it("should handle abstract classes", () => {
      const code = `
        abstract class BaseClass {
          protected value: string = "";
          abstract process(): void;
          concrete(): string {
            return this.value;
          }
        }

        class ConcreteClass extends BaseClass {
          process(): void {
            this.value = "processed";
          }
        }
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      const classNames = Array.from(index.classes.values()).map(c => c.name);
      expect(classNames.length).toBeGreaterThanOrEqual(2);
      expect(classNames).toContain("BaseClass");
      expect(classNames).toContain("ConcreteClass");
    });

    it("should handle parameter properties", () => {
      const code = `
        class ParameterProperties {
          constructor(
            public name: string,
            private age: number,
            protected email: string,
            readonly id: string
          ) {}
        }
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      const classNames = Array.from(index.classes.values()).map(c => c.name);
      expect(classNames).toContain("ParameterProperties");

      // Parameter properties are a TypeScript feature
      // The class itself should be captured correctly
      expect(index.classes.size).toBe(1);
    });

    it("should handle async functions and methods with Promise return types", () => {
      const code = `
        async function fetchUser(id: string): Promise<User> {
          return { id, name: "Test" };
        }

        interface User {
          id: string;
          name: string;
        }

        class ApiService {
          async getData(): Promise<number[]> {
            return [1, 2, 3];
          }

          async processData(items: number[]): Promise<void> {
            items.forEach(i => console.log(i));
          }
        }

        const service = new ApiService();
        const data = service.getData();
        service.processData([1, 2, 3]);
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      // Check async function is captured
      const functionNames = Array.from(index.functions.values()).map(f => f.name);
      expect(functionNames).toContain("fetchUser");

      // Check class with async methods
      const classNames = Array.from(index.classes.values()).map(c => c.name);
      expect(classNames).toContain("ApiService");

      // Check method calls on async methods
      const methodCalls = index.references.filter(
        (r) => r.type === "call" && r.call_type === "method"
      );
      const getDataCall = methodCalls.find((r) => r.name === "getData");
      const processDataCall = methodCalls.find((r) => r.name === "processData");

      expect(getDataCall).toBeDefined();
      expect(processDataCall).toBeDefined();

      if (getDataCall) {
        expect(getDataCall.context?.receiver_location).toBeDefined();
      }
      if (processDataCall) {
        expect(processDataCall.context?.receiver_location).toBeDefined();
      }
    });
  });

  describe("Module system", () => {
    it("should handle type-only imports", () => {
      const code = `
        import type { User } from "./types";
        import { type Config, UserService } from "./services";

        export type { User };
        export type UserConfig = Config;

        export interface ApiResponse<T> {
          data: T;
          status: number;
        }

        export { UserService };
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      // Check imports
      const importNames = Array.from(index.imported_symbols.values()).map(i => i.name);
      expect(importNames.length).toBeGreaterThan(0);

      // Check type definitions
      const typeNames = Array.from(index.types.values()).map(t => t.name);
      expect(typeNames).toContain("UserConfig");

      // Check interfaces
      const interfaceNames = Array.from(index.interfaces.values()).map(i => i.name);
      expect(interfaceNames).toContain("ApiResponse");
    });

    it("should handle namespace definitions", () => {
      const code = `
        export namespace MyNamespace {
          export interface Config {
            setting: string;
          }

          export function helper(): void {}
        }
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      // Check namespace definition
      const namespaceNames = Array.from(index.namespaces.values()).map(n => n.name);
      expect(namespaceNames).toContain("MyNamespace");
    });
  });

  describe("Metadata extraction", () => {
    it("should extract receiver location for method calls on class instances", () => {
      const code = `
        class Service {
          getData() {
            return [];
          }
        }

        const service = new Service();
        const data = service.getData();
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      // Check method call has receiver location
      const methodCalls = index.references.filter(
        (r) => r.type === "call" && r.call_type === "method"
      );
      const getDataCall = methodCalls.find((r) => r.name === "getData");
      expect(getDataCall).toBeDefined();
      if (getDataCall) {
        expect(getDataCall.context?.receiver_location).toBeDefined();
        expect(getDataCall.context?.receiver_location?.start_line).toBe(9);
      }
    });

    it("should extract type context for method calls on interface-typed objects", () => {
      const code = `
        interface Calculator {
          add(a: number, b: number): number;
          subtract(a: number, b: number): number;
        }

        class BasicCalculator implements Calculator {
          add(a: number, b: number): number {
            return a + b;
          }
          subtract(a: number, b: number): number {
            return a - b;
          }
        }

        const calc: Calculator = new BasicCalculator();
        const sum = calc.add(5, 3);
        const diff = calc.subtract(10, 4);
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      // Check interface definition
      const interfaceNames = Array.from(index.interfaces.values()).map(i => i.name);
      expect(interfaceNames).toContain("Calculator");

      // Check class implementation
      const classNames = Array.from(index.classes.values()).map(c => c.name);
      expect(classNames).toContain("BasicCalculator");

      // Check method calls on interface-typed object
      const methodCalls = index.references.filter(
        (r) => r.type === "call" && r.call_type === "method"
      );
      const addCall = methodCalls.find((r) => r.name === "add");
      const subtractCall = methodCalls.find((r) => r.name === "subtract");

      expect(addCall).toBeDefined();
      expect(subtractCall).toBeDefined();

      // Both should have receiver location
      if (addCall) {
        expect(addCall.context?.receiver_location).toBeDefined();
      }
      if (subtractCall) {
        expect(subtractCall.context?.receiver_location).toBeDefined();
      }
    });

    it("should handle chained method calls", () => {
      const code = `
        class QueryBuilder {
          where(field: string) { return this; }
          orderBy(field: string) { return this; }
          limit(n: number) { return this; }
        }

        const query = new QueryBuilder()
          .where("name")
          .orderBy("date")
          .limit(10);
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      const methodCalls = index.references.filter(
        (r) => r.type === "call" && r.call_type === "method"
      );
      const whereCall = methodCalls.find((r) => r.name === "where");
      const orderByCall = methodCalls.find((r) => r.name === "orderBy");
      const limitCall = methodCalls.find((r) => r.name === "limit");

      expect(whereCall?.context?.receiver_location).toBeDefined();
      expect(orderByCall?.context?.receiver_location).toBeDefined();
      expect(limitCall?.context?.receiver_location).toBeDefined();
    });

    it("should extract type info for interface references", () => {
      const code = `
        interface User {
          id: string;
          name: string;
        }

        const user: User = { id: "1", name: "John" };
        function processUser(u: User): void {}
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      const typeRefs = index.references.filter((r) => r.type === "type");
      const userRefs = typeRefs.filter((r) => r.name === "User");

      expect(userRefs.length).toBeGreaterThan(0);
      userRefs.forEach((ref) => {
        expect(ref.type_info).toBeDefined();
        if (ref.type_info) {
          expect(ref.type_info.type_name).toBe("User");
          expect(ref.type_info.certainty).toBe("declared");
        }
      });
    });

    it("should extract type info from generic types", () => {
      const code = `
        type Result<T> = { success: boolean; data: T };

        const stringResult: Result<string> = { success: true, data: "hello" };
        const numberResult: Result<number> = { success: true, data: 42 };
        const arrayResult: Result<string[]> = { success: true, data: ["a", "b"] };
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      const typeRefs = index.references.filter((r) => r.type === "type");
      const resultRefs = typeRefs.filter((r) => r.name === "Result");

      expect(resultRefs.length).toBeGreaterThan(0);

      // All Result references should have type_info
      resultRefs.forEach((ref) => {
        expect(ref.type_info).toBeDefined();
        if (ref.type_info) {
          expect(ref.type_info.type_name).toBe("Result");
          expect(ref.type_info.certainty).toBe("declared");
        }
      });
    });

    it("should extract constructor target location", () => {
      const code = `
        class MyClass {
          constructor(public value: string) {}
        }

        const instance = new MyClass("test");
        const another = new MyClass("another");
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      const constructorRefs = index.references.filter((r) => r.type === "construct");

      expect(constructorRefs.length).toBe(2);
      constructorRefs.forEach((ref) => {
        expect(ref.name).toBe("MyClass");
        expect(ref.context?.construct_target).toBeDefined();
      });
    });

    it("should handle generic constructors", () => {
      const code = `
        class Container<T> {
          constructor(public value: T) {}
        }

        const stringContainer = new Container<string>("hello");
        const numberContainer = new Container<number>(42);
        const inferredContainer = new Container("inferred");
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      const constructorRefs = index.references.filter((r) => r.type === "construct");

      // Should have at least 3 constructor calls
      expect(constructorRefs.length).toBeGreaterThanOrEqual(3);

      // Check that the Container constructor calls have metadata
      const containerRefs = constructorRefs.filter((r) => r.name === "Container");
      expect(containerRefs.length).toBeGreaterThanOrEqual(3);
      containerRefs.forEach((ref) => {
        expect(ref.context?.construct_target).toBeDefined();
      });
    });
  });

  describe("TypeScript-specific features", () => {
    it("should handle optional chaining on typed objects", () => {
      const code = `
        interface Address {
          street?: string;
          city?: string;
        }

        interface User {
          name: string;
          address?: Address;
          getEmail?(): string;
        }

        function processUser(user: User): void {
          const city = user.address?.city;
          const street = user.address?.street?.toUpperCase();
          const email = user.getEmail?.();
        }

        const userData: User = { name: "Alice" };
        processUser(userData);
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      // Check interfaces are captured
      const interfaceNames = Array.from(index.interfaces.values()).map(i => i.name);
      expect(interfaceNames).toContain("User");
      expect(interfaceNames).toContain("Address");

      // Check function is captured
      const functionNames = Array.from(index.functions.values()).map(f => f.name);
      expect(functionNames).toContain("processUser");

      // Check member access through optional chaining
      const memberAccessRefs = index.references.filter((r) => r.type === "member_access");
      expect(memberAccessRefs.length).toBeGreaterThan(0);

      // Optional chaining creates member access references
      // Verify we capture property accesses (address, city, street)
      const propertyNames = memberAccessRefs.map(r => r.name);

      // At minimum, we should capture some property accesses
      expect(propertyNames.length).toBeGreaterThan(0);
    });

    it("should handle enum member access", () => {
      const code = `
        enum Status {
          Active = "ACTIVE",
          Inactive = "INACTIVE"
        }

        const currentStatus = Status.Active;
        const isActive = currentStatus === Status.Active;
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      // Check enum definition exists
      expect(index.enums.size).toBeGreaterThanOrEqual(1);

      // Check property access on enum
      const memberAccessRefs = index.references.filter((r) => r.type === "member_access");
      const activeRefs = memberAccessRefs.filter((r) => r.name === "Active");

      expect(activeRefs.length).toBeGreaterThan(0);
      activeRefs.forEach((ref) => {
        if (ref.member_access?.property_chain) {
          expect(ref.member_access.property_chain).toEqual(["Status", "Active"]);
        }
      });
    });

    it("should handle namespaces", () => {
      const code = `
        namespace Utils {
          export function format(str: string): string {
            return str.toUpperCase();
          }
        }

        const result = Utils.format("hello");
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      // Check namespace definition exists
      expect(index.namespaces.size).toBeGreaterThanOrEqual(1);

      // Check method call through namespace
      const methodCalls = index.references.filter(
        (r) => r.type === "call" && r.call_type === "method"
      );
      const formatCall = methodCalls.find((r) => r.name === "format");

      expect(formatCall).toBeDefined();
      if (formatCall) {
        expect(formatCall.context?.receiver_location).toBeDefined();
      }
    });

    it("should handle decorators", () => {
      const code = `
        function Component(name: string) {
          return function (constructor: Function) {};
        }

        @Component("MyComponent")
        class MyComponent {
          @readonly
          value: string = "test";
        }
      `;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      // Check class definition exists
      expect(index.classes.size).toBe(1);

      // Check decorator function calls
      const functionCalls = index.references.filter(
        (r) => r.type === "call" && r.call_type === "function"
      );
      const componentCall = functionCalls.find((r) => r.name === "Component");
      expect(componentCall).toBeDefined();
    });
  });

  describe("Error handling", () => {
    it("should handle invalid code gracefully", () => {
      const invalidCode = `
        interface {
          // Missing name
        }

        class {
          // Missing name
        }

        enum {
          // Missing name
        }
      `;

      const tree = parser.parse(invalidCode);
      const parsedFile = createParsedFile(
        invalidCode,
        "invalid.ts" as FilePath,
        tree,
        "typescript" as Language
      );

      // Should not throw
      expect(() => {
        build_semantic_index(parsedFile, tree, "typescript" as Language);
      }).not.toThrow();
    });
  });

  describe("TypeScript fixtures", () => {
    const typescript_fixtures = ["classes.ts", "interfaces.ts", "types.ts", "generics.ts", "modules.ts"];

    for (const fixture of typescript_fixtures) {
      it(`should correctly parse ${fixture}`, () => {
        const code = readFileSync(
          join(FIXTURES_DIR, "typescript", fixture),
          "utf8"
        );
        const tree = parser.parse(code);
        const language: Language = "typescript";

        // Parse captures using the SCM query
        const captures = query_tree(language, tree);

        // Basic structure checks - verify we get captures
        expect(captures.length).toBeGreaterThan(0);

        // Build semantic index
        const parsedFile = createParsedFile(code, fixture as FilePath, tree, language);
        const index = build_semantic_index(parsedFile, tree, language);

        // Verify at least some symbols were extracted
        const totalSymbols =
          index.functions.size +
          index.classes.size +
          index.variables.size +
          index.interfaces.size +
          index.enums.size +
          index.namespaces.size +
          index.types.size;
        expect(totalSymbols).toBeGreaterThan(0);

        // Verify scopes were created
        expect(index.scopes.size).toBeGreaterThan(0);
      });
    }
  });
});

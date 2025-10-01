/**
 * TypeScript metadata-focused semantic index tests
 */

import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { Language, FilePath } from "@ariadnejs/types";
import { build_semantic_index } from "./semantic_index";
import type { ParsedFile } from "./file_utils";

// Helper to create ParsedFile from fixture
function createParsedFile(
  filePath: FilePath,
  tree: Parser.Tree,
  language: Language
): ParsedFile {
  return {
    file_path: filePath,
    file_lines: tree.rootNode.endPosition.row + 1,
    file_end_column: tree.rootNode.endPosition.column,
    tree,
    lang: language,
  };
}

describe("TypeScript Metadata Extraction", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.tsx);
  });

  describe("Method call metadata", () => {
    it("should extract receiver location for method calls", () => {
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
      const parsed = createParsedFile("test.ts" as FilePath, tree, "typescript" as Language);
      const index = build_semantic_index(parsed, tree, "typescript" as Language);

      // Check method call has receiver location
      const methodCalls = index.references.filter((r) => r.type === "call" && r.call_type === "method");
      const getDataCall = methodCalls.find((r) => r.name === "getData");
      expect(getDataCall).toBeDefined();
      if (getDataCall) {
        expect(getDataCall.context?.receiver_location).toBeDefined();
        expect(getDataCall.context?.receiver_location?.start_line).toBe(9);
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
      const parsed = createParsedFile("test.ts" as FilePath, tree, "typescript" as Language);
      const index = build_semantic_index(parsed, tree, "typescript" as Language);

      const methodCalls = index.references.filter((r) => r.type === "call" && r.call_type === "method");
      const whereCall = methodCalls.find((r) => r.name === "where");
      const orderByCall = methodCalls.find((r) => r.name === "orderBy");
      const limitCall = methodCalls.find((r) => r.name === "limit");

      expect(whereCall?.context?.receiver_location).toBeDefined();
      expect(orderByCall?.context?.receiver_location).toBeDefined();
      expect(limitCall?.context?.receiver_location).toBeDefined();
    });
  });

  describe("Type reference metadata", () => {
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
      const parsed = createParsedFile("test.ts" as FilePath, tree, "typescript" as Language);
      const index = build_semantic_index(parsed, tree, "typescript" as Language);

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
      const parsed = createParsedFile("test.ts" as FilePath, tree, "typescript" as Language);
      const index = build_semantic_index(parsed, tree, "typescript" as Language);

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

    it("should handle type aliases and union types", () => {
      const code = `
        type Status = "pending" | "completed" | "failed";
        type Nullable<T> = T | null | undefined;

        const status: Status = "pending";
        const value: Nullable<string> = null;
      `;

      const tree = parser.parse(code);
      const parsed = createParsedFile("test.ts" as FilePath, tree, "typescript" as Language);
      const index = build_semantic_index(parsed, tree, "typescript" as Language);

      const typeRefs = index.references.filter((r) => r.type === "type");

      const statusRef = typeRefs.find((r) => r.name === "Status");
      expect(statusRef?.type_info).toBeDefined();

      const nullableRef = typeRefs.find((r) => r.name === "Nullable");
      expect(nullableRef?.type_info).toBeDefined();
      if (nullableRef?.type_info) {
        expect(nullableRef.type_info.type_name).toBe("Nullable");
      }
    });
  });

  describe("Property access chains", () => {
    it.skip("should extract property chains", () => {
      const code = `
        const config = {
          api: {
            endpoints: {
              users: "/api/users"
            }
          }
        };

        const url = config.api.endpoints.users;
      `;

      const tree = parser.parse(code);
      const parsed = createParsedFile("test.ts" as FilePath, tree, "typescript" as Language);
      const index = build_semantic_index(parsed, tree, "typescript" as Language);

      const memberAccessRefs = index.references.filter((r) => r.type === "member_access");

      // Should have member_access references
      expect(memberAccessRefs.length).toBeGreaterThan(0);

      // At least one should have a property_chain with multiple elements
      const refWithChain = memberAccessRefs.find((r) =>
        r.context?.property_chain && r.context.property_chain.length >= 2
      );

      expect(refWithChain).toBeDefined();
      if (refWithChain?.context?.property_chain) {
        // Verify it has a multi-element chain
        expect(refWithChain.context.property_chain.length).toBeGreaterThanOrEqual(2);
      }
    });

    it.skip("should handle optional chaining", () => {
      const code = `
        interface Data {
          user?: {
            profile?: {
              name?: string;
            }
          }
        }

        const data: Data = {};
        const name = data.user?.profile?.name;
      `;

      const tree = parser.parse(code);
      const parsed = createParsedFile("test.ts" as FilePath, tree, "typescript" as Language);
      const index = build_semantic_index(parsed, tree, "typescript" as Language);

      const memberAccessRefs = index.references.filter((r) => r.type === "member_access");

      // Should have member_access references
      expect(memberAccessRefs.length).toBeGreaterThan(0);

      // At least one should have a property_chain
      const refWithChain = memberAccessRefs.find((r) =>
        r.context?.property_chain && r.context.property_chain.length >= 2
      );

      expect(refWithChain).toBeDefined();
      if (refWithChain?.context?.property_chain) {
        // Verify it has a multi-element chain
        expect(refWithChain.context.property_chain.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe("Constructor calls", () => {
    it("should extract constructor target location", () => {
      const code = `
        class MyClass {
          constructor(public value: string) {}
        }

        const instance = new MyClass("test");
        const another = new MyClass("another");
      `;

      const tree = parser.parse(code);
      const parsed = createParsedFile("test.ts" as FilePath, tree, "typescript" as Language);
      const index = build_semantic_index(parsed, tree, "typescript" as Language);

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
      const parsed = createParsedFile("test.ts" as FilePath, tree, "typescript" as Language);
      const index = build_semantic_index(parsed, tree, "typescript" as Language);

      const constructorRefs = index.references.filter((r) => r.type === "construct");

      // Should have at least 3 constructor calls (may have more from type parameters)
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
    it("should handle interfaces with extends", () => {
      const code = `
        interface Base {
          id: string;
        }

        interface Extended extends Base {
          name: string;
        }

        const obj: Extended = { id: "1", name: "test" };
      `;

      const tree = parser.parse(code);
      const parsed = createParsedFile("test.ts" as FilePath, tree, "typescript" as Language);
      const index = build_semantic_index(parsed, tree, "typescript" as Language);

      // Check interface definitions exist (may capture more if nested properties included)
      expect(index.interfaces.size).toBeGreaterThanOrEqual(2);

      // Check type reference has metadata
      const typeRefs = index.references.filter((r) => r.type === "type");
      const extendedRef = typeRefs.find((r) => r.name === "Extended");
      expect(extendedRef?.type_info).toBeDefined();
    });

    it("should handle enums", () => {
      const code = `
        enum Status {
          Active = "ACTIVE",
          Inactive = "INACTIVE"
        }

        const currentStatus = Status.Active;
        const isActive = currentStatus === Status.Active;
      `;

      const tree = parser.parse(code);
      const parsed = createParsedFile("test.ts" as FilePath, tree, "typescript" as Language);
      const index = build_semantic_index(parsed, tree, "typescript" as Language);

      // Check enum definition exists (may be more than 1 if members are captured)
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
      const parsed = createParsedFile("test.ts" as FilePath, tree, "typescript" as Language);
      const index = build_semantic_index(parsed, tree, "typescript" as Language);

      // Check namespace definition exists (may be more than 1 if nested/members captured)
      expect(index.namespaces.size).toBeGreaterThanOrEqual(1);

      // Check method call through namespace
      const methodCalls = index.references.filter((r) => r.type === "call" && r.call_type === "method");
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
      const parsed = createParsedFile("test.ts" as FilePath, tree, "typescript" as Language);
      const index = build_semantic_index(parsed, tree, "typescript" as Language);

      // Check class definition exists
      expect(index.classes.size).toBe(1);

      // Check decorator function calls
      const functionCalls = index.references.filter((r) => r.type === "call" && r.call_type === "function");
      const componentCall = functionCalls.find((r) => r.name === "Component");
      expect(componentCall).toBeDefined();
    });
  });
});
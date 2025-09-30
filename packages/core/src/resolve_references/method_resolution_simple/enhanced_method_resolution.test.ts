/**
 * Tests for enhanced method resolution
 */

import { describe, it, expect, beforeAll } from "vitest";
import { parse_code } from "../../index_single_file/query_code_tree/query_code_tree";
import { build_semantic_index } from "../../index_single_file/semantic_index";
import { resolve_methods_enhanced } from "./enhanced_method_resolution";
import { resolve_methods } from "./method_resolution";
import type { FilePath, SymbolName, SymbolId } from "@ariadnejs/types";

describe("Enhanced Method Resolution", () => {
  describe("TypeScript", () => {
    it("should resolve methods with explicit type annotations", () => {
      const code = `
        class User {
          getName(): string {
            return this.name;
          }

          getAge(): number {
            return this.age;
          }
        }

        class Admin extends User {
          getRole(): string {
            return this.role;
          }
        }

        function processUser() {
          const user: User = new User();
          user.getName(); // Should resolve to User.getName

          const admin: Admin = new Admin();
          admin.getRole(); // Should resolve to Admin.getRole
          admin.getName(); // Should resolve to User.getName (inherited)
        }
      `;

      const file_path = "test.ts" as FilePath;
      const tree = parse_code(code, "typescript");
      const index = build_semantic_index(file_path, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();

      // Test enhanced resolution
      const enhanced_results = resolve_methods_enhanced(indices, imports);

      // Should have resolved all method calls
      expect(enhanced_results.method_calls.size).toBeGreaterThan(0);
      expect(enhanced_results.constructor_calls.size).toBe(2); // new User(), new Admin()
    });

    it("should resolve methods with constructor tracking", () => {
      const code = `
        class Service {
          start() { console.log("Starting"); }
          stop() { console.log("Stopping"); }
        }

        const service = new Service();
        service.start(); // Should resolve via constructor tracking
        service.stop();  // Should resolve via constructor tracking

        let another = service;
        another.start(); // Should resolve via assignment chain
      `;

      const file_path = "test.ts" as FilePath;
      const tree = parse_code(code, "typescript");
      const index = build_semantic_index(file_path, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();

      const enhanced_results = resolve_methods_enhanced(indices, imports);

      // Should resolve all method calls
      expect(enhanced_results.method_calls.size).toBe(3); // start, stop, start
      expect(enhanced_results.constructor_calls.size).toBe(1); // new Service()
    });

    it("should resolve methods with assignment chains", () => {
      const code = `
        class Database {
          connect() { return this; }
          query(sql: string) { return []; }
          close() { }
        }

        const db1 = new Database();
        const db2 = db1;
        const db3 = db2;

        db3.connect(); // Should resolve through assignment chain
        db3.query("SELECT *"); // Should resolve through assignment chain
        db3.close(); // Should resolve through assignment chain
      `;

      const file_path = "test.ts" as FilePath;
      const tree = parse_code(code, "typescript");
      const index = build_semantic_index(file_path, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();

      const enhanced_results = resolve_methods_enhanced(indices, imports);

      // Should resolve all method calls through assignment chain
      expect(enhanced_results.method_calls.size).toBe(3);
    });

    it("should compare with original resolution", async () => {
      const code = `
        class Calculator {
          add(a: number, b: number): number { return a + b; }
          subtract(a: number, b: number): number { return a - b; }
        }

        const calc: Calculator = new Calculator();
        calc.add(1, 2);
        calc.subtract(5, 3);

        // More complex case
        function getCalculator(): Calculator {
          return new Calculator();
        }

        const calc2 = getCalculator();
        calc2.add(10, 20); // Harder to resolve without type flow
      `;

      const file_path = "test.ts" as FilePath;
      const tree = parse_code(code, "typescript");
      const index = build_semantic_index(file_path, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();

      // Build local type context for original resolution
      const { build_local_type_context } = await import(
        "../local_type_context/local_type_context"
      );
      const local_types = build_local_type_context(indices, imports);

      // Compare both approaches
      const original_results = resolve_methods(indices, imports, local_types);
      const enhanced_results = resolve_methods_enhanced(indices, imports);

      console.log(
        `Original resolved: ${original_results.method_calls.size} methods`
      );
      console.log(
        `Enhanced resolved: ${enhanced_results.method_calls.size} methods`
      );

      // Enhanced should resolve at least as many as original
      expect(enhanced_results.method_calls.size).toBeGreaterThanOrEqual(
        original_results.method_calls.size
      );
    });
  });

  describe("Python", () => {
    it("should resolve methods with type hints", () => {
      const code = `
class User:
    def get_name(self) -> str:
        return self.name

    def get_age(self) -> int:
        return self.age

class Admin(User):
    def get_role(self) -> str:
        return self.role

def process_users():
    user: User = User()
    user.get_name()  # Should resolve to User.get_name

    admin: Admin = Admin()
    admin.get_role()  # Should resolve to Admin.get_role
    admin.get_name()  # Should resolve to User.get_name (inherited)
`;

      const file_path = "test.py" as FilePath;
      const tree = parse_code(code, "python");
      const index = build_semantic_index(file_path, tree, "python");

      const indices = new Map([[file_path, index]]);
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();

      const enhanced_results = resolve_methods_enhanced(indices, imports);

      // Should resolve Python method calls
      expect(enhanced_results.method_calls.size).toBeGreaterThan(0);
    });
  });

  describe("JavaScript", () => {
    it("should resolve methods with JSDoc annotations", () => {
      const code = `
        /**
         * @class
         */
        class Service {
          start() { console.log("Starting"); }
          stop() { console.log("Stopping"); }
        }

        /** @type {Service} */
        const service = new Service();
        service.start(); // Should resolve with JSDoc type
        service.stop();  // Should resolve with JSDoc type
      `;

      const file_path = "test.js" as FilePath;
      const tree = parse_code(code, "javascript");
      const index = build_semantic_index(file_path, tree, "javascript");

      const indices = new Map([[file_path, index]]);
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();

      const enhanced_results = resolve_methods_enhanced(indices, imports);

      // Should resolve with constructor tracking even without explicit types
      expect(enhanced_results.method_calls.size).toBeGreaterThan(0);
      expect(enhanced_results.constructor_calls.size).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle methods with same name in different classes", () => {
      const code = `
        class Dog {
          speak() { return "Woof!"; }
        }

        class Cat {
          speak() { return "Meow!"; }
        }

        const dog = new Dog();
        const cat = new Cat();

        dog.speak(); // Should resolve to Dog.speak
        cat.speak(); // Should resolve to Cat.speak
      `;

      const file_path = "test.ts" as FilePath;
      const tree = parse_code(code, "typescript");
      const index = build_semantic_index(file_path, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();

      const enhanced_results = resolve_methods_enhanced(indices, imports);

      // Should correctly differentiate between methods with same name
      expect(enhanced_results.method_calls.size).toBe(2);

      // Verify they resolve to different methods
      const method_ids = Array.from(enhanced_results.method_calls.values());
      expect(new Set(method_ids).size).toBe(2); // Should be 2 unique method IDs
    });

    it("should handle unique method names", () => {
      const code = `
        class UniqueClass {
          veryUniqueMethodName() { return "unique"; }
        }

        const obj = new UniqueClass();
        obj.veryUniqueMethodName(); // Should resolve with UNIQUE_METHOD strategy
      `;

      const file_path = "test.ts" as FilePath;
      const tree = parse_code(code, "typescript");
      const index = build_semantic_index(file_path, tree, "typescript");

      const indices = new Map([[file_path, index]]);
      const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();

      const enhanced_results = resolve_methods_enhanced(indices, imports);

      // Should resolve unique method name
      expect(enhanced_results.method_calls.size).toBe(1);
    });
  });
});

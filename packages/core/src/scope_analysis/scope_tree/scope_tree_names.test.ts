/**
 * Test scope name extraction from tree-sitter queries
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import { build_scope_tree } from "./scope_tree";
import { FilePath } from "@ariadnejs/types";

describe("Scope Name Extraction", () => {
  describe("JavaScript", () => {
    const parser = new Parser();
    parser.setLanguage(JavaScript as any);

    it("should extract function names", () => {
      const code = `
        function processData() {
          const x = 1;
        }

        function calculateTotal(items) {
          return items.length;
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      // Find function scopes and check their names
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

    it("should extract class names", () => {
      const code = `
        class UserManager {
          constructor() {}
          getUser() {}
        }

        class DataProcessor {
          process() {}
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.js" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "javascript");

      // Find class scopes and check their names
      const class_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "class"
      );

      expect(class_scopes).toHaveLength(2);

      const names = class_scopes
        .map(scope => scope.name)
        .filter(name => name !== null)
        .sort();

      expect(names).toEqual(["DataProcessor", "UserManager"]);
    });
  });

  describe("TypeScript", () => {
    const parser = new Parser();
    parser.setLanguage(TypeScript.tsx as any);

    it("should extract function and class names", () => {
      const code = `
        interface IUser {
          name: string;
        }

        function getUserName(user: IUser): string {
          return user.name;
        }

        class UserService {
          getAll(): IUser[] {
            return [];
          }
        }
      `;

      const tree = parser.parse(code);
      const file_path = "/test.ts" as FilePath;
      const scope_tree = build_scope_tree(tree.rootNode, file_path, "typescript");

      // Check function names
      const function_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "function"
      );
      expect(function_scopes.length).toBeGreaterThan(0);

      const func_names = function_scopes
        .map(scope => scope.name)
        .filter(name => name !== null);

      expect(func_names).toContain("getUserName");

      // Check class names
      const class_scopes = Array.from(scope_tree.nodes.values()).filter(
        node => node.type === "class"
      );
      expect(class_scopes.length).toBeGreaterThan(0);

      const class_names = class_scopes
        .map(scope => scope.name)
        .filter(name => name !== null);

      expect(class_names).toContain("UserService");
    });
  });
});
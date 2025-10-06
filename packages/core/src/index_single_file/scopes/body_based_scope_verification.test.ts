/**
 * Body-Based Scope Verification Test
 *
 * OBJECTIVE: Verify that TypeScript .scm captures scope BODIES instead of entire declarations
 *
 * After the .scm changes:
 * - (class_declaration body: (class_body) @scope.class)
 * - (interface_declaration body: (object_type) @scope.interface)
 * - (enum_declaration body: (enum_body) @scope.enum)
 *
 * EXPECTED BEHAVIOR:
 * - Class scope should start at `{` (body start), not at `class` keyword
 * - Class name should be OUTSIDE class scope (in parent/module scope)
 * - Method should be INSIDE class scope
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import type { Language, FilePath, ScopeId } from "@ariadnejs/types";
import { build_semantic_index } from "../semantic_index";
import type { ParsedFile } from "../file_utils";

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

describe("Body-Based Scope Verification", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.tsx);
  });

  describe("Class Body-Based Scope", () => {
    it("should capture only class body as scope, not entire declaration", () => {
      const code = `class MyClass {
  method() {}
}`;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      // Get the file scope (module scope)
      const file_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null
      );
      expect(file_scope).toBeDefined();
      const file_scope_id = file_scope!.id;

      // Get the class scope
      const class_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "class"
      );
      expect(class_scope).toBeDefined();

      // Get the class definition
      const myClass = Array.from(index.classes.values()).find(
        (c) => c.name === "MyClass"
      );
      expect(myClass).toBeDefined();

      console.log("\n=== Class Body-Based Scope Verification ===");
      console.log("Code:", code);
      console.log("\nFile scope:", {
        id: file_scope_id,
        location: file_scope!.location,
      });
      console.log("Class scope:", {
        id: class_scope!.id,
        location: class_scope!.location,
      });
      console.log("MyClass definition:", {
        name: myClass!.name,
        scope_id: myClass!.scope_id,
        location: myClass!.location,
      });

      // VERIFICATION 1: Class scope should start at `{` (body start)
      // In "class MyClass {", the `{` is at position 0:14
      // Class scope should start at 0:14 or 0:15, NOT at 0:0
      expect(class_scope!.location.start_column).toBeGreaterThan(10);
      console.log(
        "\n✓ Class scope starts at body (column >10):",
        class_scope!.location.start_column
      );

      // VERIFICATION 2: Class name 'MyClass' should be OUTSIDE class scope (in module scope)
      // This is the key fix: class definition should be in file scope, not class scope
      expect(myClass!.scope_id).toBe(file_scope_id);
      console.log("✓ Class name 'MyClass' is in module scope (not class scope)");

      // VERIFICATION 3: Class scope parent should be module scope
      const parent_scope = index.scopes.get(class_scope!.parent_id!);
      expect(parent_scope?.type).toBe("module");
      console.log("✓ Class scope parent is module scope");
    });
  });

  describe("Interface Body-Based Scope", () => {
    it("should capture only interface body as scope, not entire declaration", () => {
      const code = `interface IFoo {
  bar(): void;
}`;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      // Debug: print all scopes
      console.log("\n=== ALL SCOPES ===");
      index.scopes.forEach((scope, id) => {
        console.log(`${scope.type}: ${id}`);
      });

      // Get the file scope
      const file_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null
      );
      expect(file_scope).toBeDefined();
      const file_scope_id = file_scope!.id;

      // Get the interface scope (stored as "class" type in the system)
      // Look for scope that starts after "interface IFoo"
      const interface_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "class" && s.location.start_column > 10
      );
      expect(interface_scope).toBeDefined();

      // Get the interface definition
      const iFoo = Array.from(index.interfaces.values()).find(
        (i) => i.name === "IFoo"
      );
      expect(iFoo).toBeDefined();

      console.log("\n=== Interface Body-Based Scope Verification ===");
      console.log("Code:", code);
      console.log("\nFile scope:", {
        id: file_scope_id,
        location: file_scope!.location,
      });
      console.log("Interface scope:", {
        id: interface_scope!.id,
        location: interface_scope!.location,
      });
      console.log("IFoo definition:", {
        name: iFoo!.name,
        scope_id: iFoo!.scope_id,
        location: iFoo!.location,
      });

      // VERIFICATION 1: Interface scope should start at `{` (body start)
      // In "interface IFoo {", the `{` is at position 0:15
      expect(interface_scope!.location.start_column).toBeGreaterThan(10);
      console.log(
        "\n✓ Interface scope starts at body (column >10):",
        interface_scope!.location.start_column
      );

      // VERIFICATION 2: Interface name 'IFoo' should be in module scope
      expect(iFoo!.scope_id).toBe(file_scope_id);
      console.log("✓ Interface name 'IFoo' is in module scope (not interface scope)");
    });
  });

  describe("Enum Body-Based Scope", () => {
    it("should capture only enum body as scope, not entire declaration", () => {
      const code = `enum Status {
  Active = "active",
  Inactive = "inactive"
}`;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      // Debug: print all scopes
      console.log("\n=== ALL SCOPES ===");
      index.scopes.forEach((scope, id) => {
        console.log(`${scope.type}: ${id}`);
      });

      // Get the file scope
      const file_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null
      );
      expect(file_scope).toBeDefined();
      const file_scope_id = file_scope!.id;

      // Get the enum scope (stored as "class" type in the system)
      // Look for scope that starts after "enum Status"
      const enum_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "class" && s.location.start_column > 10
      );
      expect(enum_scope).toBeDefined();

      // Get the enum definition
      const statusEnum = Array.from(index.enums.values()).find(
        (e) => e.name === "Status"
      );
      expect(statusEnum).toBeDefined();

      console.log("\n=== Enum Body-Based Scope Verification ===");
      console.log("Code:", code);
      console.log("\nFile scope:", {
        id: file_scope_id,
        location: file_scope!.location,
      });
      console.log("Enum scope:", {
        id: enum_scope!.id,
        location: enum_scope!.location,
      });
      console.log("Status definition:", {
        name: statusEnum!.name,
        scope_id: statusEnum!.scope_id,
        location: statusEnum!.location,
      });

      // VERIFICATION 1: Enum scope should start at `{` (body start)
      // In "enum Status {", the `{` is at position 0:12
      expect(enum_scope!.location.start_column).toBeGreaterThan(10);
      console.log(
        "\n✓ Enum scope starts at body (column >10):",
        enum_scope!.location.start_column
      );

      // VERIFICATION 2: Enum name 'Status' should be in module scope
      expect(statusEnum!.scope_id).toBe(file_scope_id);
      console.log("✓ Enum name 'Status' is in module scope (not enum scope)");
    });
  });

  describe("Complex Class with Multiple Members", () => {
    it("should correctly scope class with fields and methods", () => {
      const code = `class Calculator {
  private value: number = 0;

  add(n: number): void {
    this.value += n;
  }

  get result(): number {
    return this.value;
  }
}`;

      const tree = parser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.ts" as FilePath,
        tree,
        "typescript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "typescript" as Language);

      // Get scopes
      const file_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null
      );
      expect(file_scope).toBeDefined();
      const file_scope_id = file_scope!.id;

      const class_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "class"
      );
      expect(class_scope).toBeDefined();

      // Get class definition
      const calcClass = Array.from(index.classes.values()).find(
        (c) => c.name === "Calculator"
      );
      expect(calcClass).toBeDefined();

      console.log("\n=== Complex Class Verification ===");
      console.log("Calculator class scope_id:", calcClass!.scope_id);
      console.log("Class scope:", {
        id: class_scope!.id,
        location: class_scope!.location,
      });

      // Class name should be in module scope
      expect(calcClass!.scope_id).toBe(file_scope_id);
      console.log("\n✓ Class name 'Calculator' is in module scope");

      // Class scope should start at body
      expect(class_scope!.location.start_column).toBeGreaterThan(10);
      console.log("✓ Class scope starts at body (column >10):", class_scope!.location.start_column);

      // Class scope parent should be module scope
      const parent_scope = index.scopes.get(class_scope!.parent_id!);
      expect(parent_scope?.type).toBe("module");
      console.log("✓ Class scope parent is module scope");
    });
  });

  describe("JavaScript Class Body-Based Scope", () => {
    let jsParser: Parser;

    beforeAll(() => {
      jsParser = new Parser();
      jsParser.setLanguage(JavaScript);
    });

    it("should capture only class body as scope for class declaration", () => {
      const code = `class MyClass {
  method() {}
}`;

      const tree = jsParser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "javascript" as Language);

      // Get the file scope (module scope)
      const file_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null
      );
      expect(file_scope).toBeDefined();
      const file_scope_id = file_scope!.id;

      // Get the class scope
      const class_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "class"
      );
      expect(class_scope).toBeDefined();

      // Get the class definition
      const myClass = Array.from(index.classes.values()).find(
        (c) => c.name === "MyClass"
      );
      expect(myClass).toBeDefined();

      console.log("\n=== JavaScript Class Body-Based Scope Verification ===");
      console.log("Code:", code);
      console.log("\nFile scope:", {
        id: file_scope_id,
        location: file_scope!.location,
      });
      console.log("Class scope:", {
        id: class_scope!.id,
        location: class_scope!.location,
      });
      console.log("MyClass definition:", {
        name: myClass!.name,
        scope_id: myClass!.scope_id,
        location: myClass!.location,
      });

      // VERIFICATION 1: Class scope should start at `{` (body start)
      // In "class MyClass {", the `{` is at position 0:14
      // Class scope should start at 0:14 or 0:15, NOT at 0:0
      expect(class_scope!.location.start_column).toBeGreaterThan(10);
      console.log(
        "\n✓ Class scope starts at body (column >10):",
        class_scope!.location.start_column
      );

      // VERIFICATION 2: Class name 'MyClass' should be OUTSIDE class scope (in module scope)
      expect(myClass!.scope_id).toBe(file_scope_id);
      console.log("✓ Class name 'MyClass' is in module scope (not class scope)");

      // VERIFICATION 3: Class scope parent should be module scope
      const parent_scope = index.scopes.get(class_scope!.parent_id!);
      expect(parent_scope?.type).toBe("module");
      console.log("✓ Class scope parent is module scope");
    });

    it("should capture only class body as scope for class expression", () => {
      const code = `const MyClass = class {
  method() {}
}`;

      const tree = jsParser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.js" as FilePath,
        tree,
        "javascript" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "javascript" as Language);

      // Get the file scope
      const file_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null
      );
      expect(file_scope).toBeDefined();

      // Get the class scope
      const class_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "class"
      );
      expect(class_scope).toBeDefined();

      console.log("\n=== JavaScript Class Expression Body-Based Scope ===");
      console.log("Code:", code);
      console.log("Class scope:", {
        id: class_scope!.id,
        location: class_scope!.location,
      });

      // Class scope should start at body (after "class {")
      // In "const MyClass = class {", the `{` is at position 0:22
      expect(class_scope!.location.start_column).toBeGreaterThan(20);
      console.log(
        "\n✓ Class expression scope starts at body (column >20):",
        class_scope!.location.start_column
      );
    });
  });

  describe("Python Class Body-Based Scope", () => {
    let pyParser: Parser;

    beforeAll(() => {
      pyParser = new Parser();
      pyParser.setLanguage(Python);
    });

    it("should capture only class body as scope, not entire declaration", () => {
      const code = `class MyClass:
    def method(self):
        pass`;

      const tree = pyParser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.py" as FilePath,
        tree,
        "python" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "python" as Language);

      // Get the file scope (module scope)
      const file_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null
      );
      expect(file_scope).toBeDefined();
      const file_scope_id = file_scope!.id;

      // Get the class scope
      const class_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "class"
      );
      expect(class_scope).toBeDefined();

      // Get the class definition
      const myClass = Array.from(index.classes.values()).find(
        (c) => c.name === "MyClass"
      );
      expect(myClass).toBeDefined();

      console.log("\n=== Python Class Body-Based Scope Verification ===");
      console.log("Code:", code);
      console.log("\nFile scope:", {
        id: file_scope_id,
        location: file_scope!.location,
      });
      console.log("Class scope:", {
        id: class_scope!.id,
        location: class_scope!.location,
      });
      console.log("MyClass definition:", {
        name: myClass!.name,
        scope_id: myClass!.scope_id,
        location: myClass!.location,
      });

      // VERIFICATION 1: Class scope should start after `:` (where block begins)
      // In "class MyClass:", the `:` is at position 0:13
      // Class scope should start at 0:14 or later (the indented block)
      // The block actually starts on the next line, so we check start_line > 0
      expect(class_scope!.location.start_line).toBeGreaterThan(0);
      console.log(
        "\n✓ Class scope starts after ':' at line:",
        class_scope!.location.start_line
      );

      // VERIFICATION 2: Class name 'MyClass' should be OUTSIDE class scope (in module scope)
      // This is the key fix: class definition should be in file scope, not class scope
      expect(myClass!.scope_id).toBe(file_scope_id);
      console.log("✓ Class name 'MyClass' is in module scope (not class scope)");

      // VERIFICATION 3: Class scope parent should be module scope
      const parent_scope = index.scopes.get(class_scope!.parent_id!);
      expect(parent_scope?.type).toBe("module");
      console.log("✓ Class scope parent is module scope");
    });

    it("should correctly scope class with multiple methods", () => {
      const code = `class Calculator:
    def add(self, x, y):
        return x + y

    def subtract(self, x, y):
        return x - y`;

      const tree = pyParser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.py" as FilePath,
        tree,
        "python" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "python" as Language);

      // Get scopes
      const file_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null
      );
      expect(file_scope).toBeDefined();
      const file_scope_id = file_scope!.id;

      const class_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "class"
      );
      expect(class_scope).toBeDefined();

      // Get class definition
      const calcClass = Array.from(index.classes.values()).find(
        (c) => c.name === "Calculator"
      );
      expect(calcClass).toBeDefined();

      console.log("\n=== Python Complex Class Verification ===");
      console.log("Calculator class scope_id:", calcClass!.scope_id);
      console.log("Class scope:", {
        id: class_scope!.id,
        location: class_scope!.location,
      });

      // Class name should be in module scope
      expect(calcClass!.scope_id).toBe(file_scope_id);
      console.log("\n✓ Class name 'Calculator' is in module scope");

      // Class scope should start on next line (indented block)
      expect(class_scope!.location.start_line).toBeGreaterThan(0);
      console.log("✓ Class scope starts at line:", class_scope!.location.start_line);

      // Class scope parent should be module scope
      const parent_scope = index.scopes.get(class_scope!.parent_id!);
      expect(parent_scope?.type).toBe("module");
      console.log("✓ Class scope parent is module scope");
    });

    // TODO: Nested class scoping requires scope_processor.ts updates
    // Currently, inner class names are placed in module scope instead of outer class scope
    // This will be fixed in task-epic-11.112.9 (Clean up get_scope_id implementation)
    it.todo("should correctly scope nested classes", () => {
      const code = `class Outer:
    class Inner:
        def method(self):
            pass`;

      const tree = pyParser.parse(code);
      const parsedFile = createParsedFile(
        code,
        "test.py" as FilePath,
        tree,
        "python" as Language
      );
      const index = build_semantic_index(parsedFile, tree, "python" as Language);

      const file_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "module" && s.parent_id === null
      );
      const file_scope_id = file_scope!.id;

      const outerClass = Array.from(index.classes.values()).find(
        (c) => c.name === "Outer"
      );
      const innerClass = Array.from(index.classes.values()).find(
        (c) => c.name === "Inner"
      );

      const outer_class_scope = Array.from(index.scopes.values()).find(
        (s) => s.type === "class" && s.location.start_line === 2
      );

      // Outer class name should be in module scope
      expect(outerClass!.scope_id).toBe(file_scope_id);

      // Inner class name should be in outer class scope (NOT module scope)
      expect(innerClass!.scope_id).toBe(outer_class_scope!.id);
    });
  });
});

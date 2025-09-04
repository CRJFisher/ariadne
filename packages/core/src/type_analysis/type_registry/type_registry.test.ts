/**
 * Tests for Type Registry Module (Immutable Pattern)
 */

import { describe, it, expect } from "vitest";
import { TypeRegistry } from "./index";
import { build_type_registry } from "./type_registry";
import {
  FileAnalysis,
  ImportInfo,
  FilePath,
  TypeName,
  QualifiedName,
  Language,
} from "@ariadnejs/types";

describe("Type Registry (Immutable)", () => {
  describe("build_type_registry", () => {
    it("should build an immutable registry from file analyses", () => {
      const analyses: FileAnalysis[] = [
        {
          file_path: "/src/file1.ts" as FilePath,
          language: "typescript" as Language,
          source_code: "",
          imports: [],
          exports: [
            {
              symbol_name: "Class1",
              kind: "named" as const,
              location: { start: 60, end: 80 },
              is_default: false,
            },
          ],
          functions: [],
          classes: [
            {
              name: "Class1",
              location: { start: 0, end: 50 },
              methods: [],
              properties: [],
              is_exported: true,
            },
          ],
          variables: [],
          function_calls: [],
          method_calls: [],
          constructor_calls: [],
          scopes: { nodes: new Map(), edges: [] },
          errors: [],
        },
        {
          file_path: "/src/file2.ts" as FilePath,
          language: "typescript" as Language,
          source_code: "",
          imports: [],
          exports: [],
          functions: [],
          classes: [
            {
              name: "Class2",
              location: { start: 0, end: 40 },
              methods: [],
              properties: [],
              is_exported: false,
              extends: ["BaseClass"],
              implements: ["IInterface"],
            },
          ],
          variables: [],
          function_calls: [],
          method_calls: [],
          constructor_calls: [],
          scopes: { nodes: new Map(), edges: [] },
          errors: [],
        },
      ];

      const registry = build_type_registry(analyses);

      // Check that registry is populated
      expect(registry.types.size).toBeGreaterThan(0);
      expect(registry.builtins.size).toBe(4); // 4 languages
      expect(registry.types.has("/src/file1.ts#Class1" as QualifiedName)).toBe(
        true
      );
      expect(registry.types.has("/src/file2.ts#Class2" as QualifiedName)).toBe(
        true
      );

      // Check exports
      expect(
        registry.exports.get("/src/file1.ts" as FilePath)?.has("Class1")
      ).toBe(true);
      expect(registry.exports.has("/src/file2.ts" as FilePath)).toBe(false);

      // Check inheritance data is preserved
      const class2 = registry.types.get(
        "/src/file2.ts#Class2" as QualifiedName
      );
      expect(class2?.extends).toEqual(["BaseClass"]);
      expect(class2?.implements).toEqual(["IInterface"]);
    });

    it("should create an immutable registry that cannot be modified", () => {
      const analyses: FileAnalysis[] = [
        {
          file_path: "/src/test.ts" as FilePath,
          language: "typescript" as Language,
          source_code: "",
          imports: [],
          exports: [],
          functions: [],
          classes: [],
          variables: [],
          function_calls: [],
          method_calls: [],
          constructor_calls: [],
          scopes: { nodes: new Map(), edges: [] },
          errors: [],
        },
      ];

      const registry = build_type_registry(analyses);

      // Verify registry is frozen at runtime
      expect(Object.isFrozen(registry)).toBe(true);

      // Verify the registry has the expected readonly structure
      expect(registry.types).toBeDefined();
      expect(registry.files).toBeDefined();
      expect(registry.exports).toBeDefined();

      // TypeScript's ReadonlyMap interface prevents compile-time mutations
      // These would cause TypeScript compile errors:
      // registry.types.set('test', {}); // Error: Property 'set' does not exist on type 'ReadonlyMap'
      // registry.files.clear(); // Error: Property 'clear' does not exist on type 'ReadonlyMap'
    });
  });

  describe("resolve_import", () => {
    let registry: TypeRegistry;

    beforeEach(() => {
      const analyses: FileAnalysis[] = [
        {
          file_path: "/src/source.ts" as FilePath,
          language: "typescript" as Language,
          source_code: "",
          imports: [],
          exports: [
            {
              symbol_name: "ExportedClass",
              kind: "named" as const,
              location: { start: 0, end: 30 },
              is_default: false,
            },
            {
              symbol_name: "OriginalName",
              kind: "named" as const,
              location: { start: 40, end: 60 },
              is_default: false,
            },
          ],
          functions: [],
          classes: [
            {
              name: "ExportedClass",
              location: { start: 0, end: 50 },
              methods: [],
              properties: [],
              is_exported: true,
            },
            {
              name: "OriginalName",
              location: { start: 60, end: 110 },
              methods: [],
              properties: [],
              is_exported: true,
            },
          ],
          variables: [],
          function_calls: [],
          method_calls: [],
          constructor_calls: [],
          scopes: { nodes: new Map(), edges: [] },
          errors: [],
        },
      ];
      registry = build_type_registry(analyses);
    });

  });
});

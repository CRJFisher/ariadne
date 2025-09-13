/**
 * Tests for Type Registry Module (Immutable Pattern)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TypeRegistry } from "./index";
import { build_type_registry } from "./type_registry";
import {
  FileAnalysis,
  FilePath,
  QualifiedName,
  Language,
  SourceCode,
  ModulePath,
  ExportName,
  ScopeTree,
  ScopeId
} from "@ariadnejs/types";

describe("Type Registry (Immutable)", () => {
  describe("build_type_registry", () => {
    it("should build an immutable registry from file analyses", () => {
      const analyses: FileAnalysis[] = [
        {
          file_path: "/src/file1.ts" as FilePath,
          language: "typescript" as Language,
          source_code: "" as SourceCode as SourceCode,
          imports: [],
          exports: [
            {
              symbol_name: "Class1",
              location: { line: 60, column: 80, file_path: "/src/file1.ts" as FilePath, end_line: 80, end_column: 0 },
              is_default: false,
              is_type_export: false,
              source: "/src/file1.ts" as ModulePath,
              export_name: "Class1" as ExportName,
            },
          ],
          functions: [],
          classes: [
            {
              name: "Class1",
              location: { line: 0, column: 50, file_path: "/src/file1.ts" as FilePath, end_line: 50, end_column: 0 },
              methods: [],
              properties: [],
              is_exported: true,
            },
          ],
          variables: [],
          function_calls: [],
          method_calls: [],
          constructor_calls: [],
          scopes: { root_id: "root" as ScopeId, nodes: new Map(), edges: [] } as ScopeTree,
          type_info: new Map(),
          errors: [],
        },
        {
          file_path: "/src/file2.ts" as FilePath,
          language: "typescript" as Language,
          source_code: "" as SourceCode as SourceCode,
          imports: [],
          exports: [],
          functions: [],
          classes: [
            {
              name: "Class2",
              location: { line: 0, column: 40, file_path: "/src/file2.ts" as FilePath, end_line: 40, end_column: 0 },
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
          scopes: { root_id: "root" as ScopeId, nodes: new Map(), edges: [] } as ScopeTree,
          type_info: new Map(),
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
      expect(class2).toBeDefined();
      expect(class2!.extends).toEqual(["BaseClass"]);
      expect(class2!.implements).toEqual(["IInterface"]);
    });

    it("should create an immutable registry that cannot be modified", () => {
      const analyses: FileAnalysis[] = [
        {
          file_path: "/src/test.ts" as FilePath,
          language: "typescript" as Language,
          source_code: "" as SourceCode as SourceCode,
          imports: [],
          exports: [],
          functions: [],
          classes: [],
          variables: [],
          function_calls: [],
          method_calls: [],
          constructor_calls: [],
          scopes: { root_id: "root" as ScopeId, nodes: new Map(), edges: [] } as ScopeTree,
          type_info: new Map(),
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
          source_code: "" as SourceCode as SourceCode,
          imports: [],
          exports: [
            {
              symbol_name: "ExportedClass",
              location: { line: 0, column: 30, file_path: "/src/source.ts" as FilePath, end_line: 30, end_column: 0 },
              is_default: false,
              is_type_export: false,
              source: "/src/source.ts" as ModulePath,
              export_name: "ExportedClass" as ExportName,
            },
            {
              symbol_name: "OriginalName",
              location: { line: 40, column: 60, file_path: "/src/source.ts" as FilePath, end_line: 60, end_column: 0 },
              is_default: false,
              is_type_export: false,
              source: "/src/source.ts" as ModulePath,
              export_name: "OriginalName" as ExportName,
            },
          ],
          functions: [],
          classes: [
            {
              name: "ExportedClass",
              location: { line: 0, column: 50, file_path: "/src/source.ts" as FilePath, end_line: 50, end_column: 0 },
              methods: [],
              properties: [],
              is_exported: true,
            },
            {
              name: "OriginalName",
              location: { line: 60, column: 110, file_path: "/src/source.ts" as FilePath, end_line: 110, end_column: 0 },
              methods: [],
              properties: [],
              is_exported: true,
            },
          ],
          variables: [],
          function_calls: [],
          method_calls: [],
          constructor_calls: [],
          scopes: { root_id: "root" as ScopeId, nodes: new Map(), edges: [] } as ScopeTree,
          type_info: new Map(),
          errors: [],
        },
      ];
      registry = build_type_registry(analyses);
    });

  });
});

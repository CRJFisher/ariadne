/**
 * Integration Tests for Symbol Resolution Fixes
 *
 * This test suite validates the specific fixes implemented during the symbol resolution
 * task, ensuring that the issues identified and resolved continue to work correctly.
 *
 * Key fixes tested:
 * - Import resolution with proper source field handling
 * - Export structure alignment with type definitions
 * - Language handler import-to-export matching
 * - Type resolution return type handling
 * - Cross-language import compatibility
 */

import { describe, it, expect } from "vitest";
import { resolve_symbols } from "../symbol_resolution";
import type { ResolutionInput } from "../types";
import {
  create_test_cross_language_project,
  create_test_js_file,
  create_test_semantic_index,
  create_test_named_import,
  create_test_named_export,
  create_test_default_export,
  create_test_symbol_definition,
  time_execution,
} from "../test_utilities";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  Language,
} from "@ariadnejs/types";

describe("Symbol Resolution Fixes - Integration Tests", () => {
  describe("Import Resolution Fixes", () => {
    it("handles imports with proper source field structure", () => {
      // Test the fix for imports using 'source' field instead of 'source_path'
      const utils_file = create_test_js_file(
        "src/utils.ts",
        ["add", "multiply"], // exports
        [], // imports
        ["add", "multiply"] // functions
      );

      const main_file = create_test_js_file(
        "src/main.ts",
        [], // exports
        [
          { name: "add", source: "src/utils.ts" },
          { name: "multiply", source: "src/utils.ts" },
        ]
      );

      const indices = new Map([
        [utils_file.file_path, utils_file],
        [main_file.file_path, main_file],
      ]);

      const result = resolve_symbols({ indices });

      // Should successfully resolve imports
      expect(result.phases.imports.size).toBeGreaterThan(0);
      expect(result.phases.imports.has(main_file.file_path)).toBe(true);

      const resolved_imports = result.phases.imports.get(main_file.file_path);
      expect(resolved_imports).toBeDefined();
      expect(resolved_imports!.size).toBe(2);
    });

    it("handles missing import sources gracefully", () => {
      // Test the fix for handling undefined/missing import sources
      const malformed_import = {
        kind: "named" as const,
        imports: [
          {
            name: "missing" as SymbolName,
            is_type_only: false,
          },
        ],
        source: "" as FilePath, // Simulate malformed import with empty source
        location: {
          file_path: "src/main.ts" as FilePath,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 30,
        },
        modifiers: [],
        language: "typescript" as const,
        node_type: "import_statement" as const,
      };

      const main_file = create_test_semantic_index({
        file_path: "src/main.ts",
        language: "typescript",
        imports: [malformed_import],
      });

      const indices = new Map([[main_file.file_path, main_file]]);

      // Should not crash and should handle gracefully
      const result = resolve_symbols({ indices });

      expect(result.phases.imports.size).toBe(0); // No imports resolved
      expect(result.phases.functions).toBeDefined(); // Other phases still work
    });

    it("resolves cross-language imports correctly", () => {
      // Test JavaScript importing from TypeScript and vice versa
      const js_file = create_test_semantic_index({
        file_path: "src/utils.js",
        language: "javascript",
        exports: [create_test_named_export("processData")],
      });

      const ts_file = create_test_semantic_index({
        file_path: "src/main.ts",
        language: "typescript",
        imports: [create_test_named_import("processData", "src/utils.js")],
        exports: [create_test_default_export("Application")],
      });

      const consumer_file = create_test_semantic_index({
        file_path: "src/consumer.js",
        language: "javascript",
        imports: [create_test_named_import("Application", "src/main.ts")],
      });

      const indices = new Map([
        [js_file.file_path, js_file],
        [ts_file.file_path, ts_file],
        [consumer_file.file_path, consumer_file],
      ]);

      const result = resolve_symbols({ indices });

      // Should resolve imports across language boundaries
      expect(result.phases.imports.size).toBe(2); // ts and consumer files have imports

      // Verify TypeScript can import from JavaScript
      const ts_imports = result.phases.imports.get(ts_file.file_path);
      expect(ts_imports).toBeDefined();
      expect(ts_imports!.has("processData" as SymbolName)).toBe(true);

      // Verify JavaScript can import from TypeScript
      const consumer_imports = result.phases.imports.get(
        consumer_file.file_path
      );
      expect(consumer_imports).toBeDefined();
      expect(consumer_imports!.has("Application" as SymbolName)).toBe(true);
    });
  });

  describe("Export Structure Fixes", () => {
    it("handles named exports with proper structure", () => {
      // Test the fix for export structure alignment with NamedExport interface
      const export_with_proper_structure = create_test_named_export(
        "testFunction",
        "testFunction", // export name
        "symbol:testFunction" as SymbolId
      );

      // Verify the export has the required 'exports' array structure
      expect(export_with_proper_structure.kind).toBe("named");
      expect(export_with_proper_structure.exports).toBeDefined();
      expect(export_with_proper_structure.exports.length).toBe(1);
      expect(export_with_proper_structure.exports[0].local_name).toBe(
        "testFunction"
      );
      expect(export_with_proper_structure.exports[0].export_name).toBe(
        "testFunction"
      );
      expect(export_with_proper_structure.exports[0].is_type_only).toBe(false);

      const file = create_test_semantic_index({
        file_path: "src/test.ts",
        language: "typescript",
        exports: [export_with_proper_structure],
      });

      const indices = new Map([[file.file_path, file]]);
      const result = resolve_symbols({ indices });

      // Should process without errors
      expect(result.phases.imports).toBeDefined();
    });

    it("handles default exports correctly", () => {
      // Test default export structure
      const default_export = create_test_default_export("MyClass");

      expect(default_export.kind).toBe("default");
      expect(default_export.is_declaration).toBe(false);
      expect(default_export.symbol_name).toBe("MyClass");

      const file = create_test_semantic_index({
        file_path: "src/class.ts",
        language: "typescript",
        exports: [default_export],
      });

      const indices = new Map([[file.file_path, file]]);
      const result = resolve_symbols({ indices });

      expect(result.phases.imports).toBeDefined();
    });
  });

  describe("Type Resolution Fixes", () => {
    it("handles return type hints correctly", () => {
      // Test the fix for return type handling using return_type_hint instead of return_type
      const function_symbol = create_test_symbol_definition({
        kind: "function",
        name: "testFunction",
        return_type_hint: "string" as SymbolName, // Use hint, not direct type
      });

      const symbols = new Map([[function_symbol.id, function_symbol]]);

      const file = create_test_semantic_index({
        file_path: "src/types.ts",
        language: "typescript",
        symbols,
      });

      const indices = new Map([[file.file_path, file]]);
      const result = resolve_symbols({ indices });

      // Should process types without errors
      expect(result.phases.types).toBeDefined();
      expect(result.phases.types.symbol_types).toBeDefined();

      // Check if the function symbol has a type assigned
      const function_type = result.phases.types.symbol_types.get(
        function_symbol.id
      );
      expect(function_type).toBeDefined();
    });

    it("handles class inheritance correctly", () => {
      // Test inheritance handling
      const base_class = create_test_symbol_definition({
        kind: "class",
        name: "BaseClass",
      });

      const derived_class = create_test_symbol_definition({
        kind: "class",
        name: "DerivedClass",
        extends_class: "BaseClass" as SymbolName,
      });

      const symbols = new Map([
        [base_class.id, base_class],
        [derived_class.id, derived_class],
      ]);

      const file = create_test_semantic_index({
        file_path: "src/classes.ts",
        language: "typescript",
        symbols,
      });

      const indices = new Map([[file.file_path, file]]);
      const result = resolve_symbols({ indices });

      expect(result.phases.types).toBeDefined();
      expect(result.phases.types.symbol_types).toBeDefined();

      // Check that both class symbols have types assigned
      const base_type = result.phases.types.symbol_types.get(base_class.id);
      const derived_type = result.phases.types.symbol_types.get(
        derived_class.id
      );
      expect(base_type).toBeDefined();
      expect(derived_type).toBeDefined();
    });
  });

  describe("Performance and Stability", () => {
    it("handles moderate-sized projects efficiently", () => {
      // Test that the fixes maintain good performance
      const { result: project, duration: setup_time } = time_execution(() =>
        create_test_cross_language_project()
      );

      expect(setup_time).toBeLessThan(50); // Setup should be fast

      const { result: resolution, duration: resolution_time } = time_execution(
        () => resolve_symbols({ indices: project })
      );

      expect(resolution_time).toBeLessThan(100); // Resolution should be reasonably fast
      expect(resolution.phases.imports).toBeDefined();
      expect(resolution.phases.functions).toBeDefined();
      expect(resolution.phases.types).toBeDefined();
      expect(resolution.phases.methods).toBeDefined();
    });

    it("handles error conditions gracefully", () => {
      // Test that various error conditions don't crash the system
      const problematic_files = [
        // File with malformed import
        create_test_semantic_index({
          file_path: "src/malformed.ts",
          language: "typescript",
          imports: [
            { ...create_test_named_import("missing", ""), source: "" as FilePath },
          ],
        }),

        // File with empty exports
        create_test_semantic_index({
          file_path: "src/empty.ts",
          language: "typescript",
          exports: [],
        }),

        // File with circular reference attempt
        create_test_semantic_index({
          file_path: "src/circular.ts",
          language: "typescript",
          imports: [create_test_named_import("self", "src/circular.ts")],
          exports: [create_test_named_export("self")],
        }),
      ];

      const indices = new Map();
      problematic_files.forEach((file) => {
        indices.set(file.file_path, file);
      });

      // Should not throw errors
      expect(() => {
        const result = resolve_symbols({ indices });
        expect(result).toBeDefined();
      }).not.toThrow();
    });

    it("maintains consistency across multiple runs", () => {
      // Test that resolution is deterministic
      const project = create_test_cross_language_project();

      const result1 = resolve_symbols({ indices: project });
      const result2 = resolve_symbols({ indices: project });

      // Results should be consistent
      expect(result1.phases.imports.size).toBe(result2.phases.imports.size);
      expect(result1.phases.functions.function_calls.size).toBe(
        result2.phases.functions.function_calls.size
      );

      // Check that the same files have imports resolved
      for (const file_path of result1.phases.imports.keys()) {
        expect(result2.phases.imports.has(file_path)).toBe(true);

        const imports1 = result1.phases.imports.get(file_path)!;
        const imports2 = result2.phases.imports.get(file_path)!;
        expect(imports1.size).toBe(imports2.size);
      }
    });
  });

  describe("Integration Validation", () => {
    it("validates all four phases work together", () => {
      // Comprehensive test that all phases integrate correctly
      const project = create_test_cross_language_project();
      const result = resolve_symbols({ indices: project });

      // Phase 1: Import Resolution
      expect(result.phases.imports).toBeDefined();
      expect(result.phases.imports.size).toBeGreaterThan(0);

      // Phase 2: Function Resolution
      expect(result.phases.functions).toBeDefined();
      expect(result.phases.functions.function_calls).toBeDefined();

      // Phase 3: Type Resolution
      expect(result.phases.types).toBeDefined();
      expect(result.phases.types.symbol_types).toBeDefined();
      expect(result.phases.types.inheritance_hierarchy).toBeDefined();

      // Phase 4: Method Resolution
      expect(result.phases.methods).toBeDefined();
      expect(result.phases.methods.method_calls).toBeDefined();

      // Verify integration - imports should feed into other phases
      const import_count = Array.from(result.phases.imports.values()).reduce(
        (sum, imports) => sum + imports.size,
        0
      );

      expect(import_count).toBeGreaterThan(0);
    });

    it("handles real-world scenarios", () => {
      // Test patterns commonly found in real projects
      const utils_file = create_test_js_file(
        "src/utils/helpers.ts",
        ["debounce", "throttle", "formatDate"], // exports
        [], // imports
        ["debounce", "throttle", "formatDate", "internalHelper"] // functions (some not exported)
      );

      const components_file = create_test_js_file(
        "src/components/Button.tsx",
        ["Button"], // exports
        [
          { name: "debounce", source: "src/utils/helpers.ts" },
          {
            name: "formatDate",
            source: "src/utils/helpers.ts",
            alias: "format",
          },
        ],
        ["Button", "handleClick"]
      );

      const app_file = create_test_js_file(
        "src/App.tsx",
        ["App"], // exports
        [
          { name: "Button", source: "src/components/Button.tsx" },
          { name: "throttle", source: "src/utils/helpers.ts" },
        ],
        ["App", "render"]
      );

      const indices = new Map([
        [utils_file.file_path, utils_file],
        [components_file.file_path, components_file],
        [app_file.file_path, app_file],
      ]);

      const result = resolve_symbols({ indices });

      // Should handle this realistic scenario correctly
      expect(result.phases.imports.size).toBe(2); // components and app have imports

      // Verify specific import resolutions
      const component_imports = result.phases.imports.get(
        components_file.file_path
      );
      expect(component_imports).toBeDefined();
      expect(component_imports!.has("debounce" as SymbolName)).toBe(true);
      expect(component_imports!.has("format" as SymbolName)).toBe(true); // aliased import

      const app_imports = result.phases.imports.get(app_file.file_path);
      expect(app_imports).toBeDefined();
      expect(app_imports!.has("Button" as SymbolName)).toBe(true);
      expect(app_imports!.has("throttle" as SymbolName)).toBe(true);
    });
  });
});

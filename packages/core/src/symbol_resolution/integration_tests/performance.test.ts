/**
 * Performance Benchmarking Tests for Symbol Resolution
 *
 * Measures and validates performance characteristics of the symbol resolution
 * pipeline on various project sizes and complexities.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resolve_symbols } from "../symbol_resolution";
import { export_symbol_resolution_data, count_total_symbols } from "../data_export";
import type { ResolutionInput } from "../types";
import type {
  FilePath,
  SymbolId,
  Location,
  SymbolName,
  SymbolDefinition,
  ScopeId,
  LexicalScope,
  Import,
  Export,
} from "@ariadnejs/types";
import {
  function_symbol,
  class_symbol,
  method_symbol,
  variable_symbol,
} from "@ariadnejs/types";
import { SemanticIndex } from "../../semantic_index/semantic_index";
import type { LocalTypeInfo } from "../../semantic_index/type_members";
import type { CallReference } from "../../semantic_index/references/call_references";

/**
 * Generate a large test project with specified number of files
 */
function generate_large_test_project(num_files: number): Map<FilePath, SemanticIndex> {
  const indices = new Map<FilePath, SemanticIndex>();
  const files_per_module = 10;
  const modules = Math.ceil(num_files / files_per_module);

  for (let m = 0; m < modules; m++) {
    const module_name = `module_${m}`;

    for (let f = 0; f < files_per_module && (m * files_per_module + f) < num_files; f++) {
      const file_path = `src/${module_name}/file_${f}.ts` as FilePath;
      const symbols = new Map<SymbolId, SymbolDefinition>();
      const imports: Import[] = [];
      const exports: Export[] = [];
      const calls: CallReference[] = [];
      const local_types: LocalTypeInfo[] = [];

      // Add imports from previous files
      if (f > 0) {
        const prev_file = `src/${module_name}/file_${f - 1}.ts` as FilePath;
        imports.push({
          kind: "named",
          imports: [{ name: `func_${f - 1}_0` as SymbolName, is_type_only: false }],
          source: prev_file,
          location: create_location(file_path, 1, 10),
          modifiers: [],
          language: "typescript",
          node_type: "import_statement",
        });

        // Add calls to imported functions
        calls.push({
          call_type: "function" as const,
          name: `func_${f - 1}_0` as SymbolName,
          location: create_location(file_path, 10, 15),
          scope_id: `scope:module:${file_path}:0:0` as ScopeId,
          argument_count: 2,
        });
      }

      // Add cross-module imports
      if (m > 0 && f === 0) {
        const prev_module = `module_${m - 1}`;
        const prev_file = `src/${prev_module}/file_0.ts` as FilePath;
        imports.push({
          kind: "named",
          imports: [{ name: `func_0_0` as SymbolName, is_type_only: false }],
          source: `../${prev_module}/file_0.ts`,
          location: create_location(file_path, 2, 10),
          modifiers: [],
          language: "typescript",
          node_type: "import_statement",
        });
      }

      // Generate symbols for this file
      const functions_per_file = 5;
      const classes_per_file = 2;

      // Add functions
      for (let i = 0; i < functions_per_file; i++) {
        const func_name = `func_${f}_${i}` as SymbolName;
        const func_location = create_location(file_path, 5 + i * 5, 10);
        const func_id = function_symbol(func_name, file_path, func_location);

        symbols.set(func_id, {
          id: func_id,
          name: func_name,
          kind: "function",
          location: func_location,
          scope_id: `scope:module:${file_path}:0:0` as ScopeId,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
        });

        // Export first function
        if (i === 0) {
          exports.push({
            kind: "named",
            symbol: func_id,
            symbol_name: func_name,
            location: create_location(file_path, 5 + i * 5, 0),
            exports: [{ local_name: func_name, is_type_only: false }],
            modifiers: [],
            language: "typescript",
            node_type: "export_statement",
          });
        }

        // Add internal function calls
        if (i > 0) {
          calls.push({
            location: create_location(file_path, 6 + i * 5, 20),
            name: `func_${f}_${i - 1}` as SymbolName,
            scope_id: `scope:module:${file_path}:0:0` as ScopeId,
            call_type: "function",
          });
        }
      }

      // Add classes with methods
      for (let i = 0; i < classes_per_file; i++) {
        const class_name = `Class_${f}_${i}` as SymbolName;
        const class_location = create_location(file_path, 30 + i * 10, 10);
        const class_id = class_symbol(class_name, file_path, class_location);

        symbols.set(class_id, {
          id: class_id,
          name: class_name,
          kind: "class",
          location: class_location,
          scope_id: `scope:module:${file_path}:0:0` as ScopeId,
          is_hoisted: false,
          is_exported: false,
          is_imported: false,
        });

        // Add class to local types
        const members = new Map<SymbolName, SymbolId>();
        const methods_per_class = 3;

        for (let j = 0; j < methods_per_class; j++) {
          const method_name = `method_${j}` as SymbolName;
          const method_location = create_location(file_path, 32 + i * 10 + j * 2, 15);
          const method_id = method_symbol(method_name, class_name, file_path, method_location);

          symbols.set(method_id, {
            id: method_id,
            name: method_name,
            kind: "method",
            location: method_location,
            scope_id: `scope:class:${file_path}:${30 + i * 10}:10` as ScopeId,
            is_hoisted: false,
            is_exported: false,
            is_imported: false,
          });

          members.set(method_name, method_id);
        }

        local_types.push({
          type_name: class_name,
          kind: "class",
          location: class_location,
          direct_members: members,
          extends_clause: [],
          implements_clause: [],
        });

        // Export first class
        if (i === 0) {
          exports.push({
            kind: "named" as const,
            symbol: class_id,
            symbol_name: class_name,
            location: create_location(file_path, 30 + i * 10, 0),
            exports: [{
              local_name: class_name,
              export_name: class_name,
              is_type_only: false,
            }],
            modifiers: [],
            language: "typescript",
            node_type: "export_statement",
          });
        }
      }

      // Create semantic index for this file
      const root_scope_id = `scope:module:${file_path}:0:0` as ScopeId;
      const root_scope: LexicalScope = {
        id: root_scope_id,
        parent_id: null,
        name: null,
        type: "module",
        location: create_location(file_path, 0, 0),
        child_ids: [],
        symbols: new Map(),
      };

      const index: SemanticIndex = {
        file_path,
        language: "typescript",
        root_scope_id,
        scopes: new Map([[root_scope_id, root_scope]]),
        symbols,
        references: {
          calls,
          member_accesses: [],
          returns: [],
          type_annotations: [],
        },
        imports,
        exports,
        file_symbols_by_name: new Map(),
        local_types,
        local_type_annotations: [],
        local_type_tracking: {
          annotations: [],
          declarations: [],
          assignments: [],
        },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      };

      indices.set(file_path, index);
    }
  }

  return indices;
}

function create_location(file_path: FilePath, line: number, column: number): Location {
  return {
    file_path,
    line,
    column,
    end_line: line,
    end_column: column + 10,
  };
}

/**
 * Get a random sample of files from the project
 */
function get_random_files(indices: Map<FilePath, SemanticIndex>, count: number): FilePath[] {
  const all_files = Array.from(indices.keys());
  const sample: FilePath[] = [];

  for (let i = 0; i < count && i < all_files.length; i++) {
    const index = Math.floor(Math.random() * all_files.length);
    const file = all_files[index];
    if (!sample.includes(file)) {
      sample.push(file);
    }
  }

  return sample;
}

describe("Performance Benchmarks", () => {
  const SMALL_PROJECT = 100;
  const MEDIUM_PROJECT = 500;
  const LARGE_PROJECT = 1000;

  // Skip large tests in CI to avoid timeouts
  const IS_CI = process.env.CI === "true";
  const MAX_FILES_IN_CI = 500;

  describe("Scalability tests", () => {
    it(`should handle ${SMALL_PROJECT} files efficiently`, async () => {
      const large_project = generate_large_test_project(SMALL_PROJECT);

      const start_time = performance.now();

      // Measure symbol resolution
      const resolution_start = performance.now();
      const resolved_symbols = resolve_symbols({ indices: large_project });
      const resolution_time = performance.now() - resolution_start;

      // Measure data export
      const export_start = performance.now();
      const exported_data = export_symbol_resolution_data(resolved_symbols, "json");
      const export_time = performance.now() - export_start;

      const total_time = performance.now() - start_time;

      // Performance assertions
      expect(total_time).toBeLessThan(SMALL_PROJECT * 10); // 10ms per file max
      expect(resolution_time).toBeLessThan(total_time * 0.9); // Resolution < 90%
      expect(export_time).toBeLessThan(total_time * 0.2); // Export < 20%

      // Memory usage check
      const memory_usage = process.memoryUsage();
      expect(memory_usage.heapUsed).toBeLessThan(SMALL_PROJECT * 1024 * 1024); // 1MB per file max

      // Log performance metrics
      console.log(`${SMALL_PROJECT} files performance:`);
      console.log(`  Total: ${total_time.toFixed(2)}ms (${(total_time / SMALL_PROJECT).toFixed(2)}ms per file)`);
      console.log(`  Resolution: ${resolution_time.toFixed(2)}ms`);
      console.log(`  Export: ${export_time.toFixed(2)}ms`);
      console.log(`  Memory: ${(memory_usage.heapUsed / 1024 / 1024).toFixed(2)}MB`);

      // Verify resolution quality
      expect(resolved_symbols.resolved_references.size).toBeGreaterThan(0);
      expect(resolved_symbols.phases.imports.imports.size).toBeGreaterThan(0);
      expect(resolved_symbols.phases.functions.function_calls.size).toBeGreaterThan(0);
    });

    it(`should handle ${MEDIUM_PROJECT} files efficiently`, async function () {
      if (IS_CI && MEDIUM_PROJECT > MAX_FILES_IN_CI) {
        this.skip();
      }

      const large_project = generate_large_test_project(MEDIUM_PROJECT);

      const start_time = performance.now();

      const resolved_symbols = resolve_symbols({ indices: large_project });

      const total_time = performance.now() - start_time;

      // Performance assertions
      expect(total_time).toBeLessThan(MEDIUM_PROJECT * 15); // 15ms per file max

      // Log performance metrics
      console.log(`${MEDIUM_PROJECT} files performance:`);
      console.log(`  Total: ${total_time.toFixed(2)}ms (${(total_time / MEDIUM_PROJECT).toFixed(2)}ms per file)`);

      // Verify results
      const total_symbols = count_total_symbols(resolved_symbols);
      expect(total_symbols).toBeGreaterThan(0);
    });

    it.skipIf(IS_CI)(`should handle ${LARGE_PROJECT} files`, async () => {
      const large_project = generate_large_test_project(LARGE_PROJECT);

      const start_time = performance.now();

      const resolved_symbols = resolve_symbols({ indices: large_project });

      const total_time = performance.now() - start_time;

      // Performance assertions for large projects
      expect(total_time).toBeLessThan(LARGE_PROJECT * 20); // 20ms per file max

      console.log(`${LARGE_PROJECT} files performance:`);
      console.log(`  Total: ${total_time.toFixed(2)}ms (${(total_time / LARGE_PROJECT).toFixed(2)}ms per file)`);
    });
  });

  describe("Data access performance", () => {
    it("should have efficient symbol lookup performance", async () => {
      const project_size = IS_CI ? 200 : 500;
      const large_project = generate_large_test_project(project_size);
      const resolved_symbols = resolve_symbols({ indices: large_project });

      // Test random file access performance
      const random_files = get_random_files(large_project, 50);

      const access_times: number[] = [];

      for (const file_path of random_files) {
        const start = performance.now();

        // Common data access operations
        const file_imports = resolved_symbols.phases.imports.imports.get(file_path);
        const function_calls_count = Array.from(resolved_symbols.phases.functions.function_calls.entries())
          .filter(([location_key]) => location_key.startsWith(file_path))
          .length;

        const access_time = performance.now() - start;
        access_times.push(access_time);

        // Each file access should be very fast
        expect(access_time).toBeLessThan(5); // 5ms per file max
      }

      const avg_access_time = access_times.reduce((a, b) => a + b, 0) / access_times.length;
      console.log(`Average file access time: ${avg_access_time.toFixed(2)}ms`);
      expect(avg_access_time).toBeLessThan(2); // Average should be under 2ms
    });

    it("should export data efficiently for large projects", async () => {
      const project_size = IS_CI ? 100 : 300;
      const large_project = generate_large_test_project(project_size);
      const resolved_symbols = resolve_symbols({ indices: large_project });

      // Measure JSON export performance
      const json_start = performance.now();
      const json_export = export_symbol_resolution_data(resolved_symbols, "json");
      const json_time = performance.now() - json_start;

      // Measure CSV export performance
      const csv_start = performance.now();
      const csv_export = export_symbol_resolution_data(resolved_symbols, "csv");
      const csv_time = performance.now() - csv_start;

      console.log(`Export performance for ${project_size} files:`);
      console.log(`  JSON: ${json_time.toFixed(2)}ms (${(json_export.length / 1024).toFixed(2)}KB)`);
      console.log(`  CSV: ${csv_time.toFixed(2)}ms (${(csv_export.length / 1024).toFixed(2)}KB)`);

      // Export should be fast even for large projects
      expect(json_time).toBeLessThan(project_size * 2); // 2ms per file max
      expect(csv_time).toBeLessThan(project_size * 2); // 2ms per file max

      // Verify export completeness
      expect(json_export.length).toBeGreaterThan(0);
      expect(csv_export.length).toBeGreaterThan(0);
    });
  });

  describe("Memory efficiency", () => {
    it("should have reasonable memory usage for symbol resolution", () => {
      const initial_memory = process.memoryUsage().heapUsed;

      const project_size = 200;
      const large_project = generate_large_test_project(project_size);
      const resolved_symbols = resolve_symbols({ indices: large_project });

      const final_memory = process.memoryUsage().heapUsed;
      const memory_used = (final_memory - initial_memory) / 1024 / 1024; // MB

      console.log(`Memory usage for ${project_size} files: ${memory_used.toFixed(2)}MB`);
      console.log(`  Per file: ${(memory_used / project_size).toFixed(2)}MB`);

      // Memory usage should be reasonable
      expect(memory_used / project_size).toBeLessThan(1); // Less than 1MB per file
    });

    it("should handle deeply nested dependencies efficiently", () => {
      // Create a project with deep dependency chains
      const depth = 50;
      const indices = new Map<FilePath, SemanticIndex>();

      for (let i = 0; i < depth; i++) {
        const file_path = `src/level_${i}.ts` as FilePath;
        const prev_file_path = i > 0 ? (`src/level_${i - 1}.ts` as FilePath) : null;

        const func_location = create_location(file_path, 3, 10);
        const func_id = function_symbol(`func_${i}` as SymbolName, file_path, func_location);

        const imports: Import[] = [];
        const exports: Export[] = [];
        const calls: CallReference[] = [];

        // Import from previous level
        if (prev_file_path) {
          imports.push({
            kind: "named",
            name: `func_${i - 1}` as SymbolName,
            source_path: `./level_${i - 1}`,
            location: create_location(file_path, 1, 10),
            resolved_path: prev_file_path,
          });

          // Call imported function
          calls.push({
            call_type: "function" as const,
            name: `func_${i - 1}` as SymbolName,
            location: create_location(file_path, 5, 15),
            scope_id: `scope:module:${file_path}:0:0` as ScopeId,
            argument_count: 0,
          });
        }

        // Export current function
        exports.push({
          kind: "named" as const,
          symbol: func_id,
          symbol_name: `func_${i}` as SymbolName,
          location: create_location(file_path, 3, 0),
          exports: [{
            local_name: `func_${i}` as SymbolName,
            export_name: `func_${i}` as SymbolName,
            is_type_only: false,
          }],
          modifiers: [],
          language: "typescript",
          node_type: "export_statement",
        });

        const root_scope_id = `scope:module:${file_path}:0:0` as ScopeId;
        const index: SemanticIndex = {
          file_path,
          language: "typescript",
          root_scope_id,
          scopes: new Map([[root_scope_id, {
            id: root_scope_id,
            parent_id: null,
            name: null,
            type: "module",
            location: create_location(file_path, 0, 0),
            child_ids: [],
            symbols: new Map(),
          }]]),
          symbols: new Map([[func_id, {
            id: func_id,
            name: `func_${i}` as SymbolName,
            kind: "function",
            location: func_location,
            scope_id: root_scope_id,
            is_hoisted: false,
            is_exported: false,
            is_imported: false,
          }]]),
          references: { calls, member_accesses: [], returns: [], type_annotations: [] },
          imports,
          exports,
          file_symbols_by_name: new Map(),
          local_types: [],
          local_type_annotations: [],
          local_type_tracking: { annotations: [], declarations: [], assignments: [] },
          local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] },
        };

        indices.set(file_path, index);
      }

      const start_time = performance.now();
      const resolved_symbols = resolve_symbols({ indices });
      const resolution_time = performance.now() - start_time;

      console.log(`Deep dependency chain (${depth} levels): ${resolution_time.toFixed(2)}ms`);

      // Should handle deep chains efficiently
      expect(resolution_time).toBeLessThan(depth * 10); // 10ms per level max

      // Verify all imports are resolved
      expect(resolved_symbols.phases.imports.imports.size).toBe(depth - 1);
      expect(resolved_symbols.phases.functions.function_calls.size).toBeGreaterThan(0);
    });
  });
});
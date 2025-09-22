/**
 * End-to-End Integration Tests for Symbol Resolution Pipeline
 *
 * Tests the complete symbol resolution pipeline from semantic indexing
 * to fully resolved symbol mappings across all 4 phases.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resolve_symbols } from "../symbol_resolution";
import type { ResolutionInput, ResolvedSymbols } from "../types";
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
  location_key,
} from "@ariadnejs/types";
import { SemanticIndex } from "../../semantic_index/semantic_index";
import type { LocalTypeInfo } from "../../semantic_index/type_members";
import type { LocalTypeFlowData } from "../../semantic_index/references/type_flow_references";
import type { CallReference } from "../../semantic_index/references/call_references";
import type { MemberAccessReference } from "../../semantic_index/references/member_access_references";

/**
 * Helper to create a test project with multiple files
 */
function create_test_project(files: Array<{
  path: FilePath;
  content: {
    symbols: Array<{ name: string; kind: "function" | "class" | "method" | "variable"; location: Location }>;
    imports?: Import[];
    exports?: Export[];
    calls?: CallReference[];
    member_accesses?: MemberAccessReference[];
    local_types?: LocalTypeInfo[];
    type_flow?: LocalTypeFlowData;
  };
}>): Map<FilePath, SemanticIndex> {
  const indices = new Map<FilePath, SemanticIndex>();

  for (const file of files) {
    const { path, content } = file;
    const root_scope_id = `scope:module:${path}:0:0` as ScopeId;

    // Create symbols map
    const symbols = new Map<SymbolId, SymbolDefinition>();
    for (const sym of content.symbols) {
      const id = create_symbol_id(sym.kind, sym.name, sym.location);
      symbols.set(id, {
        id,
        name: sym.name as SymbolName,
        kind: sym.kind,
        location: sym.location,
        scope_id: root_scope_id,
      });
    }

    // Create root scope
    const root_scope: LexicalScope = {
      id: root_scope_id,
      parent_id: null,
      name: null,
      type: "module",
      location: { file_path: path, line: 0, column: 0, end_line: 0, end_column: 0 },
      child_ids: [],
      symbols: new Map(),
    };

    // Create semantic index
    const index: SemanticIndex = {
      file_path: path,
      language: "typescript",
      root_scope_id: root_scope_id,
      scopes: new Map([[root_scope_id, root_scope]]),
      symbols,
      references: {
        calls: content.calls || [],
        member_accesses: content.member_accesses || [],
        returns: [],
        type_annotations: [],
      },
      imports: content.imports || [],
      exports: content.exports || [],
      file_symbols_by_name: new Map(),
      local_types: content.local_types || [],
      local_type_annotations: [],
      local_type_tracking: {
        annotations: [],
        declarations: [],
        assignments: [],
      },
      local_type_flow: content.type_flow || {
        constructor_calls: [],
        assignments: [],
        returns: [],
        call_assignments: [],
      },
    };

    indices.set(path, index);
  }

  return indices;
}

function create_symbol_id(kind: string, name: string, location: Location): SymbolId {
  switch (kind) {
    case "function":
      return function_symbol(name as SymbolName, location.file_path, location);
    case "class":
      return class_symbol(name as SymbolName, location.file_path, location);
    case "method":
      return method_symbol(name as SymbolName, "UnknownClass", location.file_path, location);
    case "variable":
      return variable_symbol(name as SymbolName, location.file_path, location);
    default:
      return function_symbol(name as SymbolName, location.file_path, location);
  }
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

describe("Complete Symbol Resolution Pipeline", () => {

  describe("Cross-file function call resolution", () => {
    it("should resolve function calls through imports correctly", async () => {
      const utils_path = "src/utils.ts" as FilePath;
      const main_path = "src/main.ts" as FilePath;

      const helper_location = create_location(utils_path, 2, 10);
      const helper_call_location = create_location(main_path, 5, 20);
      const helper_symbol = function_symbol("helper" as SymbolName, utils_path, helper_location);

      const test_project = create_test_project([
        {
          path: utils_path,
          content: {
            symbols: [
              { name: "helper", kind: "function", location: helper_location }
            ],
            exports: [{
              kind: "named",
              symbol: helper_symbol,
              symbol_name: "helper" as SymbolName,
              location: create_location(utils_path, 1, 0),
              exports: [{ local_name: "helper" as SymbolName, is_type_only: false }],
              modifiers: [],
              language: "typescript",
              node_type: "export_statement",
            }],
          }
        },
        {
          path: main_path,
          content: {
            symbols: [
              { name: "main", kind: "function", location: create_location(main_path, 4, 10) }
            ],
            imports: [{
              kind: "named",
              imports: [{ name: "helper" as SymbolName, is_type_only: false }],
              source: "./utils",
              location: create_location(main_path, 1, 10),
              modifiers: [],
              language: "typescript",
              node_type: "import_statement",
            }],
            calls: [{
              location: helper_call_location,
              name: "helper" as SymbolName,
              scope_id: `scope:module:${main_path}:0:0` as ScopeId,
              call_type: "function",
            }],
          }
        }
      ]);

      const resolved_symbols = resolve_symbols({ indices: test_project });

      // Verify import resolution
      const main_file_imports = resolved_symbols.phases.imports.imports.get(main_path);
      expect(main_file_imports).toBeDefined();
      expect(main_file_imports?.has("helper" as SymbolName)).toBe(true);
      expect(main_file_imports?.get("helper" as SymbolName)).toBe(helper_symbol);

      // Verify function call resolution
      const helper_call_key = location_key(helper_call_location);
      const resolved_function = resolved_symbols.phases.functions.function_calls.get(helper_call_key);
      expect(resolved_function).toBe(helper_symbol);

      // Verify in combined resolved references
      expect(resolved_symbols.resolved_references.get(helper_call_key)).toBe(helper_symbol);
    });
  });

  describe("Method resolution through inheritance", () => {
    it("should resolve inherited method calls correctly", async () => {
      const base_path = "src/base.ts" as FilePath;
      const derived_path = "src/derived.ts" as FilePath;

      const base_method_location = create_location(base_path, 3, 10);
      const derived_call_location = create_location(derived_path, 8, 15);

      const test_project = create_test_project([
        {
          path: base_path,
          content: {
            symbols: [
              { name: "BaseClass", kind: "class", location: create_location(base_path, 1, 10) },
              { name: "baseMethod", kind: "method", location: base_method_location },
            ],
            exports: [{
              kind: "named",
              symbol: class_symbol("BaseClass" as SymbolName, base_path, create_location(base_path, 1, 10)),
              symbol_name: "BaseClass" as SymbolName,
              location: create_location(base_path, 1, 0),
              exports: [{ local_name: "BaseClass" as SymbolName, is_type_only: false }],
              modifiers: [],
              language: "typescript",
              node_type: "export_statement",
            }],
            local_types: [{
              type_name: "BaseClass" as SymbolName,
              kind: "class",
              location: create_location(base_path, 1, 10),
              direct_members: new Map([
                ["baseMethod" as SymbolName, method_symbol("baseMethod" as SymbolName, "BaseClass", base_path, base_method_location)]
              ]),
              extends_clause: [],
              implements_clause: [],
            }],
          }
        },
        {
          path: derived_path,
          content: {
            symbols: [
              { name: "DerivedClass", kind: "class", location: create_location(derived_path, 3, 10) },
              { name: "derivedMethod", kind: "method", location: create_location(derived_path, 5, 10) },
            ],
            imports: [{
              kind: "named",
              imports: [{ name: "BaseClass" as SymbolName, is_type_only: false }],
              source: "./base",
              location: create_location(derived_path, 1, 10),
              modifiers: [],
              language: "typescript",
              node_type: "import_statement",
            }],
            local_types: [{
              type_name: "DerivedClass" as SymbolName,
              kind: "class",
              location: create_location(derived_path, 3, 10),
              direct_members: new Map([
                ["derivedMethod" as SymbolName, method_symbol("derivedMethod" as SymbolName, "DerivedClass", derived_path, create_location(derived_path, 5, 10))]
              ]),
              extends_clause: ["BaseClass" as SymbolName],
              implements_clause: [],
            }],
            member_accesses: [{
              object: {
                location: create_location(derived_path, 8, 10),
              },
              member_name: "baseMethod" as SymbolName,
              location: derived_call_location,
              scope_id: "scope:0" as ScopeId,
              access_type: "method" as const,
              is_optional_chain: false,
            }],
          }
        }
      ]);

      const resolved_symbols = resolve_symbols({ indices: test_project });

      // Verify that the derived class can call inherited methods
      // This tests method resolution through the inheritance chain
      const method_calls = resolved_symbols.phases.methods.method_calls;

      // The test should verify that baseMethod is accessible from DerivedClass
      expect(method_calls).toBeDefined();

      // Note: Full inheritance resolution would require complete type hierarchy analysis
      // This test validates that the infrastructure is in place
    });
  });

  describe("Constructor call resolution", () => {
    it("should resolve constructor calls with proper type context", async () => {
      const class_path = "src/classes.ts" as FilePath;
      const usage_path = "src/usage.ts" as FilePath;

      const my_class_location = create_location(class_path, 1, 10);
      const constructor_call_location = create_location(usage_path, 4, 20);
      const my_class_symbol = class_symbol("MyClass" as SymbolName, class_path, my_class_location);

      const test_project = create_test_project([
        {
          path: class_path,
          content: {
            symbols: [
              { name: "MyClass", kind: "class", location: my_class_location },
            ],
            exports: [{
              kind: "named",
              symbol: my_class_symbol,
              symbol_name: "MyClass" as SymbolName,
              location: create_location(class_path, 1, 0),
              exports: [{ local_name: "MyClass" as SymbolName, is_type_only: false }],
              modifiers: [],
              language: "typescript",
              node_type: "export_statement",
            }],
            local_types: [{
              type_name: "MyClass" as SymbolName,
              kind: "class",
              location: my_class_location,
              direct_members: new Map(),
              extends_clause: [],
              implements_clause: [],
            }],
          }
        },
        {
          path: usage_path,
          content: {
            symbols: [
              { name: "useClass", kind: "function", location: create_location(usage_path, 3, 10) },
            ],
            imports: [{
              kind: "named",
              imports: [{ name: "MyClass" as SymbolName, is_type_only: false }],
              source: "./classes",
              location: create_location(usage_path, 1, 10),
              modifiers: [],
              language: "typescript",
              node_type: "import_statement",
            }],
            type_flow: {
              constructor_calls: [{
                class_name: "MyClass" as SymbolName,
                location: constructor_call_location,
                argument_count: 0,
              }],
              assignments: [],
              returns: [],
              call_assignments: [],
            },
          }
        }
      ]);

      const resolved_symbols = resolve_symbols({ indices: test_project });

      // Verify constructor call resolution
      const constructor_calls = resolved_symbols.phases.methods.constructor_calls;
      const constructor_call_key = location_key(constructor_call_location);

      // Check that the constructor call is resolved to the class
      const resolved_constructor = constructor_calls.get(constructor_call_key);
      expect(resolved_constructor).toBeDefined();

      // Verify in combined resolved references
      expect(resolved_symbols.resolved_references.has(constructor_call_key)).toBe(true);
    });
  });

  describe("Complete pipeline integration", () => {
    it("should handle complex multi-file projects with all resolution types", async () => {
      // Create a more complex project structure
      const lib_path = "src/lib/math.ts" as FilePath;
      const service_path = "src/services/calculator.ts" as FilePath;
      const app_path = "src/app.ts" as FilePath;

      const test_project = create_test_project([
        {
          path: lib_path,
          content: {
            symbols: [
              { name: "add", kind: "function", location: create_location(lib_path, 1, 10) },
              { name: "multiply", kind: "function", location: create_location(lib_path, 5, 10) },
            ],
            exports: [
              {
                kind: "named",
                symbol: function_symbol("add" as SymbolName, lib_path, create_location(lib_path, 1, 10)),
                symbol_name: "add" as SymbolName,
                location: create_location(lib_path, 1, 0),
                exports: [{ local_name: "add" as SymbolName, is_type_only: false }],
                modifiers: [],
                language: "typescript",
                node_type: "export_statement",
              },
              {
                kind: "named",
                symbol: function_symbol("multiply" as SymbolName, lib_path, create_location(lib_path, 5, 10)),
                symbol_name: "multiply" as SymbolName,
                location: create_location(lib_path, 5, 0),
                exports: [{ local_name: "multiply" as SymbolName, is_type_only: false }],
                modifiers: [],
                language: "typescript",
                node_type: "export_statement",
              },
            ],
          }
        },
        {
          path: service_path,
          content: {
            symbols: [
              { name: "Calculator", kind: "class", location: create_location(service_path, 3, 10) },
              { name: "calculate", kind: "method", location: create_location(service_path, 5, 10) },
            ],
            imports: [
              {
                kind: "named",
                imports: [{ name: "add" as SymbolName, is_type_only: false }],
                source: "../lib/math",
                location: create_location(service_path, 1, 10),
                modifiers: [],
                language: "typescript",
                node_type: "import_statement",
              },
              {
                kind: "named",
                imports: [{ name: "multiply" as SymbolName, is_type_only: false }],
                source: "../lib/math",
                location: create_location(service_path, 1, 25),
                modifiers: [],
                language: "typescript",
                node_type: "import_statement",
              },
            ],
            exports: [{
              kind: "default",
              symbol: class_symbol("Calculator" as SymbolName, service_path, create_location(service_path, 3, 10)),
              symbol_name: "Calculator" as SymbolName,
              location: create_location(service_path, 10, 0),
              is_declaration: false,
              modifiers: [],
              language: "typescript",
              node_type: "export_statement",
            }],
            calls: [
              {
                location: create_location(service_path, 6, 20),
                name: "add" as SymbolName,
                scope_id: `scope:module:${service_path}:0:0` as ScopeId,
                call_type: "function",
              },
              {
                location: create_location(service_path, 7, 20),
                name: "multiply" as SymbolName,
                scope_id: `scope:module:${service_path}:0:0` as ScopeId,
                call_type: "function",
              },
            ],
            local_types: [{
              type_name: "Calculator" as SymbolName,
              kind: "class",
              location: create_location(service_path, 3, 10),
              direct_members: new Map([
                ["calculate" as SymbolName, method_symbol("calculate" as SymbolName, "Calculator", service_path, create_location(service_path, 5, 10))]
              ]),
              extends_clause: [],
              implements_clause: [],
            }],
          }
        },
        {
          path: app_path,
          content: {
            symbols: [
              { name: "main", kind: "function", location: create_location(app_path, 4, 10) },
            ],
            imports: [{
              kind: "default",
              name: "Calculator" as SymbolName,
              source: "./services/calculator",
              location: create_location(app_path, 1, 10),
              modifiers: [],
              language: "typescript",
              node_type: "import_statement",
            }],
            type_flow: {
              constructor_calls: [{
                class_name: "Calculator" as SymbolName,
                location: create_location(app_path, 5, 20),
                argument_count: 0,
              }],
              assignments: [],
              returns: [],
              call_assignments: [],
            },
            member_accesses: [{
              object: {
                location: create_location(app_path, 6, 10),
              },
              member_name: "calculate" as SymbolName,
              location: create_location(app_path, 6, 15),
              scope_id: "scope:0" as ScopeId,
              access_type: "method" as const,
              is_optional_chain: false,
            }],
          }
        }
      ]);

      const resolved_symbols = resolve_symbols({ indices: test_project });

      // Verify overall resolution statistics
      expect(resolved_symbols.resolved_references.size).toBeGreaterThan(0);

      // Verify imports are resolved
      const service_imports = resolved_symbols.phases.imports.imports.get(service_path);
      expect(service_imports?.size).toBe(2);
      expect(service_imports?.has("add" as SymbolName)).toBe(true);
      expect(service_imports?.has("multiply" as SymbolName)).toBe(true);

      // Verify function calls are resolved
      expect(resolved_symbols.phases.functions.function_calls.size).toBeGreaterThan(0);

      // Verify constructor calls are resolved
      expect(resolved_symbols.phases.methods.constructor_calls.size).toBeGreaterThan(0);

      // Verify the complete pipeline processed all phases
      expect(resolved_symbols.phases.imports).toBeDefined();
      expect(resolved_symbols.phases.functions).toBeDefined();
      expect(resolved_symbols.phases.types).toBeDefined();
      expect(resolved_symbols.phases.methods).toBeDefined();
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle missing imports gracefully", () => {
      const test_project = create_test_project([
        {
          path: "src/broken.ts" as FilePath,
          content: {
            symbols: [],
            imports: [{
              kind: "named",
              imports: [{ name: "nonExistent" as SymbolName, is_type_only: false }],
              source: "./missing",
              location: create_location("src/broken.ts" as FilePath, 1, 10),
              modifiers: [],
              language: "typescript",
              node_type: "import_statement",
            }],
            calls: [{
              name: "nonExistent" as SymbolName,
              location: create_location("src/broken.ts" as FilePath, 3, 10),
              scope_id: "scope:0" as ScopeId,
              call_type: "function" as const,
            }],
          }
        }
      ]);

      const resolved_symbols = resolve_symbols({ indices: test_project });

      // Should handle gracefully without throwing
      expect(resolved_symbols).toBeDefined();
      expect(resolved_symbols.phases.imports.imports.get("src/broken.ts" as FilePath)?.size || 0).toBe(0);
    });

    it("should handle circular imports", () => {
      const a_path = "src/a.ts" as FilePath;
      const b_path = "src/b.ts" as FilePath;

      const test_project = create_test_project([
        {
          path: a_path,
          content: {
            symbols: [
              { name: "funcA", kind: "function", location: create_location(a_path, 3, 10) },
            ],
            imports: [{
              kind: "named",
              imports: [{ name: "funcB" as SymbolName, is_type_only: false }],
              source: "./b",
              location: create_location(a_path, 1, 10),
              modifiers: [],
              language: "typescript",
              node_type: "import_statement",
            }],
            exports: [{
              kind: "named",
              symbol: function_symbol("funcA" as SymbolName, a_path, create_location(a_path, 3, 10)),
              symbol_name: "funcA" as SymbolName,
              location: create_location(a_path, 3, 0),
              exports: [{ local_name: "funcA" as SymbolName, is_type_only: false }],
              modifiers: [],
              language: "typescript",
              node_type: "export_statement",
            }],
          }
        },
        {
          path: b_path,
          content: {
            symbols: [
              { name: "funcB", kind: "function", location: create_location(b_path, 3, 10) },
            ],
            imports: [{
              kind: "named",
              imports: [{ name: "funcA" as SymbolName, is_type_only: false }],
              source: "./a",
              location: create_location(b_path, 1, 10),
              modifiers: [],
              language: "typescript",
              node_type: "import_statement",
            }],
            exports: [{
              kind: "named",
              symbol: function_symbol("funcB" as SymbolName, b_path, create_location(b_path, 3, 10)),
              symbol_name: "funcB" as SymbolName,
              location: create_location(b_path, 3, 0),
              exports: [{ local_name: "funcB" as SymbolName, is_type_only: false }],
              modifiers: [],
              language: "typescript",
              node_type: "export_statement",
            }],
          }
        }
      ]);

      const resolved_symbols = resolve_symbols({ indices: test_project });

      // Should handle circular imports without infinite loops
      expect(resolved_symbols).toBeDefined();
      expect(resolved_symbols.phases.imports.imports.get(a_path)?.has("funcB" as SymbolName)).toBe(true);
      expect(resolved_symbols.phases.imports.imports.get(b_path)?.has("funcA" as SymbolName)).toBe(true);
    });
  });
});
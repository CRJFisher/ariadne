/**
 * Constructor Resolution Tests
 *
 * Comprehensive test suite for constructor call resolution,
 * including cross-file imports, local constructors, and edge cases.
 */

import { describe, it, expect } from "vitest";
import { resolve_symbols } from "./symbol_resolution";
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
  class_symbol,
  location_key,
} from "@ariadnejs/types";
import { SemanticIndex } from "../semantic_index/semantic_index";
import type { LocalTypeFlowData } from "../semantic_index/references/type_flow_references";

function create_location(file_path: FilePath, line: number, column: number): Location {
  return {
    file_path,
    line,
    column,
    end_line: line,
    end_column: column + 10,
  };
}

function create_test_index(
  file_path: FilePath,
  options: {
    symbols?: Map<SymbolId, SymbolDefinition>;
    imports?: Import[];
    exports?: Export[];
    local_type_flow?: LocalTypeFlowData;
  } = {}
): SemanticIndex {
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

  return {
    file_path,
    language: "typescript",
    root_scope_id,
    scopes: new Map([[root_scope_id, root_scope]]),
    symbols: options.symbols || new Map(),
    references: {
      calls: [],
      member_accesses: [],
      returns: [],
      type_annotations: [],
    },
    imports: options.imports || [],
    exports: options.exports || [],
    file_symbols_by_name: new Map(),
    local_types: [],
    local_type_annotations: [],
    local_type_tracking: {
      annotations: [],
      declarations: [],
      assignments: [],
    },
    local_type_flow: options.local_type_flow || {
      constructor_calls: [],
      assignments: [],
      returns: [],
      call_assignments: [],
    },
  };
}

describe("Constructor Resolution", () => {
  describe("Cross-file constructor resolution", () => {
    it("should resolve constructor calls to imported classes", () => {
      const lib_path = "src/lib.ts" as FilePath;
      const app_path = "src/app.ts" as FilePath;

      const my_class_location = create_location(lib_path, 1, 10);
      const constructor_call_location = create_location(app_path, 5, 20);
      const my_class_symbol = class_symbol("MyClass" as SymbolName, lib_path, my_class_location);

      // Library file - exports class
      const lib_symbols = new Map<SymbolId, SymbolDefinition>([
        [my_class_symbol, {
          id: my_class_symbol,
          name: "MyClass" as SymbolName,
          kind: "class",
          location: my_class_location,
          definition_scope: `scope:module:${lib_path}:0:0` as ScopeId,
        }],
      ]);

      const lib_exports: Export[] = [{
        kind: "named",
        symbol: my_class_symbol,
        symbol_name: "MyClass" as SymbolName,
        location: create_location(lib_path, 1, 0),
        exports: [{ local_name: "MyClass" as SymbolName, is_type_only: false }],
        modifiers: [],
        language: "typescript",
        node_type: "export_statement",
      }];

      // App file - imports and uses class
      const app_imports: Import[] = [{
        kind: "named",
        imports: [{ name: "MyClass" as SymbolName, is_type_only: false }],
        source: "./lib.ts",
        location: create_location(app_path, 1, 10),
        modifiers: [],
        language: "typescript",
        node_type: "import_statement",
      }];

      const app_type_flow: LocalTypeFlowData = {
        constructor_calls: [{
          class_name: "MyClass" as SymbolName,
          location: constructor_call_location,
          arguments_count: 0,
        }],
        assignments: [],
        returns: [],
        call_assignments: [],
      };

      const lib_index = create_test_index(lib_path, {
        symbols: lib_symbols,
        exports: lib_exports,
      });

      const app_index = create_test_index(app_path, {
        imports: app_imports,
        local_type_flow: app_type_flow,
      });

      const indices = new Map([
        [lib_path, lib_index],
        [app_path, app_index],
      ]);

      const result = resolve_symbols({ indices });

      // Verify constructor call is resolved to the imported class
      const constructor_call_key = location_key(constructor_call_location);
      const resolved_constructor = result.phases.methods.constructor_calls.get(constructor_call_key);
      expect(resolved_constructor).toBe(my_class_symbol);

      // Verify in combined resolved references
      expect(result.resolved_references.has(constructor_call_key)).toBe(true);
      expect(result.resolved_references.get(constructor_call_key)).toBe(my_class_symbol);
    });

    it("should handle multiple constructor calls to different imported classes", () => {
      const util_path = "src/util.ts" as FilePath;
      const service_path = "src/service.ts" as FilePath;
      const app_path = "src/app.ts" as FilePath;

      // Util exports Logger class
      const logger_location = create_location(util_path, 1, 10);
      const logger_symbol = class_symbol("Logger" as SymbolName, util_path, logger_location);

      // Service exports Database class
      const db_location = create_location(service_path, 1, 10);
      const db_symbol = class_symbol("Database" as SymbolName, service_path, db_location);

      // Constructor call locations
      const logger_call_location = create_location(app_path, 5, 20);
      const db_call_location = create_location(app_path, 6, 20);

      const util_index = create_test_index(util_path, {
        symbols: new Map([[logger_symbol, {
          id: logger_symbol,
          name: "Logger" as SymbolName,
          kind: "class",
          location: logger_location,
          definition_scope: `scope:module:${util_path}:0:0` as ScopeId,
        }]]),
        exports: [{
          kind: "named",
          symbol: logger_symbol,
          symbol_name: "Logger" as SymbolName,
          location: create_location(util_path, 1, 0),
          exports: [{ local_name: "Logger" as SymbolName, is_type_only: false }],
          modifiers: [],
          language: "typescript",
          node_type: "export_statement",
        }],
      });

      const service_index = create_test_index(service_path, {
        symbols: new Map([[db_symbol, {
          id: db_symbol,
          name: "Database" as SymbolName,
          kind: "class",
          location: db_location,
          definition_scope: `scope:module:${service_path}:0:0` as ScopeId,
        }]]),
        exports: [{
          kind: "named",
          symbol: db_symbol,
          symbol_name: "Database" as SymbolName,
          location: create_location(service_path, 1, 0),
          exports: [{ local_name: "Database" as SymbolName, is_type_only: false }],
          modifiers: [],
          language: "typescript",
          node_type: "export_statement",
        }],
      });

      const app_index = create_test_index(app_path, {
        imports: [
          {
            kind: "named",
            imports: [{ name: "Logger" as SymbolName, is_type_only: false }],
            source: "./util.ts",
            location: create_location(app_path, 1, 10),
            modifiers: [],
            language: "typescript",
            node_type: "import_statement",
          },
          {
            kind: "named",
            imports: [{ name: "Database" as SymbolName, is_type_only: false }],
            source: "./service.ts",
            location: create_location(app_path, 2, 10),
            modifiers: [],
            language: "typescript",
            node_type: "import_statement",
          },
        ],
        local_type_flow: {
          constructor_calls: [
            {
              class_name: "Logger" as SymbolName,
              location: logger_call_location,
              arguments_count: 1,
            },
            {
              class_name: "Database" as SymbolName,
              location: db_call_location,
              arguments_count: 2,
            },
          ],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      });

      const indices = new Map([
        [util_path, util_index],
        [service_path, service_index],
        [app_path, app_index],
      ]);

      const result = resolve_symbols({ indices });

      // Verify both constructor calls are resolved correctly
      const logger_call_key = location_key(logger_call_location);
      const db_call_key = location_key(db_call_location);

      expect(result.phases.methods.constructor_calls.get(logger_call_key)).toBe(logger_symbol);
      expect(result.phases.methods.constructor_calls.get(db_call_key)).toBe(db_symbol);

      // Verify both are in combined resolved references
      expect(result.resolved_references.get(logger_call_key)).toBe(logger_symbol);
      expect(result.resolved_references.get(db_call_key)).toBe(db_symbol);
    });
  });

  describe("Local constructor resolution", () => {
    it("should resolve constructor calls to classes in the same file", () => {
      const file_path = "src/local.ts" as FilePath;
      const class_location = create_location(file_path, 1, 10);
      const constructor_call_location = create_location(file_path, 5, 20);
      const local_class_symbol = class_symbol("LocalClass" as SymbolName, file_path, class_location);

      const symbols = new Map<SymbolId, SymbolDefinition>([
        [local_class_symbol, {
          id: local_class_symbol,
          name: "LocalClass" as SymbolName,
          kind: "class",
          location: class_location,
          definition_scope: `scope:module:${file_path}:0:0` as ScopeId,
        }],
      ]);

      const local_type_flow: LocalTypeFlowData = {
        constructor_calls: [{
          class_name: "LocalClass" as SymbolName,
          location: constructor_call_location,
          arguments_count: 0,
        }],
        assignments: [],
        returns: [],
        call_assignments: [],
      };

      const index = create_test_index(file_path, {
        symbols,
        local_type_flow,
      });

      const indices = new Map([[file_path, index]]);
      const result = resolve_symbols({ indices });

      const constructor_call_key = location_key(constructor_call_location);
      const resolved_constructor = result.phases.methods.constructor_calls.get(constructor_call_key);
      expect(resolved_constructor).toBe(local_class_symbol);
    });

    it("should resolve constructor calls with both local and imported classes (current behavior: imports take priority)", () => {
      const lib_path = "src/lib.ts" as FilePath;
      const app_path = "src/app.ts" as FilePath;

      // Both files have a class named "Utility" but at different locations
      const imported_class_location = create_location(lib_path, 1, 10);
      const local_class_location = create_location(app_path, 10, 10);
      const constructor_call_location = create_location(app_path, 15, 20);

      const imported_utility_symbol = class_symbol("Utility" as SymbolName, lib_path, imported_class_location);
      const local_utility_symbol = class_symbol("Utility" as SymbolName, app_path, local_class_location);

      const lib_index = create_test_index(lib_path, {
        symbols: new Map([[imported_utility_symbol, {
          id: imported_utility_symbol,
          name: "Utility" as SymbolName,
          kind: "class",
          location: imported_class_location,
          definition_scope: `scope:module:${lib_path}:0:0` as ScopeId,
        }]]),
        exports: [{
          kind: "named",
          symbol: imported_utility_symbol,
          symbol_name: "Utility" as SymbolName,
          location: create_location(lib_path, 1, 0),
          exports: [{ local_name: "Utility" as SymbolName, is_type_only: false }],
          modifiers: [],
          language: "typescript",
          node_type: "export_statement",
        }],
      });

      const app_index = create_test_index(app_path, {
        symbols: new Map([[local_utility_symbol, {
          id: local_utility_symbol,
          name: "Utility" as SymbolName,
          kind: "class",
          location: local_class_location,
          definition_scope: `scope:module:${app_path}:0:0` as ScopeId,
        }]]),
        imports: [{
          kind: "named",
          imports: [{ name: "Utility" as SymbolName, is_type_only: false }],
          source: "./lib.ts",
          location: create_location(app_path, 1, 10),
          modifiers: [],
          language: "typescript",
          node_type: "import_statement",
        }],
        local_type_flow: {
          constructor_calls: [{
            class_name: "Utility" as SymbolName,
            location: constructor_call_location,
            arguments_count: 0,
          }],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      });

      const indices = new Map([
        [lib_path, lib_index],
        [app_path, app_index],
      ]);

      const result = resolve_symbols({ indices });

      // Current implementation: imports take priority over local classes
      const constructor_call_key = location_key(constructor_call_location);
      const resolved_constructor = result.phases.methods.constructor_calls.get(constructor_call_key);
      expect(resolved_constructor).toBe(imported_utility_symbol);
      // This documents current behavior - may need to be changed in future for proper scoping
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle constructor calls to non-existent classes gracefully", () => {
      const file_path = "src/test.ts" as FilePath;
      const constructor_call_location = create_location(file_path, 5, 20);

      const local_type_flow: LocalTypeFlowData = {
        constructor_calls: [{
          class_name: "NonExistentClass" as SymbolName,
          location: constructor_call_location,
          arguments_count: 0,
        }],
        assignments: [],
        returns: [],
        call_assignments: [],
      };

      const index = create_test_index(file_path, {
        local_type_flow,
      });

      const indices = new Map([[file_path, index]]);
      const result = resolve_symbols({ indices });

      // Should not throw and should not resolve the call
      expect(result).toBeDefined();
      const constructor_call_key = location_key(constructor_call_location);
      const resolved_constructor = result.phases.methods.constructor_calls.get(constructor_call_key);
      expect(resolved_constructor).toBeUndefined();
    });

    it("should handle imports that don't exist", () => {
      const app_path = "src/app.ts" as FilePath;
      const constructor_call_location = create_location(app_path, 5, 20);

      const app_index = create_test_index(app_path, {
        imports: [{
          kind: "named",
          imports: [{ name: "MissingClass" as SymbolName, is_type_only: false }],
          source: "./missing.ts",
          location: create_location(app_path, 1, 10),
          modifiers: [],
          language: "typescript",
          node_type: "import_statement",
        }],
        local_type_flow: {
          constructor_calls: [{
            class_name: "MissingClass" as SymbolName,
            location: constructor_call_location,
            arguments_count: 0,
          }],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      });

      const indices = new Map([[app_path, app_index]]);
      const result = resolve_symbols({ indices });

      // Should not throw and should not resolve the call
      expect(result).toBeDefined();
      const constructor_call_key = location_key(constructor_call_location);
      const resolved_constructor = result.phases.methods.constructor_calls.get(constructor_call_key);
      expect(resolved_constructor).toBeUndefined();
    });

    it("should handle imported symbols that are not classes", () => {
      const lib_path = "src/lib.ts" as FilePath;
      const app_path = "src/app.ts" as FilePath;

      // Library exports a function, not a class
      const func_location = create_location(lib_path, 1, 10);
      const func_symbol = `function:${lib_path}:1:10:notAClass` as SymbolId;

      const constructor_call_location = create_location(app_path, 5, 20);

      const lib_index = create_test_index(lib_path, {
        symbols: new Map([[func_symbol, {
          id: func_symbol,
          name: "notAClass" as SymbolName,
          kind: "function",
          location: func_location,
          definition_scope: `scope:module:${lib_path}:0:0` as ScopeId,
        }]]),
        exports: [{
          kind: "named",
          symbol: func_symbol,
          symbol_name: "notAClass" as SymbolName,
          location: create_location(lib_path, 1, 0),
          exports: [{ local_name: "notAClass" as SymbolName, is_type_only: false }],
          modifiers: [],
          language: "typescript",
          node_type: "export_statement",
        }],
      });

      const app_index = create_test_index(app_path, {
        imports: [{
          kind: "named",
          imports: [{ name: "notAClass" as SymbolName, is_type_only: false }],
          source: "./lib.ts",
          location: create_location(app_path, 1, 10),
          modifiers: [],
          language: "typescript",
          node_type: "import_statement",
        }],
        local_type_flow: {
          constructor_calls: [{
            class_name: "notAClass" as SymbolName,
            location: constructor_call_location,
            arguments_count: 0,
          }],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      });

      const indices = new Map([
        [lib_path, lib_index],
        [app_path, app_index],
      ]);

      const result = resolve_symbols({ indices });

      // Should not resolve to a function when looking for a class constructor
      const constructor_call_key = location_key(constructor_call_location);
      const resolved_constructor = result.phases.methods.constructor_calls.get(constructor_call_key);
      expect(resolved_constructor).toBeUndefined();
    });

    it("should handle empty constructor calls array", () => {
      const file_path = "src/empty.ts" as FilePath;

      const index = create_test_index(file_path, {
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      });

      const indices = new Map([[file_path, index]]);
      const result = resolve_symbols({ indices });

      // Should work without throwing
      expect(result).toBeDefined();
      expect(result.phases.methods.constructor_calls.size).toBe(0);
    });
  });

  describe("Integration with other phases", () => {
    it("should work correctly when constructor resolution is part of full pipeline", () => {
      const lib_path = "src/lib.ts" as FilePath;
      const app_path = "src/app.ts" as FilePath;

      const class_location = create_location(lib_path, 1, 10);
      const constructor_call_location = create_location(app_path, 5, 20);
      const complex_class_symbol = class_symbol("ComplexClass" as SymbolName, lib_path, class_location);

      const lib_index = create_test_index(lib_path, {
        symbols: new Map([[complex_class_symbol, {
          id: complex_class_symbol,
          name: "ComplexClass" as SymbolName,
          kind: "class",
          location: class_location,
          definition_scope: `scope:module:${lib_path}:0:0` as ScopeId,
        }]]),
        exports: [{
          kind: "named",
          symbol: complex_class_symbol,
          symbol_name: "ComplexClass" as SymbolName,
          location: create_location(lib_path, 1, 0),
          exports: [{ local_name: "ComplexClass" as SymbolName, is_type_only: false }],
          modifiers: [],
          language: "typescript",
          node_type: "export_statement",
        }],
      });

      const app_index = create_test_index(app_path, {
        imports: [{
          kind: "named",
          imports: [{ name: "ComplexClass" as SymbolName, is_type_only: false }],
          source: "./lib.ts",
          location: create_location(app_path, 1, 10),
          modifiers: [],
          language: "typescript",
          node_type: "import_statement",
        }],
        local_type_flow: {
          constructor_calls: [{
            class_name: "ComplexClass" as SymbolName,
            location: constructor_call_location,
            arguments_count: 3,
          }],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      });

      const indices = new Map([
        [lib_path, lib_index],
        [app_path, app_index],
      ]);

      const result = resolve_symbols({ indices });

      // Verify all phases worked
      expect(result.phases.imports).toBeDefined();
      expect(result.phases.functions).toBeDefined();
      expect(result.phases.types).toBeDefined();
      expect(result.phases.methods).toBeDefined();

      // Verify constructor resolution specifically
      const constructor_call_key = location_key(constructor_call_location);
      expect(result.phases.methods.constructor_calls.get(constructor_call_key)).toBe(complex_class_symbol);

      // Verify combined results
      expect(result.resolved_references.get(constructor_call_key)).toBe(complex_class_symbol);
      expect(result.resolved_references.size).toBeGreaterThan(0);
    });
  });
});
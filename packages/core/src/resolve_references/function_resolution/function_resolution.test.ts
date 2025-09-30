import { describe, it, expect, beforeEach } from "vitest";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  Location,
  LocationKey,
  ScopeId,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { CallReference } from "@ariadnejs/types/src/call_chains";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import { resolve_function_calls } from "./function_resolver";

// Helper function to create a SymbolId for a built-in function
// This matches the format used by hoisting_handler.ts
function create_builtin_symbol(name: string, language: string): SymbolId {
  return `builtin:${language}:${name}` as SymbolId;
}

// Helper function to create a mock SemanticIndex
function create_mock_index(
  file_path: FilePath,
  calls: CallReference[]
): SemanticIndex {
  const testFuncDef = {
    id: "sym:testFunc" as SymbolId,
    name: "testFunc" as SymbolName,
    kind: "function" as const,
    location: {
      file_path,
      line: 1,
      column: 10,
      end_line: 1,
      end_column: 18,
    },
    scope_id: "scope:module" as ScopeId,
    is_hoisted: true,
    is_exported: false,
    is_imported: false,
  };

  const localFuncDef = {
    id: "sym:localFunc" as SymbolId,
    name: "localFunc" as SymbolName,
    kind: "function" as const,
    location: {
      file_path,
      line: 6,
      column: 10,
      end_line: 6,
      end_column: 19,
    },
    scope_id: "scope:function" as ScopeId,
    is_hoisted: true,
    is_exported: false,
    is_imported: false,
  };

  return {
    file_path,
    language: "javascript",
    root_scope_id: "scope:module" as ScopeId,
    scopes: new Map([
      [
        "scope:module" as ScopeId,
        {
          id: "scope:module" as ScopeId,
          parent_id: null,
          name: null,
          type: "module" as const,
          location: {
            file_path,
            line: 1,
            column: 1,
            end_line: 100,
            end_column: 1,
          },
          child_ids: ["scope:function" as ScopeId],
          symbols: new Map([["testFunc" as SymbolName, testFuncDef]]),
        },
      ],
      [
        "scope:function" as ScopeId,
        {
          id: "scope:function" as ScopeId,
          parent_id: "scope:module" as ScopeId,
          name: "testFunc" as SymbolName,
          type: "function" as const,
          location: {
            file_path,
            line: 5,
            column: 1,
            end_line: 10,
            end_column: 1,
          },
          child_ids: [],
          symbols: new Map([["localFunc" as SymbolName, localFuncDef]]),
        },
      ],
    ]),
    symbols: new Map([
      ["sym:testFunc" as SymbolId, testFuncDef],
      ["sym:localFunc" as SymbolId, localFuncDef],
    ]),
    references: {
      calls,
      returns: [],
      member_accesses: [],
      type_annotations: [],
      type_flows: {
        constructor_calls: [],
        assignments: [],
        returns: [],
        call_assignments: [],
      },
    },
    imports: [],
    exports: [],
    file_symbols_by_name: new Map(),
    local_types: [],
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
}

describe("Function Resolution", () => {
  describe("resolve_function_calls", () => {
    it("should resolve lexical function calls", () => {
      const file_path = "test.js" as FilePath;
      const call_location: Location = {
        file_path,
        start_line: 8,
        start_column: 5,
        end_line: 8,
        end_column: 14,
      };

      const calls: CallReference[] = [
        {
          location: call_location,
          name: "localFunc" as SymbolName,
          scope_id: "scope:function" as ScopeId,
          call_type: "function",
        },
      ];

      const indices = new Map([
        [file_path, create_mock_index(file_path, calls)],
      ]);

      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map();

      const result = resolve_function_calls(indices, imports);

      expect(result.function_calls.size).toBe(1);
      expect(result.function_calls.get(location_key(call_location))).toBe(
        "sym:localFunc" as SymbolId
      );
      expect(result.calls_to_function.get("sym:localFunc" as SymbolId)).toEqual(
        [call_location]
      );
    });

    it("should resolve imported function calls", () => {
      const file_path = "test.js" as FilePath;
      const call_location: Location = {
        file_path,
        start_line: 10,
        start_column: 5,
        end_line: 10,
        end_column: 18,
      };

      const calls: CallReference[] = [
        {
          location: call_location,
          name: "importedFunc" as SymbolName,
          scope_id: "scope:module" as ScopeId,
          call_type: "function",
        },
      ];

      const indices = new Map([
        [file_path, create_mock_index(file_path, calls)],
        [
          "other.js" as FilePath,
          {
            ...create_mock_index("other.js" as FilePath, []),
            symbols: new Map([
              [
                "sym:importedFunc" as SymbolId,
                {
                  id: "sym:importedFunc" as SymbolId,
                  name: "importedFunc" as SymbolName,
                  kind: "function" as const,
                  location: {
                    file_path: "other.js" as FilePath,
                    line: 1,
                    column: 10,
                    end_line: 1,
                    end_column: 22,
                  },
                  scope_id: "scope:module" as ScopeId,
                  is_hoisted: true,
                  is_exported: true,
                  is_imported: false,
                },
              ],
            ]),
          },
        ],
      ]);

      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map([
        [
          file_path,
          new Map([
            ["importedFunc" as SymbolName, "sym:importedFunc" as SymbolId],
          ]),
        ],
      ]);

      const result = resolve_function_calls(indices, imports);

      expect(result.function_calls.size).toBe(1);
      expect(result.function_calls.get(location_key(call_location))).toBe(
        "sym:importedFunc" as SymbolId
      );
    });

    it("should resolve built-in function calls", () => {
      const file_path = "test.js" as FilePath;
      const call_location: Location = {
        file_path,
        start_line: 12,
        start_column: 5,
        end_line: 12,
        end_column: 13,
      };

      const calls: CallReference[] = [
        {
          location: call_location,
          name: "parseInt" as SymbolName,
          scope_id: "scope:module" as ScopeId,
          call_type: "function",
        },
      ];

      const indices = new Map([
        [file_path, create_mock_index(file_path, calls)],
      ]);

      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map();

      const result = resolve_function_calls(indices, imports);

      expect(result.function_calls.size).toBe(1);
      const resolved = result.function_calls.get(location_key(call_location));
      expect(resolved).toBe(create_builtin_symbol("parseInt", "javascript"));
    });

    it("should handle multiple function calls", () => {
      const file_path = "test.js" as FilePath;
      const calls: CallReference[] = [
        {
          location: {
            file_path,
            start_line: 8,
            start_column: 5,
            end_line: 8,
            end_column: 13,
          },
          name: "testFunc" as SymbolName,
          scope_id: "scope:module" as ScopeId,
          call_type: "function",
        },
        {
          location: {
            file_path,
            start_line: 9,
            start_column: 5,
            end_line: 9,
            end_column: 13,
          },
          name: "testFunc" as SymbolName,
          scope_id: "scope:module" as ScopeId,
          call_type: "function",
        },
        {
          location: {
            file_path,
            start_line: 10,
            start_column: 5,
            end_line: 10,
            end_column: 14,
          },
          name: "localFunc" as SymbolName,
          scope_id: "scope:function" as ScopeId,
          call_type: "function",
        },
      ];

      const indices = new Map([
        [file_path, create_mock_index(file_path, calls)],
      ]);

      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map();

      const result = resolve_function_calls(indices, imports);

      expect(result.function_calls.size).toBe(3);
      expect(
        result.calls_to_function.get("sym:testFunc" as SymbolId)?.length
      ).toBe(2);
      expect(
        result.calls_to_function.get("sym:localFunc" as SymbolId)?.length
      ).toBe(1);
    });

    it("should ignore method and constructor calls", () => {
      const file_path = "test.js" as FilePath;
      const calls: CallReference[] = [
        {
          location: {
            file_path,
            start_line: 8,
            start_column: 5,
            end_line: 8,
            end_column: 13,
          },
          name: "testFunc" as SymbolName,
          scope_id: "scope:module" as ScopeId,
          call_type: "function",
        },
        {
          location: {
            file_path,
            start_line: 9,
            start_column: 5,
            end_line: 9,
            end_column: 14,
          },
          name: "methodCall" as SymbolName,
          scope_id: "scope:module" as ScopeId,
          call_type: "method",
        },
        {
          location: {
            file_path,
            start_line: 10,
            start_column: 5,
            end_line: 10,
            end_column: 14,
          },
          name: "MyClass" as SymbolName,
          scope_id: "scope:module" as ScopeId,
          call_type: "constructor",
        },
      ];

      const indices = new Map([
        [file_path, create_mock_index(file_path, calls)],
      ]);

      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map();

      const result = resolve_function_calls(indices, imports);

      // Should only resolve the function call, not method or constructor
      expect(result.function_calls.size).toBe(1);
    });

    it("should track unresolved functions", () => {
      const file_path = "test.js" as FilePath;
      const call_location: Location = {
        file_path,
        start_line: 8,
        start_column: 5,
        end_line: 8,
        end_column: 20,
      };

      const calls: CallReference[] = [
        {
          location: call_location,
          name: "unknownFunction" as SymbolName,
          scope_id: "scope:module" as ScopeId,
          call_type: "function",
        },
      ];

      const indices = new Map([
        [file_path, create_mock_index(file_path, calls)],
      ]);

      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map();

      const result = resolve_function_calls(indices, imports);

      // Unresolved function should not be in the maps
      expect(result.function_calls.size).toBe(0);
      expect(result.calls_to_function.size).toBe(0);
    });

    it("should resolve Python built-in functions", () => {
      const file_path = "test.py" as FilePath;
      const call_location: Location = {
        file_path,
        start_line: 5,
        start_column: 1,
        end_line: 5,
        end_column: 6,
      };

      const calls: CallReference[] = [
        {
          location: call_location,
          name: "print" as SymbolName,
          scope_id: "scope:module" as ScopeId,
          call_type: "function",
        },
      ];

      let index = create_mock_index(file_path, calls);
      // Override language to Python
      index = { ...index, language: "python" };

      const indices = new Map([[file_path, index]]);

      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map();

      const result = resolve_function_calls(indices, imports);

      expect(result.function_calls.size).toBe(1);
      const resolved = result.function_calls.get(location_key(call_location));
      expect(resolved).toBe(create_builtin_symbol("print", "python"));
    });

    it("should provide detailed resolution information", () => {
      const file_path = "test.js" as FilePath;
      const call_location: Location = {
        file_path,
        start_line: 8,
        start_column: 5,
        end_line: 8,
        end_column: 14,
      };

      const calls: CallReference[] = [
        {
          location: call_location,
          name: "localFunc" as SymbolName,
          scope_id: "scope:function" as ScopeId,
          call_type: "function",
        },
      ];

      const indices = new Map([
        [file_path, create_mock_index(file_path, calls)],
      ]);

      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map();

      const result = resolve_function_calls(indices, imports);

      const details = result.resolution_details.get(
        location_key(call_location)
      );
      expect(details).toBeDefined();
      expect(details?.resolution_strategy).toBe("lexical");
      expect(details?.resolved_function).toBe("sym:localFunc" as SymbolId);
      expect(details?.call_location).toEqual(call_location);
      expect(details?.scope_chain).toContain("scope:function" as ScopeId);
    });

    it("should handle nested function scopes", () => {
      const file_path = "test.js" as FilePath;
      const outerFuncDef = {
        id: "sym:outerFunc" as SymbolId,
        name: "outerFunc" as SymbolName,
        kind: "function" as const,
        location: {
          file_path,
          line: 1,
          column: 10,
          end_line: 1,
          end_column: 19,
        },
        scope_id: "scope:module" as ScopeId,
        is_hoisted: true,
        is_exported: false,
        is_imported: false,
      };

      const innerFuncDef = {
        id: "sym:innerFunc" as SymbolId,
        name: "innerFunc" as SymbolName,
        kind: "function" as const,
        location: {
          file_path,
          line: 3,
          column: 10,
          end_line: 3,
          end_column: 19,
        },
        scope_id: "scope:outer" as ScopeId,
        is_hoisted: true,
        is_exported: false,
        is_imported: false,
      };

      const index: SemanticIndex = {
        file_path,
        language: "javascript",
        root_scope_id: "scope:module" as ScopeId,
        scopes: new Map([
          [
            "scope:module" as ScopeId,
            {
              id: "scope:module" as ScopeId,
              parent_id: null,
              name: null,
              type: "module" as const,
              location: {
                file_path,
                line: 1,
                column: 1,
                end_line: 20,
                end_column: 1,
              },
              child_ids: ["scope:outer" as ScopeId],
              symbols: new Map([["outerFunc" as SymbolName, outerFuncDef]]),
            },
          ],
          [
            "scope:outer" as ScopeId,
            {
              id: "scope:outer" as ScopeId,
              parent_id: "scope:module" as ScopeId,
              name: "outerFunc" as SymbolName,
              type: "function" as const,
              location: {
                file_path,
                line: 1,
                column: 1,
                end_line: 10,
                end_column: 1,
              },
              child_ids: ["scope:inner" as ScopeId],
              symbols: new Map([["innerFunc" as SymbolName, innerFuncDef]]),
            },
          ],
          [
            "scope:inner" as ScopeId,
            {
              id: "scope:inner" as ScopeId,
              parent_id: "scope:outer" as ScopeId,
              name: "innerFunc" as SymbolName,
              type: "function" as const,
              location: {
                file_path,
                line: 3,
                column: 1,
                end_line: 8,
                end_column: 1,
              },
              child_ids: [],
              symbols: new Map(),
            },
          ],
        ]),
        symbols: new Map([
          ["sym:outerFunc" as SymbolId, outerFuncDef],
          ["sym:innerFunc" as SymbolId, innerFuncDef],
        ]),
        references: {
          type_flows: {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
          calls: [
            {
              location: {
                file_path,
                start_line: 5,
                start_column: 5,
                end_line: 5,
                end_column: 14,
              },
              name: "innerFunc" as SymbolName,
              scope_id: "scope:inner" as ScopeId,
              call_type: "function",
            },
            {
              location: {
                file_path,
                start_line: 6,
                start_column: 5,
                end_line: 6,
                end_column: 14,
              },
              name: "outerFunc" as SymbolName,
              scope_id: "scope:inner" as ScopeId,
              call_type: "function",
            },
          ],
          returns: [],
          member_accesses: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
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

      const indices = new Map([[file_path, index]]);
      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map();

      const result = resolve_function_calls(indices, imports);

      // innerFunc calling itself should resolve
      const innerCall = location_key({
        file_path,
        start_line: 5,
        start_column: 5,
        end_line: 5,
        end_column: 14,
      });
      expect(result.function_calls.get(innerCall)).toBe(
        "sym:innerFunc" as SymbolId
      );

      // innerFunc calling outerFunc should resolve through parent scope
      const outerCall = location_key({
        file_path,
        start_line: 6,
        start_column: 5,
        end_line: 6,
        end_column: 14,
      });
      expect(result.function_calls.get(outerCall)).toBe(
        "sym:outerFunc" as SymbolId
      );
    });

    it("should handle functions with same name in different scopes", () => {
      const file_path = "test.js" as FilePath;
      const globalProcessDef = {
        id: "sym:process:global" as SymbolId,
        name: "process" as SymbolName,
        kind: "function" as const,
        location: {
          file_path,
          line: 1,
          column: 10,
          end_line: 1,
          end_column: 17,
        },
        scope_id: "scope:module" as ScopeId,
        is_hoisted: true,
        is_exported: false,
        is_imported: false,
      };

      const localProcessDef = {
        id: "sym:process:local" as SymbolId,
        name: "process" as SymbolName,
        kind: "function" as const,
        location: {
          file_path,
          line: 5,
          column: 10,
          end_line: 5,
          end_column: 17,
        },
        scope_id: "scope:function" as ScopeId,
        is_hoisted: true,
        is_exported: false,
        is_imported: false,
      };

      const index: SemanticIndex = {
        file_path,
        language: "javascript",
        root_scope_id: "scope:module" as ScopeId,
        scopes: new Map([
          [
            "scope:module" as ScopeId,
            {
              id: "scope:module" as ScopeId,
              parent_id: null,
              name: null,
              type: "module" as const,
              location: {
                file_path,
                line: 1,
                column: 1,
                end_line: 20,
                end_column: 1,
              },
              child_ids: ["scope:function" as ScopeId],
              symbols: new Map([["process" as SymbolName, globalProcessDef]]),
            },
          ],
          [
            "scope:function" as ScopeId,
            {
              id: "scope:function" as ScopeId,
              parent_id: "scope:module" as ScopeId,
              name: "main" as SymbolName,
              type: "function" as const,
              location: {
                file_path,
                line: 3,
                column: 1,
                end_line: 10,
                end_column: 1,
              },
              child_ids: [],
              symbols: new Map([["process" as SymbolName, localProcessDef]]),
            },
          ],
        ]),
        symbols: new Map([
          ["sym:process:global" as SymbolId, globalProcessDef],
          ["sym:process:local" as SymbolId, localProcessDef],
        ]),
        references: {
          type_flows: {
            constructor_calls: [],
            assignments: [],
            returns: [],
            call_assignments: [],
          },
          calls: [
            {
              location: {
                file_path,
                start_line: 7,
                start_column: 5,
                end_line: 7,
                end_column: 12,
              },
              name: "process" as SymbolName,
              scope_id: "scope:function" as ScopeId,
              call_type: "function",
            },
            {
              location: {
                file_path,
                start_line: 15,
                start_column: 5,
                end_line: 15,
                end_column: 12,
              },
              name: "process" as SymbolName,
              scope_id: "scope:module" as ScopeId,
              call_type: "function",
            },
          ],
          returns: [],
          member_accesses: [],
          type_annotations: [],
        },
        imports: [],
        exports: [],
        file_symbols_by_name: new Map(),
        local_types: [],
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

      const indices = new Map([[file_path, index]]);
      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map();

      const result = resolve_function_calls(indices, imports);

      // Call in function scope should resolve to local function (shadowing)
      const localCall = location_key({
        file_path,
        start_line: 7,
        start_column: 5,
        end_line: 7,
        end_column: 12,
      });
      expect(result.function_calls.get(localCall)).toBe(
        "sym:process:local" as SymbolId
      );

      // Call in module scope should resolve to global function
      const globalCall = location_key({
        file_path,
        start_line: 15,
        start_column: 5,
        end_line: 15,
        end_column: 12,
      });
      expect(result.function_calls.get(globalCall)).toBe(
        "sym:process:global" as SymbolId
      );
    });

    it("should handle Rust-specific functions and macros", () => {
      const file_path = "test.rs" as FilePath;
      let index = create_mock_index(file_path, [
        {
          location: {
            file_path,
            start_line: 5,
            start_column: 5,
            end_line: 5,
            end_column: 13,
          },
          name: "println!" as SymbolName,
          scope_id: "scope:module" as ScopeId,
          call_type: "function",
        },
      ]);
      index = { ...index, language: "rust" };

      const indices = new Map([[file_path, index]]);
      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map();

      const result = resolve_function_calls(indices, imports);

      const call = location_key({
        file_path,
        start_line: 5,
        start_column: 5,
        end_line: 5,
        end_column: 13,
      });
      expect(result.function_calls.get(call)).toBe(
        "builtin:rust:println!" as SymbolId
      );
    });

    it("should handle empty indices gracefully", () => {
      const indices = new Map<FilePath, SemanticIndex>();
      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map();

      const result = resolve_function_calls(indices, imports);

      expect(result.function_calls.size).toBe(0);
      expect(result.calls_to_function.size).toBe(0);
      expect(result.resolution_details.size).toBe(0);
    });

    it("should handle indices with no function calls", () => {
      const file_path = "test.js" as FilePath;
      const index = create_mock_index(file_path, []);

      const indices = new Map([[file_path, index]]);
      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map();

      const result = resolve_function_calls(indices, imports);

      expect(result.function_calls.size).toBe(0);
      expect(result.calls_to_function.size).toBe(0);
    });

    it("should handle super calls correctly", () => {
      const file_path = "test.js" as FilePath;
      const calls: CallReference[] = [
        {
          location: {
            file_path,
            start_line: 5,
            start_column: 5,
            end_line: 5,
            end_column: 10,
          },
          name: "super" as SymbolName,
          scope_id: "scope:module" as ScopeId,
          call_type: "super",
        },
        {
          location: {
            file_path,
            start_line: 10,
            start_column: 5,
            end_line: 10,
            end_column: 13,
          },
          name: "testFunc" as SymbolName,
          scope_id: "scope:module" as ScopeId,
          call_type: "function",
        },
      ];

      const index = create_mock_index(file_path, calls);
      const indices = new Map([[file_path, index]]);
      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map();

      const result = resolve_function_calls(indices, imports);

      // Should only resolve function calls, not super calls
      expect(result.function_calls.size).toBe(1);
      const funcCall = location_key({
        file_path,
        start_line: 10,
        start_column: 5,
        end_line: 10,
        end_column: 13,
      });
      expect(result.function_calls.has(funcCall)).toBe(true);
    });

    it("should handle imported functions that don't exist in source file", () => {
      const file_path = "test.js" as FilePath;
      const call_location: Location = {
        file_path,
        start_line: 10,
        start_column: 5,
        end_line: 10,
        end_column: 18,
      };

      const calls: CallReference[] = [
        {
          location: call_location,
          name: "missingFunc" as SymbolName,
          scope_id: "scope:module" as ScopeId,
          call_type: "function",
        },
      ];

      const indices = new Map([
        [file_path, create_mock_index(file_path, calls)],
      ]);

      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map([
        [
          file_path,
          // Import maps to a symbol that doesn't exist in any index
          new Map([["missingFunc" as SymbolName, "sym:missing" as SymbolId]]),
        ],
      ]);

      const result = resolve_function_calls(indices, imports);

      // Should not resolve since the imported symbol doesn't exist
      expect(result.function_calls.size).toBe(0);
    });

    it("should resolve TypeScript-specific global types as functions", () => {
      const file_path = "test.ts" as FilePath;
      const calls: CallReference[] = [
        {
          location: {
            file_path,
            start_line: 5,
            start_column: 5,
            end_line: 5,
            end_column: 11,
          },
          name: "Number" as SymbolName,
          scope_id: "scope:module" as ScopeId,
          call_type: "function",
        },
        {
          location: {
            file_path,
            start_line: 6,
            start_column: 5,
            end_line: 6,
            end_column: 11,
          },
          name: "String" as SymbolName,
          scope_id: "scope:module" as ScopeId,
          call_type: "function",
        },
      ];

      let index = create_mock_index(file_path, calls);
      index = { ...index, language: "typescript" };

      const indices = new Map([[file_path, index]]);
      const imports: ReadonlyMap<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      > = new Map();

      const result = resolve_function_calls(indices, imports);

      expect(result.function_calls.size).toBe(2);
      const numberCall = location_key({
        file_path,
        start_line: 5,
        start_column: 5,
        end_line: 5,
        end_column: 11,
      });
      const stringCall = location_key({
        file_path,
        start_line: 6,
        start_column: 5,
        end_line: 6,
        end_column: 11,
      });
      expect(result.function_calls.get(numberCall)).toBe(
        "builtin:typescript:Number" as SymbolId
      );
      expect(result.function_calls.get(stringCall)).toBe(
        "builtin:typescript:String" as SymbolId
      );
    });
  });
});

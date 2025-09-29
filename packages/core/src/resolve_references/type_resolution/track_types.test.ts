/**
 * Tests for type tracking resolution
 */

import { describe, it, expect, beforeEach } from "vitest";
import type {
  TypeId,
  SymbolId,
  Location,
  FilePath,
  SymbolName,
  ScopeId,
} from "@ariadnejs/types";
import { variable_symbol } from "@ariadnejs/types";
import type { LocalTypeTracking } from "../../index_single_file/references/type_tracking";
import {
  resolve_type_tracking,
  type ResolvedTypeTracking,
  type TypeFlowGraph,
  type TypeFlowEdge,
} from "./track_types";
import type { GlobalTypeRegistry, ResolvedTypeDefinition } from "./types";

describe("resolve_type_tracking", () => {
  const mock_file_path = "test.ts" as FilePath;
  const mock_location: Location = {
    file_path: mock_file_path,
    line: 1,
    column: 0,
    end_line: 1,
    end_column: 10,
  };

  let mock_type_registry: GlobalTypeRegistry;

  beforeEach(() => {
    // Create a mock type registry
    const types = new Map<TypeId, ResolvedTypeDefinition>();
    const type_names = new Map<FilePath, Map<SymbolName, TypeId>>();

    // Add a custom class type
    types.set("class:MyClass:test.ts:1:0" as TypeId, {
      type_id: "class:MyClass:test.ts:1:0" as TypeId,
      name: "MyClass" as SymbolName,
      definition_location: mock_location,
      file_path: mock_file_path,
      kind: "class",
      all_members: new Map(),
      base_types: [],
      derived_types: [],
    });

    // Add another custom type
    types.set("interface:UserInfo:test.ts:5:0" as TypeId, {
      type_id: "interface:UserInfo:test.ts:5:0" as TypeId,
      name: "UserInfo" as SymbolName,
      definition_location: {
        ...mock_location,
        line: 5,
      },
      file_path: mock_file_path,
      kind: "interface",
      all_members: new Map(),
      base_types: [],
      derived_types: [],
    });

    // Set up type_names map
    const file_types = new Map<SymbolName, TypeId>();
    file_types.set(
      "MyClass" as SymbolName,
      "class:MyClass:test.ts:1:0" as TypeId
    );
    file_types.set(
      "UserInfo" as SymbolName,
      "interface:UserInfo:test.ts:5:0" as TypeId
    );
    type_names.set(mock_file_path, file_types);

    mock_type_registry = {
      types,
      type_names,
      hierarchy: {
        extends_edges: new Map(),
        implements_edges: new Map(),
        all_base_types: new Map(),
        all_derived_types: new Map(),
      },
    } as GlobalTypeRegistry;
  });

  describe("Type annotation resolution", () => {
    it("should resolve built-in types to TypeIds", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [
              {
                name: "x" as SymbolName,
                location: mock_location,
                annotation_text: "string",
                kind: "variable",
                scope_id: "scope_1" as ScopeId,
              },
              {
                name: "y" as SymbolName,
                location: { ...mock_location, line: 2, end_line: 2 },
                annotation_text: "number",
                kind: "variable",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            declarations: [],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      // Should resolve built-in types
      const x_symbol = variable_symbol("x" as SymbolName, mock_location);
      const y_symbol = variable_symbol("y" as SymbolName, {
        ...mock_location,
        line: 2,
        end_line: 2,
      });

      expect(resolved.variable_types.get(x_symbol)).toBe("builtin:string");
      expect(resolved.variable_types.get(y_symbol)).toBe("builtin:number");
    });

    it("should resolve custom types from registry", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [
              {
                name: "obj" as SymbolName,
                location: mock_location,
                annotation_text: "MyClass",
                kind: "variable",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            declarations: [],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const obj_symbol = variable_symbol("obj" as SymbolName, mock_location);
      expect(resolved.variable_types.get(obj_symbol)).toBe(
        "class:MyClass:test.ts:1:0"
      );
    });

    it("should handle array syntax", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [
              {
                name: "items" as SymbolName,
                location: mock_location,
                annotation_text: "string[]",
                kind: "variable",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            declarations: [],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const items_symbol = variable_symbol(
        "items" as SymbolName,
        mock_location
      );
      // For now, just resolves to Array (complex generics handling is future work)
      expect(resolved.variable_types.get(items_symbol)).toBe("builtin:Array");
    });

    it("should handle union types", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [
              {
                name: "mixed" as SymbolName,
                location: mock_location,
                annotation_text: "string | number",
                kind: "variable",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            declarations: [],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const mixed_symbol = variable_symbol(
        "mixed" as SymbolName,
        mock_location
      );
      // Union types not fully supported yet, should not resolve
      expect(resolved.variable_types.get(mixed_symbol)).toBeUndefined();
    });

    it("should handle generic types", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [
              {
                name: "map" as SymbolName,
                location: mock_location,
                annotation_text: "Map<string, number>",
                kind: "variable",
                scope_id: "scope_1" as ScopeId,
              },
              {
                name: "promise" as SymbolName,
                location: { ...mock_location, line: 2, end_line: 2 },
                annotation_text: "Promise<UserInfo>",
                kind: "variable",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            declarations: [],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const map_symbol = variable_symbol("map" as SymbolName, mock_location);
      const promise_symbol = variable_symbol("promise" as SymbolName, {
        ...mock_location,
        line: 2,
        end_line: 2,
      });

      // Generic parsing extracts base type
      expect(resolved.variable_types.get(map_symbol)).toBe("builtin:Map");
      expect(resolved.variable_types.get(promise_symbol)).toBe(
        "builtin:Promise"
      );
    });

    it("should populate expression_types for annotations", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [
              {
                name: "x" as SymbolName,
                location: mock_location,
                annotation_text: "string",
                kind: "variable",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            declarations: [],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      // Should also populate expression_types map
      expect(resolved.expression_types.get(mock_location)).toBe(
        "builtin:string"
      );
    });
  });

  describe("Type inference from initializers", () => {
    it("should infer types from literal values", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [],
            declarations: [
              {
                name: "str" as SymbolName,
                location: mock_location,
                kind: "const",
                initializer: '"hello"',
                scope_id: "scope_1" as ScopeId,
              },
              {
                name: "num" as SymbolName,
                location: { ...mock_location, line: 2, end_line: 2 },
                kind: "let",
                initializer: "42",
                scope_id: "scope_1" as ScopeId,
              },
              {
                name: "bool" as SymbolName,
                location: { ...mock_location, line: 3, end_line: 3 },
                kind: "const",
                initializer: "true",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const str_symbol = variable_symbol("str" as SymbolName, mock_location);
      const num_symbol = variable_symbol("num" as SymbolName, {
        ...mock_location,
        line: 2,
        end_line: 2,
      });
      const bool_symbol = variable_symbol("bool" as SymbolName, {
        ...mock_location,
        line: 3,
        end_line: 3,
      });

      expect(resolved.variable_types.get(str_symbol)).toBe("builtin:string");
      expect(resolved.variable_types.get(num_symbol)).toBe("builtin:number");
      expect(resolved.variable_types.get(bool_symbol)).toBe("builtin:boolean");
    });

    it("should infer types from constructor calls", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [],
            declarations: [
              {
                name: "instance" as SymbolName,
                location: mock_location,
                kind: "const",
                initializer: "new MyClass()",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const instance_symbol = variable_symbol(
        "instance" as SymbolName,
        mock_location
      );
      expect(resolved.variable_types.get(instance_symbol)).toBe(
        "class:MyClass:test.ts:1:0"
      );
    });

    it("should use type annotation over initializer when both exist", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [],
            declarations: [
              {
                name: "x" as SymbolName,
                location: mock_location,
                kind: "let",
                type_annotation: "MyClass",
                initializer: "null",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const x_symbol = variable_symbol("x" as SymbolName, mock_location);
      // Should use the explicit type annotation
      expect(resolved.variable_types.get(x_symbol)).toBe(
        "class:MyClass:test.ts:1:0"
      );
    });

    it("should infer null and undefined types", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [],
            declarations: [
              {
                name: "nullVar" as SymbolName,
                location: mock_location,
                kind: "let",
                initializer: "null",
                scope_id: "scope_1" as ScopeId,
              },
              {
                name: "undefVar" as SymbolName,
                location: { ...mock_location, line: 2, end_line: 2 },
                kind: "let",
                initializer: "undefined",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const null_symbol = variable_symbol(
        "nullVar" as SymbolName,
        mock_location
      );
      const undef_symbol = variable_symbol("undefVar" as SymbolName, {
        ...mock_location,
        line: 2,
        end_line: 2,
      });

      expect(resolved.variable_types.get(null_symbol)).toBe("builtin:null");
      expect(resolved.variable_types.get(undef_symbol)).toBe(
        "builtin:undefined"
      );
    });

    it("should infer array and object literal types", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [],
            declarations: [
              {
                name: "arr" as SymbolName,
                location: mock_location,
                kind: "const",
                initializer: "[1, 2, 3]",
                scope_id: "scope_1" as ScopeId,
              },
              {
                name: "obj" as SymbolName,
                location: { ...mock_location, line: 2, end_line: 2 },
                kind: "const",
                initializer: "{ foo: 'bar' }",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const arr_symbol = variable_symbol("arr" as SymbolName, mock_location);
      const obj_symbol = variable_symbol("obj" as SymbolName, {
        ...mock_location,
        line: 2,
        end_line: 2,
      });

      expect(resolved.variable_types.get(arr_symbol)).toBe("builtin:Array");
      expect(resolved.variable_types.get(obj_symbol)).toBe("builtin:object");
    });

    it("should not yet handle variable reference in initializer", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [],
            declarations: [
              {
                name: "x" as SymbolName,
                location: mock_location,
                kind: "const",
                initializer: '"hello"',
                scope_id: "scope_1" as ScopeId,
              },
              {
                name: "y" as SymbolName,
                location: { ...mock_location, line: 2, end_line: 2 },
                kind: "const",
                initializer: "x",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const x_symbol = variable_symbol("x" as SymbolName, mock_location);
      const y_symbol = variable_symbol("y" as SymbolName, {
        ...mock_location,
        line: 2,
        end_line: 2,
      });

      expect(resolved.variable_types.get(x_symbol)).toBe("builtin:string");
      // Variable reference resolution not yet implemented - would require scope-aware variable lookup
      expect(resolved.variable_types.get(y_symbol)).toBeUndefined();
    });
  });

  describe("Type flow through assignments", () => {
    it("should track type changes through assignments", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [],
            declarations: [
              {
                name: "x" as SymbolName,
                location: mock_location,
                kind: "let",
                initializer: '"initial"',
                scope_id: "scope_1" as ScopeId,
              },
            ],
            assignments: [
              {
                target: "x" as SymbolName,
                location: { ...mock_location, line: 2, end_line: 2 },
                source: "42",
                operator: "=",
                scope_id: "scope_1" as ScopeId,
              },
            ],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const x_symbol = variable_symbol("x" as SymbolName, mock_location);

      // Should have the latest type after assignment
      expect(resolved.variable_types.get(x_symbol)).toBe("builtin:number");

      // Should track flow history
      const flows = resolved.type_flows.flows.get(x_symbol);
      expect(flows).toBeDefined();
      expect(flows).toHaveLength(2); // Initial + assignment

      expect(flows![0].to_type).toBe("builtin:string");
      expect(flows![0].kind).toBe("initialization");

      expect(flows![1].from_type).toBe("builtin:string");
      expect(flows![1].to_type).toBe("builtin:number");
      expect(flows![1].kind).toBe("assignment");
    });

    it("should track multiple assignments", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [],
            declarations: [
              {
                name: "x" as SymbolName,
                location: mock_location,
                kind: "let",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            assignments: [
              {
                target: "x" as SymbolName,
                location: { ...mock_location, line: 2, end_line: 2 },
                source: '"string"',
                operator: "=",
                scope_id: "scope_1" as ScopeId,
              },
              {
                target: "x" as SymbolName,
                location: { ...mock_location, line: 3, end_line: 3 },
                source: "123",
                operator: "=",
                scope_id: "scope_1" as ScopeId,
              },
              {
                target: "x" as SymbolName,
                location: { ...mock_location, line: 4, end_line: 4 },
                source: "true",
                operator: "=",
                scope_id: "scope_1" as ScopeId,
              },
            ],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const x_symbol = variable_symbol("x" as SymbolName, mock_location);

      // Should have the final type
      expect(resolved.variable_types.get(x_symbol)).toBe("builtin:boolean");

      // Should track all flows
      const flows = resolved.type_flows.flows.get(x_symbol);
      expect(flows).toHaveLength(3);
      expect(flows![2].to_type).toBe("builtin:boolean");
    });

    it("should handle assignment to undeclared variable", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [],
            declarations: [],
            assignments: [
              {
                target: "undeclared" as SymbolName,
                location: mock_location,
                source: "42",
                operator: "=",
                scope_id: "scope_1" as ScopeId,
              },
            ],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      // Assignment to undeclared variable should be skipped
      expect(resolved.variable_types.size).toBe(0);
      expect(resolved.type_flows.flows.size).toBe(0);
    });

    it("should track narrowing and widening in type flow", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [],
            declarations: [
              {
                name: "x" as SymbolName,
                location: mock_location,
                kind: "let",
                type_annotation: "string | number",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            assignments: [
              {
                target: "x" as SymbolName,
                location: { ...mock_location, line: 2, end_line: 2 },
                source: '"specific"',
                operator: "=",
                scope_id: "scope_1" as ScopeId,
              },
            ],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const x_symbol = variable_symbol("x" as SymbolName, mock_location);

      // Type narrowed to string
      expect(resolved.variable_types.get(x_symbol)).toBe("builtin:string");

      const flows = resolved.type_flows.flows.get(x_symbol);
      expect(flows).toHaveLength(1);
      expect(flows![0].kind).toBe("assignment");
    });

    it("should handle compound assignment operators", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [],
            declarations: [
              {
                name: "count" as SymbolName,
                location: mock_location,
                kind: "let",
                initializer: "10",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            assignments: [
              {
                target: "count" as SymbolName,
                location: { ...mock_location, line: 2, end_line: 2 },
                source: "5",
                operator: "+=",
                scope_id: "scope_1" as ScopeId,
              },
            ],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const count_symbol = variable_symbol(
        "count" as SymbolName,
        mock_location
      );

      // Type should remain number after compound assignment
      expect(resolved.variable_types.get(count_symbol)).toBe("builtin:number");
    });
  });

  describe("Cross-file tracking", () => {
    it("should resolve types across multiple files", () => {
      const file2 = "other.ts" as FilePath;

      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [
              {
                name: "x" as SymbolName,
                location: mock_location,
                annotation_text: "UserInfo",
                kind: "variable",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            declarations: [],
            assignments: [],
          },
        ],
        [
          file2,
          {
            annotations: [
              {
                name: "y" as SymbolName,
                location: { ...mock_location, file_path: file2 },
                annotation_text: "MyClass",
                kind: "variable",
                scope_id: "scope_2" as ScopeId,
              },
            ],
            declarations: [],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const x_symbol = variable_symbol("x" as SymbolName, mock_location);
      const y_symbol = variable_symbol("y" as SymbolName, {
        ...mock_location,
        file_path: file2,
      });

      expect(resolved.variable_types.get(x_symbol)).toBe(
        "interface:UserInfo:test.ts:5:0"
      );
      expect(resolved.variable_types.get(y_symbol)).toBe(
        "class:MyClass:test.ts:1:0"
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle empty tracking", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [],
            declarations: [],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      expect(resolved.variable_types.size).toBe(0);
      expect(resolved.expression_types.size).toBe(0);
      expect(resolved.type_flows.flows.size).toBe(0);
    });

    it("should skip unresolvable types", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [
              {
                name: "x" as SymbolName,
                location: mock_location,
                annotation_text: "UnknownType",
                kind: "variable",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            declarations: [],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const x_symbol = variable_symbol("x" as SymbolName, mock_location);
      expect(resolved.variable_types.get(x_symbol)).toBeUndefined();
    });

    it("should handle complex initializers that cannot be inferred", () => {
      const localTracking = new Map<FilePath, LocalTypeTracking>([
        [
          mock_file_path,
          {
            annotations: [],
            declarations: [
              {
                name: "x" as SymbolName,
                location: mock_location,
                kind: "const",
                initializer: "someFunction()",
                scope_id: "scope_1" as ScopeId,
              },
            ],
            assignments: [],
          },
        ],
      ]);

      const resolved = resolve_type_tracking(localTracking, mock_type_registry);

      const x_symbol = variable_symbol("x" as SymbolName, mock_location);
      expect(resolved.variable_types.get(x_symbol)).toBeUndefined();
    });
  });
});

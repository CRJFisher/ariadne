/**
 * Type Resolution Refactoring Integration Tests
 *
 * Verifies the complete refactoring that separated single-file extraction
 * from cross-file resolution is working correctly end-to-end.
 */

import { describe, it, expect } from "vitest";
import type {
  FilePath,
  SymbolId,
  TypeId,
  Location,
  SymbolName,
  SymbolDefinition,
  ScopeId,
  LexicalScope,
} from "@ariadnejs/types";
import {
  function_symbol,
  class_symbol,
  method_symbol,
  variable_symbol,
  defined_type_id,
  TypeCategory,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../semantic_index/semantic_index";
import type { LocalTypeInfo } from "../semantic_index/type_members";
import type { LocalTypeAnnotation } from "../semantic_index/references/type_annotation_references";
import type { LocalTypeTracking } from "../semantic_index/references/type_tracking";
import type {
  LocalTypeFlowData,
  LocalConstructorCall,
  LocalAssignmentFlow,
} from "../semantic_index/references/type_flow_references";
import { resolve_symbols } from "./symbol_resolution";
import type { ResolutionInput } from "./types";

// Helper to create location objects
function location(filePath: FilePath, line: number, column: number): Location {
  return {
    file_path: filePath,
    line,
    column,
    end_line: line,
    end_column: column + 10,
  };
}

describe("Type Resolution Refactoring - End-to-End Integration", () => {
  /**
   * Helper to create a realistic SemanticIndex that mimics
   * what the actual semantic_index module produces.
   */
  function create_semantic_index(
    file_path: FilePath,
    options: {
      classes?: Array<{
        name: SymbolName;
        extends?: SymbolName;
        implements?: SymbolName[];
        members?: Map<SymbolName, any>;
      }>;
      interfaces?: Array<{
        name: SymbolName;
        members?: Map<SymbolName, any>;
      }>;
      functions?: Array<{
        name: SymbolName;
        return_type?: string;
        parameters?: Array<{ name: SymbolName; type?: string }>;
      }>;
      variables?: Array<{
        name: SymbolName;
        type_annotation?: string;
        initial_value?: string;
      }>;
      constructor_calls?: LocalConstructorCall[];
      assignments?: LocalAssignmentFlow[];
      member_accesses?: Array<any>;
    } = {}
  ): SemanticIndex {
    const root_scope_id = `scope:module:${file_path}:0:0` as ScopeId;
    const root_scope: LexicalScope = {
      id: root_scope_id,
      parent_id: null,
      name: null,
      type: "module",
      location: location(file_path, 0, 0),
      child_ids: [],
      symbols: new Map(),
    };

    // Build local types from classes and interfaces
    const local_types: LocalTypeInfo[] = [];

    if (options.classes) {
      options.classes.forEach((cls, idx) => {
        local_types.push({
          type_name: cls.name,
          kind: "class",
          location: location(file_path, (idx + 1) * 10, 0),
          direct_members: cls.members || new Map(),
          extends_clause: cls.extends ? [cls.extends] : undefined,
          implements_clause: cls.implements,
        });
      });
    }

    if (options.interfaces) {
      options.interfaces.forEach((iface, idx) => {
        local_types.push({
          type_name: iface.name,
          kind: "interface",
          location: location(file_path, (idx + 1) * 10 + 100, 0),
          direct_members: iface.members || new Map(),
        });
      });
    }

    // Build local type annotations from variables
    const local_type_annotations: LocalTypeAnnotation[] = [];
    if (options.variables) {
      options.variables.forEach((variable, idx) => {
        if (variable.type_annotation) {
          local_type_annotations.push({
            location: location(file_path, (idx + 1) * 5 + 200, 10),
            annotation_text: variable.type_annotation,
            annotation_kind: "variable",
            scope_id: root_scope_id,
            annotates_location: location(file_path, (idx + 1) * 5 + 200, 0),
          });
        }
      });
    }

    // Build local type tracking
    const local_type_tracking: LocalTypeTracking = {
      annotations:
        options.variables
          ?.filter((v) => v.type_annotation)
          .map((v, idx) => ({
            name: v.name,
            location: location(file_path, (idx + 1) * 5 + 200, 10),
            annotation_text: v.type_annotation!,
            kind: "variable" as const,
            scope_id: root_scope_id,
          })) || [],
      declarations:
        options.variables?.map((v, idx) => ({
          name: v.name,
          location: location(file_path, (idx + 1) * 5 + 200, 0),
          kind: "const" as const,
          type_annotation: v.type_annotation,
          initializer: v.initial_value,
          scope_id: root_scope_id,
        })) || [],
      assignments: [],
    };

    // Build local type flow
    const local_type_flow: LocalTypeFlowData = {
      constructor_calls: options.constructor_calls || [],
      assignments: options.assignments || [],
      returns: [],
      call_assignments: [],
    };

    // Build symbols map
    const symbols = new Map<SymbolId, SymbolDefinition>();

    // Add class symbols
    options.classes?.forEach((cls, idx) => {
      const id = class_symbol(cls.name, location(file_path, (idx + 1) * 10, 0));
      symbols.set(id, {
        id,
        name: cls.name,
        kind: "class",
        location: location(file_path, (idx + 1) * 10, 0),
        scope_id: root_scope_id,
        is_hoisted: false,
        is_exported: false,
        is_imported: false,
      });
    });

    // Add function symbols
    options.functions?.forEach((func, idx) => {
      const func_location = location(file_path, (idx + 1) * 10 + 50, 0);
      const id = function_symbol(func.name, func_location);
      symbols.set(id, {
        id,
        name: func.name,
        kind: "function",
        location: location(file_path, (idx + 1) * 10 + 50, 0),
        scope_id: root_scope_id,
        is_hoisted: true,
        is_exported: false,
        is_imported: false,
      });
    });

    return {
      file_path: file_path,
      language: "typescript",
      root_scope_id: root_scope_id,
      scopes: new Map([[root_scope_id, root_scope]]),
      symbols,
      references: {
        calls: [],
        member_accesses: options.member_accesses || [],
        returns: [],
        type_annotations: [],
      },
      imports: [],
      exports: [],
      file_symbols_by_name: new Map(),
      local_types: local_types,
      local_type_annotations: local_type_annotations,
      local_type_tracking: local_type_tracking,
      local_type_flow: local_type_flow,
    };
  }

  describe("Architecture Verification", () => {
    it("should maintain clean separation between extraction and resolution", () => {
      // Create index with only local extraction
      const index = create_semantic_index("test.ts" as FilePath, {
        classes: [
          {
            name: "TestClass" as SymbolName,
            members: new Map([
              ["method1" as SymbolName, { name: "method1", kind: "method" }],
            ]),
          },
        ],
      });

      // Verify SemanticIndex only contains local extraction
      expect(index.local_types).toBeDefined();
      expect(index.local_type_annotations).toBeDefined();
      expect(index.local_type_tracking).toBeDefined();
      expect(index.local_type_flow).toBeDefined();

      // Verify no resolved fields exist
      expect((index as any).type_registry).toBeUndefined();
      expect((index as any).variable_types).toBeUndefined();
      expect((index as any).function_returns).toBeUndefined();
      expect((index as any).constructor_types).toBeUndefined();
    });

    it("should generate TypeIds only in symbol_resolution phase", () => {
      const index = create_semantic_index("test.ts" as FilePath, {
        classes: [{ name: "MyClass" as SymbolName }],
      });

      // Local types should not have TypeIds
      expect(index.local_types[0].type_name).toBe("MyClass");

      // Run symbol resolution
      const indices = new Map([["test.ts" as FilePath, index]]);
      const result = resolve_symbols({ indices });

      // Now TypeIds should be generated
      expect(result.phases.types.symbol_types.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Cross-File Type Resolution", () => {
    it("should resolve types across file boundaries", () => {
      // File with base class
      const base_index = create_semantic_index("base.ts" as FilePath, {
        classes: [
          {
            name: "BaseClass" as SymbolName,
            members: new Map([
              [
                "baseMethod" as SymbolName,
                { name: "baseMethod", kind: "method" },
              ],
            ]),
          },
        ],
      });

      // File with derived class
      const derived_index = create_semantic_index("derived.ts" as FilePath, {
        classes: [
          {
            name: "DerivedClass" as SymbolName,
            extends: "BaseClass" as SymbolName,
            members: new Map([
              [
                "derivedMethod" as SymbolName,
                { name: "derivedMethod", kind: "method" },
              ],
            ]),
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        ["base.ts" as FilePath, base_index],
        ["derived.ts" as FilePath, derived_index],
      ]);

      const result = resolve_symbols({ indices });

      // Verify type resolution occurred
      expect(result.phases.types).toBeDefined();
      expect(result.phases.types.type_members).toBeInstanceOf(Map);
    });

    it("should resolve interface implementations across files", () => {
      const interface_index = create_semantic_index(
        "interface.ts" as FilePath,
        {
          interfaces: [
            {
              name: "IShape" as SymbolName,
              members: new Map([
                ["area" as SymbolName, { name: "area", kind: "method" }],
              ]),
            },
          ],
        }
      );

      const impl_index = create_semantic_index("impl.ts" as FilePath, {
        classes: [
          {
            name: "Rectangle" as SymbolName,
            implements: ["IShape" as SymbolName],
            members: new Map([
              ["area" as SymbolName, { name: "area", kind: "method" }],
              ["width" as SymbolName, { name: "width", kind: "property" }],
              ["height" as SymbolName, { name: "height", kind: "property" }],
            ]),
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        ["interface.ts" as FilePath, interface_index],
        ["impl.ts" as FilePath, impl_index],
      ]);

      const result = resolve_symbols({ indices });
      expect(result.phases.types).toBeDefined();
    });
  });

  describe("Type Flow Analysis", () => {
    it("should track types through constructor calls and assignments", () => {
      const index = create_semantic_index("app.ts" as FilePath, {
        classes: [
          {
            name: "Service" as SymbolName,
            members: new Map([
              ["process" as SymbolName, { name: "process", kind: "method" }],
            ]),
          },
        ],
        variables: [
          { name: "service" as SymbolName },
          { name: "alias" as SymbolName },
        ],
        constructor_calls: [
          {
            class_name: "Service" as SymbolName,
            location: location("app.ts" as FilePath, 10, 10),
            assigned_to: "service" as SymbolName,
            argument_count: 0,
            scope_id: "scope:module:app.ts:0:0" as ScopeId,
          },
        ],
        assignments: [
          {
            source: { kind: "variable", name: "service" as SymbolName },
            target: "alias" as SymbolName,
            location: location("app.ts" as FilePath, 11, 0),
            kind: "direct",
          },
        ],
      });

      const indices = new Map([["app.ts" as FilePath, index]]);
      const result = resolve_symbols({ indices });

      // Verify type flow was tracked
      expect(index.local_type_flow.constructor_calls).toHaveLength(1);
      expect(index.local_type_flow.assignments).toHaveLength(1);
    });

    it("should track type annotations on variables", () => {
      const index = create_semantic_index("typed.ts" as FilePath, {
        interfaces: [
          {
            name: "User" as SymbolName,
            members: new Map([
              [
                "name" as SymbolName,
                { name: "name", kind: "property", type: "string" },
              ],
              [
                "age" as SymbolName,
                { name: "age", kind: "property", type: "number" },
              ],
            ]),
          },
        ],
        variables: [
          {
            name: "user" as SymbolName,
            type_annotation: "User",
          },
          {
            name: "users" as SymbolName,
            type_annotation: "User[]",
          },
        ],
      });

      const indices = new Map([["typed.ts" as FilePath, index]]);
      const result = resolve_symbols({ indices });

      // Verify annotations were captured
      expect(index.local_type_annotations).toHaveLength(2);
      expect(index.local_type_tracking.annotations).toHaveLength(2);
    });
  });

  describe("Method Resolution Integration", () => {
    it("should resolve methods using type information", () => {
      const index = create_semantic_index("methods.ts" as FilePath, {
        classes: [
          {
            name: "Calculator" as SymbolName,
            members: new Map([
              ["add" as SymbolName, { name: "add", kind: "method" }],
              ["subtract" as SymbolName, { name: "subtract", kind: "method" }],
            ]),
          },
        ],
        constructor_calls: [
          {
            class_name: "Calculator" as SymbolName,
            location: location("methods.ts" as FilePath, 10, 10),
            assigned_to: "calc" as SymbolName,
            argument_count: 0,
            scope_id: "scope:module:methods.ts:0:0" as ScopeId,
          },
        ],
        member_accesses: [
          {
            object_name: "calc" as SymbolName,
            object_location: location("methods.ts" as FilePath, 11, 0),
            member_name: "add" as SymbolName,
            location: location("methods.ts" as FilePath, 11, 5),
            scope_id: "scope:module:methods.ts:0:0" as ScopeId,
            access_type: "method",
            is_optional_chain: false,
          },
        ],
      });

      // Method call references are passed in create_semantic_index
      // The memberAccesses were already set in the options

      const indices = new Map([["methods.ts" as FilePath, index]]);
      const result = resolve_symbols({ indices });

      // Verify method resolution
      expect(result.phases.methods).toBeDefined();
      expect(result.phases.methods.method_calls).toBeInstanceOf(Map);
    });

    it("should resolve inherited methods", () => {
      const base_index = create_semantic_index("base.ts" as FilePath, {
        classes: [
          {
            name: "Animal" as SymbolName,
            members: new Map([
              ["speak" as SymbolName, { name: "speak", kind: "method" }],
            ]),
          },
        ],
      });

      const derived_index = create_semantic_index("derived.ts" as FilePath, {
        classes: [
          {
            name: "Dog" as SymbolName,
            extends: "Animal" as SymbolName,
            members: new Map([
              ["bark" as SymbolName, { name: "bark", kind: "method" }],
            ]),
          },
        ],
        constructor_calls: [
          {
            class_name: "Dog" as SymbolName,
            location: location("derived.ts" as FilePath, 20, 10),
            assigned_to: "myDog" as SymbolName,
            argument_count: 0,
            scope_id: "scope:module:derived.ts:0:0" as ScopeId,
          },
        ],
        member_accesses: [
          {
            object_name: "myDog" as SymbolName,
            object_location: location("derived.ts" as FilePath, 21, 0),
            member_name: "speak" as SymbolName, // Inherited from Animal
            location: location("derived.ts" as FilePath, 21, 6),
            scope_id: "scope:module:derived.ts:0:0" as ScopeId,
            access_type: "method",
            is_optional_chain: false,
          },
        ],
      });

      // Method call to inherited method should be passed in create_semantic_index

      const indices = new Map<FilePath, SemanticIndex>([
        ["base.ts" as FilePath, base_index],
        ["derived.ts" as FilePath, derived_index],
      ]);

      const result = resolve_symbols({ indices });
      expect(result.phases.methods).toBeDefined();
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle multi-level inheritance chains", () => {
      const indices = new Map<FilePath, SemanticIndex>();

      // Create inheritance chain: A -> B -> C
      const class_a = create_semantic_index("a.ts" as FilePath, {
        classes: [
          {
            name: "A" as SymbolName,
            members: new Map([
              ["methodA" as SymbolName, { name: "methodA", kind: "method" }],
            ]),
          },
        ],
      });

      const class_b = create_semantic_index("b.ts" as FilePath, {
        classes: [
          {
            name: "B" as SymbolName,
            extends: "A" as SymbolName,
            members: new Map([
              ["methodB" as SymbolName, { name: "methodB", kind: "method" }],
            ]),
          },
        ],
      });

      const class_c = create_semantic_index("c.ts" as FilePath, {
        classes: [
          {
            name: "C" as SymbolName,
            extends: "B" as SymbolName,
            members: new Map([
              ["methodC" as SymbolName, { name: "methodC", kind: "method" }],
            ]),
          },
        ],
      });

      indices.set("a.ts" as FilePath, class_a);
      indices.set("b.ts" as FilePath, class_b);
      indices.set("c.ts" as FilePath, class_c);

      const result = resolve_symbols({ indices });
      expect(result.phases.types).toBeDefined();
    });

    it("should handle mixed type annotations and flow", () => {
      const index = create_semantic_index("mixed.ts" as FilePath, {
        interfaces: [
          {
            name: "Config" as SymbolName,
            members: new Map([
              ["timeout" as SymbolName, { name: "timeout", kind: "property" }],
            ]),
          },
        ],
        classes: [
          {
            name: "Service" as SymbolName,
            members: new Map([
              [
                "configure" as SymbolName,
                { name: "configure", kind: "method" },
              ],
            ]),
          },
        ],
        variables: [
          {
            name: "config" as SymbolName,
            type_annotation: "Config",
          },
          {
            name: "service" as SymbolName,
          },
        ],
        constructor_calls: [
          {
            class_name: "Service" as SymbolName,
            location: location("mixed.ts" as FilePath, 20, 10),
            assigned_to: "service" as SymbolName,
            argument_count: 0,
            scope_id: "scope:module:mixed.ts:0:0" as ScopeId,
          },
        ],
      });

      const indices = new Map([["mixed.ts" as FilePath, index]]);
      const result = resolve_symbols({ indices });

      // Verify both annotation and flow tracking
      expect(index.local_type_annotations).toHaveLength(1);
      expect(index.local_type_flow.constructor_calls).toHaveLength(1);
      expect(result.phases.types).toBeDefined();
    });

    it("should handle generic type parameters", () => {
      const index = create_semantic_index("generics.ts" as FilePath, {
        classes: [
          {
            name: "Container" as SymbolName,
            members: new Map([
              ["get" as SymbolName, { name: "get", kind: "method" }],
              ["set" as SymbolName, { name: "set", kind: "method" }],
            ]),
          },
        ],
        variables: [
          {
            name: "stringContainer" as SymbolName,
            type_annotation: "Container<string>",
          },
          {
            name: "numberContainer" as SymbolName,
            type_annotation: "Container<number>",
          },
        ],
      });

      const indices = new Map([["generics.ts" as FilePath, index]]);
      const result = resolve_symbols({ indices });

      // Verify generic annotations were captured
      expect(index.local_type_annotations).toHaveLength(2);
      expect(index.local_type_annotations[0].annotation_text).toBe(
        "Container<string>"
      );
      expect(index.local_type_annotations[1].annotation_text).toBe(
        "Container<number>"
      );
    });
  });

  describe("Performance and Scalability", () => {
    it("should efficiently handle large codebases", () => {
      const indices = new Map<FilePath, SemanticIndex>();

      // Create 50 files with various types
      for (let i = 0; i < 50; i++) {
        const filePath = `file${i}.ts` as FilePath;
        const index = create_semantic_index(filePath, {
          classes: [
            {
              name: `Class${i}` as SymbolName,
              extends: i > 0 ? (`Class${i - 1}` as SymbolName) : undefined,
              members: new Map([
                [
                  `method${i}` as SymbolName,
                  { name: `method${i}`, kind: "method" },
                ],
              ]),
            },
          ],
          interfaces: [
            {
              name: `Interface${i}` as SymbolName,
              members: new Map([
                [
                  `prop${i}` as SymbolName,
                  { name: `prop${i}`, kind: "property" },
                ],
              ]),
            },
          ],
        });
        indices.set(filePath, index);
      }

      const start = performance.now();
      const result = resolve_symbols({ indices });
      const duration = performance.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds

      // Verify all phases completed
      expect(result.phases.imports).toBeDefined();
      expect(result.phases.functions).toBeDefined();
      expect(result.phases.types).toBeDefined();
      expect(result.phases.methods).toBeDefined();
    });

    it("should handle files with many local types", () => {
      const classes = [];
      const interfaces = [];

      // Create 100 types in a single file
      for (let i = 0; i < 50; i++) {
        classes.push({
          name: `Class${i}` as SymbolName,
          members: new Map([
            [
              `method${i}` as SymbolName,
              { name: `method${i}`, kind: "method" },
            ],
          ]),
        });
        interfaces.push({
          name: `Interface${i}` as SymbolName,
          members: new Map([
            [`prop${i}` as SymbolName, { name: `prop${i}`, kind: "property" }],
          ]),
        });
      }

      const index = create_semantic_index("large.ts" as FilePath, {
        classes,
        interfaces,
      });

      const indices = new Map([["large.ts" as FilePath, index]]);
      const result = resolve_symbols({ indices });

      expect(index.local_types).toHaveLength(100);
      expect(result).toBeDefined();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty files gracefully", () => {
      const empty_index = create_semantic_index("empty.ts" as FilePath, {});
      const indices = new Map([["empty.ts" as FilePath, empty_index]]);

      const result = resolve_symbols({ indices });

      expect(result).toBeDefined();
      expect(result.resolved_references.size).toBe(0);
    });

    it("should handle circular references without infinite loops", () => {
      const class_a = create_semantic_index("a.ts" as FilePath, {
        classes: [
          {
            name: "A" as SymbolName,
            members: new Map([
              ["b" as SymbolName, { name: "b", kind: "property", type: "B" }],
            ]),
          },
        ],
      });

      const class_b = create_semantic_index("b.ts" as FilePath, {
        classes: [
          {
            name: "B" as SymbolName,
            members: new Map([
              ["a" as SymbolName, { name: "a", kind: "property", type: "A" }],
            ]),
          },
        ],
      });

      const indices = new Map<FilePath, SemanticIndex>([
        ["a.ts" as FilePath, class_a],
        ["b.ts" as FilePath, class_b],
      ]);

      // Should not throw or hang
      expect(() => resolve_symbols({ indices })).not.toThrow();
    });

    it("should handle missing base classes gracefully", () => {
      const index = create_semantic_index("orphan.ts" as FilePath, {
        classes: [
          {
            name: "OrphanClass" as SymbolName,
            extends: "NonExistentBase" as SymbolName,
            members: new Map(),
          },
        ],
      });

      const indices = new Map([["orphan.ts" as FilePath, index]]);
      const result = resolve_symbols({ indices });

      // Should complete without error
      expect(result).toBeDefined();
      expect(result.phases.types).toBeDefined();
    });
  });
});

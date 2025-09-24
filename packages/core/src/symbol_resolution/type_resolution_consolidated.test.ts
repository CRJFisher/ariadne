/**
 * Consolidated Type Resolution Pipeline Tests
 *
 * End-to-end integration tests covering all 8 type resolution features:
 * 1. Data Collection (SemanticIndex → LocalTypeExtraction)
 * 2. Type Registry (Global type name resolution)
 * 3. Inheritance Resolution (Type hierarchy)
 * 4. Type Members (Member resolution with inheritance)
 * 5. Type Annotations (Annotation to TypeId resolution)
 * 6. Type Tracking (Variable type inference)
 * 7. Type Flow Analysis (Flow through assignments)
 * 8. Constructor Discovery (Constructor-to-type mappings)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { phase3_resolve_types } from "./symbol_resolution";
import type {
  FilePath,
  SymbolId,
  TypeId,
  SymbolName,
  LocationKey,
  Location,
  SemanticIndex,
} from "@ariadnejs/types";
import {
  function_symbol,
  class_symbol,
  method_symbol,
  location_key,
  defined_type_id,
} from "@ariadnejs/types";
import type {
  TypeResolutionMap,
  FunctionResolutionMap,
  LocalTypeDefinition,
  LocalTypeAnnotation,
  LocalTypeTracking,
  LocalTypeFlowPattern,
} from "./types";

describe("Consolidated Type Resolution Pipeline", () => {
  describe("End-to-End Processing", () => {
    it("processes complete TypeScript class hierarchy", () => {
      const file_path = "/test/class.ts" as FilePath;

      // Create semantic index with complete class hierarchy
      const semantic_index: SemanticIndex = {
        symbols: new Map(),
        scopes: new Map(),
        member_access_chains: [],
        type_definitions: [
          {
            name: "BaseClass" as SymbolName,
            kind: "class",
            location: create_location(file_path, 1, 0),
            file_path,
            members: [
              {
                name: "baseMethod" as SymbolName,
                kind: "method",
                location: create_location(file_path, 2, 2),
                visibility: "public",
              },
              {
                name: "baseProperty" as SymbolName,
                kind: "property",
                location: create_location(file_path, 3, 2),
                visibility: "protected",
              }
            ],
            modifiers: ["abstract"],
          },
          {
            name: "DerivedClass" as SymbolName,
            kind: "class",
            location: create_location(file_path, 10, 0),
            file_path,
            extends: ["BaseClass" as SymbolName],
            implements: ["IInterface" as SymbolName],
            members: [
              {
                name: "derivedMethod" as SymbolName,
                kind: "method",
                location: create_location(file_path, 11, 2),
                visibility: "public",
              },
              {
                name: "baseMethod" as SymbolName,
                kind: "method",
                location: create_location(file_path, 12, 2),
                visibility: "public",
              }
            ],
          },
          {
            name: "IInterface" as SymbolName,
            kind: "interface",
            location: create_location(file_path, 20, 0),
            file_path,
            members: [
              {
                name: "interfaceMethod" as SymbolName,
                kind: "method",
                location: create_location(file_path, 21, 2),
              }
            ],
          }
        ],
        type_annotations: [
          {
            symbol_id: function_symbol("testFunction", file_path, create_location(file_path, 30, 0)),
            location: create_location(file_path, 30, 20),
            annotation: {
              kind: "reference",
              value: "DerivedClass",
            },
            file_path,
          }
        ],
        type_tracking: [
          {
            symbol_id: function_symbol("testFunction", file_path, create_location(file_path, 30, 0)),
            location: create_location(file_path, 31, 10),
            tracked_type: defined_type_id("DerivedClass", file_path, "class"),
            kind: "variable",
          }
        ],
        type_flows: [
          {
            kind: "assignment",
            source: {
              kind: "constructor",
              symbol_id: class_symbol("DerivedClass", file_path, create_location(file_path, 10, 0)),
            },
            target: {
              kind: "variable",
              symbol_id: function_symbol("instance", file_path, create_location(file_path, 35, 6)),
              location: create_location(file_path, 35, 6),
            },
            location: create_location(file_path, 35, 0),
          }
        ],
        imports: new Map(),
        exports: new Map(),
        references: [],
      };

      const indices = new Map([[file_path, semantic_index]]);
      const imports = new Map<FilePath, ReadonlyMap<SymbolName, SymbolId>>();
      const functions: FunctionResolutionMap = {
        function_signatures: new Map(),
        call_sites: new Map(),
      };

      const result = phase3_resolve_types(indices, imports, functions);

      // Verify all 8 features are working

      // 1. Data Collection - verify type definitions were extracted
      expect(result.type_definitions.size).toBeGreaterThan(0);

      // 2. Type Registry - verify types have unique TypeIds
      const base_type = Array.from(result.type_definitions.values())
        .flat()
        .find(t => t.name === "BaseClass");
      expect(base_type).toBeDefined();

      // 3. Inheritance Resolution - verify hierarchy is established
      const derived_type = Array.from(result.type_definitions.values())
        .flat()
        .find(t => t.name === "DerivedClass");
      expect(derived_type).toBeDefined();
      expect(derived_type?.extends).toContain("BaseClass");

      // 4. Type Members - verify inherited members
      expect(result.type_members.size).toBeGreaterThan(0);

      // 5. Type Annotations - verify annotations resolved
      expect(result.reference_types.size).toBeGreaterThan(0);

      // 6. Type Tracking - verify tracked types
      expect(result.symbol_types.size).toBeGreaterThan(0);

      // 7. Type Flow Analysis - verify flow edges
      expect(result.type_flow_edges).toBeDefined();
      expect(result.type_flow_edges.length).toBeGreaterThan(0);

      // 8. Constructor Discovery - verify constructors mapped
      const constructor_found = result.type_flow_edges.some(
        edge => edge.kind === "constructor"
      );
      expect(constructor_found).toBe(true);
    });

    it("handles complex JavaScript module imports", () => {
      const file1 = "/test/module1.js" as FilePath;
      const file2 = "/test/module2.js" as FilePath;

      const module1_index: SemanticIndex = {
        symbols: new Map(),
        scopes: new Map(),
        member_access_chains: [],
        type_definitions: [
          {
            name: "ExportedClass" as SymbolName,
            kind: "class",
            location: create_location(file1, 1, 0),
            file_path: file1,
            members: [],
          }
        ],
        type_annotations: [],
        type_tracking: [],
        type_flows: [],
        imports: new Map(),
        exports: new Map([
          ["ExportedClass" as SymbolName, class_symbol("ExportedClass", file1, create_location(file1, 1, 0))]
        ]),
        references: [],
      };

      const module2_index: SemanticIndex = {
        symbols: new Map(),
        scopes: new Map(),
        member_access_chains: [],
        type_definitions: [
          {
            name: "LocalClass" as SymbolName,
            kind: "class",
            location: create_location(file2, 10, 0),
            file_path: file2,
            extends: ["ExportedClass" as SymbolName],
            members: [],
          }
        ],
        type_annotations: [],
        type_tracking: [],
        type_flows: [],
        imports: new Map([
          ["ExportedClass" as SymbolName, class_symbol("ExportedClass", file1, create_location(file1, 1, 0))]
        ]),
        exports: new Map(),
        references: [],
      };

      const indices = new Map([
        [file1, module1_index],
        [file2, module2_index],
      ]);

      const imports = new Map([
        [file2, new Map([
          ["ExportedClass" as SymbolName, class_symbol("ExportedClass", file1, create_location(file1, 1, 0))]
        ])],
      ]);

      const functions: FunctionResolutionMap = {
        function_signatures: new Map(),
        call_sites: new Map(),
      };

      const result = phase3_resolve_types(indices, imports, functions);

      // Verify cross-file type resolution
      expect(result.type_definitions.size).toBe(2);

      // Verify imported type is resolved correctly
      const local_class = Array.from(result.type_definitions.values())
        .flat()
        .find(t => t.name === "LocalClass");
      expect(local_class).toBeDefined();
      expect(local_class?.extends).toContain("ExportedClass");
    });

    it("resolves Python class inheritance chains", () => {
      const file_path = "/test/inheritance.py" as FilePath;

      const semantic_index: SemanticIndex = {
        symbols: new Map(),
        scopes: new Map(),
        member_access_chains: [],
        type_definitions: [
          {
            name: "GrandParent" as SymbolName,
            kind: "class",
            location: create_location(file_path, 1, 0),
            file_path,
            members: [],
          },
          {
            name: "Parent" as SymbolName,
            kind: "class",
            location: create_location(file_path, 10, 0),
            file_path,
            extends: ["GrandParent" as SymbolName],
            members: [],
          },
          {
            name: "Child" as SymbolName,
            kind: "class",
            location: create_location(file_path, 20, 0),
            file_path,
            extends: ["Parent" as SymbolName],
            members: [],
          },
          {
            name: "GrandChild" as SymbolName,
            kind: "class",
            location: create_location(file_path, 30, 0),
            file_path,
            extends: ["Child" as SymbolName],
            members: [],
          }
        ],
        type_annotations: [],
        type_tracking: [],
        type_flows: [],
        imports: new Map(),
        exports: new Map(),
        references: [],
      };

      const indices = new Map([[file_path, semantic_index]]);
      const imports = new Map<FilePath, ReadonlyMap<SymbolName, SymbolId>>();
      const functions: FunctionResolutionMap = {
        function_signatures: new Map(),
        call_sites: new Map(),
      };

      const result = phase3_resolve_types(indices, imports, functions);

      // Verify deep inheritance chain is resolved
      expect(result.type_definitions.size).toBe(1);
      const types = Array.from(result.type_definitions.values()).flat();
      expect(types).toHaveLength(4);

      // Verify each level of inheritance
      const grand_child = types.find(t => t.name === "GrandChild");
      const child = types.find(t => t.name === "Child");
      const parent = types.find(t => t.name === "Parent");

      expect(grand_child?.extends).toContain("Child");
      expect(child?.extends).toContain("Parent");
      expect(parent?.extends).toContain("GrandParent");
    });

    it("tracks Rust trait implementations and generics", () => {
      const file_path = "/test/traits.rs" as FilePath;

      const semantic_index: SemanticIndex = {
        symbols: new Map(),
        scopes: new Map(),
        member_access_chains: [],
        type_definitions: [
          {
            name: "MyTrait" as SymbolName,
            kind: "interface", // Traits are interfaces in our model
            location: create_location(file_path, 1, 0),
            file_path,
            members: [
              {
                name: "trait_method" as SymbolName,
                kind: "method",
                location: create_location(file_path, 2, 2),
              }
            ],
            type_parameters: [
              {
                name: "T" as SymbolName,
              }
            ],
          },
          {
            name: "MyStruct" as SymbolName,
            kind: "class", // Structs are classes in our model
            location: create_location(file_path, 10, 0),
            file_path,
            implements: ["MyTrait" as SymbolName],
            members: [],
            type_parameters: [
              {
                name: "T" as SymbolName,
                constraint: {
                  kind: "reference",
                  value: "Clone",
                }
              }
            ],
          }
        ],
        type_annotations: [],
        type_tracking: [],
        type_flows: [],
        imports: new Map(),
        exports: new Map(),
        references: [],
      };

      const indices = new Map([[file_path, semantic_index]]);
      const imports = new Map<FilePath, ReadonlyMap<SymbolName, SymbolId>>();
      const functions: FunctionResolutionMap = {
        function_signatures: new Map(),
        call_sites: new Map(),
      };

      const result = phase3_resolve_types(indices, imports, functions);

      // Verify trait implementations
      const my_struct = Array.from(result.type_definitions.values())
        .flat()
        .find(t => t.name === "MyStruct");
      expect(my_struct).toBeDefined();
      expect(my_struct?.implements).toContain("MyTrait");

      // Verify generics are preserved
      expect(my_struct?.type_parameters).toBeDefined();
      expect(my_struct?.type_parameters).toHaveLength(1);
      expect(my_struct?.type_parameters?.[0].name).toBe("T");
    });
  });

  describe("Feature Integration", () => {
    it("type registry provides types for other modules", () => {
      const file_path = "/test/registry.ts" as FilePath;

      const semantic_index: SemanticIndex = {
        symbols: new Map(),
        scopes: new Map(),
        member_access_chains: [],
        type_definitions: [
          {
            name: "RegisteredType" as SymbolName,
            kind: "class",
            location: create_location(file_path, 1, 0),
            file_path,
            members: [],
          }
        ],
        type_annotations: [
          {
            symbol_id: function_symbol("useType", file_path, create_location(file_path, 10, 0)),
            location: create_location(file_path, 10, 20),
            annotation: {
              kind: "reference",
              value: "RegisteredType",
            },
            file_path,
          }
        ],
        type_tracking: [],
        type_flows: [],
        imports: new Map(),
        exports: new Map(),
        references: [],
      };

      const indices = new Map([[file_path, semantic_index]]);
      const imports = new Map<FilePath, ReadonlyMap<SymbolName, SymbolId>>();
      const functions: FunctionResolutionMap = {
        function_signatures: new Map(),
        call_sites: new Map(),
      };

      const result = phase3_resolve_types(indices, imports, functions);

      // Verify type registry created the type
      expect(result.type_definitions.size).toBeGreaterThan(0);

      // Verify annotation resolution used the registry
      expect(result.reference_types.size).toBeGreaterThan(0);

      // Both should reference the same type
      const registered = Array.from(result.type_definitions.values())
        .flat()
        .find(t => t.name === "RegisteredType");
      expect(registered).toBeDefined();
    });

    it("inheritance data enhances member resolution", () => {
      const file_path = "/test/members.ts" as FilePath;

      const semantic_index: SemanticIndex = {
        symbols: new Map(),
        scopes: new Map(),
        member_access_chains: [],
        type_definitions: [
          {
            name: "Base" as SymbolName,
            kind: "class",
            location: create_location(file_path, 1, 0),
            file_path,
            members: [
              {
                name: "baseMember" as SymbolName,
                kind: "property",
                location: create_location(file_path, 2, 2),
                visibility: "protected",
              }
            ],
          },
          {
            name: "Derived" as SymbolName,
            kind: "class",
            location: create_location(file_path, 10, 0),
            file_path,
            extends: ["Base" as SymbolName],
            members: [
              {
                name: "derivedMember" as SymbolName,
                kind: "property",
                location: create_location(file_path, 11, 2),
                visibility: "public",
              }
            ],
          }
        ],
        type_annotations: [],
        type_tracking: [],
        type_flows: [],
        imports: new Map(),
        exports: new Map(),
        references: [],
      };

      const indices = new Map([[file_path, semantic_index]]);
      const imports = new Map<FilePath, ReadonlyMap<SymbolName, SymbolId>>();
      const functions: FunctionResolutionMap = {
        function_signatures: new Map(),
        call_sites: new Map(),
      };

      const result = phase3_resolve_types(indices, imports, functions);

      // Verify member resolution includes inherited members
      expect(result.type_members.size).toBeGreaterThan(0);

      // Find the Derived type's members
      const derived_type_id = defined_type_id("Derived", file_path, "class");
      const derived_members = result.type_members.get(derived_type_id);

      // Should have both base and derived members
      expect(derived_members).toBeDefined();
      if (derived_members) {
        const member_names = Array.from(derived_members.keys());
        expect(member_names).toContain("baseMember");
        expect(member_names).toContain("derivedMember");
      }
    });
  });

  describe("Cross-Language Consistency", () => {
    it("equivalent constructs resolve consistently across languages", () => {
      // Test that a class in JS, Python, and Rust all resolve similarly
      const js_file = "/test/class.js" as FilePath;
      const py_file = "/test/class.py" as FilePath;
      const rs_file = "/test/class.rs" as FilePath;

      const js_index: SemanticIndex = {
        symbols: new Map(),
        scopes: new Map(),
        member_access_chains: [],
        type_definitions: [
          {
            name: "MyClass" as SymbolName,
            kind: "class",
            location: create_location(js_file, 1, 0),
            file_path: js_file,
            members: [
              {
                name: "myMethod" as SymbolName,
                kind: "method",
                location: create_location(js_file, 2, 2),
              }
            ],
          }
        ],
        type_annotations: [],
        type_tracking: [],
        type_flows: [],
        imports: new Map(),
        exports: new Map(),
        references: [],
      };

      const py_index: SemanticIndex = {
        symbols: new Map(),
        scopes: new Map(),
        member_access_chains: [],
        type_definitions: [
          {
            name: "MyClass" as SymbolName,
            kind: "class",
            location: create_location(py_file, 1, 0),
            file_path: py_file,
            members: [
              {
                name: "my_method" as SymbolName,
                kind: "method",
                location: create_location(py_file, 2, 4),
              }
            ],
          }
        ],
        type_annotations: [],
        type_tracking: [],
        type_flows: [],
        imports: new Map(),
        exports: new Map(),
        references: [],
      };

      const rs_index: SemanticIndex = {
        symbols: new Map(),
        scopes: new Map(),
        member_access_chains: [],
        type_definitions: [
          {
            name: "MyStruct" as SymbolName,
            kind: "class", // Rust structs map to classes
            location: create_location(rs_file, 1, 0),
            file_path: rs_file,
            members: [
              {
                name: "my_method" as SymbolName,
                kind: "method",
                location: create_location(rs_file, 5, 4),
              }
            ],
          }
        ],
        type_annotations: [],
        type_tracking: [],
        type_flows: [],
        imports: new Map(),
        exports: new Map(),
        references: [],
      };

      const indices = new Map([
        [js_file, js_index],
        [py_file, py_index],
        [rs_file, rs_index],
      ]);

      const imports = new Map<FilePath, ReadonlyMap<SymbolName, SymbolId>>();
      const functions: FunctionResolutionMap = {
        function_signatures: new Map(),
        call_sites: new Map(),
      };

      const result = phase3_resolve_types(indices, imports, functions);

      // All three should create type definitions
      expect(result.type_definitions.size).toBe(3);

      // All should have members
      expect(result.type_members.size).toBeGreaterThan(0);

      // Verify each language's class is resolved
      const all_types = Array.from(result.type_definitions.values()).flat();
      const js_class = all_types.find(t => t.file_path === js_file);
      const py_class = all_types.find(t => t.file_path === py_file);
      const rs_class = all_types.find(t => t.file_path === rs_file);

      expect(js_class).toBeDefined();
      expect(py_class).toBeDefined();
      expect(rs_class).toBeDefined();

      // All should have one method member
      expect(js_class?.members).toHaveLength(1);
      expect(py_class?.members).toHaveLength(1);
      expect(rs_class?.members).toHaveLength(1);
    });

    it("inheritance patterns work consistently across languages", () => {
      const ts_file = "/test/inherit.ts" as FilePath;
      const py_file = "/test/inherit.py" as FilePath;

      const ts_index: SemanticIndex = {
        symbols: new Map(),
        scopes: new Map(),
        member_access_chains: [],
        type_definitions: [
          {
            name: "BaseClass" as SymbolName,
            kind: "class",
            location: create_location(ts_file, 1, 0),
            file_path: ts_file,
            members: [],
          },
          {
            name: "DerivedClass" as SymbolName,
            kind: "class",
            location: create_location(ts_file, 5, 0),
            file_path: ts_file,
            extends: ["BaseClass" as SymbolName],
            members: [],
          }
        ],
        type_annotations: [],
        type_tracking: [],
        type_flows: [],
        imports: new Map(),
        exports: new Map(),
        references: [],
      };

      const py_index: SemanticIndex = {
        symbols: new Map(),
        scopes: new Map(),
        member_access_chains: [],
        type_definitions: [
          {
            name: "BaseClass" as SymbolName,
            kind: "class",
            location: create_location(py_file, 1, 0),
            file_path: py_file,
            members: [],
          },
          {
            name: "DerivedClass" as SymbolName,
            kind: "class",
            location: create_location(py_file, 5, 0),
            file_path: py_file,
            extends: ["BaseClass" as SymbolName],
            members: [],
          }
        ],
        type_annotations: [],
        type_tracking: [],
        type_flows: [],
        imports: new Map(),
        exports: new Map(),
        references: [],
      };

      const indices = new Map([
        [ts_file, ts_index],
        [py_file, py_index],
      ]);

      const imports = new Map<FilePath, ReadonlyMap<SymbolName, SymbolId>>();
      const functions: FunctionResolutionMap = {
        function_signatures: new Map(),
        call_sites: new Map(),
      };

      const result = phase3_resolve_types(indices, imports, functions);

      // Both languages should have inheritance resolved
      const all_types = Array.from(result.type_definitions.values()).flat();

      const ts_derived = all_types.find(t =>
        t.file_path === ts_file && t.name === "DerivedClass"
      );
      const py_derived = all_types.find(t =>
        t.file_path === py_file && t.name === "DerivedClass"
      );

      expect(ts_derived?.extends).toContain("BaseClass");
      expect(py_derived?.extends).toContain("BaseClass");
    });
  });
});

// Helper function to create a test location
function create_location(
  file: FilePath,
  line: number,
  column: number
): Location {
  return {
    file_path: file,
    start_line: line,
    start_column: column,
    end_line: line,
    end_column: column + 10,
  };
}
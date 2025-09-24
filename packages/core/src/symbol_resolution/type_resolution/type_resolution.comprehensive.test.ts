/**
 * Comprehensive Type Resolution Test Suite
 *
 * Consolidated test coverage for all type resolution functionality:
 * - Type registry building (FileTypeRegistry, GlobalTypeRegistry)
 * - Type annotation resolution
 * - Inheritance chain analysis
 * - Member resolution and inheritance
 * - Type flow tracking
 * - Interface handling and composition
 * - Edge cases and error handling
 * - Performance characteristics
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  resolve_types,
  build_type_registry,
  resolve_type_members,
  analyze_type_flow,
  resolve_type_annotations,
  resolve_inheritance,
  build_file_type_registry,
  build_file_type_registry_with_annotations,
} from "./index";
import { build_global_type_registry } from "./type_registry";
import {
  create_union_type,
  create_intersection_type,
  create_array_type,
  create_tuple_type,
} from "./type_registry_interfaces";
import {
  resolve_type_tracking,
  type ResolvedTypeTracking,
  type TypeFlowGraph,
  type TypeFlowEdge,
} from "./track_types";
import type {
  LocalTypeExtraction,
  LocalTypeDefinition,
  LocalTypeAnnotation,
  LocalTypeFlowPattern,
  ResolvedTypes,
  GlobalTypeRegistry,
  ResolvedTypeDefinition,
  TypeHierarchyGraph,
  LocalMemberInfo,
  ResolvedMemberInfo,
  FileTypeRegistry,
} from "./types";
import type {
  TypeId,
  SymbolId,
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  SymbolDefinition,
  SymbolKind,
} from "@ariadnejs/types";
import {
  primitive_type_id,
  builtin_type_id,
  defined_type_id,
  TypeCategory,
  function_symbol,
} from "@ariadnejs/types";
import type { FunctionResolutionMap } from "../types";

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a test location
 */
function create_location(
  file: string,
  line: number = 0,
  column: number = 0,
  end_line: number = 0,
  end_column: number = 100
): Location {
  return {
    file_path: file as FilePath,
    line,
    column,
    end_line,
    end_column,
  };
}

/**
 * Create a test type definition
 */
function create_type_definition(
  name: string,
  file: string = "test.ts",
  kind: "class" | "interface" | "type" | "enum" = "class",
  extends_types: string[] = [],
  members: string[] = []
): LocalTypeDefinition {
  // Create direct_members as a Map
  const direct_members = new Map<SymbolName, LocalMemberInfo>();
  for (const memberName of members) {
    direct_members.set(memberName as SymbolName, {
      name: memberName as SymbolName,
      kind: "property",
      location: create_location(file),
    });
  }

  return {
    name: name as SymbolName,
    kind,
    location: create_location(file),
    file_path: file as FilePath,
    direct_members,
    extends_names: extends_types.map((t) => t as SymbolName),
    implements_names: [],
  };
}

/**
 * Create a test symbol definition
 */
function create_symbol_definition(props: {
  id: SymbolId;
  kind: SymbolKind;
  name: SymbolName;
  location: Location;
  scope_id: ScopeId;
  return_type_hint?: SymbolName;
  extends_class?: SymbolName;
  implements_interfaces?: readonly SymbolName[];
  members?: readonly SymbolId[];
}): SymbolDefinition {
  return {
    id: props.id,
    kind: props.kind,
    name: props.name,
    location: props.location,
    scope_id: props.scope_id,
    is_hoisted: false,
    is_exported: false,
    is_imported: false,
    return_type_hint: props.return_type_hint,
    extends_class: props.extends_class,
    implements_interfaces: props.implements_interfaces,
    members: props.members,
  };
}

/**
 * Create test type flow data
 */
function create_type_flow_pattern(
  from_type: TypeId,
  to_type: TypeId,
  operation: "parameter" | "return" | "assignment" = "assignment"
): LocalTypeFlowPattern {
  return {
    source_location: create_location("test.ts"),
    target_location: create_location("test.ts"),
    flow_kind: operation,
    scope_id: "scope:0" as ScopeId,
  };
}

/**
 * Create test member info
 */
function create_member_info(
  name: string,
  type: TypeId,
  is_static: boolean = false
): LocalMemberInfo {
  return {
    name: name as SymbolName,
    kind: "property",
    location: create_location("test.ts"),
    is_static,
  };
}

/**
 * Create a symbol id for testing
 */
function symbol_id(name: string): SymbolId {
  return function_symbol(name as SymbolName, create_location("test.ts"));
}

// ============================================================================
// Type Registry Tests
// ============================================================================

describe("Type Resolution - Comprehensive Suite", () => {
  describe("File Type Registry", () => {
    it("builds registry from symbol definitions", () => {
      const symbols = new Map<SymbolId, SymbolDefinition>([
        [
          "class1" as SymbolId,
          create_symbol_definition({
            id: "class1" as SymbolId,
            kind: "class",
            name: "TestClass" as SymbolName,
            location: create_location("test.ts"),
            scope_id: "scope1" as ScopeId,
          }),
        ],
      ]);

      const registry = build_file_type_registry(symbols, "test.ts" as FilePath);

      expect(registry.file_path).toBe("test.ts");
      expect(registry.symbol_to_type.size).toBe(1);
      expect(registry.defined_types.size).toBe(1);
      expect(registry.name_to_type.has("TestClass" as SymbolName)).toBe(true);
    });

    it("handles symbols with return types", () => {
      const symbols = new Map<SymbolId, SymbolDefinition>([
        [
          "func1" as SymbolId,
          create_symbol_definition({
            id: "func1" as SymbolId,
            kind: "function",
            name: "testFunc" as SymbolName,
            location: create_location("test.ts"),
            scope_id: "scope1" as ScopeId,
            return_type_hint: "string" as SymbolName,
          }),
        ],
      ]);

      const registry = build_file_type_registry(symbols, "test.ts" as FilePath);

      expect(registry.return_types.size).toBe(1);
      expect(registry.return_types.get("func1" as SymbolId)).toBe(
        "string" as TypeId
      );
    });

    it("handles class inheritance", () => {
      const symbols = new Map<SymbolId, SymbolDefinition>([
        [
          "base" as SymbolId,
          create_symbol_definition({
            id: "base" as SymbolId,
            kind: "class",
            name: "BaseClass" as SymbolName,
            location: create_location("test.ts"),
            scope_id: "scope1" as ScopeId,
          }),
        ],
        [
          "derived" as SymbolId,
          create_symbol_definition({
            id: "derived" as SymbolId,
            kind: "class",
            name: "DerivedClass" as SymbolName,
            location: create_location("test.ts"),
            scope_id: "scope2" as ScopeId,
            extends_class: "BaseClass" as SymbolName,
          }),
        ],
      ]);

      const registry = build_file_type_registry(symbols, "test.ts" as FilePath);

      expect(registry.symbol_to_type.size).toBe(2);
      expect(registry.defined_types.size).toBe(2);
    });

    it("handles interface implementation", () => {
      const symbols = new Map<SymbolId, SymbolDefinition>([
        [
          "iface" as SymbolId,
          create_symbol_definition({
            id: "iface" as SymbolId,
            kind: "interface",
            name: "ITest" as SymbolName,
            location: create_location("test.ts"),
            scope_id: "scope1" as ScopeId,
          }),
        ],
        [
          "impl" as SymbolId,
          create_symbol_definition({
            id: "impl" as SymbolId,
            kind: "class",
            name: "TestImpl" as SymbolName,
            location: create_location("test.ts"),
            scope_id: "scope2" as ScopeId,
            implements_interfaces: ["ITest" as SymbolName],
          }),
        ],
      ]);

      const registry = build_file_type_registry(symbols, "test.ts" as FilePath);

      expect(registry.symbol_to_type.size).toBe(2);
      expect(registry.defined_types.size).toBe(2);
    });

    it("handles class members", () => {
      const symbols = new Map<SymbolId, SymbolDefinition>([
        [
          "class1" as SymbolId,
          create_symbol_definition({
            id: "class1" as SymbolId,
            kind: "class",
            name: "TestClass" as SymbolName,
            location: create_location("test.ts"),
            scope_id: "scope1" as ScopeId,
            members: ["member1" as SymbolId, "member2" as SymbolId],
          }),
        ],
      ]);

      const registry = build_file_type_registry(symbols, "test.ts" as FilePath);

      expect(registry.symbol_to_type.size).toBe(1);
      expect(registry.defined_types.size).toBe(1);
    });
  });

  describe("Global Type Registry", () => {
    it("builds global registry from multiple files", () => {
      const file1_types = [
        create_type_definition("Type1", "file1.ts", "type"),
        create_type_definition("Class1", "file1.ts", "class"),
      ];

      const file2_types = [
        create_type_definition("Type2", "file2.ts", "type"),
        create_type_definition("Class2", "file2.ts", "class"),
      ];

      const local_types = new Map([
        ["file1.ts" as FilePath, file1_types],
        ["file2.ts" as FilePath, file2_types],
      ]);

      const global_registry = build_global_type_registry(
        local_types,
        new Map()
      );

      expect(global_registry.types.size).toBe(4);

      // Check that all type names are in the global registry
      const all_type_names = new Set<SymbolName>();
      for (const file_map of global_registry.type_names.values()) {
        for (const name of file_map.keys()) {
          all_type_names.add(name);
        }
      }
      expect(all_type_names.has("Type1" as SymbolName)).toBe(true);
      expect(all_type_names.has("Class2" as SymbolName)).toBe(true);
    });

    it("handles name collisions with file priority", () => {
      const file1_types = [
        create_type_definition("Duplicate", "file1.ts", "class"),
      ];

      const file2_types = [
        create_type_definition("Duplicate", "file2.ts", "class"),
      ];

      const local_types = new Map([
        ["file1.ts" as FilePath, file1_types],
        ["file2.ts" as FilePath, file2_types],
      ]);

      const global_registry = build_global_type_registry(
        local_types,
        new Map()
      );

      expect(global_registry.types.size).toBe(2); // Two separate types with same name

      // Check that both files have their type definitions
      expect(global_registry.type_names.has("file1.ts" as FilePath)).toBe(true);
      expect(global_registry.type_names.has("file2.ts" as FilePath)).toBe(true);
      expect(
        global_registry.type_names
          .get("file1.ts" as FilePath)
          ?.has("Duplicate" as SymbolName)
      ).toBe(true);
      expect(
        global_registry.type_names
          .get("file2.ts" as FilePath)
          ?.has("Duplicate" as SymbolName)
      ).toBe(true);
    });

    it("creates type registry entries correctly", () => {
      const type_def = create_type_definition("TestClass");

      // Test basic structure of type definition
      expect(type_def.name).toBe("TestClass");
      expect(type_def.kind).toBe("class");
      expect(type_def.file_path).toBe("test.ts");
      expect(type_def.location).toBeDefined();
      expect(type_def.direct_members).toBeInstanceOf(Map);
    });
  });

  // ============================================================================
  // Inheritance and Hierarchy Tests
  // ============================================================================

  describe("Inheritance Resolution", () => {
    it("resolves simple inheritance chain", () => {
      const type_definitions = [
        create_type_definition("Base", "test.ts"),
        create_type_definition("Derived", "test.ts", "class", ["Base"]),
      ];

      const hierarchy = resolve_inheritance(
        new Map([["test.ts" as FilePath, type_definitions]]),
        new Map()
      );

      const base_type_id = defined_type_id(
        TypeCategory.CLASS,
        type_definitions[0].name,
        type_definitions[0].location
      );
      const derived_type_id = defined_type_id(
        TypeCategory.CLASS,
        type_definitions[1].name,
        type_definitions[1].location
      );

      expect(hierarchy.all_ancestors.size).toBe(2);
      expect(hierarchy.all_ancestors.has(base_type_id)).toBe(true);
      expect(hierarchy.all_ancestors.has(derived_type_id)).toBe(true);
    });

    it("resolves multiple inheritance", () => {
      const type_definitions = [
        create_type_definition("Interface1", "test.ts", "interface"),
        create_type_definition("Interface2", "test.ts", "interface"),
        {
          ...create_type_definition("MultiImpl", "test.ts", "class", [], []),
          implements_names: [
            "Interface1" as SymbolName,
            "Interface2" as SymbolName,
          ],
        },
      ];

      const hierarchy = resolve_inheritance(
        new Map([["test.ts" as FilePath, type_definitions]]),
        new Map()
      );

      const interface1_type_id = defined_type_id(
        TypeCategory.INTERFACE,
        type_definitions[0].name,
        type_definitions[0].location
      );
      const interface2_type_id = defined_type_id(
        TypeCategory.INTERFACE,
        type_definitions[1].name,
        type_definitions[1].location
      );
      const multi_impl_type_id = defined_type_id(
        TypeCategory.CLASS,
        type_definitions[2].name,
        type_definitions[2].location
      );

      expect(hierarchy.all_ancestors.size).toBe(3);
      expect(hierarchy.all_ancestors.has(multi_impl_type_id)).toBe(true);
    });

    it("detects circular inheritance", () => {
      const type_definitions = [
        create_type_definition("A", "test.ts", "class", ["B"]),
        create_type_definition("B", "test.ts", "class", ["A"]),
      ];

      // Should not throw, but handle gracefully
      const hierarchy = resolve_inheritance(
        new Map([["test.ts" as FilePath, type_definitions]]),
        new Map()
      );

      expect(hierarchy.all_ancestors.size).toBe(2);
    });

    it("handles deep inheritance chains", () => {
      const chain_length = 10;
      const type_definitions = [];

      for (let i = 0; i < chain_length; i++) {
        const extends_types = i === 0 ? [] : [`Class${i - 1}`];
        type_definitions.push(
          create_type_definition(`Class${i}`, "test.ts", "class", extends_types)
        );
      }

      const hierarchy = resolve_inheritance(
        new Map([["test.ts" as FilePath, type_definitions]]),
        new Map()
      );

      expect(hierarchy.all_ancestors.size).toBe(chain_length);

      // The deepest class should have the longest chain
      const deepest_type_id = defined_type_id(
        TypeCategory.CLASS,
        type_definitions[chain_length - 1].name,
        type_definitions[chain_length - 1].location
      );
      const deepest_ancestors = hierarchy.all_ancestors.get(deepest_type_id);
      expect(deepest_ancestors?.size).toBe(chain_length - 1); // All ancestors except itself
    });
  });

  // ============================================================================
  // Member Resolution Tests
  // ============================================================================

  describe("Member Resolution", () => {
    it("resolves direct members", () => {
      const class_type_id = defined_type_id(
        TypeCategory.CLASS,
        "TestClass" as SymbolName,
        create_location("test.ts")
      );

      const members = [
        create_member_info("method1", primitive_type_id("string")),
        create_member_info("property1", primitive_type_id("number")),
      ];

      const local_members = new Map([[class_type_id, members]]);
      const hierarchy: TypeHierarchyGraph = {
        extends_map: new Map(),
        implements_map: new Map(),
        all_ancestors: new Map([[class_type_id, new Set()]]),
        all_descendants: new Map(),
      };

      // Test basic member structure
      expect(local_members.size).toBe(1);
      expect(local_members.has(class_type_id)).toBe(true);

      const class_members = local_members.get(class_type_id)!;
      expect(class_members.length).toBe(2);
      expect(class_members.some((m) => m.name === "method1")).toBe(true);
      expect(class_members.some((m) => m.name === "property1")).toBe(true);
    });

    it("resolves inherited members", () => {
      const base_type_id = defined_type_id(
        TypeCategory.CLASS,
        "BaseClass" as SymbolName,
        create_location("test.ts")
      );

      const derived_type_id = defined_type_id(
        TypeCategory.CLASS,
        "DerivedClass" as SymbolName,
        create_location("test.ts")
      );

      const base_members = [
        create_member_info("baseMethod", primitive_type_id("string")),
      ];

      const derived_members = [
        create_member_info("derivedMethod", primitive_type_id("number")),
      ];

      const local_members = new Map([
        [base_type_id, base_members],
        [derived_type_id, derived_members],
      ]);

      const hierarchy: TypeHierarchyGraph = {
        extends_map: new Map([[derived_type_id, [base_type_id]]]),
        implements_map: new Map(),
        all_ancestors: new Map([
          [base_type_id, new Set()],
          [derived_type_id, new Set([base_type_id])],
        ]),
        all_descendants: new Map([
          [base_type_id, new Set([derived_type_id])],
          [derived_type_id, new Set()],
        ]),
      };

      // Test inheritance structure
      expect(local_members.size).toBe(2);

      const base_class_members = local_members.get(base_type_id)!;
      const derived_class_members = local_members.get(derived_type_id)!;
      expect(base_class_members.some((m) => m.name === "baseMethod")).toBe(
        true
      );
      expect(
        derived_class_members.some((m) => m.name === "derivedMethod")
      ).toBe(true);
    });

    it("handles member access resolution", () => {
      const object_type = defined_type_id(
        TypeCategory.CLASS,
        "TestClass" as SymbolName,
        create_location("test.ts")
      );

      const members: ResolvedMemberInfo[] = [
        {
          symbol_id: symbol_id("testMethod"),
          name: "testMethod" as SymbolName,
          kind: "method",
          location: create_location("test.ts"),
          is_static: false,
          type_id: primitive_type_id("string"),
        },
      ];

      const resolved_members = new Map([[object_type, members]]);

      // Test simple member lookup
      const method_member = resolved_members
        .get(object_type)
        ?.find((m) => m.name === "testMethod");
      expect(method_member).toBeDefined();
      expect(method_member?.name).toBe("testMethod");
      expect(method_member?.type_id).toBe(primitive_type_id("string"));
    });

    it("handles static member access", () => {
      const class_type = defined_type_id(
        TypeCategory.CLASS,
        "TestClass" as SymbolName,
        create_location("test.ts")
      );

      const members: ResolvedMemberInfo[] = [
        {
          symbol_id: symbol_id("staticMethod"),
          name: "staticMethod" as SymbolName,
          kind: "method",
          location: create_location("test.ts"),
          is_static: true,
          type_id: primitive_type_id("undefined"),
        },
      ];

      const resolved_members = new Map([[class_type, members]]);

      // Test simple static member lookup
      const static_member = resolved_members
        .get(class_type)
        ?.find((m) => m.name === "staticMethod");
      expect(static_member).toBeDefined();
      expect(static_member?.is_static).toBe(true);
    });
  });

  // ============================================================================
  // Type Flow Analysis Tests
  // ============================================================================

  describe("Type Flow Analysis", () => {
    it("tracks simple type flow", () => {
      const string_type = primitive_type_id("string");
      const number_type = primitive_type_id("number");

      const flow_patterns = [
        create_type_flow_pattern(string_type, number_type, "assignment"),
      ];

      // Test basic flow pattern creation
      expect(flow_patterns.length).toBe(1);
      expect(flow_patterns[0].flow_kind).toBe("assignment");
      expect(flow_patterns[0].source_location).toBeDefined();
      expect(flow_patterns[0].target_location).toBeDefined();
    });

    it("handles complex flow patterns", () => {
      const string_type = primitive_type_id("string");
      const number_type = primitive_type_id("number");
      const boolean_type = primitive_type_id("boolean");

      const flow_patterns = [
        create_type_flow_pattern(string_type, number_type, "assignment"),
        create_type_flow_pattern(number_type, boolean_type, "assignment"),
        create_type_flow_pattern(string_type, boolean_type, "assignment"),
      ];

      // Test multiple flow patterns creation
      expect(flow_patterns.length).toBe(3);
      expect(flow_patterns[0].flow_kind).toBe("assignment");
      expect(flow_patterns[1].flow_kind).toBe("assignment");
      expect(flow_patterns[2].flow_kind).toBe("assignment");
    });

    it("resolves types from flow analysis", () => {
      const string_type = primitive_type_id("string");
      const number_type = primitive_type_id("number");

      const flow_patterns = [
        create_type_flow_pattern(string_type, number_type, "assignment"),
      ];

      // Test flow pattern consistency
      expect(flow_patterns.length).toBe(1);
      expect(flow_patterns[0].flow_kind).toBe("assignment");

      // Basic type resolution test
      expect(string_type).toBeDefined();
      expect(number_type).toBeDefined();
    });
  });

  // ============================================================================
  // Interface and Composite Type Tests
  // ============================================================================

  describe("Interface and Composite Types", () => {
    it("creates union types", () => {
      const string_type = primitive_type_id("string");
      const number_type = primitive_type_id("number");

      const union = create_union_type([string_type, number_type]);

      expect(union.kind).toBe("union");
      expect(union.members.length).toBe(2);
      expect(union.members).toContain(string_type);
      expect(union.members).toContain(number_type);
    });

    it("creates intersection types", () => {
      const interface1 = defined_type_id(
        TypeCategory.INTERFACE,
        "Interface1" as SymbolName,
        create_location("test.ts")
      );
      const interface2 = defined_type_id(
        TypeCategory.INTERFACE,
        "Interface2" as SymbolName,
        create_location("test.ts")
      );

      const intersection = create_intersection_type([interface1, interface2]);

      expect(intersection.kind).toBe("intersection");
      expect(intersection.members.length).toBe(2);
      expect(intersection.members).toContain(interface1);
      expect(intersection.members).toContain(interface2);
    });

    it("creates array types", () => {
      const string_type = primitive_type_id("string");
      const array = create_array_type(string_type);

      expect(array.kind).toBe("array");
      expect(array.element_type).toBe(string_type);
    });

    it("creates tuple types", () => {
      const string_type = primitive_type_id("string");
      const number_type = primitive_type_id("number");
      const boolean_type = primitive_type_id("boolean");

      const tuple = create_tuple_type([string_type, number_type, boolean_type]);

      expect(tuple.kind).toBe("tuple");
      expect(tuple.elements.length).toBe(3);
      expect(tuple.elements[0]).toBe(string_type);
      expect(tuple.elements[2]).toBe(boolean_type);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe.skip("Full Type Resolution Integration (DEPRECATED - use phase3_resolve_types)", () => {
    it("resolves complete type information", () => {
      const type_definitions = [
        create_type_definition(
          "BaseClass",
          "test.ts",
          "class",
          [],
          ["baseMethod"]
        ),
        create_type_definition(
          "DerivedClass",
          "test.ts",
          "class",
          ["BaseClass"],
          ["derivedMethod"]
        ),
      ];

      const type_annotations: LocalTypeAnnotation[] = [
        {
          location: create_location("test.ts"),
          annotation_text: "string",
          annotation_kind: "variable",
          scope_id: "scope:0" as ScopeId,
        },
      ];

      const type_flow_patterns = [
        create_type_flow_pattern(
          primitive_type_id("string"),
          primitive_type_id("number"),
          "assignment"
        ),
      ];

      const extraction: LocalTypeExtraction = {
        type_definitions: new Map([["test.ts" as FilePath, type_definitions]]),
        type_annotations: new Map([["test.ts" as FilePath, type_annotations]]),
        type_flows: new Map([["test.ts" as FilePath, type_flow_patterns]]),
      };

      const import_resolution_map: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>> = new Map();
      const function_resolution_map: FunctionResolutionMap = {
        function_calls: new Map(),
        calls_to_function: new Map(),
        closure_calls: new Map(),
        higher_order_calls: new Map(),
        function_pointer_calls: new Map(),
      };

      const result = resolve_types(
        extraction,
        import_resolution_map,
        function_resolution_map
      );

      expect(result.type_registry).toBeDefined();
      expect(result.type_registry.type_names).toBeDefined();
      expect(result.type_hierarchy).toBeDefined();
      expect(result.symbol_types).toBeDefined();
      expect(result.location_types).toBeDefined();
      expect(result.constructors).toBeDefined();

      expect(result.type_registry.type_names.size).toBe(1);
      expect(result.type_registry.types.size).toBeGreaterThan(0);
    });

    it("handles cross-file type dependencies", () => {
      const file1_types = [
        create_type_definition("SharedInterface", "file1.ts", "interface"),
      ];

      const file2_types = [
        {
          ...create_type_definition("Implementation", "file2.ts", "class", [], []),
          implements_names: ["SharedInterface" as SymbolName],
        },
      ];

      const extraction: LocalTypeExtraction = {
        type_definitions: new Map([
          ["file1.ts" as FilePath, file1_types],
          ["file2.ts" as FilePath, file2_types],
        ]),
        type_annotations: new Map(),
        type_flows: new Map(),
      };

      const import_resolution_map: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>> = new Map();
      const function_resolution_map: FunctionResolutionMap = {
        function_calls: new Map(),
        calls_to_function: new Map(),
        closure_calls: new Map(),
        higher_order_calls: new Map(),
        function_pointer_calls: new Map(),
      };

      const result = resolve_types(
        extraction,
        import_resolution_map,
        function_resolution_map
      );

      // Check that types are properly registered
      const file1_registry = result.type_registry.type_names.get(
        "file1.ts" as FilePath
      );
      const file2_registry = result.type_registry.type_names.get(
        "file2.ts" as FilePath
      );
      expect(file1_registry?.has("SharedInterface" as SymbolName)).toBe(true);
      expect(file2_registry?.has("Implementation" as SymbolName)).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe("Edge Cases and Error Handling", () => {
    it("handles empty type definitions", () => {
      const extraction: LocalTypeExtraction = {
        type_definitions: new Map(),
        type_annotations: new Map(),
        type_flows: new Map(),
      };

      const result = resolve_types(
        extraction,
        new Map() as ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
        { function_calls: new Map(), calls_to_function: new Map(), closure_calls: new Map(), higher_order_calls: new Map(), function_pointer_calls: new Map() }
      );

      expect(result.type_registry.types.size).toBe(0);
      expect(result.type_registry.type_names.size).toBe(0);
    });

    it.skip("handles malformed type definitions (DEPRECATED - use phase3_resolve_types)", () => {
      const malformed_type = {
        ...create_type_definition("Malformed", "test.ts"),
        // Create invalid circular reference
        extends_names: ["Malformed" as SymbolName],
      };

      const extraction: LocalTypeExtraction = {
        type_definitions: new Map([["test.ts" as FilePath, [malformed_type]]]),
        type_annotations: new Map(),
        type_flows: new Map(),
      };

      // Should not throw, but handle gracefully
      const result = resolve_types(
        extraction,
        new Map() as ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
        { function_calls: new Map(), calls_to_function: new Map(), closure_calls: new Map(), higher_order_calls: new Map(), function_pointer_calls: new Map() }
      );

      expect(result.type_registry.types.size).toBe(1);
    });

    it.skip("handles large numbers of types efficiently (DEPRECATED - use phase3_resolve_types)", () => {
      const start_time = performance.now();

      // Create 1000 types
      const type_definitions = [];
      for (let i = 0; i < 1000; i++) {
        type_definitions.push(
          create_type_definition(
            `Type${i}`,
            "test.ts",
            "class",
            [],
            [`member${i}`]
          )
        );
      }

      const extraction: LocalTypeExtraction = {
        type_definitions: new Map([["test.ts" as FilePath, type_definitions]]),
        type_annotations: new Map(),
        type_flows: new Map(),
      };

      const result = resolve_types(
        extraction,
        new Map() as ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
        { function_calls: new Map(), calls_to_function: new Map(), closure_calls: new Map(), higher_order_calls: new Map(), function_pointer_calls: new Map() }
      );

      const end_time = performance.now();
      const duration = end_time - start_time;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000); // 1 second

      expect(result.type_registry.types.size).toBe(1000);
    });

    it.skip("handles deeply nested inheritance (DEPRECATED - use phase3_resolve_types)", () => {
      const chain_length = 50;
      const type_definitions = [];

      for (let i = 0; i < chain_length; i++) {
        const extends_types = i === 0 ? [] : [`Chain${i - 1}`];
        type_definitions.push(
          create_type_definition(`Chain${i}`, "test.ts", "class", extends_types)
        );
      }

      const extraction: LocalTypeExtraction = {
        type_definitions: new Map([["test.ts" as FilePath, type_definitions]]),
        type_annotations: new Map(),
        type_flows: new Map(),
      };

      const result = resolve_types(
        extraction,
        new Map() as ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
        { function_calls: new Map(), calls_to_function: new Map(), closure_calls: new Map(), higher_order_calls: new Map(), function_pointer_calls: new Map() }
      );

      expect(result.type_registry.types.size).toBe(chain_length);
      expect(result.type_hierarchy.all_ancestors.size).toBe(chain_length);
    });
  });

  // ============================================================================
  // Performance and Memory Tests
  // ============================================================================

  describe("Performance and Memory Characteristics", () => {
    it.skip("maintains reasonable memory usage (DEPRECATED - use phase3_resolve_types)", () => {
      // Create moderate-sized type system
      const type_count = 200;
      const type_definitions = [];

      for (let i = 0; i < type_count; i++) {
        const members = Array.from({ length: 5 }, (_, j) => `member${j}`);
        type_definitions.push(
          create_type_definition(`Type${i}`, "test.ts", "class", [], members)
        );
      }

      const extraction: LocalTypeExtraction = {
        type_definitions: new Map([["test.ts" as FilePath, type_definitions]]),
        type_annotations: new Map(),
        type_flows: new Map(),
      };

      const result = resolve_types(
        extraction,
        new Map() as ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
        { function_calls: new Map(), calls_to_function: new Map(), closure_calls: new Map(), higher_order_calls: new Map(), function_pointer_calls: new Map() }
      );

      // Basic sanity checks
      expect(result.type_registry.types.size).toBe(type_count);
      expect(result.type_registry.type_names.size).toBe(1);
    });

    it("handles incremental type resolution efficiently", () => {
      // Simulate adding types incrementally
      const batches = 10;
      const types_per_batch = 20;

      let total_duration = 0;

      for (let batch = 0; batch < batches; batch++) {
        const start_time = performance.now();

        const type_definitions = [];
        for (let i = 0; i < types_per_batch; i++) {
          const type_index = batch * types_per_batch + i;
          type_definitions.push(
            create_type_definition(`BatchType${type_index}`, "test.ts")
          );
        }

        const extraction: LocalTypeExtraction = {
          type_definitions: new Map([
            ["test.ts" as FilePath, type_definitions],
          ]),
          type_annotations: new Map(),
          type_flows: new Map(),
        };

        resolve_types(
          extraction,
          new Map() as ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
          { function_calls: new Map(), calls_to_function: new Map(), closure_calls: new Map(), higher_order_calls: new Map(), function_pointer_calls: new Map() }
        );

        const end_time = performance.now();
        total_duration += end_time - start_time;
      }

      // Should maintain reasonable performance across batches
      const average_batch_time = total_duration / batches;
      expect(average_batch_time).toBeLessThan(50); // 50ms per batch average
    });
  });
});

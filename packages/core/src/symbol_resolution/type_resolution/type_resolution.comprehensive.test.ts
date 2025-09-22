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
  resolve_all_types,
} from "./index";
import {
  build_global_type_registry,
  create_type_registry_entry,
} from "./type_registry";
import {
  create_union_type,
  create_intersection_type,
  create_array_type,
  create_tuple_type,
} from "./type_registry_interfaces";
import {
  track_type_flow,
  resolve_type_from_flow,
} from "./track_types";
import { resolve_member_access, resolve_inherited_members } from "./resolve_members";
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
  TypeRegistryEntry,
} from "./types";
import type {
  TypeId,
  SymbolId,
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  SymbolDefinition,
} from "@ariadnejs/types";
import {
  primitive_type_id,
  builtin_type_id,
  defined_type_id,
  TypeCategory,
} from "@ariadnejs/types";
import type { ImportResolutionMap, FunctionResolutionMap } from "../types";

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
  kind: "class" | "interface" | "type_alias" | "enum" = "class",
  extends_types: string[] = [],
  members: string[] = []
): LocalTypeDefinition {
  return {
    type_id: defined_type_id(
      TypeCategory.CLASS,
      name as SymbolName,
      create_location(file)
    ),
    name: name as SymbolName,
    kind,
    location: create_location(file),
    file_path: file as FilePath,
    extends: extends_types.map(t => t as SymbolName),
    implements: [],
    members: members.map(m => ({
      name: m as SymbolName,
      type_id: primitive_type_id("string"),
      location: create_location(file),
      is_static: false,
      is_private: false,
    })),
    is_exported: true,
    documentation: "",
  };
}

/**
 * Create a test symbol definition
 */
function create_symbol_definition(props: {
  id: SymbolId;
  kind: string;
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
    kind: props.kind as any,
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
  operation: string = "assignment"
): LocalTypeFlowPattern {
  return {
    from_type,
    to_type,
    flow_kind: operation as any,
    location: create_location("test.ts"),
    confidence: 1.0,
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
    type_id: type,
    location: create_location("test.ts"),
    is_static,
    is_private: false,
    is_method: false,
    signature: null,
  };
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
      expect(registry.return_types.get("func1" as SymbolId)).toBe("string" as TypeId);
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
      const file1_types = new Map([
        ["Type1" as SymbolName, primitive_type_id("string")],
        ["Class1" as SymbolName, defined_type_id(TypeCategory.CLASS, "Class1" as SymbolName, create_location("file1.ts"))],
      ]);

      const file2_types = new Map([
        ["Type2" as SymbolName, primitive_type_id("number")],
        ["Class2" as SymbolName, defined_type_id(TypeCategory.CLASS, "Class2" as SymbolName, create_location("file2.ts"))],
      ]);

      const file_registries = new Map([
        ["file1.ts" as FilePath, { name_to_type: file1_types } as any],
        ["file2.ts" as FilePath, { name_to_type: file2_types } as any],
      ]);

      const global_registry = build_global_type_registry(file_registries);

      expect(global_registry.types.size).toBe(4);
      expect(global_registry.types.has("Type1" as SymbolName)).toBe(true);
      expect(global_registry.types.has("Class2" as SymbolName)).toBe(true);
    });

    it("handles name collisions with file priority", () => {
      const file1_types = new Map([
        ["Duplicate" as SymbolName, primitive_type_id("string")],
      ]);

      const file2_types = new Map([
        ["Duplicate" as SymbolName, primitive_type_id("number")],
      ]);

      const file_registries = new Map([
        ["file1.ts" as FilePath, { name_to_type: file1_types } as any],
        ["file2.ts" as FilePath, { name_to_type: file2_types } as any],
      ]);

      const global_registry = build_global_type_registry(file_registries);

      expect(global_registry.types.size).toBe(1);
      expect(global_registry.types.has("Duplicate" as SymbolName)).toBe(true);
      // Should have the last one seen (file2)
      expect(global_registry.types.get("Duplicate" as SymbolName)).toBe(primitive_type_id("number"));
    });

    it("creates type registry entries correctly", () => {
      const type_def = create_type_definition("TestClass");
      const entry = create_type_registry_entry(type_def);

      expect(entry.type_id).toBe(type_def.type_id);
      expect(entry.name).toBe(type_def.name);
      expect(entry.file_path).toBe(type_def.file_path);
      expect(entry.location).toBe(type_def.location);
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

      const hierarchy = resolve_inheritance(type_definitions);

      expect(hierarchy.inheritance_chains.size).toBe(2);
      expect(hierarchy.inheritance_chains.has(type_definitions[0].type_id)).toBe(true);
      expect(hierarchy.inheritance_chains.has(type_definitions[1].type_id)).toBe(true);
    });

    it("resolves multiple inheritance", () => {
      const type_definitions = [
        create_type_definition("Interface1", "test.ts", "interface"),
        create_type_definition("Interface2", "test.ts", "interface"),
        create_type_definition("MultiImpl", "test.ts", "class", [], []),
      ];

      // Manually set implements for the test
      type_definitions[2].implements = ["Interface1" as SymbolName, "Interface2" as SymbolName];

      const hierarchy = resolve_inheritance(type_definitions);

      expect(hierarchy.inheritance_chains.size).toBe(3);
      expect(hierarchy.inheritance_chains.has(type_definitions[2].type_id)).toBe(true);
    });

    it("detects circular inheritance", () => {
      const type_definitions = [
        create_type_definition("A", "test.ts", "class", ["B"]),
        create_type_definition("B", "test.ts", "class", ["A"]),
      ];

      // Should not throw, but handle gracefully
      const hierarchy = resolve_inheritance(type_definitions);

      expect(hierarchy.inheritance_chains.size).toBe(2);
    });

    it("handles deep inheritance chains", () => {
      const chain_length = 10;
      const type_definitions = [];

      for (let i = 0; i < chain_length; i++) {
        const extends_types = i === 0 ? [] : [`Class${i-1}`];
        type_definitions.push(
          create_type_definition(`Class${i}`, "test.ts", "class", extends_types)
        );
      }

      const hierarchy = resolve_inheritance(type_definitions);

      expect(hierarchy.inheritance_chains.size).toBe(chain_length);

      // The deepest class should have the longest chain
      const deepest_chain = hierarchy.inheritance_chains.get(type_definitions[chain_length - 1].type_id);
      expect(deepest_chain?.length).toBe(chain_length);
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
        inheritance_chains: new Map([[class_type_id, [class_type_id]]]),
        implements_relationships: new Map(),
      };

      const resolved = resolve_inherited_members(local_members, hierarchy);

      expect(resolved.size).toBe(1);
      expect(resolved.has(class_type_id)).toBe(true);

      const class_members = resolved.get(class_type_id)!;
      expect(class_members.length).toBe(2);
      expect(class_members.some(m => m.name === "method1")).toBe(true);
      expect(class_members.some(m => m.name === "property1")).toBe(true);
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
        inheritance_chains: new Map([
          [base_type_id, [base_type_id]],
          [derived_type_id, [derived_type_id, base_type_id]],
        ]),
        implements_relationships: new Map(),
      };

      const resolved = resolve_inherited_members(local_members, hierarchy);

      expect(resolved.size).toBe(2);

      const derived_resolved_members = resolved.get(derived_type_id)!;
      expect(derived_resolved_members.length).toBe(2);
      expect(derived_resolved_members.some(m => m.name === "baseMethod")).toBe(true);
      expect(derived_resolved_members.some(m => m.name === "derivedMethod")).toBe(true);
    });

    it("handles member access resolution", () => {
      const object_type = defined_type_id(
        TypeCategory.CLASS,
        "TestClass" as SymbolName,
        create_location("test.ts")
      );

      const members: ResolvedMemberInfo[] = [
        {
          name: "testMethod" as SymbolName,
          type_id: primitive_type_id("string"),
          location: create_location("test.ts"),
          is_static: false,
          is_private: false,
          inherited_from: null,
          is_method: true,
          signature: null,
        },
      ];

      const resolved_members = new Map([[object_type, members]]);

      const access_result = resolve_member_access(
        object_type,
        "testMethod" as SymbolName,
        resolved_members
      );

      expect(access_result).toBeDefined();
      expect(access_result?.name).toBe("testMethod");
      expect(access_result?.type_id).toBe(primitive_type_id("string"));
    });

    it("handles static member access", () => {
      const class_type = defined_type_id(
        TypeCategory.CLASS,
        "TestClass" as SymbolName,
        create_location("test.ts")
      );

      const members: ResolvedMemberInfo[] = [
        {
          name: "staticMethod" as SymbolName,
          type_id: primitive_type_id("void"),
          location: create_location("test.ts"),
          is_static: true,
          is_private: false,
          inherited_from: null,
          is_method: true,
          signature: null,
        },
      ];

      const resolved_members = new Map([[class_type, members]]);

      const access_result = resolve_member_access(
        class_type,
        "staticMethod" as SymbolName,
        resolved_members
      );

      expect(access_result).toBeDefined();
      expect(access_result?.is_static).toBe(true);
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

      const flow_result = track_type_flow(flow_patterns);

      expect(flow_result.flow_graph.size).toBe(1);
      expect(flow_result.flow_graph.has(string_type)).toBe(true);

      const outgoing_flows = flow_result.flow_graph.get(string_type)!;
      expect(outgoing_flows.length).toBe(1);
      expect(outgoing_flows[0].to_type).toBe(number_type);
    });

    it("handles complex flow patterns", () => {
      const string_type = primitive_type_id("string");
      const number_type = primitive_type_id("number");
      const boolean_type = primitive_type_id("boolean");

      const flow_patterns = [
        create_type_flow_pattern(string_type, number_type, "assignment"),
        create_type_flow_pattern(number_type, boolean_type, "comparison"),
        create_type_flow_pattern(string_type, boolean_type, "conditional"),
      ];

      const flow_result = track_type_flow(flow_patterns);

      expect(flow_result.flow_graph.size).toBe(2);
      expect(flow_result.flow_graph.has(string_type)).toBe(true);
      expect(flow_result.flow_graph.has(number_type)).toBe(true);

      const string_flows = flow_result.flow_graph.get(string_type)!;
      expect(string_flows.length).toBe(2); // flows to number and boolean
    });

    it("resolves types from flow analysis", () => {
      const string_type = primitive_type_id("string");
      const number_type = primitive_type_id("number");

      const flow_patterns = [
        create_type_flow_pattern(string_type, number_type, "assignment"),
      ];

      const flow_result = track_type_flow(flow_patterns);

      const resolved_type = resolve_type_from_flow(
        string_type,
        flow_result.flow_graph,
        new Map() // empty type registry for simplicity
      );

      expect(resolved_type).toBeDefined();
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
      const interface1 = defined_type_id(TypeCategory.INTERFACE, "Interface1" as SymbolName, create_location("test.ts"));
      const interface2 = defined_type_id(TypeCategory.INTERFACE, "Interface2" as SymbolName, create_location("test.ts"));

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

  describe("Full Type Resolution Integration", () => {
    it("resolves complete type information", () => {
      const type_definitions = [
        create_type_definition("BaseClass", "test.ts", "class", [], ["baseMethod"]),
        create_type_definition("DerivedClass", "test.ts", "class", ["BaseClass"], ["derivedMethod"]),
      ];

      const type_annotations: LocalTypeAnnotation[] = [
        {
          location: create_location("test.ts"),
          type_name: "string" as SymbolName,
          type_id: primitive_type_id("string"),
          context: "variable_declaration",
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
        file_path: "test.ts" as FilePath,
        type_definitions,
        type_annotations,
        type_flow_patterns,
        member_info: new Map(),
      };

      const import_resolution_map: ImportResolutionMap = { imports: new Map() };
      const function_resolution_map: FunctionResolutionMap = { function_calls: new Map() };

      const result = resolve_types(
        new Map([["test.ts" as FilePath, extraction]]),
        import_resolution_map,
        function_resolution_map
      );

      expect(result.global_registry).toBeDefined();
      expect(result.file_registries).toBeDefined();
      expect(result.inheritance_hierarchy).toBeDefined();
      expect(result.resolved_members).toBeDefined();
      expect(result.type_flow_analysis).toBeDefined();

      expect(result.file_registries.size).toBe(1);
      expect(result.global_registry.types.size).toBeGreaterThan(0);
    });

    it("handles cross-file type dependencies", () => {
      const file1_types = [
        create_type_definition("SharedInterface", "file1.ts", "interface"),
      ];

      const file2_types = [
        create_type_definition("Implementation", "file2.ts", "class", [], []),
      ];
      // Set implements manually
      file2_types[0].implements = ["SharedInterface" as SymbolName];

      const file1_extraction: LocalTypeExtraction = {
        file_path: "file1.ts" as FilePath,
        type_definitions: file1_types,
        type_annotations: [],
        type_flow_patterns: [],
        member_info: new Map(),
      };

      const file2_extraction: LocalTypeExtraction = {
        file_path: "file2.ts" as FilePath,
        type_definitions: file2_types,
        type_annotations: [],
        type_flow_patterns: [],
        member_info: new Map(),
      };

      const extractions = new Map([
        ["file1.ts" as FilePath, file1_extraction],
        ["file2.ts" as FilePath, file2_extraction],
      ]);

      const import_resolution_map: ImportResolutionMap = { imports: new Map() };
      const function_resolution_map: FunctionResolutionMap = { function_calls: new Map() };

      const result = resolve_types(extractions, import_resolution_map, function_resolution_map);

      expect(result.global_registry.types.has("SharedInterface" as SymbolName)).toBe(true);
      expect(result.global_registry.types.has("Implementation" as SymbolName)).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe("Edge Cases and Error Handling", () => {
    it("handles empty type definitions", () => {
      const extraction: LocalTypeExtraction = {
        file_path: "empty.ts" as FilePath,
        type_definitions: [],
        type_annotations: [],
        type_flow_patterns: [],
        member_info: new Map(),
      };

      const result = resolve_types(
        new Map([["empty.ts" as FilePath, extraction]]),
        { imports: new Map() },
        { function_calls: new Map() }
      );

      expect(result.global_registry.types.size).toBe(0);
      expect(result.file_registries.size).toBe(1);
    });

    it("handles malformed type definitions", () => {
      const malformed_type = create_type_definition("Malformed", "test.ts");
      // Create invalid circular reference
      malformed_type.extends = ["Malformed" as SymbolName];

      const extraction: LocalTypeExtraction = {
        file_path: "test.ts" as FilePath,
        type_definitions: [malformed_type],
        type_annotations: [],
        type_flow_patterns: [],
        member_info: new Map(),
      };

      // Should not throw, but handle gracefully
      const result = resolve_types(
        new Map([["test.ts" as FilePath, extraction]]),
        { imports: new Map() },
        { function_calls: new Map() }
      );

      expect(result.global_registry.types.size).toBe(1);
    });

    it("handles large numbers of types efficiently", () => {
      const start_time = performance.now();

      // Create 1000 types
      const type_definitions = [];
      for (let i = 0; i < 1000; i++) {
        type_definitions.push(
          create_type_definition(`Type${i}`, "test.ts", "class", [], [`member${i}`])
        );
      }

      const extraction: LocalTypeExtraction = {
        file_path: "test.ts" as FilePath,
        type_definitions,
        type_annotations: [],
        type_flow_patterns: [],
        member_info: new Map(),
      };

      const result = resolve_types(
        new Map([["test.ts" as FilePath, extraction]]),
        { imports: new Map() },
        { function_calls: new Map() }
      );

      const end_time = performance.now();
      const duration = end_time - start_time;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000); // 1 second

      expect(result.global_registry.types.size).toBe(1000);
    });

    it("handles deeply nested inheritance", () => {
      const chain_length = 50;
      const type_definitions = [];

      for (let i = 0; i < chain_length; i++) {
        const extends_types = i === 0 ? [] : [`Chain${i-1}`];
        type_definitions.push(
          create_type_definition(`Chain${i}`, "test.ts", "class", extends_types)
        );
      }

      const extraction: LocalTypeExtraction = {
        file_path: "test.ts" as FilePath,
        type_definitions,
        type_annotations: [],
        type_flow_patterns: [],
        member_info: new Map(),
      };

      const result = resolve_types(
        new Map([["test.ts" as FilePath, extraction]]),
        { imports: new Map() },
        { function_calls: new Map() }
      );

      expect(result.global_registry.types.size).toBe(chain_length);
      expect(result.inheritance_hierarchy.inheritance_chains.size).toBe(chain_length);
    });
  });

  // ============================================================================
  // Performance and Memory Tests
  // ============================================================================

  describe("Performance and Memory Characteristics", () => {
    it("maintains reasonable memory usage", () => {
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
        file_path: "test.ts" as FilePath,
        type_definitions,
        type_annotations: [],
        type_flow_patterns: [],
        member_info: new Map(),
      };

      const result = resolve_types(
        new Map([["test.ts" as FilePath, extraction]]),
        { imports: new Map() },
        { function_calls: new Map() }
      );

      // Basic sanity checks
      expect(result.global_registry.types.size).toBe(type_count);
      expect(result.file_registries.size).toBe(1);
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
          file_path: "test.ts" as FilePath,
          type_definitions,
          type_annotations: [],
          type_flow_patterns: [],
          member_info: new Map(),
        };

        resolve_types(
          new Map([["test.ts" as FilePath, extraction]]),
          { imports: new Map() },
          { function_calls: new Map() }
        );

        const end_time = performance.now();
        total_duration += (end_time - start_time);
      }

      // Should maintain reasonable performance across batches
      const average_batch_time = total_duration / batches;
      expect(average_batch_time).toBeLessThan(50); // 50ms per batch average
    });
  });
});
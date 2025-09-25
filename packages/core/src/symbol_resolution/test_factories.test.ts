/**
 * Test Factories Verification Tests
 *
 * This test file verifies that the mock factories create properly structured data
 * that matches the actual semantic index interfaces.
 */

import { describe, it, expect } from "vitest";
import type { FilePath, SymbolName, Location, LocationKey, SymbolId, TypeId, ScopeId } from "@ariadnejs/types";
import {
  mock_location,
  mock_semantic_index,
  mock_symbol_definition,
  mock_call_reference,
  mock_member_access_reference,
  mock_return_reference,
  mock_import,
  mock_export,
  mock_local_type_info,
  create_function_scenario,
  create_class_method_scenario,
  create_import_export_scenario,
  readonly_map_from_entries,
  readonly_set_from_items,
  ReadonlyMapBuilder,
  NestedReadonlyMapBuilder,
  create_type_resolution_builder,
  create_import_resolution_builder,
  update_readonly_map,
  update_nested_readonly_map,
} from "./test_factories";

describe("Test Factories", () => {
  const test_file = "test.ts" as FilePath;
  const test_location = mock_location(test_file, 1, 0);

  describe("Basic Factories", () => {
    it("should create valid Location objects", () => {
      const location = mock_location(test_file, 5, 10, 5, 20);

      expect(location.file_path).toBe(test_file);
      expect(location.line).toBe(5);
      expect(location.column).toBe(10);
      expect(location.end_line).toBe(5);
      expect(location.end_column).toBe(20);
    });

    it("should create valid SymbolDefinition objects", () => {
      const symbol = mock_symbol_definition(
        "testFunction" as SymbolName,
        "function",
        test_location
      );

      expect(symbol.name).toBe("testFunction");
      expect(symbol.kind).toBe("function");
      expect(symbol.location).toBe(test_location);
      expect(symbol.is_hoisted).toBe(true); // Functions are hoisted by default
      expect(symbol.is_exported).toBe(false);
      expect(symbol.is_imported).toBe(false);
    });

    it("should create valid CallReference objects", () => {
      const call = mock_call_reference(
        "testFunction" as SymbolName,
        test_location,
        "scope:global" as ScopeId
      );

      expect(call.name).toBe("testFunction");
      expect(call.location).toBe(test_location);
      expect(call.call_type).toBe("function");
    });
  });

  describe("SemanticIndex Factory", () => {
    it("should create valid SemanticIndex with defaults", () => {
      const index = mock_semantic_index(test_file);

      expect(index.file_path).toBe(test_file);
      expect(index.language).toBe("typescript");
      expect(index.scopes).toBeInstanceOf(Map);
      expect(index.symbols).toBeInstanceOf(Map);
      expect(index.references).toBeDefined();
      expect(index.references.calls).toEqual([]);
      expect(index.imports).toEqual([]);
      expect(index.exports).toEqual([]);
    });

    it("should create SemanticIndex with custom options", () => {
      const symbol = mock_symbol_definition(
        "testFunc" as SymbolName,
        "function",
        test_location
      );
      const symbols = new Map([[symbol.id, symbol]]);

      const call = mock_call_reference(
        "testFunc" as SymbolName,
        test_location,
        "scope:global" as ScopeId
      );

      const index = mock_semantic_index(test_file, {
        language: "javascript",
        symbols,
        calls: [call],
      });

      expect(index.language).toBe("javascript");
      expect(index.symbols.size).toBe(1);
      expect(index.references.calls).toHaveLength(1);
      expect(index.references.calls[0]).toBe(call);
    });
  });

  describe("ReadonlyMap Utilities", () => {
    it("should create ReadonlyMap from entries", () => {
      const entries: [string, number][] = [
        ["a", 1],
        ["b", 2],
      ];
      const readonly_map = readonly_map_from_entries(entries);

      expect(readonly_map.get("a")).toBe(1);
      expect(readonly_map.get("b")).toBe(2);
      expect(readonly_map.size).toBe(2);
    });

    it("should create ReadonlySet from items", () => {
      const items = ["a", "b", "c"];
      const readonly_set = readonly_set_from_items(items);

      expect(readonly_set.has("a")).toBe(true);
      expect(readonly_set.has("b")).toBe(true);
      expect(readonly_set.has("d")).toBe(false);
      expect(readonly_set.size).toBe(3);
    });
  });

  describe("Advanced ReadonlyMap Utilities", () => {
    describe("ReadonlyMapBuilder", () => {
      it("should build ReadonlyMap incrementally", () => {
        const builder = new ReadonlyMapBuilder<string, number>();

        const result = builder.set("a", 1).set("b", 2).set("c", 3).build();

        expect(result.get("a")).toBe(1);
        expect(result.get("b")).toBe(2);
        expect(result.get("c")).toBe(3);
        expect(result.size).toBe(3);
      });

      it("should return mutable Map when needed for interface compatibility", () => {
        const builder = new ReadonlyMapBuilder<string, number>();

        const mutable_map = builder.set("x", 10).set("y", 20).build_mutable();

        expect(mutable_map).toBeInstanceOf(Map);
        expect(mutable_map.get("x")).toBe(10);
        expect(mutable_map.get("y")).toBe(20);

        // Verify it's actually mutable
        mutable_map.set("z", 30);
        expect(mutable_map.get("z")).toBe(30);
      });
    });

    describe("NestedReadonlyMapBuilder", () => {
      it("should build nested ReadonlyMap structures", () => {
        const builder = new NestedReadonlyMapBuilder<string, string, number>();

        const result = builder
          .set_nested("group1", [
            ["a", 1],
            ["b", 2],
          ])
          .set_nested("group2", [
            ["x", 10],
            ["y", 20],
          ])
          .build();

        expect(result.size).toBe(2);

        const group1 = result.get("group1");
        expect(group1?.get("a")).toBe(1);
        expect(group1?.get("b")).toBe(2);

        const group2 = result.get("group2");
        expect(group2?.get("x")).toBe(10);
        expect(group2?.get("y")).toBe(20);
      });

      it("should work with ReadonlyMapBuilder for nested construction", () => {
        const nested_builder = new ReadonlyMapBuilder<string, number>()
          .set("item1", 100)
          .set("item2", 200);

        const main_builder = new NestedReadonlyMapBuilder<
          string,
          string,
          number
        >();
        const result = main_builder
          .set_nested_builder("container", nested_builder)
          .build();

        const container = result.get("container");
        expect(container?.get("item1")).toBe(100);
        expect(container?.get("item2")).toBe(200);
      });

      it("should build mutable nested structures for interface compatibility", () => {
        const builder = new NestedReadonlyMapBuilder<string, string, number>();

        const mutable_nested = builder
          .set_nested("group1", [
            ["a", 1],
            ["b", 2],
          ])
          .build_mutable_nested();

        expect(mutable_nested).toBeInstanceOf(Map);
        const group1 = mutable_nested.get("group1");
        expect(group1).toBeInstanceOf(Map);
        expect(group1?.get("a")).toBe(1);

        // Verify both levels are mutable
        group1?.set("c", 3);
        mutable_nested.set("group2", new Map([["x", 10]]));

        expect(group1?.get("c")).toBe(3);
        expect(mutable_nested.get("group2")?.get("x")).toBe(10);
      });
    });

    describe("Type Resolution Builder", () => {
      it("should create properly structured type resolution data", () => {
        const builders = create_type_resolution_builder();

        // Build some test data
        builders.symbol_types.set("symbol1" as SymbolId, "type1" as TypeId);
        builders.type_members.set_nested("type1" as TypeId, [
          ["member1" as SymbolName, "member_symbol1" as SymbolId],
          ["member2" as SymbolName, "member_symbol2" as SymbolId],
        ]);
        builders.constructors.set("type1" as TypeId, "constructor_symbol" as SymbolId);

        const result = {
          symbol_types: builders.symbol_types.build(),
          reference_types: builders.reference_types.build(),
          type_members: builders.type_members.build(),
          constructors: builders.constructors.build(),
          inheritance_hierarchy: builders.inheritance_hierarchy.build(),
          interface_implementations: builders.interface_implementations.build(),
        };

        expect(result.symbol_types.get("symbol1" as SymbolId)).toBe("type1" as TypeId);
        expect(
          result.type_members.get("type1" as TypeId)?.get("member1" as SymbolName)
        ).toBe("member_symbol1");
        expect(result.constructors.get("type1" as TypeId)).toBe("constructor_symbol" as SymbolId);
      });
    });

    describe("Import Resolution Builder", () => {
      it("should create properly structured import resolution data", () => {
        const builders = create_import_resolution_builder();

        builders.imports.set_nested("file1.ts" as FilePath, [
          ["import1" as SymbolName, "symbol1" as SymbolId],
          ["import2" as SymbolName, "symbol2" as SymbolId],
        ]);
        builders.unresolved_imports.set(
          "location1" as LocationKey,
          "unresolved" as SymbolName
        );

        const result = {
          imports: builders.imports.build(),
          unresolved_imports: builders.unresolved_imports.build(),
        };

        expect(
          result.imports
            .get("file1.ts" as FilePath)
            ?.get("import1" as SymbolName)
        ).toBe("symbol1");
        expect(result.unresolved_imports.get("location1" as LocationKey)).toBe("unresolved");
      });
    });

    describe("Immutable Update Utilities", () => {
      it("should update ReadonlyMap immutably", () => {
        const original = readonly_map_from_entries([
          ["a", 1],
          ["b", 2],
        ]);
        const updated = update_readonly_map(original, [
          ["b", 20],
          ["c", 3],
        ]);

        // Original unchanged
        expect(original.get("b")).toBe(2);
        expect(original.has("c")).toBe(false);

        // Updated version has changes
        expect(updated.get("a")).toBe(1); // preserved
        expect(updated.get("b")).toBe(20); // updated
        expect(updated.get("c")).toBe(3); // added
      });

      it("should update nested ReadonlyMap immutably", () => {
        const builder = new NestedReadonlyMapBuilder<string, string, number>();
        const original = builder
          .set_nested("group1", [
            ["a", 1],
            ["b", 2],
          ])
          .set_nested("group2", [["x", 10]])
          .build();

        const updated = update_nested_readonly_map(original, "group1", [
          ["b", 20],
          ["c", 3],
        ]);

        // Original group1 unchanged
        expect(original.get("group1")?.get("b")).toBe(2);
        expect(original.get("group1")?.has("c")).toBe(false);

        // Updated group1 has changes
        expect(updated.get("group1")?.get("a")).toBe(1); // preserved
        expect(updated.get("group1")?.get("b")).toBe(20); // updated
        expect(updated.get("group1")?.get("c")).toBe(3); // added

        // Other groups unchanged
        expect(updated.get("group2")?.get("x")).toBe(10);
      });
    });
  });

  describe("Test Scenarios", () => {
    it("should create function scenario", () => {
      const scenario = create_function_scenario(test_file);

      expect(scenario.index.file_path).toBe(test_file);
      expect(scenario.function_symbol.kind).toBe("function");
      expect(scenario.function_symbol.name).toBe("testFunction");
      expect(scenario.call_reference.name).toBe("testFunction");
      expect(scenario.index.symbols.size).toBe(1);
      expect(scenario.index.references.calls).toHaveLength(1);
    });

    it("should create class method scenario", () => {
      const scenario = create_class_method_scenario(test_file);

      expect(scenario.index.file_path).toBe(test_file);
      expect(scenario.class_symbol.kind).toBe("class");
      expect(scenario.method_symbol.kind).toBe("method");
      expect(scenario.member_access.member_name).toBe("testMethod");
      expect(scenario.index.symbols.size).toBe(2);
      expect(scenario.index.references.member_accesses).toHaveLength(1);
    });

    it("should create import/export scenario", () => {
      const scenario = create_import_export_scenario();

      expect(scenario.exporter_index.exports).toHaveLength(1);
      expect(scenario.importer_index.imports).toHaveLength(1);
      expect(scenario.exported_symbol.is_exported).toBe(true);
      expect(scenario.import_ref.kind).toBe("named");
      expect(scenario.export_ref.kind).toBe("named");
    });
  });

  describe("Type System Factories", () => {
    it("should create LocalTypeInfo", () => {
      const type_info = mock_local_type_info(
        "TestClass" as SymbolName,
        test_location
      );

      expect(type_info.type_name).toBe("TestClass");
      expect(type_info.kind).toBe("class");
      expect(type_info.location).toBe(test_location);
      expect(type_info.direct_members).toBeInstanceOf(Map);
    });
  });
});

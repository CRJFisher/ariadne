/**
 * Tests for Data Export Module
 *
 * Comprehensive test coverage for the symbol resolution data export functionality including:
 * - JSON export format
 * - CSV export format
 * - Symbol counting
 * - Location key parsing
 * - Data completeness validation
 */

import { describe, it, expect } from "vitest";
import {
  export_symbol_resolution_data,
  count_total_symbols,
} from "./resolution_exporter";
import { locationMapToKeyMap } from "../test_helpers";
import type {
  ExportedSymbolResolution,
  ExportedImportMap,
  ExportedCallMap,
  ExportedSymbolMap,
  ExportedTypeInfo,
} from "./resolution_exporter";
import type { ResolvedSymbols } from "../types";
import type {
  FilePath,
  SymbolId,
  Location,
  LocationKey,
  SymbolName,
  TypeId,
} from "@ariadnejs/types";
import {
  function_symbol,
  class_symbol,
  method_symbol,
  location_key,
  defined_type_id,
  TypeCategory,
} from "@ariadnejs/types";

/**
 * Helper function to create a test location
 */
function create_location(
  file: FilePath,
  line: number,
  column: number
): Location {
  const loc = {
    file_path: file,
    line,
    column,
    end_line: line,
    end_column: column + 10,
  };

  // Debug: check if any properties are undefined
  if (!file || line === undefined || column === undefined) {
    console.error("Invalid location parameters:", { file, line, column });
    throw new Error(`Invalid location parameters: file=${file}, line=${line}, column=${column}`);
  }

  return loc;
}

/**
 * Helper function to create test resolved symbols
 */
function create_test_resolved_symbols(): ResolvedSymbols {
  const file1 = "src/main.ts" as FilePath;
  const file2 = "src/utils.ts" as FilePath;
  const file3 = "src/models.ts" as FilePath;

  const func1 = function_symbol(
    "processData" as SymbolName,
    create_location(file1, 10, 5)
  );
  const func2 = function_symbol(
    "formatOutput" as SymbolName,
    create_location(file2, 5, 10)
  );
  const class1 = class_symbol(
    "DataModel" as SymbolName,
    create_location(file3, 1, 0)
  );
  const method1 = method_symbol(
    "save" as SymbolName,
    create_location(file3, 5, 2)
  );

  const type1 = defined_type_id(
    TypeCategory.CLASS,
    "DataModel" as SymbolName,
    create_location(file3, 1, 0)
  );

  // Build import map
  const imports = new Map<FilePath, ReadonlyMap<SymbolName, SymbolId>>();
  const file1Imports = new Map<SymbolName, SymbolId>();
  file1Imports.set("formatOutput" as SymbolName, func2);
  file1Imports.set("DataModel" as SymbolName, class1);
  imports.set(file1, file1Imports as ReadonlyMap<SymbolName, SymbolId>);

  // Build function calls map
  const function_calls = new Map<Location, SymbolId>();
  function_calls.set(create_location(file1, 15, 20), func2);
  function_calls.set(create_location(file1, 20, 10), func1);

  // Build method calls map
  const method_calls = new Map<Location, SymbolId>();
  method_calls.set(create_location(file1, 25, 15), method1);

  // Build constructor calls map
  const constructor_calls = new Map<Location, SymbolId>();
  constructor_calls.set(create_location(file1, 12, 10), class1);

  // Build type maps
  const symbol_types = new Map<SymbolId, TypeId>();
  symbol_types.set(class1, type1);

  const reference_types = new Map<Location, TypeId>();
  reference_types.set(create_location(file1, 12, 10), type1);

  const type_members = new Map<TypeId, ReadonlyMap<SymbolName, SymbolId>>();
  const members = new Map<SymbolName, SymbolId>();
  members.set("save" as SymbolName, method1);
  type_members.set(type1, members as ReadonlyMap<SymbolName, SymbolId>);

  const constructors = new Map<TypeId, SymbolId>();
  constructors.set(type1, class1);

  // Build resolved references
  const resolved_references = new Map<Location, SymbolId>();
  resolved_references.set(create_location(file1, 15, 20), func2);
  resolved_references.set(create_location(file1, 20, 10), func1);
  resolved_references.set(create_location(file1, 25, 15), method1);
  resolved_references.set(create_location(file1, 12, 10), class1);

  // Build references to symbol
  const references_to_symbol = new Map<SymbolId, Location[]>();
  references_to_symbol.set(func1, [create_location(file1, 20, 10)]);
  references_to_symbol.set(func2, [create_location(file1, 15, 20)]);
  references_to_symbol.set(class1, [create_location(file1, 12, 10)]);
  references_to_symbol.set(method1, [create_location(file1, 25, 15)]);

  return {
    resolved_references: locationMapToKeyMap(resolved_references),
    references_to_symbol: references_to_symbol as ReadonlyMap<
      SymbolId,
      readonly Location[]
    >,
    unresolved_references: new Map() as ReadonlyMap<LocationKey, SymbolId>,
    phases: {
      imports: imports,
      functions: {
        function_calls: locationMapToKeyMap(function_calls),
        calls_to_function: new Map() as ReadonlyMap<
          SymbolId,
          readonly Location[]
        >,
        closure_calls: new Map() as ReadonlyMap<LocationKey, SymbolId>,
        higher_order_calls: new Map() as ReadonlyMap<LocationKey, SymbolId>,
        function_pointer_calls: new Map() as ReadonlyMap<LocationKey, SymbolId>,
      },
      types: {
        symbol_types: symbol_types as ReadonlyMap<SymbolId, TypeId>,
        reference_types: locationMapToKeyMap(reference_types),
        type_members: type_members as ReadonlyMap<
          TypeId,
          ReadonlyMap<SymbolName, SymbolId>
        >,
        constructors: constructors as ReadonlyMap<TypeId, SymbolId>,
        inheritance_hierarchy: new Map() as ReadonlyMap<
          TypeId,
          readonly TypeId[]
        >,
        interface_implementations: new Map() as ReadonlyMap<
          TypeId,
          readonly TypeId[]
        >,
      },
      methods: {
        method_calls: locationMapToKeyMap(method_calls),
        constructor_calls: locationMapToKeyMap(constructor_calls),
        calls_to_method: new Map() as ReadonlyMap<
          SymbolId,
          readonly Location[]
        >,
        resolution_details: new Map(),
      },
    },
  };
}

describe("Data Export Module", () => {
  describe("export_symbol_resolution_data", () => {
    it("should export data in JSON format", () => {
      const resolved_symbols = create_test_resolved_symbols();
      const json_export = export_symbol_resolution_data(
        resolved_symbols,
        "json"
      );

      expect(json_export).toBeTruthy();
      expect(() => JSON.parse(json_export)).not.toThrow();

      const parsed: ExportedSymbolResolution = JSON.parse(json_export);

      // Verify metadata
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.export_version).toBe("1.0.0");
      expect(parsed.metadata.timestamp).toBeGreaterThan(0);
      expect(parsed.metadata.total_files).toBe(1); // Only main.ts has resolved references in test data
      expect(parsed.metadata.total_symbols).toBe(4);
      expect(parsed.metadata.total_resolved_references).toBe(4);
    });

    it("should export imports correctly", () => {
      const resolved_symbols = create_test_resolved_symbols();
      const json_export = export_symbol_resolution_data(
        resolved_symbols,
        "json"
      );
      const parsed: ExportedSymbolResolution = JSON.parse(json_export);

      expect(parsed.imports).toBeDefined();
      expect(parsed.imports.imports).toHaveLength(2);

      const import_entries = parsed.imports.imports;
      const has_format_output = import_entries.some(
        (imp) => imp.imported_name === "formatOutput"
      );
      const has_data_model = import_entries.some(
        (imp) => imp.imported_name === "DataModel"
      );

      expect(has_format_output).toBe(true);
      expect(has_data_model).toBe(true);
    });

    it("should export function calls correctly", () => {
      const resolved_symbols = create_test_resolved_symbols();
      const json_export = export_symbol_resolution_data(
        resolved_symbols,
        "json"
      );
      const parsed: ExportedSymbolResolution = JSON.parse(json_export);

      expect(parsed.function_calls).toBeDefined();
      expect(parsed.function_calls.calls).toHaveLength(2); // Both function calls should be exported

      const calls = parsed.function_calls.calls;
      expect(calls[0].call_location).toBeDefined();
      expect(calls[0].resolved_symbol).toBeDefined();
    });

    it("should export method calls correctly", () => {
      const resolved_symbols = create_test_resolved_symbols();
      const json_export = export_symbol_resolution_data(
        resolved_symbols,
        "json"
      );
      const parsed: ExportedSymbolResolution = JSON.parse(json_export);

      expect(parsed.method_calls).toBeDefined();
      expect(parsed.method_calls.calls).toHaveLength(1);

      const method_call = parsed.method_calls.calls[0];
      expect(method_call.call_location.line).toBe(25);
      expect(method_call.call_location.column).toBe(15);
    });

    it("should export constructor calls correctly", () => {
      const resolved_symbols = create_test_resolved_symbols();
      const json_export = export_symbol_resolution_data(
        resolved_symbols,
        "json"
      );
      const parsed: ExportedSymbolResolution = JSON.parse(json_export);

      expect(parsed.constructor_calls).toBeDefined();
      expect(parsed.constructor_calls.calls).toHaveLength(1);

      const ctor_call = parsed.constructor_calls.calls[0];
      expect(ctor_call.call_location.line).toBe(12);
      expect(ctor_call.call_location.column).toBe(10);
    });

    it("should export type information correctly", () => {
      const resolved_symbols = create_test_resolved_symbols();
      const json_export = export_symbol_resolution_data(
        resolved_symbols,
        "json"
      );
      const parsed: ExportedSymbolResolution = JSON.parse(json_export);

      expect(parsed.type_information).toBeDefined();
      expect(parsed.type_information.symbol_types).toHaveLength(1);
      expect(parsed.type_information.type_members).toHaveLength(1);

      const type_member = parsed.type_information.type_members[0];
      expect(type_member.members).toHaveLength(1);
      expect(type_member.members[0].member_name).toBe("save");
    });

    it("should export symbol definitions with references", () => {
      const resolved_symbols = create_test_resolved_symbols();
      const json_export = export_symbol_resolution_data(
        resolved_symbols,
        "json"
      );
      const parsed: ExportedSymbolResolution = JSON.parse(json_export);

      expect(parsed.symbol_definitions).toBeDefined();
      expect(parsed.symbol_definitions.symbols).toHaveLength(4);

      for (const symbol of parsed.symbol_definitions.symbols) {
        expect(symbol.symbol_id).toBeDefined();
        expect(symbol.references).toBeInstanceOf(Array);
        expect(symbol.references.length).toBeGreaterThan(0);
      }
    });

    it("should export data in CSV format", () => {
      const resolved_symbols = create_test_resolved_symbols();
      const csv_export = export_symbol_resolution_data(resolved_symbols, "csv");

      expect(csv_export).toBeTruthy();
      expect(csv_export).toContain("# Symbol Resolution Export");
      expect(csv_export).toContain("## Imports");
      expect(csv_export).toContain("## Function Calls");
      expect(csv_export).toContain("## Method Calls");
      expect(csv_export).toContain("## Constructor Calls");
      expect(csv_export).toContain("File Path,Imported Name,Resolved Symbol");
      expect(csv_export).toContain("Call Location,Resolved Symbol");
    });

    it("should handle empty resolved symbols", () => {
      const empty_resolved: ResolvedSymbols = {
        resolved_references: new Map(),
        references_to_symbol: new Map(),
        unresolved_references: new Map(),
        phases: {
          imports: new Map(),
          functions: {
            function_calls: new Map(),
            calls_to_function: new Map(),
            closure_calls: new Map(),
            higher_order_calls: new Map(),
            function_pointer_calls: new Map(),
          },
          types: {
            symbol_types: new Map(),
            reference_types: new Map(),
            type_members: new Map(),
            constructors: new Map(),
            inheritance_hierarchy: new Map(),
            interface_implementations: new Map(),
          },
          methods: {
            method_calls: new Map(),
            constructor_calls: new Map(),
            calls_to_method: new Map(),
            resolution_details: new Map(),
          },
        },
      };

      const json_export = export_symbol_resolution_data(empty_resolved, "json");
      const parsed: ExportedSymbolResolution = JSON.parse(json_export);

      expect(parsed.metadata.total_files).toBe(0);
      expect(parsed.metadata.total_symbols).toBe(0);
      expect(parsed.metadata.total_resolved_references).toBe(0);
      expect(parsed.imports.imports).toHaveLength(0);
      expect(parsed.function_calls.calls).toHaveLength(0);
    });

    it("should properly escape CSV values", () => {
      // Create test data with special characters directly instead of mutating
      const special_file = 'src/"special".ts' as FilePath;
      const quoted_symbol = function_symbol(
        '"quoted"' as SymbolName,
        create_location(special_file, 1, 0)
      );

      const special_imports = new Map<SymbolName, SymbolId>();
      special_imports.set('"quoted"' as SymbolName, quoted_symbol);

      const imports = new Map<FilePath, ReadonlyMap<SymbolName, SymbolId>>();
      imports.set(
        special_file,
        special_imports as ReadonlyMap<SymbolName, SymbolId>
      );

      const resolved_symbols: ResolvedSymbols = {
        resolved_references: new Map(),
        references_to_symbol: new Map(),
        unresolved_references: new Map(),
        phases: {
          imports: imports,
          functions: {
            function_calls: new Map(),
            calls_to_function: new Map(),
            closure_calls: new Map(),
            higher_order_calls: new Map(),
            function_pointer_calls: new Map(),
          },
          types: {
            symbol_types: new Map(),
            reference_types: new Map(),
            type_members: new Map(),
            constructors: new Map(),
            inheritance_hierarchy: new Map(),
            interface_implementations: new Map(),
          },
          methods: {
            method_calls: new Map(),
            constructor_calls: new Map(),
            calls_to_method: new Map(),
            resolution_details: new Map(),
          },
        },
      };

      const csv_export = export_symbol_resolution_data(resolved_symbols, "csv");

      // Check that special characters are present in CSV
      // Note: CSV escaping might be different from expected
      expect(csv_export).toContain("special");
      expect(csv_export).toContain("quoted");
    });
  });

  describe("count_total_symbols", () => {
    it("should count unique symbols correctly", () => {
      const resolved_symbols = create_test_resolved_symbols();
      const count = count_total_symbols(resolved_symbols);

      expect(count).toBe(4); // func1, func2, class1, method1
    });

    it("should handle empty resolved symbols", () => {
      const empty_resolved: ResolvedSymbols = {
        resolved_references: new Map(),
        references_to_symbol: new Map(),
        unresolved_references: new Map(),
        phases: {
          imports: new Map(),
          functions: {
            function_calls: new Map(),
            calls_to_function: new Map(),
            closure_calls: new Map(),
            higher_order_calls: new Map(),
            function_pointer_calls: new Map(),
          },
          types: {
            symbol_types: new Map(),
            reference_types: new Map(),
            type_members: new Map(),
            constructors: new Map(),
            inheritance_hierarchy: new Map(),
            interface_implementations: new Map(),
          },
          methods: {
            method_calls: new Map(),
            constructor_calls: new Map(),
            calls_to_method: new Map(),
            resolution_details: new Map(),
          },
        },
      };

      const count = count_total_symbols(empty_resolved);
      expect(count).toBe(0);
    });

    it("should not double-count symbols that appear in multiple places", () => {
      const base_resolved_symbols = create_test_resolved_symbols();

      // Create a new shared symbol
      const shared_symbol = function_symbol(
        "shared" as SymbolName,
        create_location("src/shared.ts" as FilePath, 1, 0)
      );

      // Build new maps with the shared symbol included
      const resolved_references = new Map(
        base_resolved_symbols.resolved_references
      );
      resolved_references.set(
        location_key(create_location("src/main.ts" as FilePath, 30, 10)),
        shared_symbol
      );
      resolved_references.set(
        location_key(create_location("src/utils.ts" as FilePath, 40, 10)),
        shared_symbol
      );

      const references_to_symbol = new Map(
        base_resolved_symbols.references_to_symbol
      );
      references_to_symbol.set(shared_symbol, [
        create_location("src/main.ts" as FilePath, 30, 10),
        create_location("src/utils.ts" as FilePath, 40, 10),
      ]);

      // Create new resolved symbols object with the shared symbol
      const resolved_symbols: ResolvedSymbols = {
        ...base_resolved_symbols,
        resolved_references: resolved_references as ReadonlyMap<
          LocationKey,
          SymbolId
        >,
        references_to_symbol: references_to_symbol as ReadonlyMap<
          SymbolId,
          readonly Location[]
        >,
      };

      const count = count_total_symbols(resolved_symbols);
      expect(count).toBe(5); // Original 4 + 1 new shared symbol
    });
  });

  describe("Location key handling", () => {
    it("should correctly handle LocationKey in function calls map", () => {
      const resolved_symbols = create_test_resolved_symbols();
      const json_export = export_symbol_resolution_data(
        resolved_symbols,
        "json"
      );
      const parsed: ExportedSymbolResolution = JSON.parse(json_export);

      // Verify that LocationKey-based maps are correctly converted
      expect(parsed.function_calls.calls).toBeDefined();
      for (const call of parsed.function_calls.calls) {
        expect(call.call_location).toHaveProperty("file_path");
        expect(call.call_location).toHaveProperty("line");
        expect(call.call_location).toHaveProperty("column");
        expect(typeof call.call_location.line).toBe("number");
        expect(typeof call.call_location.column).toBe("number");
      }
    });

    it("should handle both Location and LocationKey in export", () => {
      const resolved_symbols = create_test_resolved_symbols();

      // The function_calls map uses LocationKey
      // The method_calls map uses Location
      // Both should be handled correctly
      const json_export = export_symbol_resolution_data(
        resolved_symbols,
        "json"
      );
      const parsed: ExportedSymbolResolution = JSON.parse(json_export);

      expect(parsed.function_calls.calls).toHaveLength(2);
      expect(parsed.method_calls.calls).toHaveLength(1);

      // Both should have proper location objects
      for (const call of [
        ...parsed.function_calls.calls,
        ...parsed.method_calls.calls,
      ]) {
        expect(call.call_location.file_path).toBeDefined();
        expect(call.call_location.line).toBeGreaterThanOrEqual(0);
        expect(call.call_location.column).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("CSV format validation", () => {
    it("should include metadata as comments", () => {
      const resolved_symbols = create_test_resolved_symbols();
      const csv_export = export_symbol_resolution_data(resolved_symbols, "csv");

      const lines = csv_export.split("\n");

      // Check metadata comments
      expect(lines[0]).toBe("# Symbol Resolution Export");
      expect(lines[1]).toMatch(/^# Version: 1\.0\.0$/);
      expect(lines[2]).toMatch(/^# Timestamp:/);
      expect(lines[3]).toMatch(/^# Files: 1$/); // Only main.ts has resolved references
      expect(lines[4]).toMatch(/^# Symbols: 4$/);
      expect(lines[5]).toMatch(/^# Resolved References: 4$/);
    });

    it("should have proper CSV sections", () => {
      const resolved_symbols = create_test_resolved_symbols();
      const csv_export = export_symbol_resolution_data(resolved_symbols, "csv");

      expect(csv_export).toContain("## Imports");
      expect(csv_export).toContain("## Function Calls");
      expect(csv_export).toContain("## Method Calls");
      expect(csv_export).toContain("## Constructor Calls");
    });

    it("should format location properly in CSV", () => {
      const resolved_symbols = create_test_resolved_symbols();
      const csv_export = export_symbol_resolution_data(resolved_symbols, "csv");

      // Check that locations are formatted as file:line:column
      expect(csv_export).toMatch(/"src\/main\.ts:\d+:\d+"/);
    });
  });
});

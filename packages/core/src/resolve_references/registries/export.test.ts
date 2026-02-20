/**
 * Tests for export registry
 */

import { describe, it, expect, vi } from "vitest";
import { ExportRegistry } from "./export";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  VariableDefinition,
  ScopeId,
  Location,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "./definition";

/**
 * Helper to create a mock variable definition
 */
function create_variable_definition(
  name: string,
  file_path: FilePath,
  start_line: number,
  is_exported: boolean = true
): VariableDefinition {
  const location: Location = {
    file_path,
    start_line,
    start_column: 0,
    end_line: start_line,
    end_column: name.length,
  };
  return {
    kind: "variable",
    name: name as SymbolName,
    symbol_id:
      `variable:${file_path}:${start_line}:0:${start_line}:${name.length}:${name}` as SymbolId,
    defining_scope_id: `module:${file_path}` as ScopeId,
    location,
    is_exported,
  };
}

/**
 * Helper to create a mock DefinitionRegistry
 */
function create_mock_definition_registry(
  definitions: VariableDefinition[]
): DefinitionRegistry {
  return {
    get_exportable_definitions_in_file: vi
      .fn()
      .mockReturnValue(definitions),
  } as unknown as DefinitionRegistry;
}

describe("ExportRegistry", () => {
  it("should be a class", () => {
    expect(typeof ExportRegistry).toBe("function");
    expect(ExportRegistry.prototype.constructor).toBe(ExportRegistry);
  });

  it("should be instantiable", () => {
    const registry = new ExportRegistry();
    expect(registry).toBeInstanceOf(ExportRegistry);
  });

  describe("variable reassignment handling", () => {
    const file_id = "test.py" as FilePath;

    it("should prefer later definition when variable is reassigned at module level", () => {
      const var1 = create_variable_definition("predictions", file_id, 10);
      const var2 = create_variable_definition("predictions", file_id, 20);

      const registry = new ExportRegistry();
      const definitions = create_mock_definition_registry([var1, var2]);

      // Should not throw
      registry.update_file(file_id, definitions);

      // Should export the later one
      const exports = registry.get_exports(file_id);
      expect(exports.size).toBe(1);
      expect(exports.has(var2.symbol_id)).toBe(true);
      expect(exports.has(var1.symbol_id)).toBe(false);
    });

    it("should handle multiple reassignments, keeping only the last", () => {
      const var1 = create_variable_definition("x", file_id, 5);
      const var2 = create_variable_definition("x", file_id, 10);
      const var3 = create_variable_definition("x", file_id, 15);

      const registry = new ExportRegistry();
      const definitions = create_mock_definition_registry([var1, var2, var3]);

      registry.update_file(file_id, definitions);

      const exports = registry.get_exports(file_id);
      expect(exports.size).toBe(1);
      expect(exports.has(var3.symbol_id)).toBe(true);
      expect(exports.has(var1.symbol_id)).toBe(false);
      expect(exports.has(var2.symbol_id)).toBe(false);
    });

    it("should handle definitions processed in reverse order", () => {
      // If definitions happen to be processed in reverse order,
      // we should still prefer the one with the higher line number
      const var1 = create_variable_definition("data", file_id, 100);
      const var2 = create_variable_definition("data", file_id, 50);

      const registry = new ExportRegistry();
      // Note: var1 (line 100) processed first, var2 (line 50) processed second
      const definitions = create_mock_definition_registry([var1, var2]);

      registry.update_file(file_id, definitions);

      const exports = registry.get_exports(file_id);
      expect(exports.size).toBe(1);
      // Should keep var1 since it's on a later line
      expect(exports.has(var1.symbol_id)).toBe(true);
      expect(exports.has(var2.symbol_id)).toBe(false);
    });

    it("should handle multiple different variables with reassignment", () => {
      const x1 = create_variable_definition("x", file_id, 1);
      const y1 = create_variable_definition("y", file_id, 2);
      const x2 = create_variable_definition("x", file_id, 3);
      const z1 = create_variable_definition("z", file_id, 4);
      const y2 = create_variable_definition("y", file_id, 5);

      const registry = new ExportRegistry();
      const definitions = create_mock_definition_registry([x1, y1, x2, z1, y2]);

      registry.update_file(file_id, definitions);

      const exports = registry.get_exports(file_id);
      expect(exports.size).toBe(3);
      expect(exports.has(x2.symbol_id)).toBe(true); // x reassigned
      expect(exports.has(y2.symbol_id)).toBe(true); // y reassigned
      expect(exports.has(z1.symbol_id)).toBe(true); // z only defined once
    });
  });
});

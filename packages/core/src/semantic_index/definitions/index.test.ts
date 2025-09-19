/**
 * Tests for definitions module index exports
 */

import { describe, it, expect } from "vitest";
import * as DefinitionsIndex from "./index";
import { process_definitions, map_entity_to_symbol_kind } from "./definitions";

describe("Definitions Index", () => {
  describe("Exports", () => {
    it("should export process_definitions function", () => {
      expect(DefinitionsIndex.process_definitions).toBeDefined();
      expect(typeof DefinitionsIndex.process_definitions).toBe("function");
      expect(DefinitionsIndex.process_definitions).toBe(process_definitions);
    });

    it("should export map_entity_to_symbol_kind function", () => {
      expect(DefinitionsIndex.map_entity_to_symbol_kind).toBeDefined();
      expect(typeof DefinitionsIndex.map_entity_to_symbol_kind).toBe("function");
      expect(DefinitionsIndex.map_entity_to_symbol_kind).toBe(map_entity_to_symbol_kind);
    });

    it("should only export expected functions", () => {
      const exported_keys = Object.keys(DefinitionsIndex);
      expect(exported_keys).toHaveLength(2);
      expect(exported_keys).toContain("process_definitions");
      expect(exported_keys).toContain("map_entity_to_symbol_kind");
    });

    it("should export functions that are callable", () => {
      // Verify exports are actually callable (not just references)
      expect(() => {
        const func1 = DefinitionsIndex.process_definitions;
        const func2 = DefinitionsIndex.map_entity_to_symbol_kind;

        // These should be functions
        expect(typeof func1).toBe("function");
        expect(typeof func2).toBe("function");

        // Should have expected properties of functions
        expect(func1.name).toBe("process_definitions");
        expect(func2.name).toBe("map_entity_to_symbol_kind");
      }).not.toThrow();
    });
  });

  describe("Re-export integrity", () => {
    it("should maintain function signatures through re-export", () => {
      // Verify that re-exported functions maintain their original signatures
      const original_process_definitions = process_definitions;
      const exported_process_definitions = DefinitionsIndex.process_definitions;

      expect(original_process_definitions.length).toBe(exported_process_definitions.length);

      const original_map_entity = map_entity_to_symbol_kind;
      const exported_map_entity = DefinitionsIndex.map_entity_to_symbol_kind;

      expect(original_map_entity.length).toBe(exported_map_entity.length);
    });

    it("should not introduce any modifications to exported functions", () => {
      // Ensure re-exports are direct references, not wrapped functions
      expect(DefinitionsIndex.process_definitions).toBe(process_definitions);
      expect(DefinitionsIndex.map_entity_to_symbol_kind).toBe(map_entity_to_symbol_kind);
    });
  });
});
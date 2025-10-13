import { describe, it, expect, beforeEach } from "vitest";
import { TypeRegistry } from "./type_registry";
import {
  class_symbol,
  method_symbol,
  variable_symbol,
  location_key,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../index_single_file/semantic_index";
import type { FilePath, Location, LocationKey, SymbolId, SymbolName, ScopeId } from "@ariadnejs/types";

// Helper to create location keys for testing
function make_location_key(file_path: FilePath, line: number, column: number = 0): LocationKey {
  const location: Location = {
    file_path,
    start_line: line,
    start_column: column,
    end_line: line,
    end_column: column + 5,
  };
  return location_key(location);
}

// Helper to create a location object
function make_location(file_path: FilePath, start_line: number, start_column: number = 0, end_line?: number, end_column?: number): Location {
  return {
    file_path,
    start_line,
    start_column,
    end_line: end_line ?? start_line,
    end_column: end_column ?? (start_column + 5),
  };
}

// Helper to create a variable with type annotation
function make_variable_with_type(name: string, type_name: string, file_path: FilePath, line: number) {
  const location = make_location(file_path, line);
  const var_id = variable_symbol(name, location);
  return {
    id: var_id,
    def: {
      kind: "variable" as const,
      symbol_id: var_id,
      name: name as SymbolName,
      location,
      scope_id: "module:0:0" as ScopeId,
      is_exported: false,
      type: type_name as SymbolName,
    },
  };
}

// Helper to create a class with members
function make_class_with_members(name: string, file_path: FilePath, methods: string[] = [], properties: string[] = []) {
  const class_loc = make_location(file_path, 1, 0, 10, 1);
  const class_id = class_symbol(name, class_loc);

  const method_defs = methods.map((method_name, idx) => {
    const method_loc = make_location(file_path, 2 + idx, 2);
    const method_id = method_symbol(method_name, method_loc);
    return {
      kind: "method" as const,
      symbol_id: method_id,
      name: method_name as SymbolName,
      location: method_loc,
      parameters: [],
    };
  });

  const prop_defs = properties.map((prop_name, idx) => {
    const prop_loc = make_location(file_path, 2 + methods.length + idx, 2);
    const prop_id = variable_symbol(prop_name, prop_loc);
    return {
      kind: "property" as const,
      symbol_id: prop_id,
      name: prop_name as SymbolName,
      location: prop_loc,
      decorators: [],
    };
  });

  return {
    id: class_id,
    def: {
      kind: "class" as const,
      symbol_id: class_id,
      name: name as SymbolName,
      location: class_loc,
      scope_id: "module:0:0" as ScopeId,
      is_exported: false,
      extends: [],
      methods: method_defs,
      properties: prop_defs,
      decorators: [],
      constructor: [],
    },
  };
}

// Helper to create a type alias
function make_type_alias(name: string, type_expression: string, file_path: FilePath, line: number = 1) {
  const alias_loc = make_location(file_path, line);
  const alias_id = class_symbol(name, alias_loc);
  return {
    id: alias_id,
    def: {
      kind: "type" as const,
      symbol_id: alias_id,
      name: name as SymbolName,
      location: alias_loc,
      scope_id: "module:0:0" as ScopeId,
      is_exported: false,
      type_expression,
    },
  };
}

// Helper to create minimal SemanticIndex for testing
// Now accepts actual definition objects that TypeRegistry will extract from
function make_test_index(
  file_path: FilePath,
  options: {
    variables?: Map<SymbolId, any>;
    functions?: Map<SymbolId, any>;
    classes?: Map<SymbolId, any>;
    interfaces?: Map<SymbolId, any>;
    enums?: Map<SymbolId, any>;
    types?: Map<SymbolId, any>;
    references?: any[];
  } = {}
): SemanticIndex {
  return {
    file_path,
    language: "typescript",
    root_scope_id: "module:0:0" as ScopeId,
    scopes: new Map(),
    scope_to_definitions: new Map(),
    functions: options.functions || new Map(),
    classes: options.classes || new Map(),
    variables: options.variables || new Map(),
    interfaces: options.interfaces || new Map(),
    enums: options.enums || new Map(),
    namespaces: new Map(),
    types: options.types || new Map(),
    imported_symbols: new Map(),
    references: options.references || [],
    exported_symbols: new Map(),
  };
}

describe("TypeRegistry", () => {
  let registry: TypeRegistry;

  beforeEach(() => {
    registry = new TypeRegistry();
  });

  describe("update_file", () => {
    it("should add type bindings from a file", () => {
      const file1 = "file1.ts" as FilePath;
      const { id, def } = make_variable_with_type("x", "number", file1, 1);
      const loc_key = make_location_key(file1, 1);

      const index = make_test_index(file1, {
        variables: new Map([[id, def]]),
      });

      registry.update_file(file1, index);

      expect(registry.get_type_binding(loc_key)).toBe("number");
      expect(registry.size().bindings).toBe(1);
    });

    it("should add type members from a file", () => {
      const file1 = "file1.ts" as FilePath;
      const { id: class_id, def: class_def } = make_class_with_members("MyClass", file1, ["foo"]);

      const index = make_test_index(file1, {
        classes: new Map([[class_id, class_def]]),
      });

      registry.update_file(file1, index);

      const retrieved_members = registry.get_type_members(class_id);
      expect(retrieved_members).toBeDefined();
      expect(retrieved_members?.methods.get("foo" as SymbolName)).toBeDefined();
      expect(registry.size().members).toBe(1);
    });

    it("should add type aliases from a file", () => {
      const file1 = "file1.ts" as FilePath;
      const { id: alias_id, def: alias_def } = make_type_alias("MyType", "string | number", file1);

      const index = make_test_index(file1, {
        types: new Map([[alias_id, alias_def]]),
      });

      registry.update_file(file1, index);

      expect(registry.resolve_type_alias(alias_id)).toBe("string | number");
      expect(registry.size().aliases).toBe(1);
    });

    it("should replace type info when file is updated", () => {
      const file1 = "file1.ts" as FilePath;
      const loc_key_v1 = make_location_key(file1, 1, 0);
      const loc_key_v2 = make_location_key(file1, 2, 0);

      // First version
      const { id: var1_id, def: var1_def } = make_variable_with_type("x", "number", file1, 1);
      const index_v1 = make_test_index(file1, {
        variables: new Map([[var1_id, var1_def]]),
      });

      registry.update_file(file1, index_v1);
      expect(registry.size().bindings).toBe(1);
      expect(registry.get_type_binding(loc_key_v1)).toBe("number");

      // Second version (replace)
      const { id: var2_id, def: var2_def } = make_variable_with_type("y", "string", file1, 2);
      const index_v2 = make_test_index(file1, {
        variables: new Map([[var2_id, var2_def]]),
      });

      registry.update_file(file1, index_v2);

      expect(registry.size().bindings).toBe(1);
      expect(registry.get_type_binding(loc_key_v1)).toBeUndefined();
      expect(registry.get_type_binding(loc_key_v2)).toBe("string");
    });

    it("should handle files with multiple type information types", () => {
      const file1 = "file1.ts" as FilePath;

      // Create variable with type
      const { id: var_id, def: var_def } = make_variable_with_type("x", "number", file1, 1);

      // Create class with members
      const { id: class_id, def: class_def } = make_class_with_members("MyClass", file1, ["foo"]);

      // Create type alias
      const { id: alias_id, def: alias_def } = make_type_alias("MyType", "string", file1, 3);

      const index = make_test_index(file1, {
        variables: new Map([[var_id, var_def]]),
        classes: new Map([[class_id, class_def]]),
        types: new Map([[alias_id, alias_def]]),
      });

      registry.update_file(file1, index);

      expect(registry.size().bindings).toBe(1);
      expect(registry.size().members).toBe(1);
      expect(registry.size().aliases).toBe(1);
    });
  });

  describe("get_type_binding", () => {
    it("should return undefined for non-existent location", () => {
      const file1 = "file1.ts" as FilePath;
      const loc_key = make_location_key(file1, 1, 0);

      expect(registry.get_type_binding(loc_key)).toBeUndefined();
    });

    it("should retrieve type binding by location key", () => {
      const file1 = "file1.ts" as FilePath;
      const { id, def } = make_variable_with_type("x", "string", file1, 1);
      const loc_key = make_location_key(file1, 1, 0);

      const index = make_test_index(file1, {
        variables: new Map([[id, def]]),
      });

      registry.update_file(file1, index);

      expect(registry.get_type_binding(loc_key)).toBe("string");
    });
  });

  describe("get_type_members", () => {
    it("should return undefined for non-existent type", () => {
      const file1 = "file1.ts" as FilePath;
      const loc = make_location(file1, 1);
      const class_id = class_symbol("NonExistent", loc);

      expect(registry.get_type_members(class_id)).toBeUndefined();
    });

    it("should retrieve type members by symbol id", () => {
      const file1 = "file1.ts" as FilePath;
      const { id: class_id, def: class_def } = make_class_with_members("MyClass", file1, ["foo"], ["bar"]);

      const index = make_test_index(file1, {
        classes: new Map([[class_id, class_def]]),
      });

      registry.update_file(file1, index);

      const retrieved = registry.get_type_members(class_id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.methods.get("foo" as SymbolName)).toBeDefined();
      expect(retrieved?.properties.get("bar" as SymbolName)).toBeDefined();
      expect(retrieved?.extends).toEqual([]);
    });
  });

  describe("resolve_type_alias", () => {
    it("should return undefined for non-existent alias", () => {
      const file1 = "file1.ts" as FilePath;
      const loc = make_location(file1, 1);
      const alias_id = class_symbol("NonExistent", loc);

      expect(registry.resolve_type_alias(alias_id)).toBeUndefined();
    });

    it("should resolve type alias to type expression", () => {
      const file1 = "file1.ts" as FilePath;
      const { id: alias_id, def: alias_def } = make_type_alias("MyType", "string | number | boolean", file1);

      const index = make_test_index(file1, {
        types: new Map([[alias_id, alias_def]]),
      });

      registry.update_file(file1, index);

      expect(registry.resolve_type_alias(alias_id)).toBe("string | number | boolean");
    });
  });

  describe("has_type_binding", () => {
    it("should return false for non-existent location", () => {
      const file1 = "file1.ts" as FilePath;
      const loc_key = make_location_key(file1, 1, 0);

      expect(registry.has_type_binding(loc_key)).toBe(false);
    });

    it("should return true for existing location", () => {
      const file1 = "file1.ts" as FilePath;
      const { id, def } = make_variable_with_type("x", "number", file1, 1);
      const loc_key = make_location_key(file1, 1, 0);

      const index = make_test_index(file1, {
        variables: new Map([[id, def]]),
      });

      registry.update_file(file1, index);

      expect(registry.has_type_binding(loc_key)).toBe(true);
    });
  });

  describe("has_type_members", () => {
    it("should return false for non-existent type", () => {
      const file1 = "file1.ts" as FilePath;
      const loc = make_location(file1, 1);
      const class_id = class_symbol("NonExistent", loc);

      expect(registry.has_type_members(class_id)).toBe(false);
    });

    it("should return true for existing type", () => {
      const file1 = "file1.ts" as FilePath;
      const { id: class_id, def: class_def } = make_class_with_members("MyClass", file1);

      const index = make_test_index(file1, {
        classes: new Map([[class_id, class_def]]),
      });

      registry.update_file(file1, index);

      expect(registry.has_type_members(class_id)).toBe(true);
    });
  });

  describe("get_all_type_bindings", () => {
    it("should return empty map when no bindings exist", () => {
      const bindings = registry.get_all_type_bindings();
      expect(bindings.size).toBe(0);
    });

    it("should return all type bindings", () => {
      const file1 = "file1.ts" as FilePath;
      const { id: var1_id, def: var1_def } = make_variable_with_type("x", "number", file1, 1);
      const { id: var2_id, def: var2_def } = make_variable_with_type("y", "string", file1, 2);
      const loc1 = make_location_key(file1, 1, 0);
      const loc2 = make_location_key(file1, 2, 0);

      const index = make_test_index(file1, {
        variables: new Map([
          [var1_id, var1_def],
          [var2_id, var2_def],
        ]),
      });

      registry.update_file(file1, index);

      const bindings = registry.get_all_type_bindings();
      expect(bindings.size).toBe(2);
      expect(bindings.get(loc1)).toBe("number");
      expect(bindings.get(loc2)).toBe("string");
    });
  });

  describe("get_all_type_members", () => {
    it("should return empty map when no members exist", () => {
      const members = registry.get_all_type_members();
      expect(members.size).toBe(0);
    });

    it("should return all type members", () => {
      const file1 = "file1.ts" as FilePath;
      const { id: class1_id, def: class1_def } = make_class_with_members("Class1", file1, ["foo"]);
      const { id: class2_id, def: class2_def } = make_class_with_members("Class2", file1, [], ["bar"]);

      const index = make_test_index(file1, {
        classes: new Map([
          [class1_id, class1_def],
          [class2_id, class2_def],
        ]),
      });

      registry.update_file(file1, index);

      const all_members = registry.get_all_type_members();
      expect(all_members.size).toBe(2);
      expect(all_members.get(class1_id)).toBeDefined();
      expect(all_members.get(class2_id)).toBeDefined();
      expect(all_members.get(class1_id)?.methods.get("foo" as SymbolName)).toBeDefined();
      expect(all_members.get(class2_id)?.properties.get("bar" as SymbolName)).toBeDefined();
    });
  });

  describe("remove_file", () => {
    it("should remove all type info from a file", () => {
      const file1 = "file1.ts" as FilePath;
      const { id, def } = make_variable_with_type("x", "number", file1, 1);
      const loc_key = make_location_key(file1, 1, 0);

      const index = make_test_index(file1, {
        variables: new Map([[id, def]]),
      });

      registry.update_file(file1, index);
      expect(registry.size().bindings).toBe(1);

      registry.remove_file(file1);

      expect(registry.size().bindings).toBe(0);
      expect(registry.get_type_binding(loc_key)).toBeUndefined();
    });

    it("should not affect other files", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const { id: var1_id, def: var1_def } = make_variable_with_type("x", "number", file1, 1);
      const { id: var2_id, def: var2_def } = make_variable_with_type("y", "string", file2, 1);
      const loc1 = make_location_key(file1, 1, 0);
      const loc2 = make_location_key(file2, 1, 0);

      registry.update_file(file1, make_test_index(file1, {
        variables: new Map([[var1_id, var1_def]]),
      }));

      registry.update_file(file2, make_test_index(file2, {
        variables: new Map([[var2_id, var2_def]]),
      }));

      registry.remove_file(file1);

      expect(registry.size().bindings).toBe(1);
      expect(registry.get_type_binding(loc1)).toBeUndefined();
      expect(registry.get_type_binding(loc2)).toBe("string");
    });

    it("should handle removing non-existent file gracefully", () => {
      const file1 = "nonexistent.ts" as FilePath;

      expect(() => registry.remove_file(file1)).not.toThrow();
      expect(registry.size().bindings).toBe(0);
    });

    it("should remove all types of data from a file", () => {
      const file1 = "file1.ts" as FilePath;

      // Create variable with type
      const { id: var_id, def: var_def } = make_variable_with_type("x", "number", file1, 1);

      // Create class with members
      const { id: class_id, def: class_def } = make_class_with_members("MyClass", file1);

      // Create type alias
      const { id: alias_id, def: alias_def } = make_type_alias("MyType", "string", file1, 3);

      const index = make_test_index(file1, {
        variables: new Map([[var_id, var_def]]),
        classes: new Map([[class_id, class_def]]),
        types: new Map([[alias_id, alias_def]]),
      });

      registry.update_file(file1, index);
      expect(registry.size().bindings).toBe(1);
      expect(registry.size().members).toBe(1);
      expect(registry.size().aliases).toBe(1);

      registry.remove_file(file1);

      expect(registry.size().bindings).toBe(0);
      expect(registry.size().members).toBe(0);
      expect(registry.size().aliases).toBe(0);
    });
  });

  describe("size", () => {
    it("should return zero for empty registry", () => {
      const sizes = registry.size();
      expect(sizes.bindings).toBe(0);
      expect(sizes.members).toBe(0);
      expect(sizes.aliases).toBe(0);
    });

    it("should return correct counts", () => {
      const file1 = "file1.ts" as FilePath;

      // Create variable with type
      const { id: var_id, def: var_def } = make_variable_with_type("x", "number", file1, 1);

      // Create class with members
      const { id: class_id, def: class_def } = make_class_with_members("MyClass", file1);

      // Create type alias
      const { id: alias_id, def: alias_def } = make_type_alias("MyType", "string", file1, 3);

      const index = make_test_index(file1, {
        variables: new Map([[var_id, var_def]]),
        classes: new Map([[class_id, class_def]]),
        types: new Map([[alias_id, alias_def]]),
      });

      registry.update_file(file1, index);

      const sizes = registry.size();
      expect(sizes.bindings).toBe(1);
      expect(sizes.members).toBe(1);
      expect(sizes.aliases).toBe(1);
    });
  });

  describe("clear", () => {
    it("should remove all data from registry", () => {
      const file1 = "file1.ts" as FilePath;
      const { id: var_id, def: var_def } = make_variable_with_type("x", "number", file1, 1);
      const { id: class_id, def: class_def } = make_class_with_members("MyClass", file1);

      const index = make_test_index(file1, {
        variables: new Map([[var_id, var_def]]),
        classes: new Map([[class_id, class_def]]),
      });

      registry.update_file(file1, index);
      expect(registry.size().bindings).toBe(1);
      expect(registry.size().members).toBe(1);

      registry.clear();

      expect(registry.size().bindings).toBe(0);
      expect(registry.size().members).toBe(0);
      expect(registry.size().aliases).toBe(0);
    });
  });

  describe("cross-file scenarios", () => {
    it("should aggregate type information from multiple files", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      const { id: var1_id, def: var1_def } = make_variable_with_type("x", "number", file1, 1);
      const { id: var2_id, def: var2_def } = make_variable_with_type("y", "string", file2, 1);
      const loc1 = make_location_key(file1, 1, 0);
      const loc2 = make_location_key(file2, 1, 0);

      const { id: class1_id, def: class1_def } = make_class_with_members("Class1", file1, ["foo"]);
      const { id: class2_id, def: class2_def } = make_class_with_members("Class2", file2, ["bar"]);

      registry.update_file(file1, make_test_index(file1, {
        variables: new Map([[var1_id, var1_def]]),
        classes: new Map([[class1_id, class1_def]]),
      }));

      registry.update_file(file2, make_test_index(file2, {
        variables: new Map([[var2_id, var2_def]]),
        classes: new Map([[class2_id, class2_def]]),
      }));

      // Should have data from both files
      expect(registry.size().bindings).toBe(2);
      expect(registry.size().members).toBe(2);

      expect(registry.get_type_binding(loc1)).toBe("number");
      expect(registry.get_type_binding(loc2)).toBe("string");

      expect(registry.get_type_members(class1_id)?.methods.get("foo" as SymbolName)).toBeDefined();
      expect(registry.get_type_members(class2_id)?.methods.get("bar" as SymbolName)).toBeDefined();
    });

    it("should handle incremental updates across multiple files", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      const loc1_v1 = make_location_key(file1, 1, 0);
      const loc1_v2 = make_location_key(file1, 2, 0);
      const loc2 = make_location_key(file2, 1, 0);

      // Add file1 version 1
      const { id: var1_v1_id, def: var1_v1_def } = make_variable_with_type("x", "number", file1, 1);
      registry.update_file(file1, make_test_index(file1, {
        variables: new Map([[var1_v1_id, var1_v1_def]]),
      }));

      // Add file2
      const { id: var2_id, def: var2_def } = make_variable_with_type("y", "string", file2, 1);
      registry.update_file(file2, make_test_index(file2, {
        variables: new Map([[var2_id, var2_def]]),
      }));

      expect(registry.size().bindings).toBe(2);

      // Update file1 to version 2
      const { id: var1_v2_id, def: var1_v2_def } = make_variable_with_type("z", "boolean", file1, 2);
      registry.update_file(file1, make_test_index(file1, {
        variables: new Map([[var1_v2_id, var1_v2_def]]),
      }));

      // Should still have 2 bindings total
      expect(registry.size().bindings).toBe(2);
      // file1 v1 should be gone, v2 should exist
      expect(registry.get_type_binding(loc1_v1)).toBeUndefined();
      expect(registry.get_type_binding(loc1_v2)).toBe("boolean");
      // file2 should be unchanged
      expect(registry.get_type_binding(loc2)).toBe("string");
    });
  });
});

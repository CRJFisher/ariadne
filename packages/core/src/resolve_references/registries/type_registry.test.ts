import { describe, it, expect, beforeEach } from "vitest";
import { TypeRegistry } from "./type_registry";
import { DefinitionRegistry } from "./definition_registry";
import { ResolutionRegistry } from "./resolution_registry";
import {
  class_symbol,
  method_symbol,
  variable_symbol,
  location_key,
  interface_symbol,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../index_single_file/semantic_index";
import type { FilePath, Location, LocationKey, SymbolId, SymbolName, ScopeId, AnyDefinition } from "@ariadnejs/types";

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
      defining_scope_id: "module:0:0" as ScopeId,
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
      defining_scope_id: "module:0:0" as ScopeId,
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
      defining_scope_id: "module:0:0" as ScopeId,
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

// Helper to create mock registries for tests that don't need real resolution
function make_mock_registries() {
  return {
    definitions: new DefinitionRegistry(),
    resolutions: new ResolutionRegistry(),
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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index, definitions, resolutions);

      expect(registry.get_type_binding(loc_key)).toBe("number");
      expect(registry.size().bindings).toBe(1);
    });

    it("should add type members from a file", () => {
      const file1 = "file1.ts" as FilePath;
      const { id: class_id, def: class_def } = make_class_with_members("MyClass", file1, ["foo"]);

      const index = make_test_index(file1, {
        classes: new Map([[class_id, class_def]]),
      });

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index, definitions, resolutions);

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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index, definitions, resolutions);

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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index_v1, definitions, resolutions);
      expect(registry.size().bindings).toBe(1);
      expect(registry.get_type_binding(loc_key_v1)).toBe("number");

      // Second version (replace)
      const { id: var2_id, def: var2_def } = make_variable_with_type("y", "string", file1, 2);
      const index_v2 = make_test_index(file1, {
        variables: new Map([[var2_id, var2_def]]),
      });

      registry.update_file(file1, index_v2, definitions, resolutions);

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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index, definitions, resolutions);

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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index, definitions, resolutions);

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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index, definitions, resolutions);

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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index, definitions, resolutions);

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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index, definitions, resolutions);

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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index, definitions, resolutions);

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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index, definitions, resolutions);

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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index, definitions, resolutions);

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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index, definitions, resolutions);
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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, make_test_index(file1, {
        variables: new Map([[var1_id, var1_def]]),
      }), definitions, resolutions);

      registry.update_file(file2, make_test_index(file2, {
        variables: new Map([[var2_id, var2_def]]),
      }), definitions, resolutions);

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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index, definitions, resolutions);
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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index, definitions, resolutions);

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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, index, definitions, resolutions);
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

      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, make_test_index(file1, {
        variables: new Map([[var1_id, var1_def]]),
        classes: new Map([[class1_id, class1_def]]),
      }), definitions, resolutions);

      registry.update_file(file2, make_test_index(file2, {
        variables: new Map([[var2_id, var2_def]]),
        classes: new Map([[class2_id, class2_def]]),
      }), definitions, resolutions);

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
      const { definitions, resolutions } = make_mock_registries();
      registry.update_file(file1, make_test_index(file1, {
        variables: new Map([[var1_v1_id, var1_v1_def]]),
      }), definitions, resolutions);

      // Add file2
      const { id: var2_id, def: var2_def } = make_variable_with_type("y", "string", file2, 1);
      registry.update_file(file2, make_test_index(file2, {
        variables: new Map([[var2_id, var2_def]]),
      }), definitions, resolutions);

      expect(registry.size().bindings).toBe(2);

      // Update file1 to version 2
      const { id: var1_v2_id, def: var1_v2_def } = make_variable_with_type("z", "boolean", file1, 2);
      registry.update_file(file1, make_test_index(file1, {
        variables: new Map([[var1_v2_id, var1_v2_def]]),
      }), definitions, resolutions);

      // Should still have 2 bindings total
      expect(registry.size().bindings).toBe(2);
      // file1 v1 should be gone, v2 should exist
      expect(registry.get_type_binding(loc1_v1)).toBeUndefined();
      expect(registry.get_type_binding(loc1_v2)).toBe("boolean");
      // file2 should be unchanged
      expect(registry.get_type_binding(loc2)).toBe("string");
    });
  });

  describe("resolve_type_metadata", () => {
    it("should resolve type bindings to SymbolIds", () => {
      const file1 = "file1.ts" as FilePath;
      const type_registry = new TypeRegistry();
      const definitions = new DefinitionRegistry();
      const resolutions = new ResolutionRegistry();

      // Create User class
      const user_class_loc = make_location(file1, 1, 0, 5, 1);
      const user_class_id = class_symbol("User", user_class_loc);
      const user_class_def: AnyDefinition = {
        kind: "class",
        symbol_id: user_class_id,
        name: "User" as SymbolName,
        location: user_class_loc,
        defining_scope_id: "module:0:0" as ScopeId,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructor: [],
      };

      // Create variable with type annotation
      const { id: user_var_id, def: user_var_def } = make_variable_with_type("user", "User", file1, 7);

      // Setup definitions
      definitions.update_file(file1, [user_class_def, user_var_def]);

      // Setup index
      const index = make_test_index(file1, {
        variables: new Map([[user_var_id, user_var_def]]),
        classes: new Map([[user_class_id, user_class_def]]),
      });

      // Extract type data (without resolution)
      type_registry.update_file(file1, index);

      // Setup resolutions - mock that "User" resolves to user_class_id
      (resolutions as any).resolutions_by_scope = new Map([
        ["module:0:0" as ScopeId, new Map([["User" as SymbolName, user_class_id]])],
      ]);

      // Call resolve_type_metadata
      (type_registry as any).resolve_type_metadata(file1, definitions, resolutions);

      // Verify: user variable should have User type
      const symbol_types = (type_registry as any).symbol_types as Map<SymbolId, SymbolId>;
      const user_type = symbol_types.get(user_var_id);
      expect(user_type).toBe(user_class_id);
    });

    it("should resolve type members from DefinitionRegistry", () => {
      const file1 = "file1.ts" as FilePath;
      const type_registry = new TypeRegistry();
      const definitions = new DefinitionRegistry();
      const resolutions = new ResolutionRegistry();

      // Create class with members
      const { id: class_id, def: class_def } = make_class_with_members("MyClass", file1, ["foo", "bar"], ["prop1"]);

      // Setup definitions
      definitions.update_file(file1, [class_def]);

      // Setup index
      const index = make_test_index(file1, {
        classes: new Map([[class_id, class_def]]),
      });

      // Extract type data
      type_registry.update_file(file1, index);

      // Call resolve_type_metadata
      (type_registry as any).resolve_type_metadata(file1, definitions, resolutions);

      // Verify: class should have resolved members
      const resolved_type_members = (type_registry as any).resolved_type_members as Map<SymbolId, Map<SymbolName, SymbolId>>;
      const member_map = resolved_type_members.get(class_id);
      expect(member_map).toBeDefined();
      expect(member_map!.has("foo" as SymbolName)).toBe(true);
      expect(member_map!.has("bar" as SymbolName)).toBe(true);
      expect(member_map!.has("prop1" as SymbolName)).toBe(true);
    });

    it("should resolve parent class relationships", () => {
      const file1 = "file1.ts" as FilePath;
      const type_registry = new TypeRegistry();
      const definitions = new DefinitionRegistry();
      const resolutions = new ResolutionRegistry();

      // Create Animal class
      const animal_loc = make_location(file1, 1, 0, 3, 1);
      const animal_id = class_symbol("Animal", animal_loc);
      const animal_def: AnyDefinition = {
        kind: "class",
        symbol_id: animal_id,
        name: "Animal" as SymbolName,
        location: animal_loc,
        defining_scope_id: "module:0:0" as ScopeId,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructor: [],
      };

      // Create Dog class extending Animal
      const dog_loc = make_location(file1, 5, 0, 7, 1);
      const dog_id = class_symbol("Dog", dog_loc);
      const dog_def: AnyDefinition = {
        kind: "class",
        symbol_id: dog_id,
        name: "Dog" as SymbolName,
        location: dog_loc,
        defining_scope_id: "module:0:0" as ScopeId,
        is_exported: false,
        extends: ["Animal" as SymbolName],
        methods: [],
        properties: [],
        decorators: [],
        constructor: [],
      };

      // Setup definitions
      definitions.update_file(file1, [animal_def, dog_def]);

      // Setup index
      const index = make_test_index(file1, {
        classes: new Map([[animal_id, animal_def], [dog_id, dog_def]]),
      });

      // Extract type data
      type_registry.update_file(file1, index);

      // Setup resolutions
      (resolutions as any).resolutions_by_scope = new Map([
        ["module:0:0" as ScopeId, new Map([["Animal" as SymbolName, animal_id]])],
      ]);

      // Call resolve_type_metadata
      (type_registry as any).resolve_type_metadata(file1, definitions, resolutions);

      // Verify: Dog should have Animal as parent
      const parent_classes = (type_registry as any).parent_classes as Map<SymbolId, SymbolId>;
      const parent = parent_classes.get(dog_id);
      expect(parent).toBe(animal_id);
    });

    it("should resolve implemented interfaces", () => {
      const file1 = "file1.ts" as FilePath;
      const type_registry = new TypeRegistry();
      const definitions = new DefinitionRegistry();
      const resolutions = new ResolutionRegistry();

      // Create Flyable interface
      const flyable_loc = make_location(file1, 1, 0, 3, 1);
      const flyable_id = interface_symbol("Flyable", flyable_loc);
      const flyable_def: AnyDefinition = {
        kind: "interface",
        symbol_id: flyable_id,
        name: "Flyable" as SymbolName,
        location: flyable_loc,
        defining_scope_id: "module:0:0" as ScopeId,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
      };

      // Create Swimmable interface
      const swimmable_loc = make_location(file1, 5, 0, 7, 1);
      const swimmable_id = interface_symbol("Swimmable", swimmable_loc);
      const swimmable_def: AnyDefinition = {
        kind: "interface",
        symbol_id: swimmable_id,
        name: "Swimmable" as SymbolName,
        location: swimmable_loc,
        defining_scope_id: "module:0:0" as ScopeId,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
      };

      // Create Duck class implementing both interfaces
      const duck_loc = make_location(file1, 9, 0, 11, 1);
      const duck_id = class_symbol("Duck", duck_loc);
      const duck_def: AnyDefinition = {
        kind: "class",
        symbol_id: duck_id,
        name: "Duck" as SymbolName,
        location: duck_loc,
        defining_scope_id: "module:0:0" as ScopeId,
        is_exported: false,
        extends: ["Flyable" as SymbolName, "Swimmable" as SymbolName],
        methods: [],
        properties: [],
        decorators: [],
        constructor: [],
      };

      // Setup definitions
      definitions.update_file(file1, [flyable_def, swimmable_def, duck_def]);

      // Setup index
      const index = make_test_index(file1, {
        interfaces: new Map([[flyable_id, flyable_def], [swimmable_id, swimmable_def]]),
        classes: new Map([[duck_id, duck_def]]),
      });

      // Extract type data
      type_registry.update_file(file1, index);

      // Setup resolutions
      (resolutions as any).resolutions_by_scope = new Map([
        ["module:0:0" as ScopeId, new Map([
          ["Flyable" as SymbolName, flyable_id],
          ["Swimmable" as SymbolName, swimmable_id],
        ])],
      ]);

      // Call resolve_type_metadata
      (type_registry as any).resolve_type_metadata(file1, definitions, resolutions);

      // Verify: Duck should implement both interfaces (first becomes parent, rest are interfaces)
      const parent_classes = (type_registry as any).parent_classes as Map<SymbolId, SymbolId>;
      const implemented_interfaces = (type_registry as any).implemented_interfaces as Map<SymbolId, SymbolId[]>;

      const parent = parent_classes.get(duck_id);
      const interfaces = implemented_interfaces.get(duck_id);

      expect(parent).toBe(flyable_id);
      expect(interfaces).toEqual([swimmable_id]);
    });

    it("should clean up resolved data on remove_file", () => {
      const file1 = "file1.ts" as FilePath;
      const type_registry = new TypeRegistry();
      const definitions = new DefinitionRegistry();
      const resolutions = new ResolutionRegistry();

      // Create class and variable
      const user_class_loc = make_location(file1, 1, 0, 5, 1);
      const user_class_id = class_symbol("User", user_class_loc);
      const user_class_def: AnyDefinition = {
        kind: "class",
        symbol_id: user_class_id,
        name: "User" as SymbolName,
        location: user_class_loc,
        defining_scope_id: "module:0:0" as ScopeId,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructor: [],
      };

      const { id: user_var_id, def: user_var_def } = make_variable_with_type("user", "User", file1, 7);

      // Setup everything
      definitions.update_file(file1, [user_class_def, user_var_def]);
      const index = make_test_index(file1, {
        variables: new Map([[user_var_id, user_var_def]]),
        classes: new Map([[user_class_id, user_class_def]]),
      });

      type_registry.update_file(file1, index);

      (resolutions as any).resolutions_by_scope = new Map([
        ["module:0:0" as ScopeId, new Map([["User" as SymbolName, user_class_id]])],
      ]);

      (type_registry as any).resolve_type_metadata(file1, definitions, resolutions);

      // Verify data exists
      const symbol_types = (type_registry as any).symbol_types as Map<SymbolId, SymbolId>;
      const resolved_by_file = (type_registry as any).resolved_by_file as Map<FilePath, Set<SymbolId>>;
      expect(symbol_types.has(user_var_id)).toBe(true);
      expect(resolved_by_file.has(file1)).toBe(true);

      // Remove file
      type_registry.remove_file(file1);

      // Verify all resolved data is gone
      expect(symbol_types.has(user_var_id)).toBe(false);
      expect(resolved_by_file.has(file1)).toBe(false);
    });

    it("should integrate with update_file when dependencies provided", () => {
      const file1 = "file1.ts" as FilePath;
      const type_registry = new TypeRegistry();
      const definitions = new DefinitionRegistry();
      const resolutions = new ResolutionRegistry();

      // Create User class
      const user_class_loc = make_location(file1, 1, 0, 5, 1);
      const user_class_id = class_symbol("User", user_class_loc);
      const user_class_def: AnyDefinition = {
        kind: "class",
        symbol_id: user_class_id,
        name: "User" as SymbolName,
        location: user_class_loc,
        defining_scope_id: "module:0:0" as ScopeId,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructor: [],
      };

      // Create variable with type annotation
      const { id: user_var_id, def: user_var_def } = make_variable_with_type("user", "User", file1, 7);

      // Setup definitions
      definitions.update_file(file1, [user_class_def, user_var_def]);

      // Setup index
      const index = make_test_index(file1, {
        variables: new Map([[user_var_id, user_var_def]]),
        classes: new Map([[user_class_id, user_class_def]]),
      });

      // Setup resolutions
      (resolutions as any).resolutions_by_scope = new Map([
        ["module:0:0" as ScopeId, new Map([["User" as SymbolName, user_class_id]])],
      ]);

      // Call update_file WITH dependencies - should trigger resolution
      type_registry.update_file(file1, index, definitions, resolutions);

      // Verify: resolution happened automatically
      const symbol_types = (type_registry as any).symbol_types as Map<SymbolId, SymbolId>;
      const user_type = symbol_types.get(user_var_id);
      expect(user_type).toBe(user_class_id);
    });

    it("should NOT resolve when dependencies not provided", () => {
      const file1 = "file1.ts" as FilePath;
      const type_registry = new TypeRegistry();

      // Create variable with type annotation
      const { id: user_var_id, def: user_var_def } = make_variable_with_type("user", "User", file1, 7);

      const index = make_test_index(file1, {
        variables: new Map([[user_var_id, user_var_def]]),
      });

      // Call update_file WITHOUT dependencies - should NOT trigger resolution
      type_registry.update_file(file1, index);

      // Verify: no resolution happened
      const symbol_types = (type_registry as any).symbol_types as Map<SymbolId, SymbolId>;
      const resolved_by_file = (type_registry as any).resolved_by_file as Map<FilePath, Set<SymbolId>>;
      expect(symbol_types.size).toBe(0);
      expect(resolved_by_file.size).toBe(0);
    });
  });

  describe("TypeContext Methods", () => {
    describe("get_symbol_type", () => {
      it("should return type from explicit annotation", () => {
        const file1 = "file1.ts" as FilePath;
        const type_registry = new TypeRegistry();
        const definitions = new DefinitionRegistry();
        const resolutions = new ResolutionRegistry();

        // Create User class
        const user_class_loc = make_location(file1, 1, 0, 5, 1);
        const user_class_id = class_symbol("User", user_class_loc);
        const user_class_def: AnyDefinition = {
          kind: "class",
          symbol_id: user_class_id,
          name: "User" as SymbolName,
          location: user_class_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: [],
          methods: [],
          properties: [],
          decorators: [],
          constructor: [],
        };

        // Create variable with type annotation
        const { id: user_var_id, def: user_var_def } = make_variable_with_type("user", "User", file1, 7);

        // Setup everything
        definitions.update_file(file1, [user_class_def, user_var_def]);
        const index = make_test_index(file1, {
          variables: new Map([[user_var_id, user_var_def]]),
          classes: new Map([[user_class_id, user_class_def]]),
        });

        (resolutions as any).resolutions_by_scope = new Map([
          ["module:0:0" as ScopeId, new Map([["User" as SymbolName, user_class_id]])],
        ]);

        type_registry.update_file(file1, index, definitions, resolutions);

        // Test get_symbol_type
        const result = type_registry.get_symbol_type(user_var_id);
        expect(result).toBe(user_class_id);
      });

      it("should return null for untyped symbols", () => {
        const file1 = "file1.ts" as FilePath;
        const type_registry = new TypeRegistry();

        const { id: var_id } = make_variable_with_type("x", "number", file1, 1);

        // Symbol not in registry
        const result = type_registry.get_symbol_type(var_id);
        expect(result).toBeNull();
      });
    });

    describe("get_parent_class", () => {
      it("should return parent class", () => {
        const file1 = "file1.ts" as FilePath;
        const type_registry = new TypeRegistry();
        const definitions = new DefinitionRegistry();
        const resolutions = new ResolutionRegistry();

        // Create Animal class
        const animal_loc = make_location(file1, 1, 0, 3, 1);
        const animal_id = class_symbol("Animal", animal_loc);
        const animal_def: AnyDefinition = {
          kind: "class",
          symbol_id: animal_id,
          name: "Animal" as SymbolName,
          location: animal_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: [],
          methods: [],
          properties: [],
          decorators: [],
          constructor: [],
        };

        // Create Dog class extending Animal
        const dog_loc = make_location(file1, 5, 0, 7, 1);
        const dog_id = class_symbol("Dog", dog_loc);
        const dog_def: AnyDefinition = {
          kind: "class",
          symbol_id: dog_id,
          name: "Dog" as SymbolName,
          location: dog_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: ["Animal" as SymbolName],
          methods: [],
          properties: [],
          decorators: [],
          constructor: [],
        };

        definitions.update_file(file1, [animal_def, dog_def]);
        const index = make_test_index(file1, {
          classes: new Map([[animal_id, animal_def], [dog_id, dog_def]]),
        });

        (resolutions as any).resolutions_by_scope = new Map([
          ["module:0:0" as ScopeId, new Map([["Animal" as SymbolName, animal_id]])],
        ]);

        type_registry.update_file(file1, index, definitions, resolutions);

        // Test get_parent_class
        const result = type_registry.get_parent_class(dog_id);
        expect(result).toBe(animal_id);
      });

      it("should return null for classes with no parent", () => {
        const file1 = "file1.ts" as FilePath;
        const type_registry = new TypeRegistry();
        const definitions = new DefinitionRegistry();
        const resolutions = new ResolutionRegistry();

        const animal_loc = make_location(file1, 1, 0, 3, 1);
        const animal_id = class_symbol("Animal", animal_loc);
        const animal_def: AnyDefinition = {
          kind: "class",
          symbol_id: animal_id,
          name: "Animal" as SymbolName,
          location: animal_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: [],
          methods: [],
          properties: [],
          decorators: [],
          constructor: [],
        };

        definitions.update_file(file1, [animal_def]);
        const index = make_test_index(file1, {
          classes: new Map([[animal_id, animal_def]]),
        });

        type_registry.update_file(file1, index, definitions, resolutions);

        const result = type_registry.get_parent_class(animal_id);
        expect(result).toBeNull();
      });
    });

    describe("get_implemented_interfaces", () => {
      it("should return all implemented interfaces", () => {
        const file1 = "file1.ts" as FilePath;
        const type_registry = new TypeRegistry();
        const definitions = new DefinitionRegistry();
        const resolutions = new ResolutionRegistry();

        // Create interfaces
        const flyable_loc = make_location(file1, 1, 0, 3, 1);
        const flyable_id = interface_symbol("Flyable", flyable_loc);
        const flyable_def: AnyDefinition = {
          kind: "interface",
          symbol_id: flyable_id,
          name: "Flyable" as SymbolName,
          location: flyable_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: [],
          methods: [],
          properties: [],
        };

        const swimmable_loc = make_location(file1, 5, 0, 7, 1);
        const swimmable_id = interface_symbol("Swimmable", swimmable_loc);
        const swimmable_def: AnyDefinition = {
          kind: "interface",
          symbol_id: swimmable_id,
          name: "Swimmable" as SymbolName,
          location: swimmable_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: [],
          methods: [],
          properties: [],
        };

        // Create Duck class implementing both
        const duck_loc = make_location(file1, 9, 0, 11, 1);
        const duck_id = class_symbol("Duck", duck_loc);
        const duck_def: AnyDefinition = {
          kind: "class",
          symbol_id: duck_id,
          name: "Duck" as SymbolName,
          location: duck_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: ["Flyable" as SymbolName, "Swimmable" as SymbolName],
          methods: [],
          properties: [],
          decorators: [],
          constructor: [],
        };

        definitions.update_file(file1, [flyable_def, swimmable_def, duck_def]);
        const index = make_test_index(file1, {
          interfaces: new Map([[flyable_id, flyable_def], [swimmable_id, swimmable_def]]),
          classes: new Map([[duck_id, duck_def]]),
        });

        (resolutions as any).resolutions_by_scope = new Map([
          ["module:0:0" as ScopeId, new Map([
            ["Flyable" as SymbolName, flyable_id],
            ["Swimmable" as SymbolName, swimmable_id],
          ])],
        ]);

        type_registry.update_file(file1, index, definitions, resolutions);

        const result = type_registry.get_implemented_interfaces(duck_id);
        expect(result).toEqual([swimmable_id]);
      });

      it("should return empty array for classes with no interfaces", () => {
        const file1 = "file1.ts" as FilePath;
        const type_registry = new TypeRegistry();
        const definitions = new DefinitionRegistry();
        const resolutions = new ResolutionRegistry();

        const animal_loc = make_location(file1, 1, 0, 3, 1);
        const animal_id = class_symbol("Animal", animal_loc);
        const animal_def: AnyDefinition = {
          kind: "class",
          symbol_id: animal_id,
          name: "Animal" as SymbolName,
          location: animal_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: [],
          methods: [],
          properties: [],
          decorators: [],
          constructor: [],
        };

        definitions.update_file(file1, [animal_def]);
        const index = make_test_index(file1, {
          classes: new Map([[animal_id, animal_def]]),
        });

        type_registry.update_file(file1, index, definitions, resolutions);

        const result = type_registry.get_implemented_interfaces(animal_id);
        expect(result).toEqual([]);
      });
    });

    describe("walk_inheritance_chain", () => {
      it("should return full inheritance chain", () => {
        const file1 = "file1.ts" as FilePath;
        const type_registry = new TypeRegistry();
        const definitions = new DefinitionRegistry();
        const resolutions = new ResolutionRegistry();

        // Create Animal
        const animal_loc = make_location(file1, 1, 0, 3, 1);
        const animal_id = class_symbol("Animal", animal_loc);
        const animal_def: AnyDefinition = {
          kind: "class",
          symbol_id: animal_id,
          name: "Animal" as SymbolName,
          location: animal_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: [],
          methods: [],
          properties: [],
          decorators: [],
          constructor: [],
        };

        // Create Mammal extends Animal
        const mammal_loc = make_location(file1, 5, 0, 7, 1);
        const mammal_id = class_symbol("Mammal", mammal_loc);
        const mammal_def: AnyDefinition = {
          kind: "class",
          symbol_id: mammal_id,
          name: "Mammal" as SymbolName,
          location: mammal_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: ["Animal" as SymbolName],
          methods: [],
          properties: [],
          decorators: [],
          constructor: [],
        };

        // Create Dog extends Mammal
        const dog_loc = make_location(file1, 9, 0, 11, 1);
        const dog_id = class_symbol("Dog", dog_loc);
        const dog_def: AnyDefinition = {
          kind: "class",
          symbol_id: dog_id,
          name: "Dog" as SymbolName,
          location: dog_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: ["Mammal" as SymbolName],
          methods: [],
          properties: [],
          decorators: [],
          constructor: [],
        };

        definitions.update_file(file1, [animal_def, mammal_def, dog_def]);
        const index = make_test_index(file1, {
          classes: new Map([[animal_id, animal_def], [mammal_id, mammal_def], [dog_id, dog_def]]),
        });

        (resolutions as any).resolutions_by_scope = new Map([
          ["module:0:0" as ScopeId, new Map([
            ["Animal" as SymbolName, animal_id],
            ["Mammal" as SymbolName, mammal_id],
          ])],
        ]);

        type_registry.update_file(file1, index, definitions, resolutions);

        const result = type_registry.walk_inheritance_chain(dog_id);
        expect(result).toEqual([dog_id, mammal_id, animal_id]);
      });

      it("should include only the class itself if no parent", () => {
        const file1 = "file1.ts" as FilePath;
        const type_registry = new TypeRegistry();
        const definitions = new DefinitionRegistry();
        const resolutions = new ResolutionRegistry();

        const animal_loc = make_location(file1, 1, 0, 3, 1);
        const animal_id = class_symbol("Animal", animal_loc);
        const animal_def: AnyDefinition = {
          kind: "class",
          symbol_id: animal_id,
          name: "Animal" as SymbolName,
          location: animal_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: [],
          methods: [],
          properties: [],
          decorators: [],
          constructor: [],
        };

        definitions.update_file(file1, [animal_def]);
        const index = make_test_index(file1, {
          classes: new Map([[animal_id, animal_def]]),
        });

        type_registry.update_file(file1, index, definitions, resolutions);

        const result = type_registry.walk_inheritance_chain(animal_id);
        expect(result).toEqual([animal_id]);
      });

      it("should handle circular inheritance gracefully", () => {
        const file1 = "file1.ts" as FilePath;
        const type_registry = new TypeRegistry();

        // Create artificial circular inheritance
        const class_a_loc = make_location(file1, 1, 0, 3, 1);
        const class_a_id = class_symbol("ClassA", class_a_loc);

        const class_b_loc = make_location(file1, 5, 0, 7, 1);
        const class_b_id = class_symbol("ClassB", class_b_loc);

        // Manually inject circular inheritance
        (type_registry as any).parent_classes.set(class_a_id, class_b_id);
        (type_registry as any).parent_classes.set(class_b_id, class_a_id);

        const result = type_registry.walk_inheritance_chain(class_a_id);

        // Should stop at cycle, not infinite loop
        expect(result).toEqual([class_a_id, class_b_id]);
      });
    });

    describe("get_type_member", () => {
      it("should find direct members", () => {
        const file1 = "file1.ts" as FilePath;
        const type_registry = new TypeRegistry();
        const definitions = new DefinitionRegistry();
        const resolutions = new ResolutionRegistry();

        const { id: class_id, def: class_def } = make_class_with_members("User", file1, ["getName"], ["name"]);

        definitions.update_file(file1, [class_def]);
        const index = make_test_index(file1, {
          classes: new Map([[class_id, class_def]]),
        });

        type_registry.update_file(file1, index, definitions, resolutions);

        const result = type_registry.get_type_member(class_id, "getName" as SymbolName);
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
      });

      it("should find inherited members", () => {
        const file1 = "file1.ts" as FilePath;
        const type_registry = new TypeRegistry();
        const definitions = new DefinitionRegistry();
        const resolutions = new ResolutionRegistry();

        // Create Animal with speak() method
        const animal_loc = make_location(file1, 1, 0, 5, 1);
        const animal_id = class_symbol("Animal", animal_loc);
        const speak_method_loc = make_location(file1, 2, 2);
        const speak_method_id = method_symbol("speak", speak_method_loc);
        const animal_def: AnyDefinition = {
          kind: "class",
          symbol_id: animal_id,
          name: "Animal" as SymbolName,
          location: animal_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: [],
          methods: [{
            kind: "method",
            symbol_id: speak_method_id,
            name: "speak" as SymbolName,
            location: speak_method_loc,
            parameters: [],
          }],
          properties: [],
          decorators: [],
          constructor: [],
        };

        // Create Dog extends Animal (no methods)
        const dog_loc = make_location(file1, 7, 0, 9, 1);
        const dog_id = class_symbol("Dog", dog_loc);
        const dog_def: AnyDefinition = {
          kind: "class",
          symbol_id: dog_id,
          name: "Dog" as SymbolName,
          location: dog_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: ["Animal" as SymbolName],
          methods: [],
          properties: [],
          decorators: [],
          constructor: [],
        };

        definitions.update_file(file1, [animal_def, dog_def]);
        const index = make_test_index(file1, {
          classes: new Map([[animal_id, animal_def], [dog_id, dog_def]]),
        });

        (resolutions as any).resolutions_by_scope = new Map([
          ["module:0:0" as ScopeId, new Map([["Animal" as SymbolName, animal_id]])],
        ]);

        type_registry.update_file(file1, index, definitions, resolutions);

        // Dog should find speak() from Animal
        const result = type_registry.get_type_member(dog_id, "speak" as SymbolName);
        expect(result).toBe(speak_method_id);
      });

      it("should return null for non-existent members", () => {
        const file1 = "file1.ts" as FilePath;
        const type_registry = new TypeRegistry();
        const definitions = new DefinitionRegistry();
        const resolutions = new ResolutionRegistry();

        const { id: class_id, def: class_def } = make_class_with_members("User", file1);

        definitions.update_file(file1, [class_def]);
        const index = make_test_index(file1, {
          classes: new Map([[class_id, class_def]]),
        });

        type_registry.update_file(file1, index, definitions, resolutions);

        const result = type_registry.get_type_member(class_id, "nonExistent" as SymbolName);
        expect(result).toBeNull();
      });

      it("should prefer direct members over inherited", () => {
        const file1 = "file1.ts" as FilePath;
        const type_registry = new TypeRegistry();
        const definitions = new DefinitionRegistry();
        const resolutions = new ResolutionRegistry();

        // Create Animal with speak()
        const animal_loc = make_location(file1, 1, 0, 5, 1);
        const animal_id = class_symbol("Animal", animal_loc);
        const animal_speak_loc = make_location(file1, 2, 2);
        const animal_speak_id = method_symbol("speak", animal_speak_loc);
        const animal_def: AnyDefinition = {
          kind: "class",
          symbol_id: animal_id,
          name: "Animal" as SymbolName,
          location: animal_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: [],
          methods: [{
            kind: "method",
            symbol_id: animal_speak_id,
            name: "speak" as SymbolName,
            location: animal_speak_loc,
            parameters: [],
          }],
          properties: [],
          decorators: [],
          constructor: [],
        };

        // Create Dog with overridden speak()
        const dog_loc = make_location(file1, 7, 0, 11, 1);
        const dog_id = class_symbol("Dog", dog_loc);
        const dog_speak_loc = make_location(file1, 8, 2);
        const dog_speak_id = method_symbol("speak", dog_speak_loc);
        const dog_def: AnyDefinition = {
          kind: "class",
          symbol_id: dog_id,
          name: "Dog" as SymbolName,
          location: dog_loc,
          defining_scope_id: "module:0:0" as ScopeId,
          is_exported: false,
          extends: ["Animal" as SymbolName],
          methods: [{
            kind: "method",
            symbol_id: dog_speak_id,
            name: "speak" as SymbolName,
            location: dog_speak_loc,
            parameters: [],
          }],
          properties: [],
          decorators: [],
          constructor: [],
        };

        definitions.update_file(file1, [animal_def, dog_def]);
        const index = make_test_index(file1, {
          classes: new Map([[animal_id, animal_def], [dog_id, dog_def]]),
        });

        (resolutions as any).resolutions_by_scope = new Map([
          ["module:0:0" as ScopeId, new Map([["Animal" as SymbolName, animal_id]])],
        ]);

        type_registry.update_file(file1, index, definitions, resolutions);

        // Should return Dog's speak, not Animal's
        const result = type_registry.get_type_member(dog_id, "speak" as SymbolName);
        expect(result).toBe(dog_speak_id);
        expect(result).not.toBe(animal_speak_id);
      });
    });

    describe("get_namespace_member", () => {
      it("should return null (not implemented)", () => {
        const type_registry = new TypeRegistry();
        const result = type_registry.get_namespace_member(
          "any" as SymbolId,
          "any" as SymbolName
        );
        expect(result).toBeNull();
      });
    });
  });
});

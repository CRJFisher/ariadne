import { describe, it, expect, beforeEach } from "vitest";
import { TypeRegistry } from "./type_registry";
import { DefinitionRegistry } from "./definition_registry";
import { ResolutionRegistry } from "../resolution_registry";
import {
  class_symbol,
  method_symbol,
  variable_symbol,
  interface_symbol,
  MethodDefinition,
  PropertyDefinition,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type {
  FilePath,
  Location,
  SymbolId,
  SymbolName,
  ScopeId,
  AnyDefinition,
  ClassDefinition,
} from "@ariadnejs/types";

// Helper to create a location object
function make_location(
  file_path: FilePath,
  start_line: number,
  start_column: number = 0,
  end_line?: number,
  end_column?: number
): Location {
  return {
    file_path,
    start_line,
    start_column,
    end_line: end_line ?? start_line,
    end_column: end_column ?? start_column + 5,
  };
}

// Helper to create a variable with type annotation
function make_variable_with_type(
  name: string,
  type_name: string,
  file_path: FilePath,
  line: number
) {
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
function make_class_with_members(
  name: string,
  file_path: FilePath,
  methods: string[] = [],
  properties: string[] = []
) {
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
      defining_scope_id: "module:0:0" as ScopeId,
    } as MethodDefinition;
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
      defining_scope_id: "module:0:0" as ScopeId,
    } as PropertyDefinition;
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
    } as ClassDefinition,
  };
}

// Helper to create minimal SemanticIndex for testing
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
    functions: options.functions || new Map(),
    classes: options.classes || new Map(),
    variables: options.variables || new Map(),
    interfaces: options.interfaces || new Map(),
    enums: options.enums || new Map(),
    namespaces: new Map(),
    types: options.types || new Map(),
    imported_symbols: new Map(),
    references: options.references || [],
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

  describe("get_type_members", () => {
    it("should return undefined for non-existent type", () => {
      const file1 = "file1.ts" as FilePath;
      const loc = make_location(file1, 1);
      const class_id = class_symbol("NonExistent", loc);

      expect(registry.get_type_members(class_id)).toBeUndefined();
    });

    it("should retrieve type members by symbol id", () => {
      const file1 = "file1.ts" as FilePath;
      const { id: class_id, def: class_def } = make_class_with_members(
        "MyClass",
        file1,
        ["foo"],
        ["bar"]
      );

      const index = make_test_index(file1, {
        classes: new Map([[class_id, class_def]]),
      });

      const { definitions, resolutions } = make_mock_registries();

      // Populate definitions registry so get_type_members can look up the class
      definitions.update_file(file1, [class_def]);

      registry.update_file(file1, index, definitions, resolutions);

      const retrieved = registry.get_type_members(class_id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.methods.get("foo" as SymbolName)).toBeDefined();
      expect(retrieved?.properties.get("bar" as SymbolName)).toBeDefined();
      expect(retrieved?.extends).toEqual([]);
    });

    it("should return constructor from ClassDefinition.constructor field", () => {
      const file1 = "file1.ts" as FilePath;

      // Create class with constructor
      const class_loc = make_location(file1, 1, 0, 10, 1);
      const class_id = class_symbol("MyClass", class_loc);

      const constructor_loc = make_location(file1, 2, 2);
      const constructor_id = method_symbol("constructor", constructor_loc);

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        location: class_loc,
        defining_scope_id: "module:0:0" as ScopeId,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructor: [
          {
            kind: "constructor",
            symbol_id: constructor_id,
            name: "constructor" as SymbolName,
            location: constructor_loc,
            parameters: [],
            defining_scope_id: "module:0:0" as ScopeId,
            body_scope_id: "function:2:2" as ScopeId,
          },
        ],
      };

      const index = make_test_index(file1, {
        classes: new Map([[class_id, class_def]]),
      });

      const { definitions, resolutions } = make_mock_registries();

      // Populate definitions registry so get_type_members can look up the class
      definitions.update_file(file1, [class_def]);

      registry.update_file(file1, index, definitions, resolutions);

      const retrieved = registry.get_type_members(class_id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.constructor).toBe(constructor_id);
    });

    it("should return undefined constructor when class has no constructor", () => {
      const file1 = "file1.ts" as FilePath;
      const { id: class_id, def: class_def } = make_class_with_members(
        "MyClass",
        file1
      );

      const index = make_test_index(file1, {
        classes: new Map([[class_id, class_def]]),
      });

      const { definitions, resolutions } = make_mock_registries();

      // Populate definitions registry so get_type_members can look up the class
      definitions.update_file(file1, [class_def]);

      registry.update_file(file1, index, definitions, resolutions);

      const retrieved = registry.get_type_members(class_id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.constructor).toBeUndefined();
    });

    it("should work for Python __init__ constructors (language-agnostic)", () => {
      const file1 = "user.py" as FilePath;

      // Create Python class with __init__ constructor
      const class_loc = make_location(file1, 1, 0, 10, 1);
      const class_id = class_symbol("User", class_loc);

      const init_loc = make_location(file1, 2, 4);
      const init_id = method_symbol("__init__", init_loc);

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "User" as SymbolName,
        location: class_loc,
        defining_scope_id: "module:0:0" as ScopeId,
        is_exported: false,
        extends: [],
        methods: [
          {
            kind: "method",
            symbol_id: init_id,
            name: "__init__" as SymbolName,
            location: init_loc,
            parameters: [],
            defining_scope_id: "module:0:0" as ScopeId,
          },
        ],
        properties: [],
        decorators: [],
        constructor: [
          {
            kind: "constructor",
            symbol_id: init_id,
            name: "__init__" as SymbolName,
            location: init_loc,
            parameters: [],
            defining_scope_id: "module:0:0" as ScopeId,
            body_scope_id: "function:2:4" as ScopeId,
          },
        ],
      };

      const index = make_test_index(file1, {
        classes: new Map([[class_id, class_def]]),
      });

      const { definitions, resolutions } = make_mock_registries();

      // Populate definitions registry so get_type_members can look up the class
      definitions.update_file(file1, [class_def]);

      registry.update_file(file1, index, definitions, resolutions);

      const retrieved = registry.get_type_members(class_id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.constructor).toBe(init_id);
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
        const { id: user_var_id, def: user_var_def } =
          make_variable_with_type("user", "User", file1, 7);

        // Setup everything
        definitions.update_file(file1, [user_class_def, user_var_def]);
        const index = make_test_index(file1, {
          variables: new Map([[user_var_id, user_var_def]]),
          classes: new Map([[user_class_id, user_class_def]]),
        });

        (resolutions as any).resolutions_by_scope = new Map([
          [
            "module:0:0" as ScopeId,
            new Map([["User" as SymbolName, user_class_id]]),
          ],
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
          classes: new Map([
            [animal_id, animal_def],
            [dog_id, dog_def],
          ]),
        });

        (resolutions as any).resolutions_by_scope = new Map([
          [
            "module:0:0" as ScopeId,
            new Map([["Animal" as SymbolName, animal_id]]),
          ],
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
          interfaces: new Map([
            [flyable_id, flyable_def],
            [swimmable_id, swimmable_def],
          ]),
          classes: new Map([[duck_id, duck_def]]),
        });

        (resolutions as any).resolutions_by_scope = new Map([
          [
            "module:0:0" as ScopeId,
            new Map([
              ["Flyable" as SymbolName, flyable_id],
              ["Swimmable" as SymbolName, swimmable_id],
            ]),
          ],
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
          classes: new Map([
            [animal_id, animal_def],
            [mammal_id, mammal_def],
            [dog_id, dog_def],
          ]),
        });

        (resolutions as any).resolutions_by_scope = new Map([
          [
            "module:0:0" as ScopeId,
            new Map([
              ["Animal" as SymbolName, animal_id],
              ["Mammal" as SymbolName, mammal_id],
            ]),
          ],
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

        const { id: class_id, def: class_def } = make_class_with_members(
          "User",
          file1,
          ["getName"],
          ["name"]
        );

        definitions.update_file(file1, [class_def]);
        const index = make_test_index(file1, {
          classes: new Map([[class_id, class_def]]),
        });

        type_registry.update_file(file1, index, definitions, resolutions);

        const result = type_registry.get_type_member(
          class_id,
          "getName" as SymbolName
        );
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
          methods: [
            {
              kind: "method",
              symbol_id: speak_method_id,
              name: "speak" as SymbolName,
              location: speak_method_loc,
              parameters: [],
              defining_scope_id: "module:0:0" as ScopeId,
            },
          ],
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
          classes: new Map([
            [animal_id, animal_def],
            [dog_id, dog_def],
          ]),
        });

        (resolutions as any).resolutions_by_scope = new Map([
          [
            "module:0:0" as ScopeId,
            new Map([["Animal" as SymbolName, animal_id]]),
          ],
        ]);

        type_registry.update_file(file1, index, definitions, resolutions);

        // Dog should find speak() from Animal
        const result = type_registry.get_type_member(
          dog_id,
          "speak" as SymbolName
        );
        expect(result).toBe(speak_method_id);
      });

      it("should return null for non-existent members", () => {
        const file1 = "file1.ts" as FilePath;
        const type_registry = new TypeRegistry();
        const definitions = new DefinitionRegistry();
        const resolutions = new ResolutionRegistry();

        const { id: class_id, def: class_def } = make_class_with_members(
          "User",
          file1
        );

        definitions.update_file(file1, [class_def]);
        const index = make_test_index(file1, {
          classes: new Map([[class_id, class_def]]),
        });

        type_registry.update_file(file1, index, definitions, resolutions);

        const result = type_registry.get_type_member(
          class_id,
          "nonExistent" as SymbolName
        );
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
          methods: [
            {
              kind: "method",
              symbol_id: animal_speak_id,
              name: "speak" as SymbolName,
              location: animal_speak_loc,
              parameters: [],
              defining_scope_id: "module:0:0" as ScopeId,
            },
          ],
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
          methods: [
            {
              kind: "method",
              symbol_id: dog_speak_id,
              name: "speak" as SymbolName,
              location: dog_speak_loc,
              parameters: [],
              defining_scope_id: "module:0:0" as ScopeId,
            },
          ],
          properties: [],
          decorators: [],
          constructor: [],
        };

        definitions.update_file(file1, [animal_def, dog_def]);
        const index = make_test_index(file1, {
          classes: new Map([
            [animal_id, animal_def],
            [dog_id, dog_def],
          ]),
        });

        (resolutions as any).resolutions_by_scope = new Map([
          [
            "module:0:0" as ScopeId,
            new Map([["Animal" as SymbolName, animal_id]]),
          ],
        ]);

        type_registry.update_file(file1, index, definitions, resolutions);

        // Should return Dog's speak, not Animal's
        const result = type_registry.get_type_member(
          dog_id,
          "speak" as SymbolName
        );
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

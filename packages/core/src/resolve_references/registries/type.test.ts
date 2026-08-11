import { describe, it, expect, beforeEach } from "vitest";
import { TypeRegistry } from "./type";
import { DefinitionRegistry } from "./definition";
import { ResolutionRegistry } from "../resolution_registry";
import { set_test_resolutions } from "../resolve_references.test";
import { make_export_chain_context } from "../resolution_test_helpers";
import {
  class_symbol,
  interface_symbol,
  method_symbol,
  variable_symbol,
  MethodDefinition,
  PropertyDefinition,
} from "@ariadnejs/types";
import type { SemanticIndex } from "@ariadnejs/types";
import type {
  FilePath,
  Location,
  SymbolId,
  SymbolName,
  ScopeId,
  AnyDefinition,
  ClassDefinition,
} from "@ariadnejs/types";
import { create_module_resolution_context } from "../import_resolution";

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
      constructors: [],
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

// Empty export-chain inputs for unit tests that do not follow re-export chains.
const {
  exports: empty_exports,
  languages: empty_languages,
  resolution: empty_resolution,
} = make_export_chain_context();

describe("TypeRegistry", () => {
  let registry: TypeRegistry;

  beforeEach(() => {
    registry = new TypeRegistry();
  });

  describe("get_type_members", () => {
    it("returns undefined for non-existent type", () => {
      const file1 = "file1.ts" as FilePath;
      const loc = make_location(file1, 1);
      const class_id = class_symbol("NonExistent", loc);

      expect(registry.get_type_members(class_id)).toBeUndefined();
    });

    it("retrieves type members by symbol id", () => {
      const file1 = "file1.ts" as FilePath;
      const { id: class_id, def: class_def } = make_class_with_members(
        "MyClass",
        file1,
        ["foo"],
        ["bar"]
      );
      const foo_id = class_def.methods[0].symbol_id;
      const bar_id = class_def.properties[0].symbol_id;

      const index = make_test_index(file1, {
        classes: new Map([[class_id, class_def]]),
      });

      const { definitions, resolutions } = make_mock_registries();
      definitions.update_file(file1, [class_def]);

      registry.update_file(file1, index, definitions, resolutions, empty_exports, empty_languages, empty_resolution);

      const retrieved = registry.get_type_members(class_id);
      expect(retrieved?.methods.get("foo" as SymbolName)).toEqual(foo_id);
      expect(retrieved?.properties.get("bar" as SymbolName)).toEqual(bar_id);
      expect(retrieved?.extends).toEqual([]);
    });

    it("builds members for an interface from its definition", () => {
      const file1 = "file1.ts" as FilePath;
      const iface_loc = make_location(file1, 1, 0, 5, 1);
      const iface_id = interface_symbol("Greeter", iface_loc);
      const greet_loc = make_location(file1, 2, 2);
      const greet_id = method_symbol("greet", greet_loc);
      const iface_def: AnyDefinition = {
        kind: "interface",
        symbol_id: iface_id,
        name: "Greeter" as SymbolName,
        location: iface_loc,
        defining_scope_id: "module:0:0" as ScopeId,
        is_exported: false,
        extends: [],
        methods: [
          {
            kind: "method",
            symbol_id: greet_id,
            name: "greet" as SymbolName,
            location: greet_loc,
            parameters: [],
            defining_scope_id: "module:0:0" as ScopeId,
          },
        ],
        properties: [],
      };

      const index = make_test_index(file1, {
        interfaces: new Map([[iface_id, iface_def]]),
      });

      const { definitions, resolutions } = make_mock_registries();
      definitions.update_file(file1, [iface_def]);

      registry.update_file(file1, index, definitions, resolutions, empty_exports, empty_languages, empty_resolution);

      const retrieved = registry.get_type_members(iface_id);
      expect(retrieved?.methods.get("greet" as SymbolName)).toEqual(greet_id);
      expect(retrieved?.properties.size).toEqual(0);
      expect(retrieved?.extends).toEqual([]);
    });

    it("keys the constructor into the member index under its name", () => {
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
        constructors: [
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

      registry.update_file(file1, index, definitions, resolutions, empty_exports, empty_languages, empty_resolution);

      const members = definitions.get_member_index().get(class_id);
      expect(members?.get("constructor" as SymbolName)).toEqual(constructor_id);
    });

    it("omits a constructor key when the class has none", () => {
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

      registry.update_file(file1, index, definitions, resolutions, empty_exports, empty_languages, empty_resolution);

      const members = definitions.get_member_index().get(class_id);
      expect(members?.get("constructor" as SymbolName)).toBeUndefined();
    });

    it("keys a Python __init__ constructor into the member index (language-agnostic)", () => {
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
        constructors: [
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

      registry.update_file(file1, index, definitions, resolutions, empty_exports, empty_languages, empty_resolution);

      const members = definitions.get_member_index().get(class_id);
      expect(members?.get("__init__" as SymbolName)).toEqual(init_id);
    });
  });

  describe("TypeContext Methods", () => {
    describe("get_symbol_type", () => {
      it("returns type from explicit annotation", () => {
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
          constructors: [],
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

        set_test_resolutions(
          resolutions,
          "module:0:0" as ScopeId,
          new Map([["User" as SymbolName, user_class_id]])
        );

        type_registry.update_file(file1, index, definitions, resolutions, empty_exports, empty_languages, empty_resolution);

        // Test get_symbol_type
        const result = type_registry.get_symbol_type(user_var_id);
        expect(result).toBe(user_class_id);
      });

      it("returns null for untyped symbols", () => {
        const file1 = "file1.ts" as FilePath;
        const type_registry = new TypeRegistry();

        const { id: var_id } = make_variable_with_type("x", "number", file1, 1);

        // Symbol not in registry
        const result = type_registry.get_symbol_type(var_id);
        expect(result).toBeNull();
      });
    });

    describe("walk_inheritance_chain", () => {
      it("returns the full inheritance chain", () => {
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
          constructors: [],
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
          constructors: [],
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
          constructors: [],
        };

        definitions.update_file(file1, [animal_def, mammal_def, dog_def]);
        const index = make_test_index(file1, {
          classes: new Map([
            [animal_id, animal_def],
            [mammal_id, mammal_def],
            [dog_id, dog_def],
          ]),
        });

        set_test_resolutions(
          resolutions,
          "module:0:0" as ScopeId,
          new Map([
            ["Animal" as SymbolName, animal_id],
            ["Mammal" as SymbolName, mammal_id],
          ])
        );

        type_registry.update_file(file1, index, definitions, resolutions, empty_exports, empty_languages, empty_resolution);

        const result = type_registry.walk_inheritance_chain(dog_id);
        expect(result).toEqual([dog_id, mammal_id, animal_id]);
      });

      it("includes only the class itself when there is no parent", () => {
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
          constructors: [],
        };

        definitions.update_file(file1, [animal_def]);
        const index = make_test_index(file1, {
          classes: new Map([[animal_id, animal_def]]),
        });

        type_registry.update_file(file1, index, definitions, resolutions, empty_exports, empty_languages, empty_resolution);

        const result = type_registry.walk_inheritance_chain(animal_id);
        expect(result).toEqual([animal_id]);
      });

      it("stops at a cycle in circular inheritance", () => {
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
      it("finds direct members", () => {
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
        const get_name_id = class_def.methods[0].symbol_id;

        definitions.update_file(file1, [class_def]);
        const index = make_test_index(file1, {
          classes: new Map([[class_id, class_def]]),
        });

        type_registry.update_file(file1, index, definitions, resolutions, empty_exports, empty_languages, empty_resolution);

        const result = type_registry.get_type_member(
          class_id,
          "getName" as SymbolName
        );
        expect(result).toBe(get_name_id);
      });

      it("finds inherited members", () => {
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
          constructors: [],
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
          constructors: [],
        };

        definitions.update_file(file1, [animal_def, dog_def]);
        const index = make_test_index(file1, {
          classes: new Map([
            [animal_id, animal_def],
            [dog_id, dog_def],
          ]),
        });

        set_test_resolutions(
          resolutions,
          "module:0:0" as ScopeId,
          new Map([["Animal" as SymbolName, animal_id]])
        );

        type_registry.update_file(file1, index, definitions, resolutions, empty_exports, empty_languages, empty_resolution);

        // Dog should find speak() from Animal
        const result = type_registry.get_type_member(
          dog_id,
          "speak" as SymbolName
        );
        expect(result).toBe(speak_method_id);
      });

      it("returns null for non-existent members", () => {
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

        type_registry.update_file(file1, index, definitions, resolutions, empty_exports, empty_languages, empty_resolution);

        const result = type_registry.get_type_member(
          class_id,
          "nonExistent" as SymbolName
        );
        expect(result).toBeNull();
      });

      it("prefers direct members over inherited", () => {
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
          constructors: [],
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
          constructors: [],
        };

        definitions.update_file(file1, [animal_def, dog_def]);
        const index = make_test_index(file1, {
          classes: new Map([
            [animal_id, animal_def],
            [dog_id, dog_def],
          ]),
        });

        set_test_resolutions(
          resolutions,
          "module:0:0" as ScopeId,
          new Map([["Animal" as SymbolName, animal_id]])
        );

        type_registry.update_file(file1, index, definitions, resolutions, empty_exports, empty_languages, empty_resolution);

        // Should return Dog's speak, not Animal's
        const result = type_registry.get_type_member(
          dog_id,
          "speak" as SymbolName
        );
        expect(result).toBe(dog_speak_id);
        expect(result).not.toBe(animal_speak_id);
      });
    });

  });

  describe("register_late_binding", () => {
    it("records a binding queryable via get_symbol_type", () => {
      const file1 = "file1.ts" as FilePath;
      const var_id = variable_symbol("user", make_location(file1, 3));
      const type_id = class_symbol("User", make_location(file1, 1, 0, 2, 1));

      registry.register_late_binding(var_id, type_id, file1);

      expect(registry.get_symbol_type(var_id)).toBe(type_id);
    });

    it("evicts a late binding when its file is removed", () => {
      const file1 = "file1.ts" as FilePath;
      const var_id = variable_symbol("user", make_location(file1, 3));
      const type_id = class_symbol("User", make_location(file1, 1, 0, 2, 1));

      registry.register_late_binding(var_id, type_id, file1);
      registry.remove_file(file1);

      expect(registry.get_symbol_type(var_id)).toBeNull();
    });
  });

  describe("remove_file", () => {
    it("evicts symbol types, members, and inheritance for the file", () => {
      const file1 = "file1.ts" as FilePath;
      const definitions = new DefinitionRegistry();
      const resolutions = new ResolutionRegistry();

      const animal_loc = make_location(file1, 1, 0, 5, 1);
      const animal_id = class_symbol("Animal", animal_loc);
      const speak_loc = make_location(file1, 2, 2);
      const speak_id = method_symbol("speak", speak_loc);
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
            symbol_id: speak_id,
            name: "speak" as SymbolName,
            location: speak_loc,
            parameters: [],
            defining_scope_id: "module:0:0" as ScopeId,
          },
        ],
        properties: [],
        decorators: [],
        constructors: [],
      };

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
        constructors: [],
      };

      const { id: user_id, def: user_def } = make_variable_with_type(
        "user",
        "Dog",
        file1,
        11
      );

      definitions.update_file(file1, [animal_def, dog_def, user_def]);
      const index = make_test_index(file1, {
        variables: new Map([[user_id, user_def]]),
        classes: new Map([
          [animal_id, animal_def],
          [dog_id, dog_def],
        ]),
      });
      set_test_resolutions(
        resolutions,
        "module:0:0" as ScopeId,
        new Map([
          ["Animal" as SymbolName, animal_id],
          ["Dog" as SymbolName, dog_id],
        ])
      );

      registry.update_file(file1, index, definitions, resolutions, empty_exports, empty_languages, empty_resolution);

      expect(registry.get_symbol_type(user_id)).toBe(dog_id);
      expect(registry.walk_inheritance_chain(dog_id)).toEqual([dog_id, animal_id]);
      expect(registry.get_type_member(dog_id, "speak" as SymbolName)).toBe(speak_id);

      registry.remove_file(file1);

      expect(registry.get_symbol_type(user_id)).toBeNull();
      expect(registry.walk_inheritance_chain(dog_id)).toEqual([dog_id]);
      expect(registry.get_type_member(dog_id, "speak" as SymbolName)).toBeNull();
    });
  });

  describe("clear", () => {
    it("empties every index", () => {
      const file1 = "file1.ts" as FilePath;
      const definitions = new DefinitionRegistry();
      const resolutions = new ResolutionRegistry();

      const { id: class_id, def: class_def } = make_class_with_members(
        "User",
        file1,
        ["getName"]
      );

      definitions.update_file(file1, [class_def]);
      const index = make_test_index(file1, {
        classes: new Map([[class_id, class_def]]),
      });
      registry.update_file(file1, index, definitions, resolutions, empty_exports, empty_languages, empty_resolution);

      registry.clear();

      expect(registry.get_type_member(class_id, "getName" as SymbolName)).toBeNull();
    });
  });
});

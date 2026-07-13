import { describe, it, expect, beforeEach } from "vitest";
import { resolve_constructor_call, include_constructors_for_class_symbols } from "./constructor";
import { DefinitionRegistry } from "../registries/definition";
import { ScopeRegistry } from "../registries/scope";
import { ResolutionRegistry } from "../resolve_references";
import { ExportRegistry } from "../registries/export";
import type { FileSystemFolder } from "../file_folders";
import { make_export_chain_context } from "../resolution_test_helpers";
import { set_test_resolutions, unwrap } from "../resolve_references.test";
import { create_constructor_call_reference } from "../../index_single_file/references/factories";
import { class_symbol, is_err } from "@ariadnejs/types";
import type {
  SymbolId,
  SymbolName,
  ScopeId,
  Location,
  FilePath,
  Language,
  MethodDefinition,
  ClassDefinition,
  ConstructorDefinition,
  FunctionDefinition,
} from "@ariadnejs/types";

// Test fixtures
const TEST_FILE = "test.ts" as FilePath;
const FILE_SCOPE_ID = "scope:test.ts:file:0:0" as ScopeId;
const CLASS_SCOPE_ID = "scope:test.ts:MyClass:1:0" as ScopeId;
const PARENT_CLASS_SCOPE_ID = "scope:test.ts:Parent:1:0" as ScopeId;
const CONSTRUCTOR_SCOPE_ID = "scope:test.ts:MyClass.constructor:2:2" as ScopeId;
const PARENT_CONSTRUCTOR_SCOPE_ID = "scope:test.ts:Parent.constructor:2:2" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 15,
  end_line: 5,
  end_column: 22,
};

describe("Constructor Call Resolution", () => {
  let definitions: DefinitionRegistry;
  let scopes: ScopeRegistry;
  let resolutions: ResolutionRegistry;
  let exports: ExportRegistry;
  let languages: Map<FilePath, Language>;
  let root_folder: FileSystemFolder;

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    scopes = new ScopeRegistry();
    resolutions = new ResolutionRegistry();
    ({ exports, languages, root_folder } = make_export_chain_context());
  });

  describe("Resolves to constructor symbol", () => {
    it("resolves a constructor call to the explicit constructor symbol", () => {
      const class_id = class_symbol("MyClass", MOCK_LOCATION);
      const constructor_id =
        "constructor:test.ts:2:2:4:3:constructor" as SymbolId;

      const constructor_def: ConstructorDefinition = {
        kind: "constructor",
        symbol_id: constructor_id,
        name: "constructor" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: {
          ...MOCK_LOCATION,
          start_line: 2,
        },
        parameters: [],
        body_scope_id: CONSTRUCTOR_SCOPE_ID,
      };

      // Create class definition with constructor
      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: {
          ...MOCK_LOCATION,
          start_line: 1,
        },
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructors: [constructor_def],
      };

      definitions.update_file(TEST_FILE, [class_def, constructor_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("MyClass" as SymbolName, class_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "MyClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        scopes,
        resolutions,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved)).toEqual([constructor_id]);
    });

    it("resolves a constructor that has parameters", () => {
      const class_id = class_symbol("User", MOCK_LOCATION);
      const constructor_id =
        "constructor:test.ts:2:2:5:3:constructor" as SymbolId;

      const constructor_def: ConstructorDefinition = {
        kind: "constructor",
        symbol_id: constructor_id,
        name: "constructor" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: {
          ...MOCK_LOCATION,
          start_line: 2,
        },
        parameters: [
          {
            kind: "parameter",
            symbol_id: "param:test.ts:2:14:2:18:name" as SymbolId,
            name: "name" as SymbolName,
            defining_scope_id: CONSTRUCTOR_SCOPE_ID,
            location: { ...MOCK_LOCATION, start_line: 2, start_column: 14 },
          },
          {
            kind: "parameter",
            symbol_id: "param:test.ts:2:28:2:31:age" as SymbolId,
            name: "age" as SymbolName,
            defining_scope_id: CONSTRUCTOR_SCOPE_ID,
            location: { ...MOCK_LOCATION, start_line: 2, start_column: 28 },
          },
        ],
        body_scope_id: CONSTRUCTOR_SCOPE_ID,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "User" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructors: [constructor_def],
      };

      definitions.update_file(TEST_FILE, [class_def, constructor_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("User" as SymbolName, class_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "User" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        scopes,
        resolutions,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved)).toEqual([constructor_id]);
    });
  });

  describe("Falls back to class symbol", () => {
    it("returns the class symbol when no explicit constructor exists", () => {
      const class_id = class_symbol("SimpleClass", MOCK_LOCATION);

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "SimpleClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
      };

      definitions.update_file(TEST_FILE, [class_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("SimpleClass" as SymbolName, class_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "SimpleClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        scopes,
        resolutions,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved)).toEqual([class_id]);
    });

    it("returns the class symbol when the constructor array is empty", () => {
      const class_id = class_symbol("EmptyClass", MOCK_LOCATION);

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "EmptyClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructors: [],
      };

      definitions.update_file(TEST_FILE, [class_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("EmptyClass" as SymbolName, class_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "EmptyClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        scopes,
        resolutions,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved)).toEqual([class_id]);
    });
  });

  describe("Inherited constructor (hierarchy walk)", () => {
    it("resolves to the parent constructor when the child declares none", () => {
      const parent_id = class_symbol("Parent", MOCK_LOCATION);
      const child_id = class_symbol("Child", { ...MOCK_LOCATION, start_line: 10 });
      const parent_ctor_id = "constructor:test.ts:2:2:4:3:constructor" as SymbolId;

      const parent_ctor: ConstructorDefinition = {
        kind: "constructor",
        symbol_id: parent_ctor_id,
        name: "__init__" as SymbolName,
        defining_scope_id: PARENT_CLASS_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 2 },
        parameters: [],
        body_scope_id: PARENT_CONSTRUCTOR_SCOPE_ID,
      };

      const parent_def: ClassDefinition = {
        kind: "class",
        symbol_id: parent_id,
        name: "Parent" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructors: [parent_ctor],
      };

      const child_def: ClassDefinition = {
        kind: "class",
        symbol_id: child_id,
        name: "Child" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 10 },
        is_exported: false,
        extends: ["Parent" as SymbolName],
        methods: [],
        properties: [],
        decorators: [],
      };

      definitions.update_file(TEST_FILE, [parent_def, parent_ctor, child_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("Parent" as SymbolName, parent_id);
      scope_resolutions.set("Child" as SymbolName, child_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "Child" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        scopes,
        resolutions,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved)).toEqual([parent_ctor_id]);
    });

    it("falls back to the class symbol when the extended parent is unresolvable", () => {
      const child_id = class_symbol("Orphan", MOCK_LOCATION);

      const child_def: ClassDefinition = {
        kind: "class",
        symbol_id: child_id,
        name: "Orphan" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: ["NonExistent" as SymbolName],
        methods: [],
        properties: [],
        decorators: [],
      };

      definitions.update_file(TEST_FILE, [child_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("Orphan" as SymbolName, child_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "Orphan" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        scopes,
        resolutions,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved)).toEqual([child_id]);
    });

    it("terminates on a cyclic extends chain and falls back to the class symbol", () => {
      const class_a_id = class_symbol("ClassA", MOCK_LOCATION);
      const class_b_id = class_symbol("ClassB", { ...MOCK_LOCATION, start_line: 10 });

      const class_a: ClassDefinition = {
        kind: "class",
        symbol_id: class_a_id,
        name: "ClassA" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: ["ClassB" as SymbolName],
        methods: [],
        properties: [],
        decorators: [],
      };

      const class_b: ClassDefinition = {
        kind: "class",
        symbol_id: class_b_id,
        name: "ClassB" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 10 },
        is_exported: false,
        extends: ["ClassA" as SymbolName],
        methods: [],
        properties: [],
        decorators: [],
      };

      definitions.update_file(TEST_FILE, [class_a, class_b]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("ClassA" as SymbolName, class_a_id);
      scope_resolutions.set("ClassB" as SymbolName, class_b_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "ClassA" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        scopes,
        resolutions,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved)).toEqual([class_a_id]);
    });
  });

  describe("Unresolved Cases", () => {
    it("fails with name_not_in_scope when the class name does not resolve", () => {
      set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map());

      const call_ref = create_constructor_call_reference(
        "UndefinedClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        scopes,
        resolutions,
        exports,
        languages,
        root_folder
      );

      expect(resolved.ok).toBe(false);
      if (is_err(resolved)) {
        expect(resolved.error.stage).toBe("constructor_lookup");
        expect(resolved.error.reason).toBe("name_not_in_scope");
      }
    });

    it("fails with constructor_target_not_a_class when the name resolves to a function", () => {
      const func_id = "function:test.ts:1:0:3:1:NotAClass" as SymbolId;

      const func_def: FunctionDefinition = {
        kind: "function",
        symbol_id: func_id,
        name: "NotAClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        signature: {
          parameters: [],
        },
        body_scope_id: "scope:test.ts:NotAClass:1:0" as ScopeId,
      };

      definitions.update_file(TEST_FILE, [func_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("NotAClass" as SymbolName, func_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "NotAClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        scopes,
        resolutions,
        exports,
        languages,
        root_folder
      );

      expect(resolved.ok).toBe(false);
      if (is_err(resolved)) {
        expect(resolved.error.stage).toBe("constructor_lookup");
        expect(resolved.error.reason).toBe("constructor_target_not_a_class");
      }
    });

    it("fails when the resolved symbol has no definition in the registry", () => {
      const unknown_id = "class:test.ts:1:0:1:10:Unknown" as SymbolId;

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("Unknown" as SymbolName, unknown_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "Unknown" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        scopes,
        resolutions,
        exports,
        languages,
        root_folder
      );

      expect(resolved.ok).toBe(false);
      if (is_err(resolved)) {
        expect(resolved.error.stage).toBe("constructor_lookup");
        expect(resolved.error.reason).toBe("constructor_target_not_a_class");
      }
    });
  });

  describe("Constructor stored outside the constructors array", () => {
    it("does not treat a method named `constructor` as the constructor", () => {
      const class_id = class_symbol("BuggyClass", MOCK_LOCATION);

      const fake_constructor_method: MethodDefinition = {
        kind: "method",
        symbol_id: "method:test.ts:2:2:4:3:constructor" as SymbolId,
        name: "constructor" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 2 },
        parameters: [],
        body_scope_id: CONSTRUCTOR_SCOPE_ID,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "BuggyClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [fake_constructor_method],
        properties: [],
        decorators: [],
      };

      definitions.update_file(TEST_FILE, [class_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("BuggyClass" as SymbolName, class_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "BuggyClass" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID
      );

      const resolved = resolve_constructor_call(
        call_ref,
        definitions,
        scopes,
        resolutions,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved)).toEqual([class_id]);
      expect(unwrap(resolved)).not.toContain(fake_constructor_method.symbol_id);
    });
  });
});

describe("include_constructors_for_class_symbols", () => {
  let definitions: DefinitionRegistry;
  let resolutions: ResolutionRegistry;

  beforeEach(() => {
    definitions = new DefinitionRegistry();
    resolutions = new ResolutionRegistry();
  });

  it("adds constructor when resolved symbol is a class", () => {
    const class_id = class_symbol("MyClass", MOCK_LOCATION);
    const constructor_id = "constructor:test.ts:2:2:4:3:constructor" as SymbolId;

    const constructor_def: ConstructorDefinition = {
      kind: "constructor",
      symbol_id: constructor_id,
      name: "constructor" as SymbolName,
      defining_scope_id: CLASS_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 2 },
      parameters: [],
      body_scope_id: CONSTRUCTOR_SCOPE_ID,
    };

    const class_def: ClassDefinition = {
      kind: "class",
      symbol_id: class_id,
      name: "MyClass" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      is_exported: false,
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
      constructors: [constructor_def],
    };

    definitions.update_file(TEST_FILE, [class_def, constructor_def]);

    const result = include_constructors_for_class_symbols([class_id], definitions, resolutions);
    expect(result).toEqual([class_id, constructor_id]);
  });

  it("is idempotent — does not duplicate constructor already in list", () => {
    const class_id = class_symbol("MyClass", MOCK_LOCATION);
    const constructor_id = "constructor:test.ts:2:2:4:3:constructor" as SymbolId;

    const constructor_def: ConstructorDefinition = {
      kind: "constructor",
      symbol_id: constructor_id,
      name: "constructor" as SymbolName,
      defining_scope_id: CLASS_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 2 },
      parameters: [],
      body_scope_id: CONSTRUCTOR_SCOPE_ID,
    };

    const class_def: ClassDefinition = {
      kind: "class",
      symbol_id: class_id,
      name: "MyClass" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      is_exported: false,
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
      constructors: [constructor_def],
    };

    definitions.update_file(TEST_FILE, [class_def, constructor_def]);

    // Constructor already in the list
    const result = include_constructors_for_class_symbols(
      [class_id, constructor_id],
      definitions,
      resolutions
    );
    expect(result).toEqual([class_id, constructor_id]);
  });

  it("passes through non-class symbols unchanged", () => {
    const func_id = "function:test.ts:1:0:3:1:myFunc" as SymbolId;
    const func_def: FunctionDefinition = {
      kind: "function",
      symbol_id: func_id,
      name: "myFunc" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: MOCK_LOCATION,
      is_exported: false,
      signature: { parameters: [] },
      body_scope_id: "scope:test.ts:myFunc:1:0" as ScopeId,
    };

    definitions.update_file(TEST_FILE, [func_def]);

    const result = include_constructors_for_class_symbols([func_id], definitions, resolutions);
    expect(result).toEqual([func_id]);
  });

  it("returns empty array unchanged", () => {
    const result = include_constructors_for_class_symbols([], definitions, resolutions);
    expect(result).toEqual([]);
  });
});

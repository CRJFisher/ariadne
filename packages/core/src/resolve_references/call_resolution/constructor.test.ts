import { describe, it, expect, beforeEach } from "vitest";
import { resolve_constructor_call, include_constructors_for_class_symbols } from "./constructor";
import { DefinitionRegistry } from "../registries/definition";
import { ScopeRegistry } from "../registries/scope";
import { ResolutionRegistry } from "../resolve_references";
import { ExportRegistry } from "../registries/export";
import type { FileSystemFolder } from "../file_folders";
import { make_export_chain_context } from "../file_folders_test_helper";
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

  describe("Rust associated constructor (member-index link)", () => {
    // Rust `impl T { fn new() }` indexes `new` as a plain method, leaving
    // ClassDefinition.constructors empty. A qualified `T::new()` call carries a
    // path_prefix; the resolver links it to the `new` member rather than falling
    // back to the bare class symbol.
    function make_rust_struct_with_new(struct_name: string): {
      class_id: SymbolId;
      new_method_id: SymbolId;
    } {
      const class_id = class_symbol(struct_name, MOCK_LOCATION);
      const new_method_id =
        "method:test.rs:2:4:4:5:new" as SymbolId;
      const new_method: MethodDefinition = {
        kind: "method",
        symbol_id: new_method_id,
        name: "new" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 2 },
        parameters: [],
        static: true,
        body_scope_id: CONSTRUCTOR_SCOPE_ID,
      };
      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: struct_name as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: true,
        extends: [],
        methods: [new_method], // Rust `new` lives in methods, not constructors
        properties: [],
        decorators: [],
        constructors: [],
      };
      definitions.update_file(TEST_FILE, [class_def]);
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set(struct_name as SymbolName, class_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);
      return { class_id, new_method_id };
    }

    it("links an in-scope Type::new() to the `new` member, not the class symbol", () => {
      const { new_method_id } = make_rust_struct_with_new("Parker");

      const call_ref = create_constructor_call_reference(
        "Parker" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        undefined,
        undefined,
        ["Parker"] as SymbolName[]
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

      expect(unwrap(resolved)).toEqual([new_method_id]);
    });

    it("does not fire the member-index link without a path_prefix (TS new ClassName() untouched)", () => {
      const { class_id } = make_rust_struct_with_new("Parker");

      // No path_prefix → the TS `new ClassName()` path: a class with no
      // constructor falls back to the class symbol, never the `new` method.
      const call_ref = create_constructor_call_reference(
        "Parker" as SymbolName,
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

    it("falls back to the class symbol for a qualified call when the type has no `new` member", () => {
      const bare_class_id = class_symbol("Bare", MOCK_LOCATION);
      const bare_def: ClassDefinition = {
        kind: "class",
        symbol_id: bare_class_id,
        name: "Bare" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: true,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructors: [],
      };
      definitions.update_file(TEST_FILE, [bare_def]);
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("Bare" as SymbolName, bare_class_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "Bare" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        undefined,
        undefined,
        ["Bare"] as SymbolName[]
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

      expect(unwrap(resolved)).toEqual([bare_class_id]);
    });

    it("does not link a qualified call to a non-callable member named `new` (a field)", () => {
      // A Rust `struct T { new: u32 }` field overwrites a `fn new` in the flat
      // member index; the constructor link must not bind to the property.
      const class_id = class_symbol("Shadowed", MOCK_LOCATION);
      const field_id = "property:test.rs:2:4:2:14:new" as SymbolId;
      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "Shadowed" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: true,
        extends: [],
        methods: [],
        properties: [
          {
            kind: "property",
            symbol_id: field_id,
            name: "new" as SymbolName,
            defining_scope_id: CLASS_SCOPE_ID,
            location: { ...MOCK_LOCATION, start_line: 2 },
            decorators: [],
          },
        ],
        decorators: [],
        constructors: [],
      };
      definitions.update_file(TEST_FILE, [class_def]);
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("Shadowed" as SymbolName, class_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "Shadowed" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        undefined,
        undefined,
        ["Shadowed"] as SymbolName[]
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

  describe("Inline-full-path constructor (module-path walk)", () => {
    // The terminal type name misses in scope and a type-last path_prefix is
    // present; the resolver walks the module path to bind the type. These cases
    // assert the bail boundaries — the positive resolution is exercised
    // end-to-end in project.rust.integration.test.ts.
    it("bails when the module qualifier does not resolve in scope", () => {
      // crate::runtime::Driver::new(): `Driver` not in scope, and `runtime` does
      // not resolve at all — bail rather than fabricate an edge.
      set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map());

      const call_ref = create_constructor_call_reference(
        "Driver" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        undefined,
        undefined,
        ["crate", "runtime", "Driver"] as SymbolName[]
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

    it("bails when the module qualifier resolves to a non-namespace definition", () => {
      // Outer::Inner::new(): `Inner` not in scope, and the qualifier `Outer`
      // resolves to a type, not a `mod` — only a namespace has a module body to
      // walk, so bail rather than treat a type as a module.
      const outer_id = class_symbol("Outer", MOCK_LOCATION);
      const outer_def: ClassDefinition = {
        kind: "class",
        symbol_id: outer_id,
        name: "Outer" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: true,
        extends: [],
        methods: [],
        properties: [],
        decorators: [],
        constructors: [],
      };
      definitions.update_file(TEST_FILE, [outer_def]);
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("Outer" as SymbolName, outer_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_constructor_call_reference(
        "Inner" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        undefined,
        undefined,
        ["Outer", "Inner"] as SymbolName[]
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

    it("bails when the path_prefix carries no module path (lone type segment)", () => {
      // Cell::<u8>::new() reduces to name `Cell`, prefix ["Cell"] — a single
      // segment is the type itself with no module to walk, so the bare miss stands.
      set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map());

      const call_ref = create_constructor_call_reference(
        "Cell" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        undefined,
        undefined,
        ["Cell"] as SymbolName[]
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

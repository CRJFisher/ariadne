import { describe, it, expect, beforeEach } from "vitest";
import { resolve_constructor_call } from "./constructor";
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
} from "@ariadnejs/types";

// Test fixtures
const TEST_FILE = "test.ts" as FilePath;
const FILE_SCOPE_ID = "scope:test.ts:file:0:0" as ScopeId;
const CLASS_SCOPE_ID = "scope:test.ts:MyClass:1:0" as ScopeId;
const CONSTRUCTOR_SCOPE_ID = "scope:test.ts:MyClass.constructor:2:2" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 15,
  end_line: 5,
  end_column: 22,
};

describe("Rust Constructor Resolution", () => {
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
});

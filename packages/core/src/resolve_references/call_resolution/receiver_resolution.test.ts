/**
 * Unit Tests for Receiver Resolution Module
 *
 * Tests the core functions for resolving receiver expressions:
 * - extract_receiver: Normalizes self-reference and method calls
 * - resolve_receiver_type: Two-phase resolution (base + chain)
 * - find_self_type: The type a self receiver in a scope denotes
 *
 * These unit tests focus on individual function behavior.
 * For full integration tests, see method.test.ts and self_reference.integration.test.ts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { make_export_chain_context, make_type_resolution_context } from "../resolution_test_helpers";
import {
  extract_receiver,
  resolve_receiver_type,
  find_self_type,
  type ReceiverExpression,
  type ReceiverResolutionContext,
} from "./receiver_resolution";
import { resolve_held_type } from "./value_source";
import { ScopeRegistry } from "../registries/scope";
import { DefinitionRegistry } from "../registries/definition";
import { TypeRegistry } from "../registries/type";
import { ExportRegistry } from "../registries/export";
import { ResolutionRegistry } from "../resolution_registry";
import { ImportGraph } from "../import_resolution/import_graph";
import { set_test_resolutions } from "../resolve_references.test";
import type {
  SymbolId,
  SymbolName,
  ScopeId,
  Location,
  FilePath,
  ModulePath,
  LexicalScope,
  SelfReferenceCall,
  MethodCallReference,
  MethodDefinition,
  ClassDefinition,
  InterfaceDefinition,
  EnumDefinition,
  AnyDefinition,
  PropertyDefinition,
  ImportDefinition,
  NamespaceDefinition,
  VariableDefinition,
  ParameterDefinition,
  FunctionDefinition,
  SemanticIndex,
} from "@ariadnejs/types";
import {
  class_symbol,
  method_symbol,
  property_symbol,
  variable_symbol,
  namespace_symbol,
  is_ok,
  is_err,
} from "@ariadnejs/types";

// Test fixtures
const TEST_FILE = "test.ts" as FilePath;
const FILE_SCOPE_ID = "scope:test.ts:file:0:0" as ScopeId;
const CLASS_SCOPE_ID = "scope:test.ts:MyClass:1:0" as ScopeId;
const METHOD_SCOPE_ID = "scope:test.ts:MyClass.process:2:2" as ScopeId;
const NESTED_SCOPE_ID = "scope:test.ts:MyClass.process.inner:3:4" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 15,
  end_line: 5,
  end_column: 22,
};

describe("extract_receiver", () => {
  describe("SelfReferenceCall extraction", () => {
    it("extracts this.method() with no property chain", () => {
      const ref: SelfReferenceCall = {
        kind: "self_reference_call",
        name: "process" as SymbolName,
        keyword: "this",
        property_chain: ["this", "process"] as SymbolName[],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "this" },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("extracts this.property.method() with property chain", () => {
      const ref: SelfReferenceCall = {
        kind: "self_reference_call",
        name: "query" as SymbolName,
        keyword: "this",
        property_chain: ["this", "db", "query"] as SymbolName[],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "this" },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("extracts self.method() for Python", () => {
      const ref: SelfReferenceCall = {
        kind: "self_reference_call",
        name: "process" as SymbolName,
        keyword: "self",
        property_chain: ["self", "process"] as SymbolName[],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "self" },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("extracts super.method()", () => {
      const ref: SelfReferenceCall = {
        kind: "self_reference_call",
        name: "process" as SymbolName,
        keyword: "super",
        property_chain: ["super", "process"] as SymbolName[],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "super" },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("extracts cls.method() for Python classmethods", () => {
      const ref: SelfReferenceCall = {
        kind: "self_reference_call",
        name: "create" as SymbolName,
        keyword: "cls",
        property_chain: ["cls", "create"] as SymbolName[],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "cls" },
        chain: [],
        method_name: "create" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("handles deep property chains", () => {
      const ref: SelfReferenceCall = {
        kind: "self_reference_call",
        name: "execute" as SymbolName,
        keyword: "this",
        property_chain: ["this", "config", "database", "connection", "execute"] as SymbolName[],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "this" },
        chain: [
          "config" as SymbolName,
          "database" as SymbolName,
          "connection" as SymbolName,
        ],
        method_name: "execute" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });
  });

  describe("MethodCallReference extraction", () => {
    it("carries an index-access receiver and whether its key is a literal from call_site_syntax", () => {
      const index_ref = (index_key_is_literal: boolean): MethodCallReference => ({
        kind: "method_call",
        name: "afterEach" as SymbolName,
        property_chain: ["suites", "afterEach"] as SymbolName[],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
        is_optional_chain: false,
        call_site_syntax: { receiver_kind: "index_access", index_key_is_literal },
      });

      expect([extract_receiver(index_ref(true)), extract_receiver(index_ref(false))]).toEqual([
        {
          base: { type: "identifier", value: "suites" as SymbolName },
          chain: [],
          method_name: "afterEach" as SymbolName,
          scope_id: METHOD_SCOPE_ID,
          index_access: { key_is_literal: true },
        },
        {
          base: { type: "identifier", value: "suites" as SymbolName },
          chain: [],
          method_name: "afterEach" as SymbolName,
          scope_id: METHOD_SCOPE_ID,
          index_access: { key_is_literal: false },
        },
      ]);
    });

    it("carries index access on a keyword-rooted chain (`this.items[0].run()`)", () => {
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "run" as SymbolName,
        property_chain: ["this", "items", "run"] as SymbolName[],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
        is_optional_chain: false,
        call_site_syntax: { receiver_kind: "index_access", index_key_is_literal: true },
      };

      expect(extract_receiver(ref)).toEqual({
        base: { type: "keyword", value: "this" },
        chain: ["items" as SymbolName],
        method_name: "run" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
        index_access: { key_is_literal: true },
      });
    });

    it("extracts obj.method() with identifier base", () => {
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "process" as SymbolName,
        property_chain: ["obj", "process"] as SymbolName[],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
        is_optional_chain: false,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "identifier", value: "obj" as SymbolName },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("extracts obj.field.method() with property chain", () => {
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "query" as SymbolName,
        property_chain: ["service", "db", "query"] as SymbolName[],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
        is_optional_chain: false,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "identifier", value: "service" as SymbolName },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("slices property_chain_arguments to align with the mid-chain properties", () => {
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "handle" as SymbolName,
        property_chain: ["injector", "get", "handle"] as SymbolName[],
        property_chain_arguments: [null, ["Token" as SymbolName], []],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
        is_optional_chain: false,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "identifier", value: "injector" as SymbolName },
        chain: ["get" as SymbolName],
        chain_arguments: [["Token" as SymbolName]],
        method_name: "handle" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("detects 'this' in method_call and treat as keyword", () => {
      // this.property.method() is indexed as method_call, yet 'this' is a keyword base.
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "query" as SymbolName,
        property_chain: ["this", "db", "query"] as SymbolName[],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
        is_optional_chain: false,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "this" },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("detects 'self' in method_call and treat as keyword", () => {
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "query" as SymbolName,
        property_chain: ["self", "db", "query"] as SymbolName[],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
        is_optional_chain: false,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "self" },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("detects 'super' in method_call and treat as keyword", () => {
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "query" as SymbolName,
        property_chain: ["super", "db", "query"] as SymbolName[],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
        is_optional_chain: false,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "super" },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("detects 'cls' in method_call and treat as keyword", () => {
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "create" as SymbolName,
        property_chain: ["cls", "factory", "create"] as SymbolName[],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
        is_optional_chain: false,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "keyword", value: "cls" },
        chain: ["factory" as SymbolName],
        method_name: "create" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });

    it("does not treat regular identifiers as keywords", () => {
      // Variable named 'thisService' should be treated as identifier
      const ref: MethodCallReference = {
        kind: "method_call",
        name: "process" as SymbolName,
        property_chain: ["thisService", "process"] as SymbolName[],
        scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        receiver_location: MOCK_LOCATION,
        is_optional_chain: false,
      };

      const result = extract_receiver(ref);

      expect(result).toEqual({
        base: { type: "identifier", value: "thisService" as SymbolName },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      });
    });
  });
});

describe("find_self_type", () => {
  const CLASS_LOCATION: Location = {
    file_path: TEST_FILE,
    start_line: 1,
    start_column: 0,
    end_line: 50,
    end_column: 0,
  };
  const MY_CLASS_ID = class_symbol("MyClass" as SymbolName, CLASS_LOCATION);

  function make_scope_tree(
    class_scope: Partial<LexicalScope>
  ): Map<ScopeId, LexicalScope> {
    const scope_map = new Map<ScopeId, LexicalScope>();
    scope_map.set(FILE_SCOPE_ID, {
      id: FILE_SCOPE_ID,
      name: null,
      type: "module",
      location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
      parent_id: null,
      child_ids: [CLASS_SCOPE_ID],
      self_type_name: null,
    });
    scope_map.set(CLASS_SCOPE_ID, {
      id: CLASS_SCOPE_ID,
      name: "MyClass" as SymbolName,
      type: "class",
      location: CLASS_LOCATION,
      parent_id: FILE_SCOPE_ID,
      child_ids: [METHOD_SCOPE_ID],
      self_type_name: "MyClass" as SymbolName,
      ...class_scope,
    });
    scope_map.set(METHOD_SCOPE_ID, {
      id: METHOD_SCOPE_ID,
      name: "process" as SymbolName,
      type: "function",
      location: { file_path: TEST_FILE, start_line: 2, start_column: 2, end_line: 20, end_column: 2 },
      parent_id: CLASS_SCOPE_ID,
      child_ids: [NESTED_SCOPE_ID],
      self_type_name: null,
    });
    scope_map.set(NESTED_SCOPE_ID, {
      id: NESTED_SCOPE_ID,
      name: null,
      type: "block",
      location: { file_path: TEST_FILE, start_line: 3, start_column: 4, end_line: 10, end_column: 4 },
      parent_id: METHOD_SCOPE_ID,
      child_ids: [],
      self_type_name: null,
    });
    return scope_map;
  }

  function make_type_definition(
    kind: "class" | "interface" | "enum"
  ): ClassDefinition | InterfaceDefinition | EnumDefinition {
    const base = {
      symbol_id: MY_CLASS_ID,
      name: "MyClass" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: CLASS_LOCATION,
      is_exported: false,
    };
    if (kind === "interface") {
      return { ...base, kind: "interface", extends: [], methods: [], properties: [] };
    }
    if (kind === "enum") {
      return { ...base, kind: "enum", members: [], is_const: false };
    }
    return {
      ...base,
      kind: "class",
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
      constructors: [],
    };
  }

  /**
   * The registries `find_self_type` reads: a class-family scope naming
   * `MyClass`, a method body inside it, a block inside that, and `MyClass`
   * bound where the class scope can see it. Each case states only what it
   * varies.
   */
  function make_context(overrides: {
    readonly class_scope?: Partial<LexicalScope>;
    readonly definition?: AnyDefinition;
    readonly binding?: SymbolId | null;
  }): ReceiverResolutionContext {
    const scopes = new ScopeRegistry();
    scopes.update_file(TEST_FILE, make_scope_tree(overrides.class_scope ?? {}));

    const definitions = new DefinitionRegistry();
    definitions.update_file(TEST_FILE, [
      overrides.definition ?? make_type_definition("class"),
    ]);

    const resolutions = new ResolutionRegistry();
    const binding =
      overrides.binding === undefined ? MY_CLASS_ID : overrides.binding;
    if (binding) {
      // Bound where the class is declared — outside the body that records the
      // name — which is the scope the lookup starts from.
      set_test_resolutions(
        resolutions,
        FILE_SCOPE_ID,
        new Map([["MyClass" as SymbolName, binding]])
      );
    }

    return {
      ...make_export_chain_context(),
      scopes,
      definitions,
      resolutions,
      types: new TypeRegistry(definitions),
      imports: new ImportGraph(),
    };
  }

  it("names the type from the class scope enclosing a method body", () => {
    const result = find_self_type(METHOD_SCOPE_ID, make_context({}));

    expect(result).toEqual({ ok: true, value: MY_CLASS_ID });
  });

  it("names the type from a block nested inside the method body", () => {
    const result = find_self_type(NESTED_SCOPE_ID, make_context({}));

    expect(result).toEqual({ ok: true, value: MY_CLASS_ID });
  });

  it("names the type an interface scope records", () => {
    const result = find_self_type(
      METHOD_SCOPE_ID,
      make_context({ definition: make_type_definition("interface") })
    );

    expect(result).toEqual({ ok: true, value: MY_CLASS_ID });
  });

  it("names the type an enum scope records", () => {
    const result = find_self_type(
      METHOD_SCOPE_ID,
      make_context({ definition: make_type_definition("enum") })
    );

    expect(result).toEqual({ ok: true, value: MY_CLASS_ID });
  });

  it("fails with no_enclosing_class_scope when no scope names a type", () => {
    const context = make_context({ class_scope: { self_type_name: null } });

    const result = find_self_type(METHOD_SCOPE_ID, context);

    expect(result).toEqual({
      ok: false,
      error: {
        stage: "receiver_resolution",
        reason: "no_enclosing_class_scope",
        partial_info: { last_known_scope: METHOD_SCOPE_ID },
      },
    });
  });

  it("fails with no_enclosing_class_scope for an unknown scope", () => {
    const unknown_scope = "scope:test.ts:unknown:99:99" as ScopeId;

    const result = find_self_type(unknown_scope, make_context({}));

    expect(result).toEqual({
      ok: false,
      error: {
        stage: "receiver_resolution",
        reason: "no_enclosing_class_scope",
        partial_info: { last_known_scope: unknown_scope },
      },
    });
  });

  it("fails with class_definition_not_found when the recorded name is unresolvable", () => {
    // A name no binding reaches and no declaration in the lookup scope supplies.
    const result = find_self_type(
      METHOD_SCOPE_ID,
      make_context({
        class_scope: { self_type_name: "Absent" as SymbolName },
        binding: null,
      })
    );

    expect(result).toEqual({
      ok: false,
      error: {
        stage: "receiver_resolution",
        reason: "class_definition_not_found",
        partial_info: { last_known_scope: CLASS_SCOPE_ID },
      },
    });
  });

  it("fails with class_definition_not_found when the recorded name names only a non-type", () => {
    const variable_id = variable_symbol("MyClass" as SymbolName, CLASS_LOCATION);
    const variable: VariableDefinition = {
      kind: "variable",
      symbol_id: variable_id,
      name: "MyClass" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: CLASS_LOCATION,
      is_exported: false,
    };

    const result = find_self_type(
      METHOD_SCOPE_ID,
      make_context({ definition: variable, binding: variable_id })
    );

    expect(result).toEqual({
      ok: false,
      error: {
        stage: "receiver_resolution",
        reason: "class_definition_not_found",
        partial_info: { last_known_scope: CLASS_SCOPE_ID },
      },
    });
  });

  // @language typescript
  // A scope holds one symbol per name, and a merged `namespace Foo` can win the
  // slot from `class Foo`. Only a type can be what `self` denotes, so the type
  // is asked for by kind.
  it("names the class when a same-named namespace won the scope's name binding", () => {
    const namespace_location: Location = {
      file_path: TEST_FILE,
      start_line: 60,
      start_column: 0,
      end_line: 70,
      end_column: 0,
    };
    const namespace_id = namespace_symbol(
      "MyClass" as SymbolName,
      namespace_location
    );
    const merged_namespace: NamespaceDefinition = {
      kind: "namespace",
      symbol_id: namespace_id,
      name: "MyClass" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: namespace_location,
      is_exported: false,
    };

    const scopes = new ScopeRegistry();
    scopes.update_file(TEST_FILE, make_scope_tree({}));
    const definitions = new DefinitionRegistry();
    definitions.update_file(TEST_FILE, [
      make_type_definition("class"),
      merged_namespace,
    ]);
    const resolutions = new ResolutionRegistry();
    set_test_resolutions(
      resolutions,
      FILE_SCOPE_ID,
      new Map([["MyClass" as SymbolName, namespace_id]])
    );

    const context: ReceiverResolutionContext = {
      ...make_export_chain_context(),
      scopes,
      definitions,
      resolutions,
      types: new TypeRegistry(definitions),
      imports: new ImportGraph(),
    };

    const result = find_self_type(METHOD_SCOPE_ID, context);

    expect(result).toEqual({ ok: true, value: MY_CLASS_ID });
  });

  it("stops at the nearest scope carrying a self type rather than an enclosing one", () => {
    const inner_location: Location = {
      file_path: TEST_FILE,
      start_line: 4,
      start_column: 4,
      end_line: 9,
      end_column: 4,
    };
    const inner_id = class_symbol("Inner" as SymbolName, inner_location);
    const inner_class_scope = "scope:test.ts:Inner:4:4" as ScopeId;
    const inner_method_scope = "scope:test.ts:Inner.run:5:6" as ScopeId;

    const scope_map = make_scope_tree({});
    const nested = scope_map.get(NESTED_SCOPE_ID);
    if (!nested) {
      throw new Error("nested scope missing from fixture");
    }
    scope_map.set(NESTED_SCOPE_ID, { ...nested, child_ids: [inner_class_scope] });
    scope_map.set(inner_class_scope, {
      id: inner_class_scope,
      name: "Inner" as SymbolName,
      type: "class",
      location: inner_location,
      parent_id: NESTED_SCOPE_ID,
      child_ids: [inner_method_scope],
      self_type_name: "Inner" as SymbolName,
    });
    scope_map.set(inner_method_scope, {
      id: inner_method_scope,
      name: "run" as SymbolName,
      type: "function",
      location: { file_path: TEST_FILE, start_line: 5, start_column: 6, end_line: 8, end_column: 6 },
      parent_id: inner_class_scope,
      child_ids: [],
      self_type_name: null,
    });

    const inner_class: ClassDefinition = {
      kind: "class",
      symbol_id: inner_id,
      name: "Inner" as SymbolName,
      defining_scope_id: NESTED_SCOPE_ID,
      location: inner_location,
      is_exported: false,
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
      constructors: [],
    };

    const scopes = new ScopeRegistry();
    scopes.update_file(TEST_FILE, scope_map);
    const definitions = new DefinitionRegistry();
    definitions.update_file(TEST_FILE, [make_type_definition("class"), inner_class]);
    const resolutions = new ResolutionRegistry();
    set_test_resolutions(
      resolutions,
      FILE_SCOPE_ID,
      new Map([["MyClass" as SymbolName, MY_CLASS_ID]])
    );
    set_test_resolutions(
      resolutions,
      NESTED_SCOPE_ID,
      new Map([["Inner" as SymbolName, inner_id]])
    );

    const context: ReceiverResolutionContext = {
      ...make_export_chain_context(),
      scopes,
      definitions,
      resolutions,
      types: new TypeRegistry(definitions),
      imports: new ImportGraph(),
    };

    const result = find_self_type(inner_method_scope, context);

    expect(result).toEqual({ ok: true, value: inner_id });
  });

  // @language rust
  // An `impl` block is a `block` scope that names the type it implements. A
  // cross-file `impl` contributes no member the owning type could be read back
  // off, so the recorded name is the only route to it.
  it("names the type a Rust impl block records when the type is declared in another file", () => {
    const struct_file = "model.rs" as FilePath;
    const impl_file = "behaviour.rs" as FilePath;
    const struct_location: Location = {
      file_path: struct_file,
      start_line: 0,
      start_column: 0,
      end_line: 2,
      end_column: 1,
    };
    const struct_id = class_symbol("S" as SymbolName, struct_location);

    const struct_file_scope = "scope:model.rs:file:0:0" as ScopeId;
    const impl_file_scope = "scope:behaviour.rs:file:0:0" as ScopeId;
    const impl_block_scope = "scope:behaviour.rs:block:2:10" as ScopeId;
    const impl_method_scope = "scope:behaviour.rs:describe:3:4" as ScopeId;

    const scopes = new ScopeRegistry();
    scopes.update_file(
      struct_file,
      new Map<ScopeId, LexicalScope>([
        [
          struct_file_scope,
          {
            id: struct_file_scope,
            name: null,
            type: "module",
            location: { file_path: struct_file, start_line: 0, start_column: 0, end_line: 10, end_column: 0 },
            parent_id: null,
            child_ids: [],
            self_type_name: null,
          },
        ],
      ])
    );
    scopes.update_file(
      impl_file,
      new Map<ScopeId, LexicalScope>([
        [
          impl_file_scope,
          {
            id: impl_file_scope,
            name: null,
            type: "module",
            location: { file_path: impl_file, start_line: 0, start_column: 0, end_line: 10, end_column: 0 },
            parent_id: null,
            child_ids: [impl_block_scope],
            self_type_name: null,
          },
        ],
        [
          impl_block_scope,
          {
            id: impl_block_scope,
            name: null,
            type: "block",
            location: { file_path: impl_file, start_line: 2, start_column: 10, end_line: 6, end_column: 1 },
            parent_id: impl_file_scope,
            child_ids: [impl_method_scope],
            self_type_name: "S" as SymbolName,
          },
        ],
        [
          impl_method_scope,
          {
            id: impl_method_scope,
            name: "describe" as SymbolName,
            type: "function",
            location: { file_path: impl_file, start_line: 3, start_column: 4, end_line: 5, end_column: 5 },
            parent_id: impl_block_scope,
            child_ids: [],
            self_type_name: null,
          },
        ],
      ])
    );

    const struct_def: ClassDefinition = {
      kind: "class",
      symbol_id: struct_id,
      name: "S" as SymbolName,
      defining_scope_id: struct_file_scope,
      location: struct_location,
      is_exported: true,
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
      constructors: [],
    };
    const definitions = new DefinitionRegistry();
    definitions.update_file(struct_file, [struct_def]);

    const resolutions = new ResolutionRegistry();
    // The `use` that brings `S` into this file binds it in the module scope
    // above the impl block, which is where the lookup starts.
    set_test_resolutions(
      resolutions,
      impl_file_scope,
      new Map([["S" as SymbolName, struct_id]])
    );

    const context: ReceiverResolutionContext = {
      ...make_export_chain_context(),
      scopes,
      definitions,
      resolutions,
      types: new TypeRegistry(definitions),
      imports: new ImportGraph(),
    };

    const result = find_self_type(impl_method_scope, context);

    expect(result).toEqual({ ok: true, value: struct_id });
  });
});
describe("resolve_receiver_type", () => {
  let scopes: ScopeRegistry;
  let definitions: DefinitionRegistry;
  let types: TypeRegistry;
  let resolutions: ResolutionRegistry;
  let imports: ImportGraph;
  let context: ReceiverResolutionContext;

  // Helper symbols
  let my_class_id: SymbolId;
  let method_id: SymbolId;
  let property_id: SymbolId;
  let database_class_id: SymbolId;

  beforeEach(() => {
    scopes = new ScopeRegistry();
    definitions = new DefinitionRegistry();
    types = new TypeRegistry(definitions);
    resolutions = new ResolutionRegistry();
    imports = new ImportGraph();
    context = {
      scopes,
      definitions,
      types,
      resolutions,
      imports,
      ...make_export_chain_context(),
    };

    // Create test symbols
    my_class_id = class_symbol("MyClass", MOCK_LOCATION);
    method_id = method_symbol("process", MOCK_LOCATION);
    property_id = property_symbol("db", MOCK_LOCATION);
    database_class_id = class_symbol("Database", {
      ...MOCK_LOCATION,
      start_line: 20,
    });
  });

  function setup_class_scopes(
    self_type_name: SymbolName = "MyClass" as SymbolName
  ): void {
    const scope_map = new Map();
    scope_map.set(FILE_SCOPE_ID, {
      id: FILE_SCOPE_ID,
      type: "file",
      location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
      parent_id: null,
      child_ids: [CLASS_SCOPE_ID],
      self_type_name: null,
    });
    scope_map.set(CLASS_SCOPE_ID, {
      id: CLASS_SCOPE_ID,
      name: "MyClass" as SymbolName,
      type: "class",
      location: { file_path: TEST_FILE, start_line: 1, start_column: 0, end_line: 50, end_column: 0 },
      parent_id: FILE_SCOPE_ID,
      child_ids: [METHOD_SCOPE_ID],
      self_type_name,
    });
    scope_map.set(METHOD_SCOPE_ID, {
      id: METHOD_SCOPE_ID,
      type: "function",
      location: { file_path: TEST_FILE, start_line: 2, start_column: 2, end_line: 10, end_column: 2 },
      parent_id: CLASS_SCOPE_ID,
      child_ids: [],
      self_type_name: null,
    });
    scopes.update_file(TEST_FILE, scope_map);

    // The class scope names its type; `this` reaches the declaration by
    // resolving that name from the scope the class is declared in.
    set_test_resolutions(
      resolutions,
      FILE_SCOPE_ID,
      new Map([["MyClass" as SymbolName, my_class_id]])
    );
  }

  function setup_class_definitions(): void {
    const method_def: MethodDefinition = {
      kind: "method",
      symbol_id: method_id,
      name: "process" as SymbolName,
      defining_scope_id: CLASS_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 3 },
      parameters: [],
      body_scope_id: METHOD_SCOPE_ID,
      decorators: [],
    };

    const property_def: PropertyDefinition = {
      kind: "property",
      symbol_id: property_id,
      name: "db" as SymbolName,
      defining_scope_id: CLASS_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 2 },
      type: "Database" as SymbolName,
      decorators: [],
    };

    const class_def: ClassDefinition = {
      kind: "class",
      symbol_id: my_class_id,
      name: "MyClass" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 1 },
      is_exported: false,
      extends: [],
      methods: [method_def],
      properties: [property_def],
      decorators: [],
      constructors: [],
    };

    const database_def: ClassDefinition = {
      kind: "class",
      symbol_id: database_class_id,
      name: "Database" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 20 },
      is_exported: false,
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
      constructors: [],
    };

    definitions.update_file(TEST_FILE, [class_def, method_def, property_def, database_def]);
  }

  describe("keyword base resolution", () => {
    it("resolves this.method() to containing class", () => {
      setup_class_scopes();
      setup_class_definitions();

      const receiver: ReceiverExpression = {
        base: { type: "keyword", value: "this" },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context, resolve_held_type);

      expect(is_ok(result) && result.value).toBe(my_class_id);
    });

    it("resolves super.method() to the parent class", () => {
      setup_class_scopes();
      setup_class_definitions();

      const base_class_id = class_symbol("Base", { ...MOCK_LOCATION, start_line: 30 });
      definitions["heritage"].register_subtype(base_class_id, my_class_id, "declared", MOCK_LOCATION.file_path);

      const receiver: ReceiverExpression = {
        base: { type: "keyword", value: "super" },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context, resolve_held_type);

      expect(is_ok(result) && result.value).toBe(base_class_id);
    });

    it("fails with no_parent_class for super in a class without a parent", () => {
      setup_class_scopes();
      setup_class_definitions();

      const receiver: ReceiverExpression = {
        base: { type: "keyword", value: "super" },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context, resolve_held_type);

      expect(is_err(result)).toBe(true);
      if (is_err(result)) {
        expect(result.error.stage).toBe("receiver_resolution");
        expect(result.error.reason).toBe("no_parent_class");
      }
    });

    it("fails with no_enclosing_class_scope for this outside of class", () => {
      // Setup scope without class
      const func_scope_id = "scope:test.ts:standalone:1:0" as ScopeId;
      const scope_map = new Map();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "file",
        location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
        parent_id: null,
        child_ids: [func_scope_id],
        self_type_name: null,
      });
      scope_map.set(func_scope_id, {
        id: func_scope_id,
        type: "function",
        location: { file_path: TEST_FILE, start_line: 1, start_column: 0, end_line: 10, end_column: 0 },
        parent_id: FILE_SCOPE_ID,
        child_ids: [],
        self_type_name: null,
      });
      scopes.update_file(TEST_FILE, scope_map);

      const receiver: ReceiverExpression = {
        base: { type: "keyword", value: "this" },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: func_scope_id,
      };

      const result = resolve_receiver_type(receiver, context, resolve_held_type);

      expect(is_err(result)).toBe(true);
      if (is_err(result)) {
        expect(result.error.stage).toBe("receiver_resolution");
        expect(result.error.reason).toBe("no_enclosing_class_scope");
      }
    });
  });

  describe("property chain walking", () => {
    it("resolves this.property.method() via TypeRegistry", () => {
      setup_class_scopes();
      setup_class_definitions();

      // Type supplied via the TypeRegistry rather than a resolvable annotation.
      types["symbol_types"] = new Map();
      types["symbol_types"].set(property_id, database_class_id);

      const receiver: ReceiverExpression = {
        base: { type: "keyword", value: "this" },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context, resolve_held_type);

      expect(is_ok(result) && result.value).toBe(database_class_id);
    });

    it("resolves a multi-segment chain across successive member types", () => {
      setup_class_scopes();
      setup_class_definitions();

      const middle_class_id = class_symbol("Middle", { ...MOCK_LOCATION, start_line: 15 });
      const inner_prop_id = property_symbol("inner", { ...MOCK_LOCATION, start_line: 16 });

      // this.db.inner.query(): db is a Middle, and Middle.inner is a Database.
      const inner_def: PropertyDefinition = {
        kind: "property",
        symbol_id: inner_prop_id,
        name: "inner" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 16 },
        decorators: [],
      };
      definitions.update_file("middle.ts" as FilePath, [inner_def]);
      types["symbol_types"] = new Map([
        [property_id, middle_class_id],
        [inner_prop_id, database_class_id],
      ]);
      types["resolved_type_members"] = new Map([
        [middle_class_id, new Map([[("inner" as SymbolName), inner_prop_id]])],
      ]);

      const receiver: ReceiverExpression = {
        base: { type: "keyword", value: "this" },
        chain: ["db" as SymbolName, "inner" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context, resolve_held_type);

      expect(is_ok(result) && result.value).toBe(database_class_id);
    });

    it("fails with method_not_on_type if property not found", () => {
      setup_class_scopes();
      setup_class_definitions();

      const receiver: ReceiverExpression = {
        base: { type: "keyword", value: "this" },
        chain: ["nonexistent" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context, resolve_held_type);

      expect(is_err(result)).toBe(true);
      if (is_err(result)) {
        expect(result.error.reason).toBe("method_not_on_type");
      }
    });

    it("fails with class_definition_not_found when the class scope names a type nothing supplies", () => {
      // The class scope names a type that neither a binding nor a declaration in
      // the lookup scope supplies, which is what the reason reports.
      setup_class_scopes("Absent" as SymbolName);
      setup_class_definitions();

      const receiver: ReceiverExpression = {
        base: { type: "keyword", value: "this" },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context, resolve_held_type);

      expect(is_err(result)).toBe(true);
      if (is_err(result)) {
        expect(result.error.stage).toBe("receiver_resolution");
        expect(result.error.reason).toBe("class_definition_not_found");
        expect(result.error.partial_info).toEqual({
          last_known_scope: CLASS_SCOPE_ID,
        });
      }
    });
  });

  describe("identifier base resolution", () => {
    it("resolves obj.method() via scope resolution and type lookup", () => {
      const var_id = "variable:test.ts:5:15:5:18:obj" as SymbolId;

      // Setup scope with variable
      const scope_map = new Map();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "file",
        location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
        parent_id: null,
        child_ids: [],
        self_type_name: null,
      });
      scopes.update_file(TEST_FILE, scope_map);

      // Setup definitions
      definitions.update_file(TEST_FILE, [
        {
          kind: "variable",
          symbol_id: var_id,
          name: "obj" as SymbolName,
          defining_scope_id: FILE_SCOPE_ID,
          location: MOCK_LOCATION,
          is_exported: false,
        },
        {
          kind: "class",
          symbol_id: my_class_id,
          name: "MyClass" as SymbolName,
          defining_scope_id: FILE_SCOPE_ID,
          location: { ...MOCK_LOCATION, start_line: 1 },
          is_exported: false,
          extends: [],
          methods: [],
          properties: [],
          decorators: [],
          constructors: [],
        },
      ]);

      // Setup resolution for 'obj' identifier
      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, var_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      // Setup type for variable
      types["symbol_types"] = new Map();
      types["symbol_types"].set(var_id, my_class_id);

      const receiver: ReceiverExpression = {
        base: { type: "identifier", value: "obj" as SymbolName },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: FILE_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context, resolve_held_type);

      expect(is_ok(result) && result.value).toBe(my_class_id);
    });

    it("resolves a type name receiver to the type itself for static calls", () => {
      const scope_map = new Map();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "file",
        location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
        parent_id: null,
        child_ids: [],
        self_type_name: null,
      });
      scopes.update_file(TEST_FILE, scope_map);

      definitions.update_file(TEST_FILE, [
        {
          kind: "class",
          symbol_id: my_class_id,
          name: "MyClass" as SymbolName,
          defining_scope_id: FILE_SCOPE_ID,
          location: { ...MOCK_LOCATION, start_line: 1 },
          is_exported: false,
          extends: [],
          methods: [],
          properties: [],
          decorators: [],
          constructors: [],
        },
      ]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("MyClass" as SymbolName, my_class_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const receiver: ReceiverExpression = {
        base: { type: "identifier", value: "MyClass" as SymbolName },
        chain: [],
        method_name: "create" as SymbolName,
        scope_id: FILE_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context, resolve_held_type);

      expect(is_ok(result) && result.value).toBe(my_class_id);
    });

    it("fails with name_not_in_scope if identifier cannot be resolved", () => {
      const scope_map = new Map();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "file",
        location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
        parent_id: null,
        child_ids: [],
        self_type_name: null,
      });
      scopes.update_file(TEST_FILE, scope_map);

      const receiver: ReceiverExpression = {
        base: { type: "identifier", value: "unknown" as SymbolName },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: FILE_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context, resolve_held_type);

      expect(is_err(result)).toBe(true);
      if (is_err(result)) {
        expect(result.error.reason).toBe("name_not_in_scope");
      }
    });

    it("fails with receiver_type_unknown when identifier has no inferable type", () => {
      // A bare variable with no type annotation, no TypeRegistry entry, and not a type def
      const var_id = "variable:test.ts:5:0:5:8:untyped" as SymbolId;
      const scope_map = new Map();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "file",
        location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
        parent_id: null,
        child_ids: [],
        self_type_name: null,
      });
      scopes.update_file(TEST_FILE, scope_map);

      definitions.update_file(TEST_FILE, [
        {
          kind: "variable",
          symbol_id: var_id,
          name: "untyped" as SymbolName,
          defining_scope_id: FILE_SCOPE_ID,
          location: MOCK_LOCATION,
          is_exported: false,
        },
      ]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("untyped" as SymbolName, var_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const receiver: ReceiverExpression = {
        base: { type: "identifier", value: "untyped" as SymbolName },
        chain: [],
        method_name: "process" as SymbolName,
        scope_id: FILE_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context, resolve_held_type);

      expect(is_err(result)).toBe(true);
      if (is_err(result)) {
        expect(result.error.stage).toBe("type_inference");
        expect(result.error.reason).toBe("receiver_type_unknown");
      }
    });

    it("fails with member_type_unknown when chained property has no resolvable type", () => {
      setup_class_scopes();

      // Property exists but has no type annotation and no TypeRegistry entry.
      // walk_property_chain finds the member but cannot resolve its type.
      const property_no_type: PropertyDefinition = {
        kind: "property",
        symbol_id: property_id,
        name: "db" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 2 },
        decorators: [],
      };

      const method_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "process" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 3 },
        parameters: [],
        body_scope_id: METHOD_SCOPE_ID,
        decorators: [],
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: my_class_id,
        name: "MyClass" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 1 },
        is_exported: false,
        extends: [],
        methods: [method_def],
        properties: [property_no_type],
        decorators: [],
        constructors: [],
      };

      definitions.update_file(TEST_FILE, [class_def, method_def, property_no_type]);

      // Set type member explicitly so walk finds the property symbol.
      types["resolved_type_members"] = new Map();
      types["resolved_type_members"].set(
        my_class_id,
        new Map([[("db" as SymbolName), property_id]])
      );
      // Property has no type — get_symbol_type returns undefined.

      const receiver: ReceiverExpression = {
        base: { type: "keyword", value: "this" },
        chain: ["db" as SymbolName],
        method_name: "query" as SymbolName,
        scope_id: METHOD_SCOPE_ID,
      };

      const result = resolve_receiver_type(receiver, context, resolve_held_type);

      expect(is_err(result)).toBe(true);
      if (is_err(result)) {
        expect(result.error.stage).toBe("type_inference");
        expect(result.error.reason).toBe("member_type_unknown");
      }
    });
  });
});

/**
 * A re-export surface whose every link lands on another import definition,
 * which is what makes a chain a hop-by-hop walk for the receiver instead of a
 * single `ExportRegistry` lookup. Keyed by file: every hop re-exports the same
 * name.
 */
class ImportChainExports extends ExportRegistry {
  private readonly links: ReadonlyMap<FilePath, SymbolId>;

  constructor(links: ReadonlyMap<FilePath, SymbolId>) {
    super();
    this.links = links;
  }

  override resolve_export_chain(source_file: FilePath): SymbolId | null {
    return this.links.get(source_file) ?? null;
  }
}

describe("re-export chain dereferencing", () => {
  const NAMESPACE_FILE = "widgets.ts" as FilePath;
  const NAMESPACE_FILE_SCOPE_ID = "scope:widgets.ts:file:0:0" as ScopeId;
  const NAMESPACE_BODY_SCOPE_ID = "scope:widgets.ts:Widgets:1:0" as ScopeId;
  const NAMESPACE_LOCATION: Location = {
    file_path: NAMESPACE_FILE,
    start_line: 1,
    start_column: 0,
    end_line: 9,
    end_column: 1,
  };

  const widgets_id = namespace_symbol("Widgets", NAMESPACE_LOCATION);
  const inner_class_id = class_symbol("Inner" as SymbolName, {
    ...NAMESPACE_LOCATION,
    start_line: 2,
    end_line: 4,
  });

  function barrel_file(hop: number): FilePath {
    return `barrel${hop}.ts` as FilePath;
  }

  /** The `import { Widgets } from './barrel<hop+1>'` at a given depth. */
  function chain_import(hop: number): ImportDefinition {
    const file = hop === 0 ? TEST_FILE : barrel_file(hop);
    return {
      kind: "import",
      symbol_id: `import:${file}:${hop}:0:${hop}:30:Widgets` as SymbolId,
      name: "Widgets" as SymbolName,
      defining_scope_id: `scope:${file}:file:0:0` as ScopeId,
      location: {
        file_path: file,
        start_line: hop,
        start_column: 0,
        end_line: hop,
        end_column: 30,
      },
      import_kind: "named",
      import_path: `./barrel${hop + 1}` as ModulePath,
    };
  }

  function namespace_scopes(): Map<ScopeId, LexicalScope> {
    return new Map<ScopeId, LexicalScope>([
      [
        NAMESPACE_FILE_SCOPE_ID,
        {
          id: NAMESPACE_FILE_SCOPE_ID,
          parent_id: null,
          name: null,
          type: "module",
          location: { ...NAMESPACE_LOCATION, start_line: 0 },
          child_ids: [NAMESPACE_BODY_SCOPE_ID],
          self_type_name: null,
        },
      ],
      [
        NAMESPACE_BODY_SCOPE_ID,
        {
          id: NAMESPACE_BODY_SCOPE_ID,
          parent_id: NAMESPACE_FILE_SCOPE_ID,
          name: "Widgets" as SymbolName,
          type: "module",
          location: NAMESPACE_LOCATION,
          child_ids: [],
          self_type_name: null,
        },
      ],
    ]);
  }

  /**
   * `hops` barrels that each re-export `Widgets` from the next, with the
   * deepest one exporting `deepest_target` — the namespace itself, or a hop
   * already on the chain to close it into a cycle.
   */
  function setup_chain(
    hops: number,
    deepest_target: SymbolId
  ): ReceiverResolutionContext {
    const scopes = new ScopeRegistry();
    const definitions = new DefinitionRegistry();
    const resolutions = new ResolutionRegistry();
    const imports = new ImportGraph();
    const links = new Map<FilePath, SymbolId>();

    for (let hop = 0; hop < hops; hop++) {
      const import_def = chain_import(hop);
      definitions.update_file(import_def.location.file_path, [import_def]);
      imports["resolved_import_paths"].set(
        import_def.symbol_id,
        barrel_file(hop + 1)
      );
      if (hop > 0) {
        links.set(barrel_file(hop), import_def.symbol_id);
      }
    }
    links.set(barrel_file(hops), deepest_target);

    const widgets_namespace: NamespaceDefinition = {
      kind: "namespace",
      symbol_id: widgets_id,
      name: "Widgets" as SymbolName,
      defining_scope_id: NAMESPACE_FILE_SCOPE_ID,
      location: NAMESPACE_LOCATION,
      is_exported: true,
    };
    const inner_class: ClassDefinition = {
      kind: "class",
      symbol_id: inner_class_id,
      name: "Inner" as SymbolName,
      defining_scope_id: NAMESPACE_BODY_SCOPE_ID,
      location: { ...NAMESPACE_LOCATION, start_line: 2, end_line: 4 },
      is_exported: true,
      extends: [],
      methods: [],
      properties: [],
      decorators: [],
      constructors: [],
    };
    definitions.update_file(NAMESPACE_FILE, [widgets_namespace, inner_class]);
    scopes.update_file(NAMESPACE_FILE, namespace_scopes());

    set_test_resolutions(
      resolutions,
      FILE_SCOPE_ID,
      new Map([["Widgets" as SymbolName, chain_import(0).symbol_id]])
    );

    return {
      scopes,
      definitions,
      types: new TypeRegistry(definitions),
      resolutions,
      imports,
      ...make_export_chain_context(),
      exports: new ImportChainExports(links),
    };
  }

  const receiver: ReceiverExpression = {
    base: { type: "identifier", value: "Widgets" as SymbolName },
    chain: ["Inner" as SymbolName],
    method_name: "build" as SymbolName,
    scope_id: FILE_SCOPE_ID,
  };

  it("resolves a namespace member through ten re-export hops", () => {
    const context = setup_chain(10, widgets_id);

    const result = resolve_receiver_type(receiver, context, resolve_held_type);

    expect(is_ok(result) && result.value).toBe(inner_class_id);
  });

  it("resolves nothing when the re-export chain is circular", () => {
    const context = setup_chain(3, chain_import(0).symbol_id);

    const result = resolve_receiver_type(receiver, context, resolve_held_type);

    expect(is_err(result) && result.error).toEqual({
      stage: "receiver_resolution",
      reason: "method_not_on_type",
      partial_info: { resolved_receiver_type: chain_import(0).symbol_id },
    });
  });
});

describe("destructured binding receiver typing", () => {
  let scopes: ScopeRegistry;
  let definitions: DefinitionRegistry;
  let types: TypeRegistry;
  let resolutions: ResolutionRegistry;
  let imports: ImportGraph;
  let context: ReceiverResolutionContext;

  const OPTIONS_ID = "interface:test.ts:1:0:3:1:Options" as SymbolId;
  const STORAGE_PROP_ID = "property:test.ts:2:2:2:30:storage" as SymbolId;
  const STORAGE_IFACE_ID = "interface:test.ts:5:0:7:1:PersistenceStorage" as SymbolId;
  const OPTIONS_PARAM_ID = "parameter:test.ts:10:0:10:20:options" as SymbolId;
  const BINDING_ID = "variable:test.ts:11:8:11:15:storage" as SymbolId;

  beforeEach(() => {
    scopes = new ScopeRegistry();
    definitions = new DefinitionRegistry();
    types = new TypeRegistry(definitions);
    resolutions = new ResolutionRegistry();
    imports = new ImportGraph();
    context = {
      scopes,
      definitions,
      types,
      resolutions,
      imports,
      ...make_export_chain_context(),
    };

    const scope_map = new Map();
    scope_map.set(FILE_SCOPE_ID, {
      id: FILE_SCOPE_ID,
      type: "file",
      location: { file_path: TEST_FILE, start_line: 0, start_column: 0, end_line: 100, end_column: 0 },
      parent_id: null,
      child_ids: [],
      self_type_name: null,
    });
    scopes.update_file(TEST_FILE, scope_map);
  });

  /**
   * Register the Options/PersistenceStorage types and the `options` parameter,
   * and record their annotations through the TypeRegistry the way indexing does.
   */
  function register_types(binding: Partial<VariableDefinition>): void {
    const options_param: ParameterDefinition = {
      kind: "parameter",
      symbol_id: OPTIONS_PARAM_ID,
      name: "options" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 10 },
      type: "Options" as SymbolName,
    };
    const options_iface: InterfaceDefinition = {
      kind: "interface",
      symbol_id: OPTIONS_ID,
      name: "Options" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 1 },
      is_exported: false,
      extends: [],
      methods: [],
      properties: [
        {
          kind: "property",
          symbol_id: STORAGE_PROP_ID,
          name: "storage" as SymbolName,
          defining_scope_id: FILE_SCOPE_ID,
          location: { ...MOCK_LOCATION, start_line: 2 },
          type: "PersistenceStorage" as SymbolName,
          decorators: [],
        },
      ],
    };
    const storage_iface: InterfaceDefinition = {
      kind: "interface",
      symbol_id: STORAGE_IFACE_ID,
      name: "PersistenceStorage" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 5 },
      is_exported: false,
      extends: [],
      methods: [],
      properties: [],
    };
    const run_function: FunctionDefinition = {
      kind: "function",
      symbol_id: "function:test.ts:10:0:12:1:run" as SymbolId,
      name: "run" as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 10 },
      is_exported: false,
      signature: { parameters: [options_param] },
      body_scope_id: FILE_SCOPE_ID,
    };
    const binding_def = {
      kind: "variable",
      symbol_id: BINDING_ID,
      name: (binding.name ?? "storage") as SymbolName,
      defining_scope_id: FILE_SCOPE_ID,
      location: { ...MOCK_LOCATION, start_line: 11 },
      is_exported: false,
      ...binding,
    } as VariableDefinition;
    definitions.update_file(TEST_FILE, [options_iface, storage_iface, options_param, binding_def]);

    const scope_resolutions = new Map<SymbolName, SymbolId>();
    scope_resolutions.set("options" as SymbolName, OPTIONS_PARAM_ID);
    scope_resolutions.set("Options" as SymbolName, OPTIONS_ID);
    scope_resolutions.set("PersistenceStorage" as SymbolName, STORAGE_IFACE_ID);
    scope_resolutions.set((binding.name ?? "storage") as SymbolName, BINDING_ID);
    set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

    const index: SemanticIndex = {
      file_path: TEST_FILE,
      language: "typescript",
      root_scope_id: FILE_SCOPE_ID,
      scopes: new Map(),
      functions: new Map([[run_function.symbol_id, run_function]]),
      classes: new Map(),
      variables: new Map([[BINDING_ID, binding_def]]),
      interfaces: new Map([
        [OPTIONS_ID, options_iface],
        [STORAGE_IFACE_ID, storage_iface],
      ]),
      enums: new Map(),
      namespaces: new Map(),
      types: new Map(),
      imported_symbols: new Map(),
      unattached_impl_methods: new Map(),
      references: [],
    };
    const { exports, languages, modules } = make_export_chain_context();
    types.update_file(
      TEST_FILE,
      index,
      [],
      make_type_resolution_context(resolutions, exports, languages, modules)
    );
  }

  it("types a shorthand destructured binding as the declared type of the property it unpacks", () => {
    register_types({
      name: "storage" as SymbolName,
      destructured_from: "options" as SymbolName,
      destructured_key: "storage" as SymbolName,
    });

    const result = resolve_receiver_type(
      {
        base: { type: "identifier", value: "storage" as SymbolName },
        chain: [],
        method_name: "sweep" as SymbolName,
        scope_id: FILE_SCOPE_ID,
      },
      context,
      resolve_held_type
    );

    expect(is_ok(result) && result.value).toBe(STORAGE_IFACE_ID);
  });

  it("types a renamed destructured binding from the written key, not the bound name", () => {
    register_types({
      name: "store" as SymbolName,
      destructured_from: "options" as SymbolName,
      destructured_key: "storage" as SymbolName,
    });

    const result = resolve_receiver_type(
      {
        base: { type: "identifier", value: "store" as SymbolName },
        chain: [],
        method_name: "sweep" as SymbolName,
        scope_id: FILE_SCOPE_ID,
      },
      context,
      resolve_held_type
    );

    expect(is_ok(result) && result.value).toBe(STORAGE_IFACE_ID);
  });

  it("fails with receiver_type_unknown when the destructured source has no known type", () => {
    definitions.update_file(TEST_FILE, [
      {
        kind: "variable",
        symbol_id: BINDING_ID,
        name: "storage" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 11 },
        is_exported: false,
        destructured_from: "missing" as SymbolName,
        destructured_key: "storage" as SymbolName,
      } as VariableDefinition,
    ]);
    const scope_resolutions = new Map<SymbolName, SymbolId>();
    scope_resolutions.set("storage" as SymbolName, BINDING_ID);
    set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

    const result = resolve_receiver_type(
      {
        base: { type: "identifier", value: "storage" as SymbolName },
        chain: [],
        method_name: "sweep" as SymbolName,
        scope_id: FILE_SCOPE_ID,
      },
      context,
      resolve_held_type
    );

    expect(is_err(result) && result.error).toEqual({
      stage: "type_inference",
      reason: "receiver_type_unknown",
      partial_info: { last_known_scope: FILE_SCOPE_ID },
    });
  });

  it("stops rather than looping when a binding destructures itself", () => {
    definitions.update_file(TEST_FILE, [
      {
        kind: "variable",
        symbol_id: BINDING_ID,
        name: "storage" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 11 },
        is_exported: false,
        destructured_from: "storage" as SymbolName,
        destructured_key: "storage" as SymbolName,
      } as VariableDefinition,
    ]);
    const scope_resolutions = new Map<SymbolName, SymbolId>();
    scope_resolutions.set("storage" as SymbolName, BINDING_ID);
    set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

    const result = resolve_receiver_type(
      {
        base: { type: "identifier", value: "storage" as SymbolName },
        chain: [],
        method_name: "sweep" as SymbolName,
        scope_id: FILE_SCOPE_ID,
      },
      context,
      resolve_held_type
    );

    expect(is_err(result) && result.error).toEqual({
      stage: "type_inference",
      reason: "receiver_type_unknown",
      partial_info: { last_known_scope: FILE_SCOPE_ID },
    });
  });
});

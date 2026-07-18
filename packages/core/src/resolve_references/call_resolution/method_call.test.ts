import { describe, it, expect, beforeEach } from "vitest";
import { resolve_method_call } from "./method_call";
import { ScopeRegistry } from "../registries/scope";
import { DefinitionRegistry } from "../registries/definition";
import { TypeRegistry } from "../registries/type";
import { ResolutionRegistry } from "../resolution_registry";
import { ImportGraph } from "../import_resolution/import_graph";
import { ExportRegistry } from "../registries/export";
import type { FileSystemFolder } from "../file_folders";
import { make_export_chain_context } from "../resolution_test_helpers";
import { set_test_resolutions, unwrap } from "../resolve_references.test";
import { create_method_call_reference } from "../../index_single_file/references/factories";
import { method_symbol, class_symbol, function_symbol, variable_symbol } from "@ariadnejs/types";
import type {
  SymbolId,
  SymbolName,
  ScopeId,
  Location,
  FilePath,
  Language,
  ModulePath,
  Result,
  ResolutionFailure,
  MethodDefinition,
  ClassDefinition,
  VariableDefinition,
} from "@ariadnejs/types";

const TEST_FILE = "test.ts" as FilePath;
const FILE_SCOPE_ID = "scope:test.ts:file:0:0" as ScopeId;
const CLASS_SCOPE_ID = "scope:test.ts:MyClass:1:0" as ScopeId;
const METHOD_SCOPE_ID = "scope:test.ts:MyClass.process:2:2" as ScopeId;

const MOCK_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 15,
  end_line: 5,
  end_column: 22,
};

const MOCK_RECEIVER_LOCATION: Location = {
  file_path: TEST_FILE,
  start_line: 5,
  start_column: 10,
  end_line: 5,
  end_column: 13,
};

function unwrap_err(r: Result<unknown, ResolutionFailure>): ResolutionFailure {
  if (r.ok) {
    throw new Error(`Expected err, got ok: ${JSON.stringify(r.value)}`);
  }
  return r.error;
}

describe("Method Call Resolution", () => {
  let scopes: ScopeRegistry;
  let definitions: DefinitionRegistry;
  let types: TypeRegistry;
  let resolutions: ResolutionRegistry;
  let imports: ImportGraph;
  let exports: ExportRegistry;
  let languages: Map<FilePath, Language>;
  let root_folder: FileSystemFolder;

  beforeEach(() => {
    scopes = new ScopeRegistry();
    definitions = new DefinitionRegistry();
    types = new TypeRegistry();
    resolutions = new ResolutionRegistry();
    imports = new ImportGraph();
    ({ exports, languages, root_folder } = make_export_chain_context());
  });

  describe("Basic Method Calls", () => {
    it("resolves a method call on an object variable", () => {
      // const obj = new MyClass(); obj.process();
      const obj_symbol_id = variable_symbol("obj", MOCK_LOCATION);
      const class_id = class_symbol("MyClass" as SymbolName, MOCK_LOCATION);
      const method_id = method_symbol("process" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 3,
      });

      const scope_map = new Map();
      scope_map.set(FILE_SCOPE_ID, {
        id: FILE_SCOPE_ID,
        type: "file",
        location: {
          file_path: TEST_FILE,
          start_line: 0,
          start_column: 0,
          end_line: 10,
          end_column: 0,
        },
        parent_id: null,
        child_ids: [CLASS_SCOPE_ID],
      });
      scopes.update_file(TEST_FILE, scope_map);

      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: obj_symbol_id,
        name: "obj" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };

      const method_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "process" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: {
          ...MOCK_LOCATION,
          start_line: 3,
        },
        parameters: [],
        body_scope_id: METHOD_SCOPE_ID,
        decorators: [],
      };

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
        methods: [method_def],
        properties: [],
        decorators: [],
        constructors: [],
      };

      definitions.update_file(TEST_FILE, [var_def, class_def, method_def]);

      types["symbol_types"] = new Map();
      types["symbol_types"].set(obj_symbol_id, class_id);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, obj_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_method_call_reference(
        "process" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "process"] as SymbolName[],
        false
      );

      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved)).toEqual([method_id]);
    });

    it("resolves a method call via a cached TypeRegistry member", () => {
      const obj_symbol_id = variable_symbol("obj", MOCK_LOCATION);
      const class_id = class_symbol("MyClass" as SymbolName, MOCK_LOCATION);
      const method_id = method_symbol("getData" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 3,
      });

      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: obj_symbol_id,
        name: "obj" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [var_def]);

      types["symbol_types"] = new Map();
      types["symbol_types"].set(obj_symbol_id, class_id);

      types["resolved_type_members"] = new Map();
      const member_map = new Map();
      member_map.set("getData" as SymbolName, method_id);
      types["resolved_type_members"].set(class_id, member_map);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, obj_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_method_call_reference(
        "getData" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "getData"] as SymbolName[],
        false
      );

      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved)).toEqual([method_id]);
    });
  });

  describe("Method Calls After Constructor", () => {
    it("resolves a method call on a newly constructed object", () => {
      // const obj = new MyClass(); obj.method();
      const obj_symbol_id = variable_symbol("obj", MOCK_LOCATION);
      const class_id = class_symbol("MyClass" as SymbolName, MOCK_LOCATION);
      const method_id = method_symbol("method" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 3,
      });

      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: obj_symbol_id,
        name: "obj" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [var_def]);

      types["symbol_types"] = new Map();
      types["symbol_types"].set(obj_symbol_id, class_id);

      types["resolved_type_members"] = new Map();
      const member_map = new Map();
      member_map.set("method" as SymbolName, method_id);
      types["resolved_type_members"].set(class_id, member_map);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, obj_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_method_call_reference(
        "method" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "method"] as SymbolName[],
        false
      );

      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved)).toEqual([method_id]);
    });
  });

  describe("Chained Method Calls", () => {
    it("resolves chained method calls on a fluent interface", () => {
      // builder.setName("foo").setAge(25) — each setter returns Builder
      const builder_symbol_id = variable_symbol("builder", MOCK_LOCATION);
      const builder_class_id = class_symbol("Builder" as SymbolName, MOCK_LOCATION);
      const set_name_id = method_symbol("setName" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 2,
      });
      const set_age_id = method_symbol("setAge" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 3,
      });

      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: builder_symbol_id,
        name: "builder" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [var_def]);

      types["symbol_types"] = new Map();
      types["symbol_types"].set(builder_symbol_id, builder_class_id);

      types["resolved_type_members"] = new Map();
      const builder_member_map = new Map();
      builder_member_map.set("setName" as SymbolName, set_name_id);
      builder_member_map.set("setAge" as SymbolName, set_age_id);
      types["resolved_type_members"].set(builder_class_id, builder_member_map);

      types["symbol_types"].set(set_name_id, builder_class_id);
      types["symbol_types"].set(set_age_id, builder_class_id);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("builder" as SymbolName, builder_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const first_call = create_method_call_reference(
        "setName" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["builder", "setName"] as SymbolName[],
        false
      );

      const resolved_first = resolve_method_call(
        first_call,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved_first)).toEqual([set_name_id]);

      const second_call = create_method_call_reference(
        "setAge" as SymbolName,
        { ...MOCK_LOCATION, start_line: 6 },
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["builder", "setAge"] as SymbolName[],
        false
      );

      const resolved_second = resolve_method_call(
        second_call,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved_second)).toEqual([set_age_id]);
    });
  });

  describe("Property Access Chains", () => {
    it("resolves a method call through a property chain", () => {
      // obj.field.method() where field is an InnerClass instance
      const obj_symbol_id = variable_symbol("obj", MOCK_LOCATION);
      const outer_class_id = class_symbol("OuterClass" as SymbolName, MOCK_LOCATION);
      const field_symbol_id = variable_symbol("field", {
        ...MOCK_LOCATION,
        start_line: 2,
      });
      const inner_class_id = class_symbol("InnerClass" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 10,
      });
      const method_id = method_symbol("method" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 11,
      });

      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: obj_symbol_id,
        name: "obj" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [var_def]);

      types["symbol_types"] = new Map();
      types["symbol_types"].set(obj_symbol_id, outer_class_id);

      types["resolved_type_members"] = new Map();
      const outer_member_map = new Map();
      outer_member_map.set("field" as SymbolName, field_symbol_id);
      types["resolved_type_members"].set(outer_class_id, outer_member_map);
      types["symbol_types"].set(field_symbol_id, inner_class_id);

      const inner_member_map = new Map();
      inner_member_map.set("method" as SymbolName, method_id);
      types["resolved_type_members"].set(inner_class_id, inner_member_map);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, obj_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_method_call_reference(
        "method" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "field", "method"] as SymbolName[],
        false
      );

      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved)).toEqual([method_id]);
    });
  });

  describe("Namespace Import Resolution", () => {
    const UTILS_FILE = "utils.ts" as FilePath;
    const UTILS_SCOPE_ID = "scope:utils.ts:file:0:0" as ScopeId;

    it("resolves a namespace-import method call to the imported function", () => {
      // import * as utils from './utils'; utils.helper();
      const utils_import_id = "import:test.ts:1:0:1:30:utils" as SymbolId;
      const helper_id = function_symbol("helper" as SymbolName, {
        file_path: UTILS_FILE,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });

      definitions.update_file(UTILS_FILE, [{
        kind: "function",
        symbol_id: helper_id,
        name: "helper" as SymbolName,
        defining_scope_id: UTILS_SCOPE_ID,
        location: {
          file_path: UTILS_FILE,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
        body_scope_id: "scope:utils.ts:helper:1:0" as ScopeId,
        decorators: [],
      }]);
      exports.update_file(UTILS_FILE, definitions);

      definitions.update_file(TEST_FILE, [{
        kind: "import",
        symbol_id: utils_import_id,
        name: "utils" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        import_kind: "namespace",
        import_path: "./utils" as ModulePath,
      }]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("utils" as SymbolName, utils_import_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_method_call_reference(
        "helper" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["utils", "helper"] as SymbolName[],
        false
      );

      imports["resolved_import_paths"].set(utils_import_id, UTILS_FILE);

      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved)).toEqual([helper_id]);
    });

    it("fails with import_unresolved when the import path is not registered", () => {
      const utils_import_id = "import:test.ts:1:0:1:30:utils" as SymbolId;
      const helper_id = function_symbol("helper" as SymbolName, {
        file_path: UTILS_FILE,
        start_line: 1,
        start_column: 0,
        end_line: 5,
        end_column: 1,
      });

      definitions.update_file(UTILS_FILE, [{
        kind: "function",
        symbol_id: helper_id,
        name: "helper" as SymbolName,
        defining_scope_id: UTILS_SCOPE_ID,
        location: {
          file_path: UTILS_FILE,
          start_line: 1,
          start_column: 0,
          end_line: 5,
          end_column: 1,
        },
        is_exported: true,
        signature: { parameters: [] },
        body_scope_id: "scope:utils.ts:helper:1:0" as ScopeId,
        decorators: [],
      }]);

      definitions.update_file(TEST_FILE, [{
        kind: "import",
        symbol_id: utils_import_id,
        name: "utils" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        import_kind: "namespace",
        import_path: "./utils" as ModulePath,
      }]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("utils" as SymbolName, utils_import_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_method_call_reference(
        "helper" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["utils", "helper"] as SymbolName[],
        false
      );

      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      const error = unwrap_err(resolved);
      expect(error.stage).toBe("import_resolution");
      expect(error.reason).toBe("import_unresolved");
    });

    it("fails with import_unresolved for an external module not in the project", () => {
      // import os; os.listdir() — os is not an indexed project file
      const os_import_id = "import:test.ts:1:0:1:10:os" as SymbolId;

      definitions.update_file(TEST_FILE, [{
        kind: "import",
        symbol_id: os_import_id,
        name: "os" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        import_kind: "namespace",
        import_path: "os" as ModulePath,
      }]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("os" as SymbolName, os_import_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_method_call_reference(
        "listdir" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["os", "listdir"] as SymbolName[],
        false
      );

      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      const error = unwrap_err(resolved);
      expect(error.stage).toBe("import_resolution");
      expect(error.reason).toBe("import_unresolved");
    });
  });

  describe("Unresolved Cases", () => {
    it("fails with receiver_type_unknown when the receiver has no type", () => {
      const obj_symbol_id = variable_symbol("obj", MOCK_LOCATION);

      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: obj_symbol_id,
        name: "obj" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [var_def]);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, obj_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_method_call_reference(
        "method" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "method"] as SymbolName[],
        false
      );

      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      const error = unwrap_err(resolved);
      expect(error.stage).toBe("type_inference");
      expect(error.reason).toBe("receiver_type_unknown");
    });

    it("fails with name_not_in_scope when the receiver is not resolved in scope", () => {
      set_test_resolutions(resolutions, FILE_SCOPE_ID, new Map());

      const call_ref = create_method_call_reference(
        "method" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "method"] as SymbolName[],
        false
      );

      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      const error = unwrap_err(resolved);
      expect(error.stage).toBe("name_resolution");
      expect(error.reason).toBe("name_not_in_scope");
    });

    it("fails with method_not_on_type when the type lacks the method", () => {
      const obj_symbol_id = variable_symbol("obj", MOCK_LOCATION);
      const class_id = class_symbol("MyClass" as SymbolName, MOCK_LOCATION);

      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: obj_symbol_id,
        name: "obj" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [var_def]);

      types["symbol_types"] = new Map();
      types["symbol_types"].set(obj_symbol_id, class_id);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, obj_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_method_call_reference(
        "nonExistentMethod" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "nonExistentMethod"] as SymbolName[],
        false
      );

      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      const error = unwrap_err(resolved);
      expect(error.stage).toBe("method_lookup");
      expect(error.reason).toBe("method_not_on_type");
    });

    it("fails with name_not_in_scope for an empty property chain", () => {
      const call_ref = create_method_call_reference(
        "method" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        [] as SymbolName[],
        false
      );

      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      const error = unwrap_err(resolved);
      expect(error.stage).toBe("name_resolution");
      expect(error.reason).toBe("name_not_in_scope");
    });

    it("fails with method_not_on_type when a property-chain intermediate is unknown", () => {
      // obj.unknownField.method() where obj's type has no 'unknownField' member
      const obj_symbol_id = variable_symbol("obj", MOCK_LOCATION);
      const class_id = class_symbol("MyClass" as SymbolName, MOCK_LOCATION);

      const var_def: VariableDefinition = {
        kind: "variable",
        symbol_id: obj_symbol_id,
        name: "obj" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };
      definitions.update_file(TEST_FILE, [var_def]);

      types["symbol_types"] = new Map();
      types["symbol_types"].set(obj_symbol_id, class_id);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("obj" as SymbolName, obj_symbol_id);
      set_test_resolutions(resolutions, FILE_SCOPE_ID, scope_resolutions);

      const call_ref = create_method_call_reference(
        "method" as SymbolName,
        MOCK_LOCATION,
        FILE_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["obj", "unknownField", "method"] as SymbolName[],
        false
      );

      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      const error = unwrap_err(resolved);
      expect(error.stage).toBe("receiver_resolution");
      expect(error.reason).toBe("method_not_on_type");
    });
  });

  describe("Polymorphic Interface Resolution", () => {
    it("resolves an interface method call to all implementations", () => {
      // interface Handler { process() }; HandlerA, HandlerB implements Handler;
      // run(h: Handler) { h.process() } fans out to both implementations.
      const handler_param_id = variable_symbol("h", MOCK_LOCATION);
      const interface_id = class_symbol("Handler" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 1,
      });
      const interface_method_id = method_symbol("process" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 1,
        start_column: 20,
      });

      const handler_a_id = class_symbol("HandlerA" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 3,
      });
      const handler_a_process_id = method_symbol("process" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 3,
        start_column: 20,
      });

      const handler_b_id = class_symbol("HandlerB" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 6,
      });
      const handler_b_process_id = method_symbol("process" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 6,
        start_column: 20,
      });

      const interface_method: MethodDefinition = {
        kind: "method",
        symbol_id: interface_method_id,
        name: "process" as SymbolName,
        defining_scope_id: "scope:Handler" as ScopeId,
        location: {
          ...MOCK_LOCATION,
          start_line: 1,
          start_column: 20,
        },
        parameters: [],
      };

      const interface_def: import("@ariadnejs/types").InterfaceDefinition = {
        kind: "interface",
        symbol_id: interface_id,
        name: "Handler" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 1 },
        is_exported: false,
        extends: [],
        methods: [interface_method],
        properties: [],
      };

      const handler_a_method: MethodDefinition = {
        kind: "method",
        symbol_id: handler_a_process_id,
        name: "process" as SymbolName,
        defining_scope_id: "scope:HandlerA" as ScopeId,
        location: {
          ...MOCK_LOCATION,
          start_line: 3,
          start_column: 20,
        },
        parameters: [],
        body_scope_id: "scope:HandlerA.process" as ScopeId,
      };

      const handler_a_def: ClassDefinition = {
        kind: "class",
        symbol_id: handler_a_id,
        name: "HandlerA" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 3 },
        is_exported: false,
        extends: ["Handler" as SymbolName],
        methods: [handler_a_method],
        properties: [],
        decorators: [],
      };

      const handler_b_method: MethodDefinition = {
        kind: "method",
        symbol_id: handler_b_process_id,
        name: "process" as SymbolName,
        defining_scope_id: "scope:HandlerB" as ScopeId,
        location: {
          ...MOCK_LOCATION,
          start_line: 6,
          start_column: 20,
        },
        parameters: [],
        body_scope_id: "scope:HandlerB.process" as ScopeId,
      };

      const handler_b_def: ClassDefinition = {
        kind: "class",
        symbol_id: handler_b_id,
        name: "HandlerB" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 6 },
        is_exported: false,
        extends: ["Handler" as SymbolName],
        methods: [handler_b_method],
        properties: [],
        decorators: [],
      };

      const param_def: VariableDefinition = {
        kind: "variable",
        symbol_id: handler_param_id,
        name: "h" as SymbolName,
        defining_scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };

      definitions.update_file(TEST_FILE, [
        interface_def,
        handler_a_def,
        handler_b_def,
        param_def,
      ]);

      types["symbol_types"] = new Map();
      types["symbol_types"].set(handler_param_id, interface_id);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("h" as SymbolName, handler_param_id);
      set_test_resolutions(resolutions, METHOD_SCOPE_ID, scope_resolutions);

      const call_ref = create_method_call_reference(
        "process" as SymbolName,
        MOCK_LOCATION,
        METHOD_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["h", "process"] as SymbolName[],
        false
      );

      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      expect([...unwrap(resolved)].sort()).toEqual(
        [handler_a_process_id, handler_b_process_id].sort()
      );
    });

    it("resolves a concrete class method call to a single method", () => {
      // class User { getName() }; test(u: User) { u.getName() } — not polymorphic
      const user_param_id = variable_symbol("u", MOCK_LOCATION);
      const class_id = class_symbol("User" as SymbolName, MOCK_LOCATION);
      const method_id = method_symbol("getName", {
        ...MOCK_LOCATION,
        start_line: 2,
      });

      const method_def: MethodDefinition = {
        kind: "method",
        symbol_id: method_id,
        name: "getName" as SymbolName,
        defining_scope_id: CLASS_SCOPE_ID,
        location: { ...MOCK_LOCATION, start_line: 2 },
        parameters: [],
        body_scope_id: "scope:User.getName" as ScopeId,
      };

      const class_def: ClassDefinition = {
        kind: "class",
        symbol_id: class_id,
        name: "User" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [method_def],
        properties: [],
        decorators: [],
      };

      const param_def: VariableDefinition = {
        kind: "variable",
        symbol_id: user_param_id,
        name: "u" as SymbolName,
        defining_scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };

      definitions.update_file(TEST_FILE, [class_def, param_def]);

      types["symbol_types"] = new Map();
      types["symbol_types"].set(user_param_id, class_id);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("u" as SymbolName, user_param_id);
      set_test_resolutions(resolutions, METHOD_SCOPE_ID, scope_resolutions);

      const call_ref = create_method_call_reference(
        "getName" as SymbolName,
        MOCK_LOCATION,
        METHOD_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["u", "getName"] as SymbolName[],
        false
      );

      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      expect(unwrap(resolved)).toEqual([method_id]);
    });

    it("fails with polymorphic_no_implementations when the interface has no implementers", () => {
      const handler_param_id = variable_symbol("h", MOCK_LOCATION);
      const interface_id = class_symbol("EmptyHandler" as SymbolName, MOCK_LOCATION);
      const interface_method_id = method_symbol("process" as SymbolName, {
        ...MOCK_LOCATION,
        start_line: 1,
      });

      const interface_method: MethodDefinition = {
        kind: "method",
        symbol_id: interface_method_id,
        name: "process" as SymbolName,
        defining_scope_id: "scope:EmptyHandler" as ScopeId,
        location: { ...MOCK_LOCATION, start_line: 1 },
        parameters: [],
      };

      const interface_def: import("@ariadnejs/types").InterfaceDefinition = {
        kind: "interface",
        symbol_id: interface_id,
        name: "EmptyHandler" as SymbolName,
        defining_scope_id: FILE_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
        extends: [],
        methods: [interface_method],
        properties: [],
      };

      const param_def: VariableDefinition = {
        kind: "variable",
        symbol_id: handler_param_id,
        name: "h" as SymbolName,
        defining_scope_id: METHOD_SCOPE_ID,
        location: MOCK_LOCATION,
        is_exported: false,
      };

      definitions.update_file(TEST_FILE, [interface_def, param_def]);

      types["symbol_types"] = new Map();
      types["symbol_types"].set(handler_param_id, interface_id);

      const scope_resolutions = new Map<SymbolName, SymbolId>();
      scope_resolutions.set("h" as SymbolName, handler_param_id);
      set_test_resolutions(resolutions, METHOD_SCOPE_ID, scope_resolutions);

      const call_ref = create_method_call_reference(
        "process" as SymbolName,
        MOCK_LOCATION,
        METHOD_SCOPE_ID,
        MOCK_RECEIVER_LOCATION,
        ["h", "process"] as SymbolName[],
        false
      );

      const resolved = resolve_method_call(
        call_ref,
        scopes,
        definitions,
        types,
        resolutions,
        imports,
        exports,
        languages,
        root_folder
      );

      const error = unwrap_err(resolved);
      expect(error.stage).toBe("method_lookup");
      expect(error.reason).toBe("polymorphic_no_implementations");
    });
  });
});

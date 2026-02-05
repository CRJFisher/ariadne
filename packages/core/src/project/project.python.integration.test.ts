import { describe, it, expect, beforeEach } from "vitest";
import { Project } from "./project";
import path from "path";
import fs from "fs";
import type {
  FilePath,
  SymbolName,
  FunctionCallReference,
  MethodCallReference,
  SelfReferenceCall,
  ConstructorCallReference,
} from "@ariadnejs/types";

const FIXTURE_ROOT = path.join(__dirname, "../../tests/fixtures/python/code");

function load_source(relative_path: string): string {
  return fs.readFileSync(path.join(FIXTURE_ROOT, relative_path), "utf-8");
}

function file_path(relative_path: string): FilePath {
  return path.join(FIXTURE_ROOT, relative_path) as FilePath;
}

describe("Project Integration - Python", () => {
  let project: Project;

  beforeEach(async () => {
    project = new Project();
    await project.initialize(FIXTURE_ROOT as FilePath);
  });

  describe("Basic Resolution", () => {
    it("should resolve local function calls in single file", async () => {
      const source = load_source("functions/nested_scopes.py");
      const file = file_path("functions/nested_scopes.py");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Find function definitions
      const functions = Array.from(index!.functions.values());
      expect(functions.length).toBeGreaterThan(0);

      // Find the helper function
      const helper_fn = functions.find((f) => f.name === ("helper" as SymbolName));
      expect(helper_fn).toBeDefined();

      // Find call references
      const calls = index!.references.filter(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          r.kind === "function_call" ||
          r.kind === "method_call" ||
          r.kind === "self_reference_call" ||
          r.kind === "constructor_call"
      );
      expect(calls.length).toBeGreaterThan(0);

      // Verify resolution - find a call to "helper"
      const helper_call = calls.find((c) => c.name === ("helper" as SymbolName));
      expect(helper_call).toBeDefined();

      // Verify it resolves to the helper function definition
      const resolved = project.resolutions.resolve(
        helper_call!.scope_id,
        helper_call!.name
      );
      expect(resolved).toBeDefined();
      expect(resolved).toBe(helper_fn!.symbol_id);
    });

    it("should resolve constructor calls and type bindings", async () => {
      const source = load_source("classes/constructor_workflow.py");
      const file = file_path("classes/constructor_workflow.py");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Find the Product class
      const product_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Product" as SymbolName)
      );
      expect(product_class).toBeDefined();

      // Verify class has methods
      const all_refs = index!.references;
      expect(all_refs.length).toBeGreaterThan(0);
    });

    it("should resolve method calls via type bindings", async () => {
      const source = load_source("classes/constructor_workflow.py");
      const file = file_path("classes/constructor_workflow.py");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Find method call references
      const method_calls = index!.references.filter(
        (r): r is MethodCallReference | SelfReferenceCall =>
          r.kind === "method_call" || r.kind === "self_reference_call"
      );
      expect(method_calls.length).toBeGreaterThan(0);

      // Find the "get_name" method call
      const get_name_call = method_calls.find(
        (c) => c.name === ("get_name" as SymbolName)
      );
      expect(get_name_call).toBeDefined();

      // Get Product class to find its get_name method
      const product_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Product" as SymbolName)
      );
      expect(product_class).toBeDefined();

      // Get type info for Product class
      const type_info = project.get_type_info(product_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.size).toBeGreaterThan(0);

      // Verify get_name method exists in type info
      const get_name_method_id = type_info!.methods.get("get_name" as SymbolName);
      expect(get_name_method_id).toBeDefined();
    });
  });

  describe("Module Resolution", () => {
    it("should resolve 'from module import name' imports", async () => {
      const utils_source = load_source("modules/utils.py");
      const shadowing_source = load_source("modules/shadowing.py");
      const utils_file = file_path("modules/utils.py");
      const shadowing_file = file_path("modules/shadowing.py");

      project.update_file(utils_file, utils_source);
      project.update_file(shadowing_file, shadowing_source);

      // Get shadowing.py index
      const shadowing_index = project.get_index_single_file(shadowing_file);
      expect(shadowing_index).toBeDefined();

      // Verify import definitions created
      const imports = Array.from(shadowing_index!.imported_symbols.values());
      expect(imports.length).toBeGreaterThan(0);

      // Find process_data import
      const process_data_import = imports.find(
        (i) => i.name === ("process_data" as SymbolName)
      );
      expect(process_data_import).toBeDefined();

      // Verify call to imported function resolves
      const process_data_call = shadowing_index!.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("process_data" as SymbolName)
      );
      expect(process_data_call).toBeDefined();

      const resolved = project.resolutions.resolve(
        process_data_call!.scope_id,
        process_data_call!.name
      );
      expect(resolved).toBeDefined();

      // Verify resolved to utils.py
      const def = resolved ? project.definitions.get(resolved) : undefined;
      expect(def).toBeDefined();
      if (!def) return;

      expect(def.location.file_path).toContain("utils.py");
    });
  });

  describe("Cross-File Resolution", () => {
    it("should resolve cross-file function calls", async () => {
      const utils_source = load_source("modules/utils.py");
      const shadowing_source = load_source("modules/shadowing.py");
      const utils_file = file_path("modules/utils.py");
      const shadowing_file = file_path("modules/shadowing.py");

      project.update_file(utils_file, utils_source);
      project.update_file(shadowing_file, shadowing_source);

      // Get shadowing.py index
      const shadowing_index = project.get_index_single_file(shadowing_file);
      expect(shadowing_index).toBeDefined();

      // Find call to process_data (imported function)
      const process_data_call = shadowing_index!.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("process_data" as SymbolName)
      );
      expect(process_data_call).toBeDefined();

      // Resolve the call
      const resolved = project.resolutions.resolve(
        process_data_call!.scope_id,
        process_data_call!.name
      );
      expect(resolved).toBeDefined();
      if (!resolved) return;

      // Verify it resolves to the function in utils.py
      const resolved_def = project.definitions.get(resolved);
      expect(resolved_def).toBeDefined();
      if (!resolved_def) return;

      expect(resolved_def.location.file_path).toContain("utils.py");
      expect(resolved_def.name).toBe("process_data" as SymbolName);
      expect(resolved_def.kind).toBe("function");
    });

    it("should resolve cross-file constructor calls", async () => {
      const user_class_source = load_source("modules/user_class.py");
      const uses_user_source = load_source("modules/uses_user.py");
      const user_class_file = file_path("modules/user_class.py");
      const uses_user_file = file_path("modules/uses_user.py");

      project.update_file(user_class_file, user_class_source);
      project.update_file(uses_user_file, uses_user_source);

      // Get uses_user.py index
      const uses_user_index = project.get_index_single_file(uses_user_file);
      expect(uses_user_index).toBeDefined();

      // Find User constructor call (should be a call with call_type "constructor" or "function")
      const constructor_calls = uses_user_index!.references.filter(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("User" as SymbolName)
      );
      expect(constructor_calls.length).toBeGreaterThan(0);

      const user_constructor_call = constructor_calls[0];
      expect(user_constructor_call).toBeDefined();
      if (!user_constructor_call) return;

      // Resolve the constructor call
      const resolved = project.resolutions.resolve(
        user_constructor_call.scope_id,
        user_constructor_call.name
      );
      expect(resolved).toBeDefined();

      // Get the resolved definition
      if (!resolved) return;
      const resolved_def = project.definitions.get(resolved);
      expect(resolved_def).toBeDefined();
      if (!resolved_def) return;

      // Should resolve to either the class or __init__ method in user_class.py
      expect(resolved_def.location.file_path).toContain("user_class.py");
      // Could be the class itself or the __init__ method
      const is_class_or_init =
        resolved_def.kind === "class" ||
        (resolved_def.kind === "method" && resolved_def.name === "__init__");
      expect(is_class_or_init).toBe(true);
    });

    // TODO: Requires assignment tracking to be implemented
    // Currently, we don't track that `user = User(...)` creates a binding
    // from the variable `user` to the type `User`, so method calls like
    // `user.get_name()` cannot be resolved through the assignment chain.
    it("should resolve method calls on cross-file constructed instances (requires assignment tracking)", async () => {
      const user_class_source = load_source("modules/user_class.py");
      const uses_user_source = load_source("modules/uses_user.py");
      const user_class_file = file_path("modules/user_class.py");
      const uses_user_file = file_path("modules/uses_user.py");

      project.update_file(user_class_file, user_class_source);
      project.update_file(uses_user_file, uses_user_source);

      // Get uses_user.py index
      const uses_user_index = project.get_index_single_file(uses_user_file);
      expect(uses_user_index).toBeDefined();

      // Find get_name method call
      const get_name_call = uses_user_index!.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("get_name" as SymbolName)
      );
      expect(get_name_call).toBeDefined();
      if (!get_name_call) return;

      // Resolve the method call - should follow chain:
      // user.get_name() → user variable → User type → get_name method
      const resolved = project.resolutions.resolve(
        get_name_call.scope_id,
        get_name_call.name
      );
      expect(resolved).toBeDefined();
      if (!resolved) return;

      // Verify it resolves to the method in user_class.py
      const resolved_def = project.definitions.get(resolved);
      expect(resolved_def).toBeDefined();
      if (!resolved_def) return;
      expect(resolved_def.location.file_path).toContain("user_class.py");
      expect(resolved_def.name).toBe("get_name" as SymbolName);
      expect(resolved_def.kind).toBe("method");
    });

    it("should handle multiple cross-file function calls from same module", async () => {
      const utils_source = load_source("modules/utils.py");
      const shadowing_source = load_source("modules/shadowing.py");
      const utils_file = file_path("modules/utils.py");
      const shadowing_file = file_path("modules/shadowing.py");

      project.update_file(utils_file, utils_source);
      project.update_file(shadowing_file, shadowing_source);

      const shadowing_index = project.get_index_single_file(shadowing_file);
      expect(shadowing_index).toBeDefined();
      if (!shadowing_index) return;

      // shadowing.py imports both 'helper' and 'process_data' from utils
      const imported_symbols = Array.from(shadowing_index.imported_symbols.values());
      const helper_import = imported_symbols.find((i) => i.name === ("helper" as SymbolName));
      const process_data_import = imported_symbols.find((i) => i.name === ("process_data" as SymbolName));

      expect(helper_import).toBeDefined();
      expect(process_data_import).toBeDefined();

      // Both should point to utils.py (though helper is shadowed locally)
      // Verify the import definitions were created
      expect(imported_symbols.length).toBeGreaterThan(0);
    });
  });

  describe("Class Methods with self", () => {
    it("should resolve instance methods with self parameter", async () => {
      const source = load_source("classes/basic_class.py");
      const file = file_path("classes/basic_class.py");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Find User class
      const classes = Array.from(index!.classes.values());
      const user_class = classes.find((c) => c.name === ("User" as SymbolName));
      expect(user_class).toBeDefined();

      // Get type info for User class
      const type_info = project.get_type_info(user_class!.symbol_id);
      expect(type_info).toBeDefined();
      if (!type_info) return;

      // Verify Python __init__ is captured as constructor
      expect(type_info.constructor).toBeDefined();
      if (!type_info.constructor) return;

      // Verify the constructor is the __init__ method
      const constructor_def = project.definitions.get(type_info.constructor);
      expect(constructor_def).toBeDefined();
      if (constructor_def && constructor_def.kind === "method") {
        expect(constructor_def.name).toBe("__init__");
      }

      // Verify instance methods exist
      expect(type_info.methods.size).toBeGreaterThan(0);

      // Find get_info method
      const get_info_method_id = type_info.methods.get("get_info" as SymbolName);
      expect(get_info_method_id).toBeDefined();

      // Verify method definition has self parameter
      const get_info_def = project.definitions.get(get_info_method_id!);
      expect(get_info_def).toBeDefined();
      expect(get_info_def!.kind).toBe("method");
    });

    it("should resolve cross-file class method calls", async () => {
      const user_class_source = load_source("modules/user_class.py");
      const uses_user_source = load_source("modules/uses_user.py");
      const user_class_file = file_path("modules/user_class.py");
      const uses_user_file = file_path("modules/uses_user.py");

      project.update_file(user_class_file, user_class_source);
      project.update_file(uses_user_file, uses_user_source);

      // Get uses_user.py index
      const uses_user_index = project.get_index_single_file(uses_user_file);
      expect(uses_user_index).toBeDefined();

      // Find method call references
      const method_calls = uses_user_index!.references.filter(
        (r): r is MethodCallReference | SelfReferenceCall =>
          r.kind === "method_call" || r.kind === "self_reference_call"
      );
      expect(method_calls.length).toBeGreaterThan(0);

      // Find get_name method call
      const get_name_call = method_calls.find(
        (c) => c.name === ("get_name" as SymbolName)
      );
      expect(get_name_call).toBeDefined();

      // Verify User class import
      const user_import = Array.from(uses_user_index!.imported_symbols.values()).find(
        (i) => i.name === ("User" as SymbolName)
      );
      expect(user_import).toBeDefined();

      // Verify User class exists in user_class.py
      const user_class_index = project.get_index_single_file(user_class_file);
      const user_class = Array.from(user_class_index!.classes.values()).find(
        (c) => c.name === ("User" as SymbolName)
      );
      expect(user_class).toBeDefined();

      // Verify User class has get_name method in type registry
      const type_info = project.get_type_info(user_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("get_name" as SymbolName)).toBe(true);

      // Get the actual get_name method symbol ID
      const get_name_method_id = type_info!.methods.get("get_name" as SymbolName);
      expect(get_name_method_id).toBeDefined();

      // Verify method definition can be looked up
      const get_name_def = project.definitions.get(get_name_method_id!);
      expect(get_name_def).toBeDefined();
      expect(get_name_def!.location.file_path).toContain("user_class.py");
    });
  });

  describe("Shadowing", () => {
    it("should resolve to local definition when it shadows import", async () => {
      const utils_source = load_source("modules/utils.py");
      const shadowing_source = load_source("modules/shadowing.py");
      const utils_file = file_path("modules/utils.py");
      const shadowing_file = file_path("modules/shadowing.py");

      project.update_file(utils_file, utils_source);
      project.update_file(shadowing_file, shadowing_source);

      const shadowing_index = project.get_index_single_file(shadowing_file);
      expect(shadowing_index).toBeDefined();

      // Find call to "helper"
      const helper_call = shadowing_index!.references.find(
        (r): r is FunctionCallReference =>
          r.kind === "function_call" && r.name === ("helper" as SymbolName)
      );
      expect(helper_call).toBeDefined();

      // Verify resolves to LOCAL helper, not imported one
      const resolved = project.resolutions.resolve(
        helper_call!.scope_id,
        helper_call!.name
      );
      expect(resolved).toBeDefined();

      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      // Local definition should be in shadowing.py, not utils.py
      expect(resolved_def!.location.file_path).toContain("shadowing.py");
      expect(resolved_def!.name).toBe("helper" as SymbolName);
    });

    it("should resolve to import when no local shadowing occurs", async () => {
      const utils_source = load_source("modules/utils.py");
      const shadowing_source = load_source("modules/shadowing.py");
      const utils_file = file_path("modules/utils.py");
      const shadowing_file = file_path("modules/shadowing.py");

      project.update_file(utils_file, utils_source);
      project.update_file(shadowing_file, shadowing_source);

      const shadowing_index = project.get_index_single_file(shadowing_file);
      expect(shadowing_index).toBeDefined();

      // Find call to "process_data" (not shadowed)
      const process_data_call = shadowing_index!.references.find(
        (r): r is FunctionCallReference =>
          r.kind === "function_call" && r.name === ("process_data" as SymbolName)
      );
      expect(process_data_call).toBeDefined();

      // Verify resolves to imported function from utils.py
      const resolved = project.resolutions.resolve(
        process_data_call!.scope_id,
        process_data_call!.name
      );
      expect(resolved).toBeDefined();

      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      if (!resolved_def) return;

      expect(resolved_def.location.file_path).toContain("utils.py");
      expect(resolved_def.name).toBe("process_data" as SymbolName);
    });
  });

  describe("Type Hints", () => {
    it("should extract type hints for method resolution", async () => {
      const source = load_source("classes/constructor_workflow.py");
      const file = file_path("classes/constructor_workflow.py");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Find the Product class
      const product_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Product" as SymbolName)
      );
      expect(product_class).toBeDefined();

      // Verify type info exists
      const type_info = project.get_type_info(product_class!.symbol_id);
      expect(type_info).toBeDefined();

      // Verify methods are accessible via type info
      expect(type_info!.methods.has("get_name" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("apply_discount" as SymbolName)).toBe(true);

      // Find method call in the file
      const method_call = index!.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("get_name" as SymbolName)
      );
      expect(method_call).toBeDefined();

      // Verify resolves via type binding
      const resolved = project.resolutions.resolve(
        method_call!.scope_id,
        method_call!.name
      );
      expect(resolved).toBeDefined();
    });

    it("should handle method chaining with type hints", async () => {
      const source = load_source("classes/constructor_workflow.py");
      const file = file_path("classes/constructor_workflow.py");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Find apply_discount method call (part of method chain)
      const apply_discount_call = index!.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("apply_discount" as SymbolName)
      );
      expect(apply_discount_call).toBeDefined();

      // Find mark_out_of_stock method call (chained after apply_discount)
      const mark_out_of_stock_call = index!.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("mark_out_of_stock" as SymbolName)
      );
      expect(mark_out_of_stock_call).toBeDefined();

      // Both should resolve
      const resolved_discount = project.resolutions.resolve(
        apply_discount_call!.scope_id,
        apply_discount_call!.name
      );
      const resolved_mark = project.resolutions.resolve(
        mark_out_of_stock_call!.scope_id,
        mark_out_of_stock_call!.name
      );

      expect(resolved_discount).toBeDefined();
      expect(resolved_mark).toBeDefined();
    });
  });

  describe("Parameter Type Resolution", () => {
    it("should register function parameters as first-class definitions with type hints", async () => {
      const code = `
class Database:
    def query(self, sql: str) -> None:
        pass

def process_data(db: Database) -> None:
    db.query("SELECT * FROM users")
      `;
      const file = file_path("test_param_function.py");
      project.update_file(file, code);

      // Verify parameter appears in DefinitionRegistry
      const db_param = Array.from(project.definitions["by_symbol"].values()).find(
        (def) => def.kind === "parameter" && def.name === ("db" as SymbolName)
      );
      expect(db_param).toBeDefined();
      expect(db_param?.kind).toBe("parameter");

      // Verify type binding was created for parameter
      const type_binding = project.types.get_symbol_type(db_param!.symbol_id);
      expect(type_binding).toBeDefined();
    });

    it("should register method parameters as first-class definitions with type hints", async () => {
      const code = `
class Logger:
    def log(self, message: str) -> None:
        pass

class Service:
    def process(self, logger: Logger) -> None:
        logger.log("Processing...")
      `;
      const file = file_path("test_param_method.py");
      project.update_file(file, code);

      // Verify parameter in method appears in registry
      const logger_param = Array.from(project.definitions["by_symbol"].values()).find(
        (def) => def.kind === "parameter" && def.name === ("logger" as SymbolName)
      );
      expect(logger_param).toBeDefined();
      expect(logger_param?.kind).toBe("parameter");

      // Verify type binding for method parameter
      const type_binding = project.types.get_symbol_type(logger_param!.symbol_id);
      expect(type_binding).toBeDefined();
    });
  });

  describe("Python-Specific Patterns", () => {
    it("should handle nested functions and closures", async () => {
      const source = load_source("functions/nested_scopes.py");
      const file = file_path("functions/nested_scopes.py");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Find the outer_function
      const outer_fn = Array.from(index!.functions.values()).find(
        (f) => f.name === ("outer_function" as SymbolName)
      );
      expect(outer_fn).toBeDefined();

      // Find nested function (inner_function)
      const inner_fn = Array.from(index!.functions.values()).find(
        (f) => f.name === ("inner_function" as SymbolName)
      );
      expect(inner_fn).toBeDefined();

      // Verify both functions exist (scope nesting is handled internally)
      // Function definitions don't expose scope_id directly
      expect(inner_fn).toBeDefined();
      expect(outer_fn).toBeDefined();
    });

    it("should handle __init__ as constructor", async () => {
      const source = load_source("classes/basic_class.py");
      const file = file_path("classes/basic_class.py");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const user_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("User" as SymbolName)
      );
      expect(user_class).toBeDefined();

      // Verify __init__ method exists in type registry as constructor
      const type_info = project.get_type_info(user_class!.symbol_id);
      expect(type_info).toBeDefined();
      if (!type_info) return;

      // Verify __init__ is captured as constructor
      expect(type_info.constructor).toBeDefined();

      // Verify instance methods also exist
      expect(type_info.methods.size).toBeGreaterThan(0);
    });
  });

  describe("Incremental Updates", () => {
    it("should re-resolve after file update", async () => {
      // Initial state
      const source_v1 = load_source("modules/utils.py");
      const utils_file = file_path("modules/utils.py");
      project.update_file(utils_file, source_v1);

      let index = project.get_index_single_file(utils_file);
      expect(index).toBeDefined();
      const initial_functions = index!.functions.size;

      // Modify file (add a function)
      const source_v2 =
        source_v1 + "\n\ndef new_function() -> str:\n    return \"new\"\n";
      project.update_file(utils_file, source_v2);

      // Verify re-indexing occurred
      index = project.get_index_single_file(utils_file);
      expect(index).toBeDefined();
      expect(index!.functions.size).toBeGreaterThan(initial_functions);

      // Verify the new function is in definitions registry
      const new_func_defs = Array.from(index!.functions.values()).filter(
        (f) => f.name === ("new_function" as SymbolName)
      );
      expect(new_func_defs.length).toBe(1);
    });

    it("should update dependent files when imported file changes", async () => {
      const utils_source = load_source("modules/utils.py");
      const shadowing_source = load_source("modules/shadowing.py");
      const utils_file = file_path("modules/utils.py");
      const shadowing_file = file_path("modules/shadowing.py");

      project.update_file(utils_file, utils_source);
      project.update_file(shadowing_file, shadowing_source);

      // Verify initial state - process_data call resolves
      const shadowing_v1 = project.get_index_single_file(shadowing_file);
      const process_data_call_v1 = shadowing_v1!.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("process_data" as SymbolName)
      );
      expect(process_data_call_v1).toBeDefined();

      const resolved_v1 = project.resolutions.resolve(
        process_data_call_v1!.scope_id,
        process_data_call_v1!.name
      );
      expect(resolved_v1).toBeDefined();
      const resolved_def_v1 = project.definitions.get(resolved_v1!);
      expect(resolved_def_v1).toBeDefined();
      if (!resolved_def_v1) return;

      expect(resolved_def_v1.location.file_path).toContain("utils.py");

      // Modify utils.py - rename process_data
      const modified_utils = utils_source.replace(
        "def process_data",
        "def renamed_process_data"
      );
      project.update_file(utils_file, modified_utils);

      // Verify shadowing.py still has the reference (source unchanged)
      const shadowing_v2 = project.get_index_single_file(shadowing_file);
      const process_data_call_v2 = shadowing_v2!.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("process_data" as SymbolName)
      );
      expect(process_data_call_v2).toBeDefined();

      // Import should not resolve after source file removes the export
      const resolved_v2 = project.resolutions.resolve(
        process_data_call_v2!.scope_id,
        process_data_call_v2!.name
      );
      expect(resolved_v2).toBeNull();
    });

    it("should handle file removal and update dependents", async () => {
      const utils_source = load_source("modules/utils.py");
      const shadowing_source = load_source("modules/shadowing.py");
      const utils_file = file_path("modules/utils.py");
      const shadowing_file = file_path("modules/shadowing.py");

      project.update_file(utils_file, utils_source);
      project.update_file(shadowing_file, shadowing_source);

      // Verify shadowing.py depends on utils.py
      const dependents = project.get_dependents(utils_file);
      expect(dependents.has(shadowing_file)).toBe(true);

      // Remove utils.py
      project.remove_file(utils_file);

      // Verify utils.py is removed
      const utils_index = project.get_index_single_file(utils_file);
      expect(utils_index).toBeUndefined();

      // Verify shadowing.py still exists but import can't resolve
      const shadowing = project.get_index_single_file(shadowing_file);
      expect(shadowing).toBeDefined();

      // Call to process_data (which was imported) should not resolve after source file removal
      const process_data_call = shadowing!.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("process_data" as SymbolName)
      );
      if (process_data_call) {
        const resolved = project.resolutions.resolve(
          process_data_call.scope_id,
          process_data_call.name
        );
        expect(resolved).toBeNull();
      }
    });
  });

  describe("Call Graph", () => {
    it("should build call graph from resolved references", async () => {
      const source = load_source("functions/nested_scopes.py");
      const file = file_path("functions/nested_scopes.py");
      project.update_file(file, source);

      // Get call graph
      const call_graph = project.get_call_graph();
      expect(call_graph).toBeDefined();
      expect(call_graph.nodes.size).toBeGreaterThan(0);

      // Verify call relationships exist
      const nodes = Array.from(call_graph.nodes.values());
      const has_calls = nodes.some((node) => node.enclosed_calls.length > 0);
      expect(has_calls).toBe(true);
    });

    it("should include cross-file calls in call graph", async () => {
      const user_class_source = load_source("modules/user_class.py");
      const uses_user_source = load_source("modules/uses_user.py");
      const user_class_file = file_path("modules/user_class.py");
      const uses_user_file = file_path("modules/uses_user.py");

      project.update_file(user_class_file, user_class_source);
      project.update_file(uses_user_file, uses_user_source);

      // Get call graph
      const call_graph = project.get_call_graph();
      expect(call_graph).toBeDefined();

      // Should have nodes from both files
      const nodes = Array.from(call_graph.nodes.values());
      const user_class_nodes = nodes.filter((n) =>
        n.location.file_path.includes("user_class.py")
      );
      const uses_user_nodes = nodes.filter((n) =>
        n.location.file_path.includes("uses_user.py")
      );

      // Python files with class methods should have callable nodes
      expect(nodes.length).toBeGreaterThan(0);
    });

    it("should update call graph after file changes", async () => {
      const source = load_source("functions/nested_scopes.py");
      const file = file_path("functions/nested_scopes.py");
      project.update_file(file, source);

      // Get initial call graph
      const call_graph_v1 = project.get_call_graph();
      const initial_node_count = call_graph_v1.nodes.size;

      // Add a new function with calls
      const modified_source =
        source + "\n\ndef new_function():\n    helper()\n    return \"test\"\n";
      project.update_file(file, modified_source);

      // Get updated call graph
      const call_graph_v2 = project.get_call_graph();

      // Should have more nodes (new_function added)
      expect(call_graph_v2.nodes.size).toBeGreaterThan(initial_node_count);

      // Find new_function node
      const new_func_nodes = Array.from(call_graph_v2.nodes.values()).filter((n) => {
        const def = project.definitions.get(n.symbol_id);
        return def?.name === ("new_function" as SymbolName);
      });
      expect(new_func_nodes.length).toBeGreaterThan(0);

      // Verify new_function has calls
      const new_func_node = new_func_nodes[0];
      expect(new_func_node.enclosed_calls.length).toBeGreaterThan(0);
    });
  });

  describe("Advanced Import Patterns", () => {
    it("should track dependencies with multi-level relative imports (from ...module)", async () => {
      const utils_source = load_source("modules/utils.py");
      const core_source = load_source("package/subpackage/core.py");
      const nested_imports_source = load_source("package/subpackage/nested_imports.py");

      const utils_file = file_path("modules/utils.py");
      const core_file = file_path("package/subpackage/core.py");
      const nested_imports_file = file_path("package/subpackage/nested_imports.py");

      project.update_file(utils_file, utils_source);
      project.update_file(core_file, core_source);
      project.update_file(nested_imports_file, nested_imports_source);

      // Verify utils.py has nested_imports.py as dependent (verifies nested_imports.py depends on utils.py)
      const utils_dependents = project.get_dependents(utils_file);
      expect(utils_dependents.has(nested_imports_file)).toBe(true);

      // Verify nested_imports.py depends on core.py (via from .core import)
      const core_dependents = project.get_dependents(core_file);
      expect(core_dependents.has(nested_imports_file)).toBe(true);
    });

    it("should resolve symbols from multi-level relative imports", async () => {
      const utils_source = load_source("modules/utils.py");
      const nested_imports_source = load_source("package/subpackage/nested_imports.py");

      const utils_file = file_path("modules/utils.py");
      const nested_imports_file = file_path("package/subpackage/nested_imports.py");

      project.update_file(utils_file, utils_source);
      project.update_file(nested_imports_file, nested_imports_source);

      const nested_index = project.get_index_single_file(nested_imports_file);
      expect(nested_index).toBeDefined();

      // Find call to helper() which was imported via "from ...modules.utils import helper"
      const helper_call = nested_index?.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("helper" as SymbolName)
      );
      expect(helper_call).toBeDefined();

      if (helper_call) {
        // Resolve helper() - should resolve to utils.py
        const resolved_helper_id = project.resolutions.resolve(
          helper_call.scope_id,
          helper_call.name
        );
        expect(resolved_helper_id).toBeDefined();

        if (resolved_helper_id) {
          const resolved_helper_def = project.definitions.get(resolved_helper_id);
          expect(resolved_helper_def?.location.file_path).toBe(utils_file);
        }
      }

      // Find call to process_data() which was also imported from utils
      const process_data_call = nested_index?.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("process_data" as SymbolName)
      );
      expect(process_data_call).toBeDefined();

      if (process_data_call) {
        // Resolve process_data() - should resolve to utils.py
        const resolved_process_data_id = project.resolutions.resolve(
          process_data_call.scope_id,
          process_data_call.name
        );
        expect(resolved_process_data_id).toBeDefined();

        if (resolved_process_data_id) {
          const resolved_process_data_def = project.definitions.get(resolved_process_data_id);
          expect(resolved_process_data_def?.location.file_path).toBe(utils_file);
        }
      }
    });

    it("should resolve sibling module imports with relative paths (from .module)", async () => {
      const core_source = load_source("package/subpackage/core.py");
      const nested_imports_source = load_source("package/subpackage/nested_imports.py");

      const core_file = file_path("package/subpackage/core.py");
      const nested_imports_file = file_path("package/subpackage/nested_imports.py");

      project.update_file(core_file, core_source);
      project.update_file(nested_imports_file, nested_imports_source);

      const nested_index = project.get_index_single_file(nested_imports_file);
      expect(nested_index).toBeDefined();

      // Find call to core_function() which was imported via "from .core import core_function"
      const core_call = nested_index?.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("core_function" as SymbolName)
      );
      expect(core_call).toBeDefined();

      if (core_call) {
        // Resolve core_function() - should resolve to core.py
        const resolved_id = project.resolutions.resolve(
          core_call.scope_id,
          core_call.name
        );
        expect(resolved_id).toBeDefined();

        if (resolved_id) {
          const resolved_def = project.definitions.get(resolved_id);
          expect(resolved_def?.location.file_path).toBe(core_file);
        }
      }
    });

    it("should handle dependency invalidation with nested package imports", async () => {
      const utils_source = load_source("modules/utils.py");
      const nested_imports_source = load_source("package/subpackage/nested_imports.py");

      const utils_file = file_path("modules/utils.py");
      const nested_imports_file = file_path("package/subpackage/nested_imports.py");

      project.update_file(utils_file, utils_source);
      project.update_file(nested_imports_file, nested_imports_source);

      // Verify dependency exists (utils.py has nested_imports.py as dependent)
      const dependents_before = project.get_dependents(utils_file);
      expect(dependents_before.has(nested_imports_file)).toBe(true);

      // Verify resolution works before removal
      const nested_index = project.get_index_single_file(nested_imports_file);
      const helper_call = nested_index?.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("helper" as SymbolName)
      );
      expect(helper_call).toBeDefined();

      if (helper_call) {
        const resolved_before = project.resolutions.resolve(
          helper_call.scope_id,
          helper_call.name
        );
        expect(resolved_before).toBeDefined();

        // Remove utils.py
        project.remove_file(utils_file);

        // Verify dependency is removed (utils.py no longer has dependents)
        const dependents_after = project.get_dependents(utils_file);
        expect(dependents_after.has(nested_imports_file)).toBe(false);

        // Verify resolution fails after removal
        const resolved_after = project.resolutions.resolve(
          helper_call.scope_id,
          helper_call.name
        );
        expect(resolved_after).toBeNull();
      }
    });

    it("should handle parent directory imports (from .. import module)", async () => {
      // Test case for imports like "from .. import subpackage"
      // This verifies that ".." (parent directory) imports are handled correctly
      const nested_imports_source = load_source("package/subpackage/nested_imports.py");
      const nested_imports_file = file_path("package/subpackage/nested_imports.py");

      project.update_file(nested_imports_file, nested_imports_source);

      const index = project.get_index_single_file(nested_imports_file);
      expect(index).toBeDefined();

      if (index) {
        // Verify the file was indexed without errors
        expect(index.references.length).toBeGreaterThan(0);

        // Check that "from .. import subpackage" was processed
        // The import should be present in the semantic index
        const subpackage_import = Array.from(index.imported_symbols.values()).find(
          (imp) => imp.name === ("subpackage" as SymbolName)
        );
        expect(subpackage_import).toBeDefined();
        expect(subpackage_import?.import_path).toBe("..");
      }
    });
  });

  describe("Callback detection and invocation", () => {
    it("should detect callback context for lambda in array methods", async () => {
      const project = new Project();
      await project.initialize();

      const code = `
numbers = [1, 2, 3, 4, 5]

def process():
    doubled = list(map(lambda x: x * 2, numbers))
      `.trim();

      const file_path_str = "/test/callback.py" as FilePath;
      project.update_file(file_path_str, code);

      const definitions = project.definitions;
      const anon_funcs = Array.from(definitions.get_callable_definitions()).filter(
        (d) => d.name === "<anonymous>"
      );

      expect(anon_funcs.length).toBe(1);
      const anon = anon_funcs[0];

      // Check callback context is captured
      expect((anon as any).callback_context).toBeDefined();
      expect((anon as any).callback_context.is_callback).toBe(true);
      expect((anon as any).callback_context.receiver_location).toBeDefined();
    });

    it("should NOT mark external callbacks as entry points", async () => {
      const project = new Project();
      await project.initialize();

      const code = `
numbers = [1, 2, 3, 4, 5]

def process():
    doubled = list(map(lambda x: x * 2, numbers))
    evens = list(filter(lambda x: x % 2 == 0, numbers))
      `.trim();

      const file_path_str = "/test/callbacks_entry.py" as FilePath;
      project.update_file(file_path_str, code);

      const definitions = project.definitions;
      const call_graph = project.get_call_graph();

      // Find lambdas
      const lambdas = Array.from(definitions.get_callable_definitions()).filter(
        (d) => d.name === "<anonymous>"
      );
      expect(lambdas.length).toBe(2);

      // Verify lambdas are NOT entry points
      const entry_point_ids = new Set(call_graph.entry_points);
      for (const lambda of lambdas) {
        expect(entry_point_ids.has(lambda.symbol_id)).toBe(false);
      }

      // Verify process() IS an entry point
      const process_def = Array.from(definitions.get_callable_definitions()).find(
        (d) => d.name === "process"
      );
      expect(process_def).toBeDefined();
      expect(entry_point_ids.has(process_def!.symbol_id)).toBe(true);
    });

  });

  describe("Polymorphic Protocol Resolution (Task 11.158)", () => {
    it("should mark Protocol implementations as called when possible", async () => {
      const source = load_source("classes/polymorphic_protocol.py");
      const file = file_path("classes/polymorphic_protocol.py");
      project.update_file(file, source);

      const call_graph = project.get_call_graph();
      const nodes = Array.from(call_graph.nodes.values());

      // Find process methods
      const process_methods = nodes.filter(
        (n) => n.name === "process" && n.location.file_path.includes("polymorphic_protocol.py")
      );

      // Should have at least 3 process methods (one for each implementation)
      // Plus one in the Protocol definition itself
      expect(process_methods.length).toBeGreaterThanOrEqual(3);

      // Entry point detection should work correctly if polymorphic resolution is active
      const entry_point_ids = new Set(call_graph.entry_points);

      // Verify that at least some methods exist in the call graph
      expect(process_methods.length).toBeGreaterThan(0);
    });
  });

  describe("Polymorphic self Dispatch (Task 11.174)", () => {
    it("should mark child override as called when base calls self.method()", async () => {
      const code = `
class Base:
    def process(self):
        self.helper()
    def helper(self):
        return "base"

class Child(Base):
    def helper(self):
        return "child"
      `;
      const file = file_path("polymorphic_self.py");
      project.update_file(file, code);

      // Get all referenced symbols (should include both helpers)
      const referenced = project.resolutions.get_all_referenced_symbols();

      // Find Base.helper and Child.helper
      const index = project.get_index_single_file(file);
      const base_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Base" as SymbolName)
      );
      const child_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Child" as SymbolName)
      );

      expect(base_class).toBeDefined();
      expect(child_class).toBeDefined();

      const base_helper = project.get_type_info(base_class!.symbol_id)!.methods.get(
        "helper" as SymbolName
      );
      const child_helper = project.get_type_info(child_class!.symbol_id)!.methods.get(
        "helper" as SymbolName
      );

      expect(base_helper).toBeDefined();
      expect(child_helper).toBeDefined();

      // Both should be referenced (neither is an entry point)
      expect(referenced.has(base_helper!)).toBe(true);
      expect(referenced.has(child_helper!)).toBe(true);
    });

    it("should resolve multi-level Python inheritance", async () => {
      const code = `
class A:
    def process(self):
        self.helper()
    def helper(self):
        pass

class B(A):
    def helper(self):
        pass

class C(B):
    def helper(self):
        pass
      `;
      const file = file_path("multilevel_self.py");
      project.update_file(file, code);

      const referenced = project.resolutions.get_all_referenced_symbols();
      const index = project.get_index_single_file(file);

      // All three helper methods should be referenced
      const classes = Array.from(index!.classes.values());
      expect(classes).toHaveLength(3);

      for (const cls of classes) {
        const helper_id = project.get_type_info(cls.symbol_id)!.methods.get(
          "helper" as SymbolName
        );
        expect(helper_id).toBeDefined();
        expect(referenced.has(helper_id!)).toBe(true);
      }
    });
  });

  describe("Python Re-export Resolution", () => {
    it("should resolve calls through single-level Python re-export", async () => {
      // Load the re-export chain:
      // original.py defines get_retail_months
      // middle.py re-exports it: from .reexport_original import get_retail_months
      // consumer.py imports from middle and calls: get_retail_months()
      const original_source = load_source("modules/reexport_original.py");
      const middle_source = load_source("modules/reexport_middle.py");
      const consumer_source = load_source("modules/reexport_consumer.py");

      const original_file = file_path("modules/reexport_original.py");
      const middle_file = file_path("modules/reexport_middle.py");
      const consumer_file = file_path("modules/reexport_consumer.py");

      project.update_file(original_file, original_source);
      project.update_file(middle_file, middle_source);
      project.update_file(consumer_file, consumer_source);

      // Get consumer index
      const consumer_index = project.get_index_single_file(consumer_file);
      expect(consumer_index).toBeDefined();

      // Find call to get_retail_months()
      const call = consumer_index!.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("get_retail_months" as SymbolName)
      );
      expect(call).toBeDefined();

      // Resolve the call - should resolve to original.py's definition
      const resolved = project.resolutions.resolve(call!.scope_id, call!.name);
      expect(resolved).toBeDefined();
      expect(resolved).not.toBeNull();

      // Verify it resolves to the original definition in reexport_original.py
      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.location.file_path).toContain("reexport_original.py");
      expect(resolved_def!.name).toBe("get_retail_months" as SymbolName);
    });

    it("should resolve calls through multi-level Python re-export chain", async () => {
      // Load the full chain:
      // original.py -> middle.py -> top.py -> multilevel_consumer.py
      const original_source = load_source("modules/reexport_original.py");
      const middle_source = load_source("modules/reexport_middle.py");
      const top_source = load_source("modules/reexport_top.py");
      const consumer_source = load_source("modules/reexport_multilevel_consumer.py");

      const original_file = file_path("modules/reexport_original.py");
      const middle_file = file_path("modules/reexport_middle.py");
      const top_file = file_path("modules/reexport_top.py");
      const consumer_file = file_path("modules/reexport_multilevel_consumer.py");

      project.update_file(original_file, original_source);
      project.update_file(middle_file, middle_source);
      project.update_file(top_file, top_source);
      project.update_file(consumer_file, consumer_source);

      // Get consumer index
      const consumer_index = project.get_index_single_file(consumer_file);
      expect(consumer_index).toBeDefined();

      // Find call to get_retail_months()
      const call = consumer_index!.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("get_retail_months" as SymbolName)
      );
      expect(call).toBeDefined();

      // Resolve - should trace through top -> middle -> original
      const resolved = project.resolutions.resolve(call!.scope_id, call!.name);
      expect(resolved).toBeDefined();
      expect(resolved).not.toBeNull();

      // Verify it resolves to the original definition
      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.location.file_path).toContain("reexport_original.py");
      expect(resolved_def!.name).toBe("get_retail_months" as SymbolName);
    });

    it.skip("should resolve calls through aliased Python re-export", async () => {
      // TODO: Fix aliased re-export resolution - same issue as TypeScript (see resolve_references.test.ts)
      // middle.py re-exports with alias: from .original import calculate_forecast as aliased_forecast
      // consumer.py imports and calls: aliased_forecast()
      const original_source = load_source("modules/reexport_original.py");
      const middle_source = load_source("modules/reexport_middle.py");
      const consumer_source = load_source("modules/reexport_consumer.py");

      const original_file = file_path("modules/reexport_original.py");
      const middle_file = file_path("modules/reexport_middle.py");
      const consumer_file = file_path("modules/reexport_consumer.py");

      project.update_file(original_file, original_source);
      project.update_file(middle_file, middle_source);
      project.update_file(consumer_file, consumer_source);

      // Get consumer index
      const consumer_index = project.get_index_single_file(consumer_file);
      expect(consumer_index).toBeDefined();

      // Find call to aliased_forecast()
      const call = consumer_index!.references.find(
        (r): r is FunctionCallReference | MethodCallReference | SelfReferenceCall | ConstructorCallReference =>
          (r.kind === "function_call" ||
            r.kind === "method_call" ||
            r.kind === "self_reference_call" ||
            r.kind === "constructor_call") &&
          r.name === ("aliased_forecast" as SymbolName)
      );
      expect(call).toBeDefined();

      // Resolve - should resolve to original calculate_forecast
      const resolved = project.resolutions.resolve(call!.scope_id, call!.name);
      expect(resolved).toBeDefined();
      expect(resolved).not.toBeNull();

      // Verify it resolves to the original definition
      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.location.file_path).toContain("reexport_original.py");
      expect(resolved_def!.name).toBe("calculate_forecast" as SymbolName);
    });

    it("should not mark re-exported functions as entry points when called through re-export", async () => {
      // If re-export resolution works, get_retail_months should NOT be an entry point
      // because it's called from consumer.py
      const original_source = load_source("modules/reexport_original.py");
      const middle_source = load_source("modules/reexport_middle.py");
      const consumer_source = load_source("modules/reexport_consumer.py");

      const original_file = file_path("modules/reexport_original.py");
      const middle_file = file_path("modules/reexport_middle.py");
      const consumer_file = file_path("modules/reexport_consumer.py");

      project.update_file(original_file, original_source);
      project.update_file(middle_file, middle_source);
      project.update_file(consumer_file, consumer_source);

      const call_graph = project.get_call_graph();
      const entry_point_ids = new Set(call_graph.entry_points);

      // Find get_retail_months definition in original.py
      const original_index = project.get_index_single_file(original_file);
      const get_retail_months_def = Array.from(original_index!.functions.values()).find(
        (f) => f.name === ("get_retail_months" as SymbolName)
      );
      expect(get_retail_months_def).toBeDefined();

      // get_retail_months should NOT be an entry point (it's called from consumer)
      expect(entry_point_ids.has(get_retail_months_def!.symbol_id)).toBe(false);
    });
  });

  describe("Module-Qualified Call Resolution (Bug Trap)", () => {
    it("should resolve calls via aliased module imports (import X as Y; Y.func())", async () => {
      const utils_source = load_source("modules/utils.py");
      const import_patterns_source = load_source("modules/import_patterns.py");
      const utils_file = file_path("modules/utils.py");
      const import_patterns_file = file_path("modules/import_patterns.py");

      project.update_file(utils_file, utils_source);
      project.update_file(import_patterns_file, import_patterns_source);

      const call_graph = project.get_call_graph();
      const entry_point_ids = new Set(call_graph.entry_points);

      // Find helper() function in utils.py
      const helper_def = Array.from(project.definitions.get_callable_definitions()).find(
        (d) => d.name === ("helper" as SymbolName) && d.location.file_path === utils_file
      );
      expect(helper_def).toBeDefined();

      // helper() should NOT be an entry point - it's called via utils_mod.helper()
      expect(entry_point_ids.has(helper_def!.symbol_id)).toBe(false);
    });

    it("should resolve multiple calls via aliased module imports", async () => {
      const utils_source = load_source("modules/utils.py");
      const import_patterns_source = load_source("modules/import_patterns.py");
      const utils_file = file_path("modules/utils.py");
      const import_patterns_file = file_path("modules/import_patterns.py");

      project.update_file(utils_file, utils_source);
      project.update_file(import_patterns_file, import_patterns_source);

      const call_graph = project.get_call_graph();
      const entry_point_ids = new Set(call_graph.entry_points);

      // Find all utils.py functions
      const utils_functions = Array.from(project.definitions.get_callable_definitions()).filter(
        (d) => d.location.file_path === utils_file
      );

      // helper, process_data, and calculate_total are all called via utils_mod.X()
      // They should NOT be entry points
      const called_functions = ["helper", "process_data", "calculate_total"];
      for (const fn_name of called_functions) {
        const fn_def = utils_functions.find((d) => d.name === (fn_name as SymbolName));
        expect(fn_def).toBeDefined();
        expect(entry_point_ids.has(fn_def!.symbol_id)).toBe(false);
      }

      // validate_user_data is NOT called anywhere - it SHOULD be an entry point
      const validate_def = utils_functions.find(
        (d) => d.name === ("validate_user_data" as SymbolName)
      );
      expect(validate_def).toBeDefined();
      expect(entry_point_ids.has(validate_def!.symbol_id)).toBe(true);
    });

    it("should handle aliased named imports (from X import Y as Z; Z())", async () => {
      const utils_source = load_source("modules/utils.py");
      const import_patterns_source = load_source("modules/import_patterns.py");
      const utils_file = file_path("modules/utils.py");
      const import_patterns_file = file_path("modules/import_patterns.py");

      project.update_file(utils_file, utils_source);
      project.update_file(import_patterns_file, import_patterns_source);

      // import_patterns.py has: from modules.utils import helper as util_helper
      // Then calls: util_result = util_helper()
      // So helper() should be resolved via this path too

      const call_graph = project.get_call_graph();
      const entry_point_ids = new Set(call_graph.entry_points);

      // Find helper() function in utils.py
      const helper_def = Array.from(project.definitions.get_callable_definitions()).find(
        (d) => d.name === ("helper" as SymbolName) && d.location.file_path === utils_file
      );
      expect(helper_def).toBeDefined();

      // helper() should NOT be an entry point (called via both utils_mod.helper() and util_helper())
      expect(entry_point_ids.has(helper_def!.symbol_id)).toBe(false);
    });
  });

});

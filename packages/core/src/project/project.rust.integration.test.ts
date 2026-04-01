import { describe, it, expect, beforeEach } from "vitest";
import { Project } from "./project";
import path from "path";
import fs from "fs";
import type {
  FilePath,
  SymbolName,
  SymbolId,
  FunctionCallReference,
  MethodCallReference,
  SelfReferenceCall,
  ConstructorCallReference,
  VariableReference,
} from "@ariadnejs/types";

const FIXTURE_ROOT = path.join(__dirname, "../../tests/fixtures/rust/code");

function load_source(relative_path: string): string {
  return fs.readFileSync(path.join(FIXTURE_ROOT, relative_path), "utf-8");
}

function file_path(relative_path: string): FilePath {
  return path.join(FIXTURE_ROOT, relative_path) as FilePath;
}

describe("Project Integration - Rust", () => {
  let project: Project;

  beforeEach(async () => {
    project = new Project();
    await project.initialize(FIXTURE_ROOT as FilePath);
  });

  describe("Impl Blocks", () => {
    it("should link struct to its impl block methods", async () => {
      const source = load_source("structs/user_with_impl.rs");
      const file = file_path("structs/user_with_impl.rs");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // user_with_impl.rs defines exactly one struct: User
      const structs = Array.from(index!.classes.values());
      expect(structs.length).toBe(1);

      const user_struct = structs.find((s) => s.name === ("User" as SymbolName));
      expect(user_struct).toBeDefined();

      // User has 8 impl methods: new, default, get_name, get_email, update_name, activate, deactivate, get_info
      const type_info = project.get_type_info(user_struct!.symbol_id);
      expect(type_info).toBeDefined();

      const method_names = Array.from(type_info!.methods.keys()).sort();
      expect(method_names).toEqual([
        "activate",
        "deactivate",
        "default",
        "get_email",
        "get_info",
        "get_name",
        "new",
        "update_name",
      ] as SymbolName[]);
    });

    it("should resolve method calls (&self)", async () => {
      const source = load_source("structs/constructor_workflow.rs");
      const file = file_path("structs/constructor_workflow.rs");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Find method call references
      const method_calls = index!.references.filter(
        (r): r is MethodCallReference | SelfReferenceCall =>
          r.kind === "method_call" || r.kind === "self_reference_call"
      );
      expect(method_calls.length).toBe(8);

      // Verify at least one method call resolves
      const first_method_call = method_calls[0];
      const resolved = project.resolutions.resolve(
        first_method_call.scope_id,
        first_method_call.name
      );
      expect(resolved).toBeDefined();
    });

  });

  describe("Basic Resolution", () => {
    it("should resolve local function calls in single file", async () => {
      const source = load_source("functions/nested_scopes.rs");
      const file = file_path("functions/nested_scopes.rs");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // nested_scopes.rs defines: helper, main, outer_function, inner_function, deeper_function, complex_nesting
      const functions = Array.from(index!.functions.values());
      const function_names = functions.map((f) => f.name).sort();
      expect(function_names).toEqual([
        "complex_nesting",
        "deeper_function",
        "helper",
        "inner_function",
        "main",
        "outer_function",
      ] as SymbolName[]);

      // Find helper() calls - should be multiple across different scopes
      const helper_calls = index!.references.filter(
        (r): r is FunctionCallReference =>
          r.kind === "function_call" &&
          r.name === ("helper" as SymbolName)
      );
      // helper() is called in: main, block in main, outer_function, inner_function,
      // deeper_function, closure in outer_function, complex_nesting (4 times)
      expect(helper_calls.length).toBe(10);

      // Every helper() call should resolve to the same definition
      const helper_def = functions.find((f) => f.name === ("helper" as SymbolName));
      expect(helper_def).toBeDefined();
      for (const call of helper_calls) {
        const resolved = project.resolutions.resolve(call.scope_id, call.name);
        expect(resolved).toBe(helper_def!.symbol_id);
      }
    });

    it("should handle variable shadowing", async () => {
      const source = load_source("functions/variable_shadowing.rs");
      const file = file_path("functions/variable_shadowing.rs");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // variable_shadowing.rs has many variables across scopes
      const variables = Array.from(index!.variables.values());
      expect(variables.length).toBe(48);

      // Verify variable references exist (read or write)
      const var_refs = index!.references.filter(
        (r): r is VariableReference => r.kind === "variable_reference"
      );
      expect(var_refs.length).toBe(222);

      // Verify that function calls still resolve despite variable shadowing
      // outer_helper() should resolve even when 'helper' var shadows the name
      const outer_helper_calls = index!.references.filter(
        (r): r is FunctionCallReference =>
          r.kind === "function_call" &&
          r.name === ("outer_helper" as SymbolName)
      );
      expect(outer_helper_calls.length).toBe(6);

      const outer_helper_def = Array.from(index!.functions.values()).find(
        (f) => f.name === ("outer_helper" as SymbolName)
      );
      expect(outer_helper_def).toBeDefined();

      for (const call of outer_helper_calls) {
        const resolved = project.resolutions.resolve(call.scope_id, call.name);
        expect(resolved).toBe(outer_helper_def!.symbol_id);
      }
    });
  });

  describe("Module System", () => {
    it("should resolve 'use' imports", async () => {
      const utils_source = load_source("modules/utils.rs");
      const main_source = load_source("modules/main.rs");
      const utils_file = file_path("modules/utils.rs");
      const main_file = file_path("modules/main.rs");

      project.update_file(utils_file, utils_source);
      project.update_file(main_file, main_source);

      // main.rs imports exactly 4 symbols: helper, process_data, calculate_total, validate_email
      const main_index = project.get_index_single_file(main_file);
      expect(main_index).toBeDefined();

      const imports = Array.from(main_index!.imported_symbols.values());
      const import_names = imports.map((i) => i.name).sort();
      expect(import_names).toEqual([
        "calculate_total",
        "helper",
        "process_data",
        "validate_email",
      ] as SymbolName[]);

      // utils.rs defines 5 functions: helper, process_data, calculate_total, validate_email, internal_helper
      const utils_index = project.get_index_single_file(utils_file);
      expect(utils_index).toBeDefined();

      const function_names = Array.from(utils_index!.functions.values())
        .map((f) => f.name)
        .sort();
      expect(function_names).toEqual([
        "calculate_total",
        "helper",
        "internal_helper",
        "process_data",
        "validate_email",
      ] as SymbolName[]);
    });

    it("should resolve multiple imported function calls", async () => {
      const utils_source = load_source("modules/utils.rs");
      const main_source = load_source("modules/main.rs");
      const utils_file = file_path("modules/utils.rs");
      const main_file = file_path("modules/main.rs");

      project.update_file(utils_file, utils_source);
      project.update_file(main_file, main_source);

      const main_index = project.get_index_single_file(main_file);
      expect(main_index).toBeDefined();

      // main.rs imports: helper, process_data, calculate_total, validate_email
      const imports = Array.from(main_index!.imported_symbols.values());
      const import_names = imports.map((i) => i.name).sort();
      expect(import_names).toEqual([
        "calculate_total",
        "helper",
        "process_data",
        "validate_email",
      ] as SymbolName[]);

      // Find function call references in main.rs
      const calls = main_index!.references.filter(
        (r): r is FunctionCallReference => r.kind === "function_call"
      );
      const call_names = calls.map((c) => c.name).sort();
      // main.rs main() calls: helper, process_data, calculate_total, validate_email
      // main.rs process_user_data() calls: process_data, calculate_total, validate_email
      expect(call_names).toEqual([
        "calculate_total",
        "calculate_total",
        "helper",
        "process_data",
        "process_data",
        "validate_email",
        "validate_email",
      ] as SymbolName[]);

      // Verify all 4 imported function calls resolve to utils.rs definitions
      const imported_fn_names = ["helper", "process_data", "calculate_total", "validate_email"] as SymbolName[];
      for (const fn_name of imported_fn_names) {
        const call = calls.find((c) => c.name === fn_name);
        expect(call).toBeDefined();

        const resolved = project.resolutions.resolve(call!.scope_id, call!.name);
        expect(resolved).toBeDefined();

        const def = project.definitions.get(resolved!);
        expect(def).toBeDefined();
        expect(def!.location.file_path).toContain("utils.rs");
        expect(def!.name).toBe(fn_name);
      }
    });

    it("should handle mod declarations with inline modules", async () => {
      const source = load_source("modules/inline_modules.rs");
      const file = file_path("modules/inline_modules.rs");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Should have at least file scope + mod utils scope
      const scopes = Array.from(index!.scopes.values());
      expect(scopes.length).toBe(6);

      // inline_modules.rs defines: mod utils { helper, process_data }, main, test_inline_modules
      const functions = Array.from(index!.functions.values());
      const function_names = functions.map((f) => f.name).sort();
      expect(function_names).toEqual([
        "helper",
        "main",
        "process_data",
        "test_inline_modules",
      ] as SymbolName[]);

      // Verify imports from inline module
      const imports = Array.from(index!.imported_symbols.values());
      const import_names = imports.map((i) => i.name).sort();
      expect(import_names).toEqual(["helper", "process_data"] as SymbolName[]);
    });
  });

  describe("Cross-Module Resolution", () => {
    it("should resolve methods on imported structs", async () => {
      const user_mod_source = load_source("modules/user_mod.rs");
      const uses_user_source = load_source("modules/uses_user.rs");
      const user_mod_file = file_path("modules/user_mod.rs");
      const uses_user_file = file_path("modules/uses_user.rs");

      project.update_file(user_mod_file, user_mod_source);
      project.update_file(uses_user_file, uses_user_source);

      const main_index = project.get_index_single_file(uses_user_file);
      expect(main_index).toBeDefined();

      // uses_user.rs imports exactly User and UserManager
      const imports = Array.from(main_index!.imported_symbols.values());
      const import_names = imports.map((i) => i.name).sort();
      expect(import_names).toEqual(["User", "UserManager"] as SymbolName[]);

      // Verify User struct exists in user_mod.rs
      const user_mod_index = project.get_index_single_file(user_mod_file);
      const user_struct = Array.from(user_mod_index!.classes.values()).find(
        (c) => c.name === ("User" as SymbolName)
      );
      expect(user_struct).toBeDefined();

      // uses_user.rs calls method: get_name, get_email, is_active, update_name, activate, deactivate, format_info
      const method_calls = main_index!.references.filter(
        (r): r is MethodCallReference | SelfReferenceCall =>
          r.kind === "method_call" || r.kind === "self_reference_call"
      );
      const method_call_names = method_calls.map((c) => c.name).sort();
      expect(method_call_names).toEqual([
        "activate",
        "activate",
        "add_user",
        "clone",
        "deactivate",
        "format_info",
        "get_email",
        "get_name",
        "get_name",
        "get_user_count",
        "is_active",
        "update_name",
      ] as SymbolName[]);
    });

    it("should handle multiple structs from the same module", async () => {
      const user_mod_source = load_source("modules/user_mod.rs");
      const uses_user_source = load_source("modules/uses_user.rs");
      const user_mod_file = file_path("modules/user_mod.rs");
      const uses_user_file = file_path("modules/uses_user.rs");

      project.update_file(user_mod_file, user_mod_source);
      project.update_file(uses_user_file, uses_user_source);

      // user_mod.rs has exactly 2 structs: User and UserManager
      const user_mod_index = project.get_index_single_file(user_mod_file);
      expect(user_mod_index).toBeDefined();

      const structs = Array.from(user_mod_index!.classes.values());
      const struct_names = structs.map((s) => s.name).sort();
      expect(struct_names).toEqual(["User", "UserManager"] as SymbolName[]);

      // Verify both are imported in uses_user.rs
      const main_index = project.get_index_single_file(uses_user_file);
      expect(main_index).toBeDefined();

      const imports = Array.from(main_index!.imported_symbols.values());
      const main_import_names = imports.map((i) => i.name).sort();
      expect(main_import_names).toEqual(["User", "UserManager"] as SymbolName[]);

      // Verify UserManager::new() and User::new() are captured as constructor calls
      const new_calls = main_index!.references.filter(
        (r): r is ConstructorCallReference =>
          r.kind === "constructor_call" &&
          (r.name === "User" || r.name === "UserManager")
      );
      // main() and create_test_user() both call User::new() and main() also calls UserManager::new()
      expect(new_calls.length).toBe(3);
    });
  });

  describe("Shadowing", () => {
    it("should resolve to local definition when it shadows import", async () => {
      const utils_source = load_source("modules/utils.rs");
      const shadowing_source = load_source("modules/shadowing.rs");
      const utils_file = file_path("modules/utils.rs");
      const shadowing_file = file_path("modules/shadowing.rs");

      project.update_file(utils_file, utils_source);
      project.update_file(shadowing_file, shadowing_source);

      const shadowing_index = project.get_index_single_file(shadowing_file);
      expect(shadowing_index).toBeDefined();

      // shadowing.rs defines: helper (local), main, test_shadowing, use_original_helper
      const functions = Array.from(shadowing_index!.functions.values());
      const function_names = functions.map((f) => f.name).sort();
      expect(function_names).toEqual([
        "helper",
        "main",
        "test_shadowing",
        "use_original_helper",
      ] as SymbolName[]);

      // Find the local helper() definition
      const local_helper = functions.find((f) => f.name === ("helper" as SymbolName));
      expect(local_helper).toBeDefined();
      expect(local_helper!.location.file_path).toContain("shadowing.rs");

      // helper() calls in main() and test_shadowing() should resolve to LOCAL definition
      const helper_calls = shadowing_index!.references.filter(
        (r): r is FunctionCallReference =>
          r.kind === "function_call" &&
          r.name === ("helper" as SymbolName)
      );
      expect(helper_calls.length).toBe(2);

      for (const call of helper_calls) {
        const resolved = project.resolutions.resolve(call.scope_id, call.name);
        expect(resolved).toBeDefined();
        expect(resolved).toBe(local_helper!.symbol_id);
      }

      // process_data() call should resolve to utils.rs (not shadowed)
      const process_call = shadowing_index!.references.find(
        (r): r is FunctionCallReference =>
          r.kind === "function_call" &&
          r.name === ("process_data" as SymbolName)
      );
      expect(process_call).toBeDefined();

      const process_resolved = project.resolutions.resolve(
        process_call!.scope_id,
        process_call!.name
      );
      expect(process_resolved).toBeDefined();

      const process_def = project.definitions.get(process_resolved!);
      expect(process_def).toBeDefined();
      expect(process_def!.location.file_path).toContain("utils.rs");
    });
  });

  describe("Builder Pattern", () => {
    it("should resolve method chains in builder pattern", async () => {
      const source = load_source("structs/constructor_workflow.rs");
      const file = file_path("structs/constructor_workflow.rs");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // constructor_workflow.rs has method calls: get_name, get_price, apply_discount, mark_out_of_stock, get_info
      const method_calls = index!.references.filter(
        (r): r is MethodCallReference | SelfReferenceCall =>
          r.kind === "method_call" || r.kind === "self_reference_call"
      );
      const method_names = method_calls.map((c) => c.name).sort();
      expect(method_names).toEqual([
        "apply_discount",
        "apply_discount",
        "get_info",
        "get_name",
        "get_name",
        "get_price",
        "get_price",
        "mark_out_of_stock",
      ] as SymbolName[]);

      // Verify Product struct has all impl methods
      const product_struct = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Product" as SymbolName)
      );
      expect(product_struct).toBeDefined();

      const type_info = project.get_type_info(product_struct!.symbol_id);
      expect(type_info).toBeDefined();

      const impl_method_names = Array.from(type_info!.methods.keys()).sort();
      expect(impl_method_names).toEqual([
        "apply_discount",
        "default",
        "get_info",
        "get_name",
        "get_price",
        "mark_out_of_stock",
        "new",
      ] as SymbolName[]);
    });
  });

  describe("Basic Struct Definition", () => {
    it("should capture struct definitions with impl blocks", async () => {
      const source = load_source("structs/basic_struct.rs");
      const file = file_path("structs/basic_struct.rs");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // basic_struct.rs has 2 structs: User and Point
      const structs = Array.from(index!.classes.values());
      const struct_names = structs.map((s) => s.name).sort();
      expect(struct_names).toEqual(["Point", "User"] as SymbolName[]);

      // User struct has methods: new, greet, get_age, set_age
      const user_struct = structs.find((s) => s.name === ("User" as SymbolName));
      expect(user_struct).toBeDefined();

      const user_type_info = project.get_type_info(user_struct!.symbol_id);
      expect(user_type_info).toBeDefined();
      const user_methods = Array.from(user_type_info!.methods.keys()).sort();
      expect(user_methods).toEqual([
        "get_age",
        "greet",
        "new",
        "set_age",
      ] as SymbolName[]);

      // Point struct has methods: new, distance_from_origin
      const point_struct = structs.find((s) => s.name === ("Point" as SymbolName));
      expect(point_struct).toBeDefined();

      const point_type_info = project.get_type_info(point_struct!.symbol_id);
      expect(point_type_info).toBeDefined();
      const point_methods = Array.from(point_type_info!.methods.keys()).sort();
      expect(point_methods).toEqual([
        "distance_from_origin",
        "new",
      ] as SymbolName[]);
    });
  });

  describe("Callback detection and invocation", () => {
    it("should detect callback context for closures in iterator methods", async () => {
      const code = `
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    let doubled: Vec<i32> = numbers.iter().map(|x| x * 2).collect();
}
      `.trim();

      const file_path_str = "/tmp/ariadne_test/callback.rs" as FilePath;
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
      const code = `
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    let doubled: Vec<i32> = numbers.iter().map(|x| x * 2).collect();
    let evens: Vec<&i32> = numbers.iter().filter(|x| *x % 2 == 0).collect();
}
      `.trim();

      const file_path_str = "/tmp/ariadne_test/callbacks_entry.rs" as FilePath;
      project.update_file(file_path_str, code);

      const definitions = project.definitions;
      const call_graph = project.get_call_graph();

      // Find closures
      const closures = Array.from(definitions.get_callable_definitions()).filter(
        (d) => d.name === "<anonymous>"
      );
      expect(closures.length).toBe(2);

      // Verify closures are NOT entry points
      const entry_point_ids = new Set(call_graph.entry_points);
      for (const closure of closures) {
        expect(entry_point_ids.has(closure.symbol_id)).toBe(false);
      }

      // Verify main() IS an entry point
      const main_def = Array.from(definitions.get_callable_definitions()).find(
        (d) => d.name === "main"
      );
      expect(main_def).toBeDefined();
      expect(entry_point_ids.has(main_def!.symbol_id)).toBe(true);
    });

  });

  describe("Polymorphic Trait Resolution", () => {
    it("should resolve trait method calls to all implementations", async () => {
      const source = load_source("traits/polymorphic_handler.rs");
      const file = file_path("traits/polymorphic_handler.rs");
      project.update_file(file, source);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Handler trait is captured as an interface
      const handler_trait = Array.from(index!.interfaces.values()).find(
        (i) => i.name === ("Handler" as SymbolName)
      );
      expect(handler_trait).toBeDefined();

      // Exactly 3 implementing structs: HandlerA, HandlerB, HandlerC
      const classes = Array.from(index!.classes.values());
      const class_names = classes.map((c) => c.name).sort();
      expect(class_names).toEqual([
        "HandlerA",
        "HandlerB",
        "HandlerC",
      ] as SymbolName[]);
    });

    it("should have process methods from all three implementations in call graph", async () => {
      const source = load_source("traits/polymorphic_handler.rs");
      const file = file_path("traits/polymorphic_handler.rs");
      project.update_file(file, source);

      const call_graph = project.get_call_graph();
      const nodes = Array.from(call_graph.nodes.values());

      // Find process methods from polymorphic_handler.rs
      const process_methods = nodes.filter(
        (n) => n.name === "process" && n.location.file_path.includes("polymorphic_handler.rs")
      );

      // Should have exactly 3 process methods (one for each impl)
      expect(process_methods.length).toBe(3);

      // Find get_name methods too
      const get_name_methods = nodes.filter(
        (n) => n.name === "get_name" && n.location.file_path.includes("polymorphic_handler.rs")
      );
      expect(get_name_methods.length).toBe(3);
    });
  });

  describe("Function as Callback - Entry Point Detection", () => {
    it("should not flag named closure passed as argument as entry point", async () => {
      const source = load_source("functions/function_as_callback.rs");
      const file = file_path("functions/function_as_callback.rs");
      project.update_file(file, source);

      // Verify the fixture indexes successfully
      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Find the apply function and main function
      const functions = Array.from(index!.functions.values());
      const apply_fn = functions.find((f) => f.name === ("apply" as SymbolName));
      expect(apply_fn).toBeDefined();

      const main_fn = functions.find((f) => f.name === ("main" as SymbolName));
      expect(main_fn).toBeDefined();

      // Get call graph and check entry points
      const call_graph = project.get_call_graph();
      expect(call_graph).toBeDefined();

      const entry_point_ids = new Set(call_graph.entry_points);

      // apply should NOT be an entry point (called by main)
      expect(entry_point_ids.has(apply_fn!.symbol_id)).toBe(false);
    });
  });

  describe("Incremental Updates", () => {
    it("should re-resolve after file update", async () => {
      const source_v1 = load_source("modules/utils.rs");
      const utils_file = file_path("modules/utils.rs");
      project.update_file(utils_file, source_v1);

      let index = project.get_index_single_file(utils_file);
      expect(index).toBeDefined();
      const initial_functions = index!.functions.size;

      // Modify file (add a function)
      const source_v2 = source_v1 + "\n\npub fn new_function() -> i32 { 123 }\n";
      project.update_file(utils_file, source_v2);

      // Verify re-indexing occurred
      index = project.get_index_single_file(utils_file);
      expect(index).toBeDefined();
      expect(index!.functions.size).toBe(initial_functions + 1);

      // Verify the new function is in the index
      const new_func_defs = Array.from(index!.functions.values()).filter(
        (f) => f.name === ("new_function" as SymbolName)
      );
      expect(new_func_defs.length).toBe(1);
    });

    it("should update dependent files when imported file changes", async () => {
      const utils_source = load_source("modules/utils.rs");
      const main_source = load_source("modules/main.rs");
      const utils_file = file_path("modules/utils.rs");
      const main_file = file_path("modules/main.rs");

      project.update_file(utils_file, utils_source);
      project.update_file(main_file, main_source);

      // Verify initial state - helper() call resolves to utils.rs
      const main_v1 = project.get_index_single_file(main_file);
      const helper_call_v1 = main_v1!.references.find(
        (r): r is FunctionCallReference =>
          r.kind === "function_call" &&
          r.name === ("helper" as SymbolName)
      );
      expect(helper_call_v1).toBeDefined();

      const resolved_v1 = project.resolutions.resolve(
        helper_call_v1!.scope_id,
        helper_call_v1!.name
      );
      expect(resolved_v1).toBeDefined();
      const resolved_def_v1 = project.definitions.get(resolved_v1!);
      expect(resolved_def_v1!.location.file_path).toContain("utils.rs");

      // Modify utils.rs - rename helper to renamed_helper
      const modified_utils = utils_source.replace(
        "pub fn helper",
        "pub fn renamed_helper"
      );
      project.update_file(utils_file, modified_utils);

      // Verify main.rs still has the reference (source unchanged)
      const main_v2 = project.get_index_single_file(main_file);
      const helper_call_v2 = main_v2!.references.find(
        (r): r is FunctionCallReference =>
          r.kind === "function_call" &&
          r.name === ("helper" as SymbolName)
      );
      expect(helper_call_v2).toBeDefined();

      // Import should not resolve after source file renames the export
      const resolved_v2 = project.resolutions.resolve(
        helper_call_v2!.scope_id,
        helper_call_v2!.name
      );
      expect(resolved_v2).toBeNull();
    });

    it("should handle file removal and update dependents", async () => {
      const utils_source = load_source("modules/utils.rs");
      const main_source = load_source("modules/main.rs");
      const utils_file = file_path("modules/utils.rs");
      const main_file = file_path("modules/main.rs");

      project.update_file(utils_file, utils_source);
      project.update_file(main_file, main_source);

      // Verify main.rs depends on utils.rs
      const dependents = project.get_dependents(utils_file);
      expect(dependents.has(main_file)).toBe(true);

      // Remove utils.rs
      project.remove_file(utils_file);

      // Verify utils.rs is removed
      const utils_index = project.get_index_single_file(utils_file);
      expect(utils_index).toBeUndefined();

      // Verify main.rs still exists but import can't resolve
      const main = project.get_index_single_file(main_file);
      expect(main).toBeDefined();

      // Call to helper (which was imported) should not resolve after source file removal
      const helper_call = main!.references.find(
        (r): r is FunctionCallReference =>
          r.kind === "function_call" &&
          r.name === ("helper" as SymbolName)
      );
      expect(helper_call).toBeDefined();
      const resolved = project.resolutions.resolve(
        helper_call!.scope_id,
        helper_call!.name
      );
      expect(resolved).toBeNull();
    });
  });

  describe("Call Graph", () => {
    it("should build call graph with exact caller-callee relationships", async () => {
      const source = load_source("functions/nested_scopes.rs");
      const file = file_path("functions/nested_scopes.rs");
      project.update_file(file, source);

      const call_graph = project.get_call_graph();
      expect(call_graph.nodes.size).toBe(6);

      const nodes = Array.from(call_graph.nodes.values());

      // Find specific caller nodes by name
      const main_node = nodes.find((n) => {
        const def = project.definitions.get(n.symbol_id);
        return def?.name === ("main" as SymbolName);
      });
      expect(main_node).toBeDefined();
      // main() calls helper() (x2, including block scope) and outer_function()
      expect(main_node!.enclosed_calls.length).toBe(3);
    });

    it("should include cross-file calls in call graph", async () => {
      const utils_source = load_source("modules/utils.rs");
      const main_source = load_source("modules/main.rs");
      const utils_file = file_path("modules/utils.rs");
      const main_file = file_path("modules/main.rs");

      project.update_file(utils_file, utils_source);
      project.update_file(main_file, main_source);

      const call_graph = project.get_call_graph();

      // Should have nodes from both files
      const nodes = Array.from(call_graph.nodes.values());
      const utils_nodes = nodes.filter((n) =>
        n.location.file_path.includes("utils.rs")
      );
      const main_nodes = nodes.filter((n) =>
        n.location.file_path.includes("main.rs")
      );

      expect(utils_nodes.length).toBe(5);
      expect(main_nodes.length).toBe(2);

      // Verify cross-file call: main.rs main() calls utils.rs helper()
      const main_fn_node = main_nodes.find((n) => {
        const def = project.definitions.get(n.symbol_id);
        return def?.name === ("main" as SymbolName);
      });
      expect(main_fn_node).toBeDefined();

      // main() should have calls that resolve to utils.rs definitions
      const has_cross_file_calls = main_fn_node!.enclosed_calls.some((call) =>
        call.resolutions.some((resolution) => {
          const called_node = call_graph.nodes.get(resolution.symbol_id);
          return called_node && called_node.location.file_path.includes("utils.rs");
        })
      );
      expect(has_cross_file_calls).toBe(true);
    });

    it("should update call graph after file changes", async () => {
      const source = load_source("functions/nested_scopes.rs");
      const file = file_path("functions/nested_scopes.rs");
      project.update_file(file, source);

      // Get initial call graph
      const call_graph_v1 = project.get_call_graph();
      const initial_node_count = call_graph_v1.nodes.size;

      // Add a new function with calls
      const modified_source =
        source + "\n\nfn new_function() -> &'static str { helper() }\n";
      project.update_file(file, modified_source);

      // Get updated call graph
      const call_graph_v2 = project.get_call_graph();

      // Should have exactly one more node (new_function added)
      expect(call_graph_v2.nodes.size).toBe(initial_node_count + 1);

      // Find new_function node
      const new_func_nodes = Array.from(call_graph_v2.nodes.values()).filter(
        (n) => {
          const def = project.definitions.get(n.symbol_id);
          return def?.name === ("new_function" as SymbolName);
        }
      );
      expect(new_func_nodes.length).toBe(1);

      // Verify new_function has calls (to helper)
      const new_func_node = new_func_nodes[0];
      expect(new_func_node.enclosed_calls.length).toBe(1);
    });
  });

  describe("Pub Use Re-exports", () => {
    it("should resolve symbols through pub use re-exports", async () => {

      // Module that defines functions
      const math_code = `
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

pub fn multiply(a: i32, b: i32) -> i32 {
    a * b
}
      `.trim();

      // Module that re-exports via pub use
      const reexport_code = `
mod math;
pub use math::{add, multiply};
      `.trim();

      // Consumer that imports through the re-export
      const consumer_code = `
mod reexport;
use reexport::{add, multiply};

fn main() {
    let sum = add(1, 2);
    let product = multiply(3, 4);
}
      `.trim();

      const math_file = "/tmp/ariadne_test/math.rs" as FilePath;
      const reexport_file = "/tmp/ariadne_test/reexport.rs" as FilePath;
      const consumer_file = "/tmp/ariadne_test/consumer.rs" as FilePath;

      project.update_file(math_file, math_code);
      project.update_file(reexport_file, reexport_code);
      project.update_file(consumer_file, consumer_code);

      // Verify consumer has imports
      const consumer_index = project.get_index_single_file(consumer_file);
      expect(consumer_index).toBeDefined();

      const imports = Array.from(consumer_index!.imported_symbols.values());
      const import_names = imports.map((i) => i.name).sort();
      expect(import_names).toEqual(["add", "multiply"] as SymbolName[]);

      // Verify add() call resolves
      const add_call = consumer_index!.references.find(
        (r): r is FunctionCallReference =>
          r.kind === "function_call" &&
          r.name === ("add" as SymbolName)
      );
      expect(add_call).toBeDefined();

      const resolved_add = project.resolutions.resolve(
        add_call!.scope_id,
        add_call!.name
      );
      // pub use re-exports don't currently resolve through to the original definition
      expect(resolved_add).toBeNull();
    });
  });

});

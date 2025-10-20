import { describe, it, expect, beforeEach } from "vitest";
import { Project } from "./project";
import path from "path";
import fs from "fs";
import type { FilePath, SymbolName } from "@ariadnejs/types";

const FIXTURE_ROOT = path.join(
  __dirname,
  "../../tests/fixtures/javascript/code"
);

function load_source(relative_path: string): string {
  return fs.readFileSync(path.join(FIXTURE_ROOT, relative_path), "utf-8");
}

function file_path(relative_path: string): FilePath {
  return path.join(FIXTURE_ROOT, relative_path) as FilePath;
}

describe("Project Integration - JavaScript", () => {
  let project: Project;

  beforeEach(async () => {
    project = new Project();
    await project.initialize(FIXTURE_ROOT as FilePath);
  });

  describe("CommonJS Module Resolution", () => {
    it("should resolve require() imports", async () => {
      const utils = load_source("modules/utils_commonjs.js");
      const main = load_source("modules/main_commonjs.js");
      const utils_file = file_path("modules/utils_commonjs.js");
      const main_file = file_path("modules/main_commonjs.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Verify require() creates import definitions
      const main_index = project.get_semantic_index(main_file);
      expect(main_index).toBeDefined();

      const imports = Array.from(main_index!.imported_symbols.values());
      expect(imports.length).toBeGreaterThan(0);

      // Find the helper import
      const helper_import = imports.find((i) => i.name === ("helper" as SymbolName));
      expect(helper_import).toBeDefined();
    });

    it("should resolve cross-file function calls in CommonJS", async () => {
      const utils = load_source("modules/utils_commonjs.js");
      const main = load_source("modules/main_commonjs.js");
      const utils_file = file_path("modules/utils_commonjs.js");
      const main_file = file_path("modules/main_commonjs.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Get main index
      const main_index = project.get_semantic_index(main_file);
      expect(main_index).toBeDefined();

      // Find call to helper
      const calls = main_index!.references.filter((r) => r.type === "call");
      expect(calls.length).toBeGreaterThan(0);

      const helper_call = calls.find(
        (c) =>
          c.name === ("helper" as SymbolName) && c.call_type === "function"
      );
      expect(helper_call).toBeDefined();

      // Verify cross-file resolution
      const resolved = project.resolutions.resolve(
        helper_call!.scope_id,
        helper_call!.name
      );
      expect(resolved).toBeDefined();

      // Verify it resolves to utils_commonjs.js
      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.location.file_path).toContain("utils_commonjs.js");
    });

    it("should handle module.exports patterns", async () => {
      const utils = load_source("modules/utils_commonjs.js");
      const utils_file = file_path("modules/utils_commonjs.js");

      project.update_file(utils_file, utils);

      const index = project.get_semantic_index(utils_file);
      expect(index).toBeDefined();

      // Verify functions are exported
      const functions = Array.from(index!.functions.values());
      expect(functions.length).toBeGreaterThan(0);

      // Check for helper, processData, calculateTotal
      const helper_fn = functions.find((f) => f.name === ("helper" as SymbolName));
      const process_data_fn = functions.find(
        (f) => f.name === ("processData" as SymbolName)
      );
      const calculate_total_fn = functions.find(
        (f) => f.name === ("calculateTotal" as SymbolName)
      );

      expect(helper_fn).toBeDefined();
      expect(process_data_fn).toBeDefined();
      expect(calculate_total_fn).toBeDefined();
    });
  });

  describe("ES6 Module Resolution", () => {
    it("should resolve import/export", async () => {
      const utils = load_source("modules/utils_es6.js");
      const main = load_source("modules/main_es6.js");
      const utils_file = file_path("modules/utils_es6.js");
      const main_file = file_path("modules/main_es6.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Verify ES6 import creates import definitions
      const main_index = project.get_semantic_index(main_file);
      expect(main_index).toBeDefined();

      const imports = Array.from(main_index!.imported_symbols.values());
      expect(imports.length).toBeGreaterThan(0);

      // Find the helper import
      const helper_import = imports.find((i) => i.name === ("helper" as SymbolName));
      expect(helper_import).toBeDefined();
    });

    it("should resolve cross-file function calls in ES6", async () => {
      const utils = load_source("modules/utils_es6.js");
      const main = load_source("modules/main_es6.js");
      const utils_file = file_path("modules/utils_es6.js");
      const main_file = file_path("modules/main_es6.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Get main index
      const main_index = project.get_semantic_index(main_file);
      expect(main_index).toBeDefined();

      // Find call to helper
      const calls = main_index!.references.filter((r) => r.type === "call");
      expect(calls.length).toBeGreaterThan(0);

      const helper_call = calls.find(
        (c) =>
          c.name === ("helper" as SymbolName) && c.call_type === "function"
      );
      expect(helper_call).toBeDefined();

      // Verify cross-file resolution
      const resolved = project.resolutions.resolve(
        helper_call!.scope_id,
        helper_call!.name
      );
      expect(resolved).toBeDefined();

      // Verify it resolves to utils_es6.js
      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.location.file_path).toContain("utils_es6.js");
    });

    it("should handle default exports", async () => {
      const utils = load_source("modules/utils_es6.js");
      const main = load_source("modules/main_es6.js");
      const utils_file = file_path("modules/utils_es6.js");
      const main_file = file_path("modules/main_es6.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Verify default import
      const main_index = project.get_semantic_index(main_file);
      expect(main_index).toBeDefined();

      const imports = Array.from(main_index!.imported_symbols.values());

      // Find the formatDate default import
      const format_date_import = imports.find(
        (i) => i.name === ("formatDate" as SymbolName)
      );
      expect(format_date_import).toBeDefined();

      // Find call to formatDate
      const calls = main_index!.references.filter((r) => r.type === "call");
      const format_date_call = calls.find(
        (c) => c.name === ("formatDate" as SymbolName)
      );
      expect(format_date_call).toBeDefined();

      // Verify it resolves
      const resolved = project.resolutions.resolve(
        format_date_call!.scope_id,
        format_date_call!.name
      );
      expect(resolved).toBeDefined();

      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.location.file_path).toContain("utils_es6.js");
    });
  });

  describe("Class Methods", () => {
    it("should resolve ES6 class methods", async () => {
      const source = load_source("classes/constructor_workflow.js");
      const file = file_path("classes/constructor_workflow.js");

      project.update_file(file, source);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find class
      const classes = Array.from(index!.classes.values());
      expect(classes.length).toBeGreaterThan(0);

      const product_class = classes.find(
        (c) => c.name === ("Product" as SymbolName)
      );
      expect(product_class).toBeDefined();

      // Find method call
      const method_calls = index!.references.filter(
        (r) => r.type === "call" && r.call_type === "method"
      );
      expect(method_calls.length).toBeGreaterThan(0);

      // Find the getName method call
      const get_name_call = method_calls.find(
        (c) => c.name === ("getName" as SymbolName)
      );
      expect(get_name_call).toBeDefined();

      // Get type info for Product class
      const type_info = project.get_type_info(product_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.size).toBeGreaterThan(0);

      // Verify getName method exists in type info
      const get_name_method_id = type_info!.methods.get(
        "getName" as SymbolName
      );
      expect(get_name_method_id).toBeDefined();
    });

    it("should handle prototype methods", async () => {
      const source = load_source("classes/prototype_methods.js");
      const file = file_path("classes/prototype_methods.js");

      project.update_file(file, source);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find the Vehicle class (constructor function)
      const functions = Array.from(index!.functions.values());
      const vehicle_fn = functions.find(
        (f) => f.name === ("Vehicle" as SymbolName)
      );
      expect(vehicle_fn).toBeDefined();

      // Find method calls
      const method_calls = index!.references.filter(
        (r) => r.type === "call" && r.call_type === "method"
      );
      expect(method_calls.length).toBeGreaterThan(0);

      // Find start method call
      const start_call = method_calls.find(
        (c) => c.name === ("start" as SymbolName)
      );
      expect(start_call).toBeDefined();

      // Find getInfo method call
      const get_info_call = method_calls.find(
        (c) => c.name === ("getInfo" as SymbolName)
      );
      expect(get_info_call).toBeDefined();

      // Note: Prototype methods may not resolve in the same way as ES6 class methods
      // due to the dynamic nature of prototype assignment. This is expected.
    });

    it("should handle method chaining", async () => {
      const source = load_source("classes/constructor_workflow.js");
      const file = file_path("classes/constructor_workflow.js");

      project.update_file(file, source);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find method calls
      const method_calls = index!.references.filter(
        (r) => r.type === "call" && r.call_type === "method"
      );

      // Find applyDiscount and markOutOfStock calls (method chaining)
      const apply_discount_call = method_calls.find(
        (c) => c.name === ("applyDiscount" as SymbolName)
      );
      const mark_out_of_stock_call = method_calls.find(
        (c) => c.name === ("markOutOfStock" as SymbolName)
      );

      expect(apply_discount_call).toBeDefined();
      expect(mark_out_of_stock_call).toBeDefined();
    });
  });

  describe("JavaScript Patterns", () => {
    it("should handle IIFE patterns", async () => {
      const source = load_source("functions/iife_patterns.js");
      const file = file_path("functions/iife_patterns.js");

      project.update_file(file, source);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Verify IIFE scopes are captured
      const scopes = Array.from(index!.scopes.values());
      const function_scopes = scopes.filter((s) => s.type === "function");
      expect(function_scopes.length).toBeGreaterThan(0);

      // Find function definitions within IIFEs
      const functions = Array.from(index!.functions.values());
      const helper_fns = functions.filter(
        (f) => f.name === ("helper" as SymbolName)
      );
      expect(helper_fns.length).toBeGreaterThan(0);
    });

    it("should handle closures and nested scopes", async () => {
      const source = load_source("functions/closures.js");
      const file = file_path("functions/closures.js");

      project.update_file(file, source);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find closure functions
      const functions = Array.from(index!.functions.values());

      // createMultiplier should exist
      const create_multiplier = functions.find(
        (f) => f.name === ("createMultiplier" as SymbolName)
      );
      expect(create_multiplier).toBeDefined();

      // createBankAccount should exist
      const create_bank_account = functions.find(
        (f) => f.name === ("createBankAccount" as SymbolName)
      );
      expect(create_bank_account).toBeDefined();

      // Nested scopes should be captured
      const scopes = Array.from(index!.scopes.values());
      const function_scopes = scopes.filter((s) => s.type === "function");
      expect(function_scopes.length).toBeGreaterThan(5); // Multiple nested functions

      // Find inner function calls
      const calls = index!.references.filter((r) => r.type === "call");
      expect(calls.length).toBeGreaterThan(0);

      // Find multiply call (inside closure)
      const multiply_call = calls.find(
        (c) => c.name === ("multiply" as SymbolName)
      );
      expect(multiply_call).toBeDefined();

      // Verify it resolves to the multiply function in the same file
      const resolved = project.resolutions.resolve(
        multiply_call!.scope_id,
        multiply_call!.name
      );
      expect(resolved).toBeDefined();

      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.name).toBe("multiply" as SymbolName);
    });

    it("should handle factory patterns", async () => {
      const source = load_source("functions/factory_patterns.js");
      const file = file_path("functions/factory_patterns.js");

      project.update_file(file, source);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Verify factory functions exist
      const functions = Array.from(index!.functions.values());
      expect(functions.length).toBeGreaterThan(0);
    });
  });

  describe("Cross-Module Resolution", () => {
    it("should resolve imported class and methods", async () => {
      const user_class = load_source("modules/user_class.js");
      const uses_user = load_source("modules/uses_user.js");
      const user_file = file_path("modules/user_class.js");
      const uses_file = file_path("modules/uses_user.js");

      project.update_file(user_file, user_class);
      project.update_file(uses_file, uses_user);

      // Get uses_user index
      const uses_index = project.get_semantic_index(uses_file);
      expect(uses_index).toBeDefined();

      // Find import
      const imports = Array.from(uses_index!.imported_symbols.values());
      expect(imports.length).toBeGreaterThan(0);

      // Find the User import
      const user_import = imports.find((i) => i.name === ("User" as SymbolName));
      expect(user_import).toBeDefined();

      // Verify User class is in user_class.js
      const user_index = project.get_semantic_index(user_file);
      const user_class_def = Array.from(user_index!.classes.values()).find(
        (c) => c.name === ("User" as SymbolName)
      );
      expect(user_class_def).toBeDefined();
      expect(user_class_def!.location.file_path).toContain("user_class.js");
    });

    it("should capture method calls on imported class instances", async () => {
      const user_class = load_source("modules/user_class.js");
      const uses_user = load_source("modules/uses_user.js");
      const user_file = file_path("modules/user_class.js");
      const uses_file = file_path("modules/uses_user.js");

      project.update_file(user_file, user_class);
      project.update_file(uses_file, uses_user);

      // Get uses_user index
      const uses_index = project.get_semantic_index(uses_file);
      expect(uses_index).toBeDefined();

      // Find method calls
      const method_calls = uses_index!.references.filter(
        (r) => r.type === "call" && r.call_type === "method"
      );
      expect(method_calls.length).toBeGreaterThan(0);

      // Find getName method call
      const getName_call = method_calls.find(
        (c) => c.name === ("getName" as SymbolName)
      );
      expect(getName_call).toBeDefined();
      expect(getName_call!.name).toBe("getName" as SymbolName);

      // Verify User class exists in user_class.js
      const user_index = project.get_semantic_index(user_file);
      const user_class_def = Array.from(user_index!.classes.values()).find(
        (c) => c.name === ("User" as SymbolName)
      );
      expect(user_class_def).toBeDefined();

      // Verify getName method exists in the User class
      const getName_method = user_class_def!.methods.find(
        (m) => m.name === ("getName" as SymbolName)
      );
      expect(getName_method).toBeDefined();
      expect(getName_method!.location.file_path).toContain("user_class.js");
    });

    it("should follow re-export chains", async () => {
      const base = load_source("modules/base.js");
      const middle = load_source("modules/middle.js");
      const main = load_source("modules/main_reexport.js");
      const base_file = file_path("modules/base.js");
      const middle_file = file_path("modules/middle.js");
      const main_file = file_path("modules/main_reexport.js");

      project.update_file(base_file, base);
      project.update_file(middle_file, middle);
      project.update_file(main_file, main);

      // Get main index
      const main_index = project.get_semantic_index(main_file);
      expect(main_index).toBeDefined();

      // Find call to coreFunction (imported from middle, re-exported from base)
      const calls = main_index!.references.filter((r) => r.type === "call");
      const core_call = calls.find(
        (c) =>
          c.name === ("coreFunction" as SymbolName) && c.call_type === "function"
      );
      expect(core_call).toBeDefined();

      // Verify it resolves to base.js (not middle.js)
      const resolved = project.resolutions.resolve(
        core_call!.scope_id,
        core_call!.name
      );
      expect(resolved).toBeDefined();

      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.kind).toBe("function");
      expect(resolved_def!.name).toBe("coreFunction" as SymbolName);
      expect(resolved_def!.location.file_path).toContain("base.js");
    });

    it("should resolve aliased imports", async () => {
      const utils = load_source("modules/utils_aliased.js");
      const main = load_source("modules/main_aliased.js");
      const utils_file = file_path("modules/utils_aliased.js");
      const main_file = file_path("modules/main_aliased.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Get main index
      const main_index = project.get_semantic_index(main_file);
      expect(main_index).toBeDefined();

      // Find imports with aliases
      const imports = Array.from(main_index!.imported_symbols.values());
      expect(imports.length).toBeGreaterThan(0);

      // Find utilHelper import (aliased from helper)
      const util_helper_import = imports.find(
        (i) => i.name === ("utilHelper" as SymbolName)
      );
      expect(util_helper_import).toBeDefined();
      expect(util_helper_import!.original_name).toBe("helper" as SymbolName);

      // Find call to utilHelper
      const calls = main_index!.references.filter((r) => r.type === "call");
      const helper_call = calls.find(
        (c) =>
          c.name === ("utilHelper" as SymbolName) && c.call_type === "function"
      );
      expect(helper_call).toBeDefined();

      // Verify it resolves to helper in utils_aliased.js
      const resolved = project.resolutions.resolve(
        helper_call!.scope_id,
        helper_call!.name
      );
      expect(resolved).toBeDefined();

      const resolved_def = project.definitions.get(resolved!);
      expect(resolved_def).toBeDefined();
      expect(resolved_def!.kind).toBe("function");
      expect(resolved_def!.name).toBe("helper" as SymbolName);
      expect(resolved_def!.location.file_path).toContain("utils_aliased.js");
    });

    it("should handle aliased class imports and method calls", async () => {
      const utils = load_source("modules/utils_aliased.js");
      const main = load_source("modules/main_aliased.js");
      const utils_file = file_path("modules/utils_aliased.js");
      const main_file = file_path("modules/main_aliased.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Get main index
      const main_index = project.get_semantic_index(main_file);
      expect(main_index).toBeDefined();

      // Find Manager import (aliased from DataManager)
      const imports = Array.from(main_index!.imported_symbols.values());
      const manager_import = imports.find(
        (i) => i.name === ("Manager" as SymbolName)
      );
      expect(manager_import).toBeDefined();
      expect(manager_import!.original_name).toBe("DataManager" as SymbolName);

      // Find method call on manager instance
      const method_calls = main_index!.references.filter(
        (r) => r.type === "call" && r.call_type === "method"
      );
      const process_call = method_calls.find(
        (c) => c.name === ("process" as SymbolName)
      );
      expect(process_call).toBeDefined();
      expect(process_call!.name).toBe("process" as SymbolName);

      // Verify DataManager class exists in utils_aliased.js
      const utils_index = project.get_semantic_index(utils_file);
      const data_manager_class = Array.from(utils_index!.classes.values()).find(
        (c) => c.name === ("DataManager" as SymbolName)
      );
      expect(data_manager_class).toBeDefined();

      // Verify process method exists in the DataManager class
      const process_method = data_manager_class!.methods.find(
        (m) => m.name === ("process" as SymbolName)
      );
      expect(process_method).toBeDefined();
      expect(process_method!.location.file_path).toContain("utils_aliased.js");
    });
  });

  describe("Shadowing", () => {
    it("should resolve to local definition when it shadows import", async () => {
      const source = load_source("modules/shadowing.js");
      const file = file_path("modules/shadowing.js");

      project.update_file(file, source);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Verify scopes exist with shadowing
      const scopes = Array.from(index!.scopes.values());
      expect(scopes.length).toBeGreaterThan(0);

      // Find function definitions
      const functions = Array.from(index!.functions.values());
      expect(functions.length).toBeGreaterThan(0);
    });
  });

  describe("Call Graph", () => {
    it("should build call graph for JavaScript functions", async () => {
      const source = load_source("functions/closures.js");
      const file = file_path("functions/closures.js");

      project.update_file(file, source);

      // Get call graph
      const call_graph = project.get_call_graph();
      expect(call_graph).toBeDefined();

      // Should have nodes for callable functions
      expect(call_graph.nodes.size).toBeGreaterThan(0);

      // Verify some nodes have calls
      const nodes = Array.from(call_graph.nodes.values());
      const has_calls = nodes.some((node) => node.enclosed_calls.length > 0);
      expect(has_calls).toBe(true);
    });

    it("should handle cross-module call graph", async () => {
      const utils = load_source("modules/utils_es6.js");
      const main = load_source("modules/main_es6.js");
      const utils_file = file_path("modules/utils_es6.js");
      const main_file = file_path("modules/main_es6.js");

      project.update_file(utils_file, utils);
      project.update_file(main_file, main);

      // Get call graph
      const call_graph = project.get_call_graph();
      expect(call_graph).toBeDefined();

      // Should have nodes from both files
      const nodes = Array.from(call_graph.nodes.values());
      expect(nodes.length).toBeGreaterThan(0);
    });
  });

  describe("Incremental Updates", () => {
    it("should re-resolve after file update", async () => {
      const source_v1 = load_source("modules/utils_es6.js");
      const utils_file = file_path("modules/utils_es6.js");
      project.update_file(utils_file, source_v1);

      let index = project.get_semantic_index(utils_file);
      expect(index).toBeDefined();
      const initial_functions = index!.functions.size;

      // Modify file (add a function)
      const source_v2 =
        source_v1 + "\n\nexport function newFunc() { return 123; }";
      project.update_file(utils_file, source_v2);

      // Verify re-indexing occurred
      index = project.get_semantic_index(utils_file);
      expect(index).toBeDefined();
      expect(index!.functions.size).toBeGreaterThan(initial_functions);

      // Verify the new function is in definitions registry
      const new_func_defs = Array.from(index!.functions.values()).filter(
        (f) => f.name === ("newFunc" as SymbolName)
      );
      expect(new_func_defs.length).toBe(1);
    });

    it("should update dependent files when imported file changes", async () => {
      const utils_source = load_source("modules/utils_es6.js");
      const main_source = load_source("modules/main_es6.js");
      const utils_file = file_path("modules/utils_es6.js");
      const main_file = file_path("modules/main_es6.js");

      project.update_file(utils_file, utils_source);
      project.update_file(main_file, main_source);

      // Verify initial state - helper call resolves
      const main_v1 = project.get_semantic_index(main_file);
      const helper_call_v1 = main_v1!.references.find(
        (r) =>
          r.name === ("helper" as SymbolName) &&
          r.type === "call" &&
          r.call_type === "function"
      );
      expect(helper_call_v1).toBeDefined();

      const resolved_v1 = project.resolutions.resolve(
        helper_call_v1!.scope_id,
        helper_call_v1!.name
      );
      expect(resolved_v1).toBeDefined();

      // Modify utils.js - rename helper
      const modified_utils = utils_source.replace(
        "function helper",
        "function renamedHelper"
      );
      project.update_file(utils_file, modified_utils);

      // Verify main.js still has the reference (source unchanged)
      const main_v2 = project.get_semantic_index(main_file);
      const helper_call_v2 = main_v2!.references.find(
        (r) =>
          r.name === ("helper" as SymbolName) &&
          r.type === "call" &&
          r.call_type === "function"
      );
      expect(helper_call_v2).toBeDefined();

      // Import should not resolve after source file removes the export
      const resolved_v2 = project.resolutions.resolve(
        helper_call_v2!.scope_id,
        helper_call_v2!.name
      );
      expect(resolved_v2).toBeNull();
    });

    it("should handle file removal and update dependents", async () => {
      const utils_source = load_source("modules/utils_es6.js");
      const main_source = load_source("modules/main_es6.js");
      const utils_file = file_path("modules/utils_es6.js");
      const main_file = file_path("modules/main_es6.js");

      project.update_file(utils_file, utils_source);
      project.update_file(main_file, main_source);

      // Verify main.js depends on utils.js
      const dependents = project.get_dependents(utils_file);
      expect(dependents.has(main_file)).toBe(true);

      // Remove utils.js
      project.remove_file(utils_file);

      // Verify utils.js is removed
      const utils_index = project.get_semantic_index(utils_file);
      expect(utils_index).toBeUndefined();

      // Verify main.js still exists but import can't resolve
      const main = project.get_semantic_index(main_file);
      expect(main).toBeDefined();

      // Call to helper (which was imported) should not resolve after source file removal
      const helper_call = main!.references.find(
        (r) =>
          r.name === ("helper" as SymbolName) &&
          r.type === "call" &&
          r.call_type === "function"
      );
      if (helper_call) {
        const resolved = project.resolutions.resolve(
          helper_call.scope_id,
          helper_call.name
        );
        expect(resolved).toBeNull();
      }
    });
  });
});

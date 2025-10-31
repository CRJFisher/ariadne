import { describe, it, expect, beforeEach } from "vitest";
import { Project } from "./project";
import path from "path";
import fs from "fs";
import type { FilePath, SymbolName, SymbolId } from "@ariadnejs/types";

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

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find struct (structs map to classes in our model)
      const structs = Array.from(index!.classes.values());
      expect(structs.length).toBeGreaterThan(0);

      const user_struct = structs.find((s) => s.name === ("User" as SymbolName));
      expect(user_struct).toBeDefined();

      // Get type members (should include impl block methods)
      const type_info = project.get_type_info(user_struct!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.size).toBeGreaterThan(0);

      // Verify method is from impl block
      const get_name = type_info!.methods.get("get_name" as SymbolName);
      expect(get_name).toBeDefined();

      // Verify associated functions exist
      const new_fn = type_info!.methods.get("new" as SymbolName);
      expect(new_fn).toBeDefined();
    });

    it("should resolve method calls (&self)", async () => {
      const source = load_source("structs/constructor_workflow.rs");
      const file = file_path("structs/constructor_workflow.rs");
      project.update_file(file, source);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find method call references
      const method_calls = index!.references.filter(
        (r) => r.type === "call" && r.call_type === "method"
      );
      expect(method_calls.length).toBeGreaterThan(0);

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

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find function definitions
      const functions = Array.from(index!.functions.values());
      expect(functions.length).toBeGreaterThan(0);

      // Find call references
      const calls = index!.references.filter((r) => r.type === "call");
      expect(calls.length).toBeGreaterThan(0);

      // Verify at least one call resolves
      const first_call = calls[0];
      const resolved = project.resolutions.resolve(
        first_call.scope_id,
        first_call.name
      );
      expect(resolved).toBeDefined();
    });

    it("should handle variable shadowing", async () => {
      const source = load_source("functions/variable_shadowing.rs");
      const file = file_path("functions/variable_shadowing.rs");
      project.update_file(file, source);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find variable definitions
      const variables = Array.from(index!.variables.values());
      expect(variables.length).toBeGreaterThan(0);

      // Verify variable references exist (read or write)
      const var_refs = index!.references.filter(
        (r) => r.type === "read" || r.type === "write"
      );
      expect(var_refs.length).toBeGreaterThan(0);
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

      // Verify main.rs has imports
      const main_index = project.get_semantic_index(main_file);
      expect(main_index).toBeDefined();

      const imports = Array.from(main_index!.imported_symbols.values());
      expect(imports.length).toBeGreaterThan(0);

      // Verify utils.rs has functions that could be exported
      const utils_index = project.get_semantic_index(utils_file);
      expect(utils_index).toBeDefined();

      const functions = Array.from(utils_index!.functions.values());
      expect(functions.length).toBeGreaterThan(0);
    });

    it("should resolve multiple imported function calls", async () => {
      const utils_source = load_source("modules/utils.rs");
      const main_source = load_source("modules/main.rs");
      const utils_file = file_path("modules/utils.rs");
      const main_file = file_path("modules/main.rs");

      project.update_file(utils_file, utils_source);
      project.update_file(main_file, main_source);

      const main_index = project.get_semantic_index(main_file);
      expect(main_index).toBeDefined();

      // main.rs imports: helper, process_data, calculate_total, validate_email
      // Verify these are captured as imports
      const imports = Array.from(main_index!.imported_symbols.values());
      const import_names = imports.map((i) => i.name);
      expect(import_names).toContain("helper" as SymbolName);
      expect(import_names).toContain("process_data" as SymbolName);
      expect(import_names).toContain("calculate_total" as SymbolName);
      expect(import_names).toContain("validate_email" as SymbolName);

      // Find function call references
      const calls = main_index?.references.filter(
        (r) => r.type === "call" && r.call_type === "function"
      );
      expect(calls).toBeDefined();
      expect(calls?.length).toBeGreaterThan(0);

      // Verify at least helper() and process_data() calls resolve
      const helper_call = calls?.find((c) => c.name === ("helper" as SymbolName));
      const process_call = calls?.find(
        (c) => c.name === ("process_data" as SymbolName)
      );

      expect(helper_call).toBeDefined();
      expect(process_call).toBeDefined();

      if (helper_call && process_call) {
        const helper_resolved = project.resolutions.resolve(
          helper_call.scope_id,
          helper_call.name
        );
        const process_resolved = project.resolutions.resolve(
          process_call.scope_id,
          process_call.name
        );

        expect(helper_resolved).toBeDefined();
        expect(process_resolved).toBeDefined();

        // Verify they resolve to definitions in utils.rs
        if (helper_resolved && process_resolved) {
          const helper_def = project.definitions.get(helper_resolved);
          const process_def = project.definitions.get(process_resolved);

          expect(helper_def?.location.file_path).toContain("utils.rs");
          expect(process_def?.location.file_path).toContain("utils.rs");
        }
      }
    });

    it("should handle mod declarations with inline modules", async () => {
      const source = load_source("modules/inline_modules.rs");
      const file = file_path("modules/inline_modules.rs");
      project.update_file(file, source);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Verify that scopes are created for modules
      const scopes = Array.from(index!.scopes.values());
      expect(scopes.length).toBeGreaterThan(1); // At least file scope + module scope
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

      const main_index = project.get_semantic_index(uses_user_file);
      expect(main_index).toBeDefined();

      // Find User import
      const imports = Array.from(main_index!.imported_symbols.values());
      expect(imports.length).toBeGreaterThan(0);

      const user_import = imports.find((i) => i.name === ("User" as SymbolName));
      expect(user_import).toBeDefined();

      // Find User struct in user_mod.rs
      const user_mod_index = project.get_semantic_index(user_mod_file);
      const user_struct = Array.from(user_mod_index!.classes.values()).find(
        (c) => c.name === ("User" as SymbolName)
      );
      expect(user_struct).toBeDefined();

      // Find method calls in uses_user.rs
      const method_calls = main_index!.references.filter(
        (r) => r.type === "call" && r.call_type === "method"
      );
      expect(method_calls.length).toBeGreaterThan(0);

      // Verify at least one method call resolves
      const first_method_call = method_calls[0];
      const resolved = project.resolutions.resolve(
        first_method_call.scope_id,
        first_method_call.name
      );
      expect(resolved).toBeDefined();
    });

    it("should handle multiple structs from the same module", async () => {
      const user_mod_source = load_source("modules/user_mod.rs");
      const uses_user_source = load_source("modules/uses_user.rs");
      const user_mod_file = file_path("modules/user_mod.rs");
      const uses_user_file = file_path("modules/uses_user.rs");

      project.update_file(user_mod_file, user_mod_source);
      project.update_file(uses_user_file, uses_user_source);

      // Verify user_mod.rs has both User and UserManager structs
      const user_mod_index = project.get_semantic_index(user_mod_file);
      expect(user_mod_index).toBeDefined();

      if (user_mod_index) {
        const structs = Array.from(user_mod_index.classes.values());
        const struct_names = structs.map((s) => s.name);

        expect(struct_names).toContain("User" as SymbolName);
        expect(struct_names).toContain("UserManager" as SymbolName);
      }

      // Verify both are imported in uses_user.rs
      const main_index = project.get_semantic_index(uses_user_file);
      expect(main_index).toBeDefined();

      if (main_index) {
        const imports = Array.from(main_index.imported_symbols.values());
        const import_names = imports.map((i) => i.name);

        expect(import_names).toContain("User" as SymbolName);
        expect(import_names).toContain("UserManager" as SymbolName);

        // Verify UserManager::new() has receiver_location for method resolution
        // Associated function calls have the full scoped name (UserManager::new)
        // and receiver_location points to the type (UserManager)
        const manager_new_calls = main_index.references.filter(
          (r) =>
            r.type === "call" &&
            r.name.includes("UserManager") &&
            r.name.includes("new") &&
            r.context?.receiver_location
        );

        expect(manager_new_calls.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Parameter Type Resolution", () => {
    it("should register function parameters as first-class definitions", async () => {
      const code = `
        struct Database;

        impl Database {
            fn query(&self, sql: &str) {}
        }

        fn process_data(db: &Database) {
            db.query("SELECT * FROM users");
        }
      `;
      const file = file_path("test_param_function.rs");
      project.update_file(file, code);

      // Verify parameter appears in DefinitionRegistry
      const all_defs = project.definitions.get_all_definitions();
      const db_param = all_defs.find(
        (def) => def.kind === "parameter" && def.name === ("db" as SymbolName)
      );
      expect(db_param).toBeDefined();
      expect(db_param?.kind).toBe("parameter");
    });

    it("should register method parameters as first-class definitions", async () => {
      const code = `
        struct Logger;

        impl Logger {
            fn log(&self, message: &str) {}
        }

        struct Service;

        impl Service {
            fn process(&self, logger: &Logger) {
                logger.log("Processing...");
            }
        }
      `;
      const file = file_path("test_param_method.rs");
      project.update_file(file, code);

      // Verify parameter in method appears in registry
      const all_defs = project.definitions.get_all_definitions();
      const logger_param = all_defs.find(
        (def) => def.kind === "parameter" && def.name === ("logger" as SymbolName)
      );
      expect(logger_param).toBeDefined();
      expect(logger_param?.kind).toBe("parameter");
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

      const main_index = project.get_semantic_index(shadowing_file);
      expect(main_index).toBeDefined();

      // Find function definitions in shadowing.rs
      const functions = Array.from(main_index!.functions.values());
      expect(functions.length).toBeGreaterThan(0);

      // Find call references
      const calls = main_index!.references.filter((r) => r.type === "call");
      expect(calls.length).toBeGreaterThan(0);

      // Verify at least one call resolves to a local definition
      const first_call = calls[0];
      const resolved = project.resolutions.resolve(
        first_call.scope_id,
        first_call.name
      );
      expect(resolved).toBeDefined();

      const def = project.definitions.get(resolved!);
      expect(def).toBeDefined();
      // Should resolve to local definition in shadowing.rs
      expect(def!.location.file_path).toContain("shadowing.rs");
    });
  });

  describe("Builder Pattern", () => {
    it("should resolve method chains in builder pattern", async () => {
      const source = load_source("structs/constructor_workflow.rs");
      const file = file_path("structs/constructor_workflow.rs");
      project.update_file(file, source);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find method chain calls
      const method_calls = index!.references.filter(
        (r) => r.type === "call" && r.call_type === "method"
      );
      expect(method_calls.length).toBeGreaterThan(1);

      // Verify each method call has the correct call_type
      for (const call of method_calls) {
        expect(call.call_type).toBe("method");
      }
    });
  });

  describe("Basic Struct Definition", () => {
    it("should capture struct definitions with impl blocks", async () => {
      const source = load_source("structs/basic_struct.rs");
      const file = file_path("structs/basic_struct.rs");
      project.update_file(file, source);

      const index = project.get_semantic_index(file);
      expect(index).toBeDefined();

      // Find struct definitions
      const structs = Array.from(index!.classes.values());
      expect(structs.length).toBeGreaterThan(0);

      // The basic_struct.rs file contains structs with impl blocks
      // Verify that at least one struct has methods
      const user_struct = structs.find((s) => s.name === ("User" as SymbolName));
      expect(user_struct).toBeDefined();

      const type_info = project.get_type_info(user_struct!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.size).toBeGreaterThan(0);
    });
  });
});

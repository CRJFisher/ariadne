import { describe, it, expect, beforeEach } from "vitest";
import { Project } from "./project";
import type { FilePath, SymbolName } from "@ariadnejs/types";

describe("Project - Language-Agnostic Resolution Patterns", () => {
  let project: Project;

  beforeEach(async () => {
    project = new Project();
    await project.initialize();
  });

  describe("Shadowing - Cross-Language Consistency", () => {
    it("should resolve shadowed imports correctly in TypeScript", () => {
      project.update_file("utils.ts" as FilePath, "export function helper() { return 'utils'; }");
      project.update_file("main.ts" as FilePath, `
import { helper } from "./utils";
function helper() { return "local"; }
const result = helper();
      `);

      const main_index = project.get_semantic_index("main.ts" as FilePath);
      const helper_call = main_index?.references.find(
        (r) => r.type === "call" && r.name === ("helper" as SymbolName)
      );

      expect(helper_call).toBeDefined();
      if (helper_call) {
        const resolved = project.resolutions.resolve(helper_call.scope_id, helper_call.name);
        const resolved_def = project.definitions.get(resolved!);
        // Should resolve to LOCAL helper in main.ts, not imported one
        expect(resolved_def?.location.file_path).toContain("main.ts");
        expect(resolved_def?.kind).toBe("function");
      }
    });

    it("should resolve shadowed imports correctly in JavaScript", () => {
      project.update_file("utils.js" as FilePath, "export function helper() { return 'utils'; }");
      project.update_file("main.js" as FilePath, `
import { helper } from "./utils";
function helper() { return "local"; }
const result = helper();
      `);

      const main_index = project.get_semantic_index("main.js" as FilePath);
      const helper_call = main_index?.references.find(
        (r) => r.type === "call" && r.name === ("helper" as SymbolName)
      );

      if (helper_call) {
        const resolved = project.resolutions.resolve(helper_call.scope_id, helper_call.name);
        const resolved_def = project.definitions.get(resolved!);
        expect(resolved_def?.location.file_path).toContain("main.js");
      }
    });

    it("should resolve shadowed imports correctly in Python", () => {
      project.update_file("utils.py" as FilePath, "def helper():\n    return 'utils'");
      project.update_file("main.py" as FilePath, `
from utils import helper

def helper():
    return "local"

result = helper()
      `);

      const main_index = project.get_semantic_index("main.py" as FilePath);
      const helper_call = main_index?.references.find(
        (r) => r.type === "call" && r.name === ("helper" as SymbolName)
      );

      if (helper_call) {
        const resolved = project.resolutions.resolve(helper_call.scope_id, helper_call.name);
        const resolved_def = project.definitions.get(resolved!);
        expect(resolved_def?.location.file_path).toContain("main.py");
      }
    });
  });

  describe("Nested Scopes", () => {
    it("should create nested scopes for TypeScript functions", () => {
      project.update_file("test.ts" as FilePath, `
function outer() {
  function inner() {
    return 42;
  }
}
      `);

      const index = project.get_semantic_index("test.ts" as FilePath);
      const scopes = Array.from(index!.scopes.values());

      // Should have module scope, outer scope, inner scope
      expect(scopes.length).toBeGreaterThanOrEqual(3);

      // Verify scope hierarchy exists
      const nested_scopes = scopes.filter((s) => s.parent_id !== null);
      expect(nested_scopes.length).toBeGreaterThan(0);
    });

    it("should create nested scopes for Python functions", () => {
      project.update_file("test.py" as FilePath, `
def outer():
    def inner():
        return 42
      `);

      const index = project.get_semantic_index("test.py" as FilePath);
      const scopes = Array.from(index!.scopes.values());

      expect(scopes.length).toBeGreaterThanOrEqual(3);

      const nested_scopes = scopes.filter((s) => s.parent_id !== null);
      expect(nested_scopes.length).toBeGreaterThan(0);
    });

    it("should create nested scopes for Rust functions", () => {
      project.update_file("test.rs" as FilePath, `
fn outer() {
    fn inner() -> i32 {
        42
    }
}
      `);

      const index = project.get_semantic_index("test.rs" as FilePath);
      const scopes = Array.from(index!.scopes.values());

      expect(scopes.length).toBeGreaterThanOrEqual(3);

      const nested_scopes = scopes.filter((s) => s.parent_id !== null);
      expect(nested_scopes.length).toBeGreaterThan(0);
    });
  });

  describe("Constructor → Type → Method Chains", () => {
    it("should resolve constructor and method calls in TypeScript", () => {
      project.update_file("test.ts" as FilePath, `
class User {
  constructor(public name: string) {}
  getName() { return this.name; }
}

const user = new User("Alice");
const name = user.getName();
      `);

      const index = project.get_semantic_index("test.ts" as FilePath);

      // Find constructor call (type is "construct" not "call")
      const constructor_calls = index?.references.filter(
        (r) => r.type === "construct"
      );
      expect(constructor_calls?.length).toBeGreaterThan(0);

      // Find method call
      const method_calls = index?.references.filter(
        (r) => r.type === "call" && r.name === ("getName" as SymbolName)
      );
      expect(method_calls?.length).toBeGreaterThan(0);

      // Verify method resolves
      const method_call = method_calls?.[0];
      if (method_call) {
        const resolved = project.resolutions.resolve(method_call.scope_id, method_call.name);
        expect(resolved).toBeDefined();
      }
    });

    it("should resolve constructor and method calls in Python", () => {
      project.update_file("test.py" as FilePath, `
class User:
    def __init__(self, name):
        self.name = name
    def get_name(self):
        return self.name

user = User("Alice")
name = user.get_name()
      `);

      const index = project.get_semantic_index("test.py" as FilePath);

      // Find constructor call (type is "construct" not "call")
      const constructor_calls = index?.references.filter(
        (r) => r.type === "construct"
      );
      expect(constructor_calls?.length).toBeGreaterThan(0);

      // Find method call
      const method_calls = index?.references.filter(
        (r) => r.type === "call" && r.name === ("get_name" as SymbolName)
      );
      expect(method_calls?.length).toBeGreaterThan(0);

      if (method_calls && method_calls.length > 0) {
        const method_call = method_calls[0];
        const resolved = project.resolutions.resolve(method_call.scope_id, method_call.name);
        expect(resolved).toBeDefined();
      }
    });

    it("should resolve associated functions and methods in Rust", () => {
      project.update_file("test.rs" as FilePath, `
struct User {
    name: String,
}

impl User {
    fn new(name: String) -> Self {
        User { name }
    }
    fn get_name(&self) -> &str {
        &self.name
    }
}

fn main() {
    let user = User::new(String::from("Alice"));
    let name = user.get_name();
}
      `);

      const index = project.get_semantic_index("test.rs" as FilePath);

      // Find User::new() call (associated function)
      const new_calls = index?.references.filter(
        (r) => r.type === "call" && r.name === ("new" as SymbolName) && r.context?.receiver_location
      );
      expect(new_calls?.length).toBeGreaterThan(0);

      // Find get_name() method call
      const method_calls = index?.references.filter(
        (r) => r.type === "call" && r.name === ("get_name" as SymbolName)
      );
      expect(method_calls?.length).toBeGreaterThan(0);

      if (method_calls && method_calls.length > 0) {
        const method_call = method_calls[0];
        const resolved = project.resolutions.resolve(method_call.scope_id, method_call.name);
        expect(resolved).toBeDefined();
      }
    });
  });

  describe("Cross-Module Resolution", () => {
    it("should resolve imported function calls across files in TypeScript", () => {
      project.update_file("utils.ts" as FilePath, "export function helper() { return 42; }");
      project.update_file("main.ts" as FilePath, `
import { helper } from "./utils";
const result = helper();
      `);

      const main_index = project.get_semantic_index("main.ts" as FilePath);

      // Find import - verifies import capture works
      const imports = Array.from(main_index!.imported_symbols.values());
      const helper_import = imports.find((i) => i.name === ("helper" as SymbolName));
      expect(helper_import).toBeDefined();
      expect(helper_import?.import_path).toBe("./utils");

      // Find call - verifies call capture works
      const helper_call = main_index?.references.find(
        (r) => r.type === "call" && r.name === ("helper" as SymbolName)
      );
      expect(helper_call).toBeDefined();

      // FULL TEST: Verify cross-module resolution works
      if (helper_call) {
        const resolved = project.resolutions.resolve(helper_call.scope_id, helper_call.name);
        expect(resolved).toBeDefined();
        const resolved_def = project.definitions.get(resolved!);
        expect(resolved_def?.location.file_path).toContain("utils.ts");
        expect(resolved_def?.name).toBe("helper" as SymbolName);
        expect(resolved_def?.kind).toBe("function");
      }
    });

    it("should resolve imported classes and method calls across files in TypeScript", () => {
      project.update_file("types.ts" as FilePath, `
export class User {
  getName() { return "Alice"; }
}
      `);
      project.update_file("main.ts" as FilePath, `
import { User } from "./types";
const user = new User();
const name = user.getName();
      `);

      const main_index = project.get_semantic_index("main.ts" as FilePath);

      // Find class import
      const imports = Array.from(main_index!.imported_symbols.values());
      const user_import = imports.find((i) => i.name === ("User" as SymbolName));
      expect(user_import).toBeDefined();

      // Find constructor call
      const constructor_call = main_index?.references.find(
        (r) => r.type === "construct" && r.name === ("User" as SymbolName)
      );
      expect(constructor_call).toBeDefined();

      // FULL TEST: Verify constructor resolves to imported class
      if (constructor_call) {
        const resolved = project.resolutions.resolve(constructor_call.scope_id, constructor_call.name);
        expect(resolved).toBeDefined();
        const resolved_def = project.definitions.get(resolved!);
        expect(resolved_def?.location.file_path).toContain("types.ts");
        expect(resolved_def?.name).toBe("User" as SymbolName);
        expect(resolved_def?.kind).toBe("class");
      }

      // Find method call
      const method_call = main_index?.references.find(
        (r) => r.type === "call" && r.name === ("getName" as SymbolName)
      );
      expect(method_call).toBeDefined();
    });

    it("should resolve method calls on imported classes across files in TypeScript", async () => {
      project.update_file("types.ts" as FilePath, `
export class User {
  getName() { return "Alice"; }
}
      `);
      project.update_file("main.ts" as FilePath, `
import { User } from "./types";
const user = new User();
const name = user.getName();
      `);

      // TEMP: Add diagnostics
      const main_index = project.get_semantic_index("main.ts" as FilePath);
      const method_ref = main_index?.references.find(r => r.name === "getName" && r.call_type === "method");
      if (method_ref) {
        console.log("\n===== TYPESCRIPT DIAGNOSTICS =====");
        console.log("Method call scope_id:", method_ref.scope_id);
        const scope_res = project.resolutions["resolutions_by_scope"].get(method_ref.scope_id);
        console.log("Resolutions in scope:", scope_res ? scope_res.size : 0);
        if (scope_res) {
          console.log("Names:", Array.from(scope_res.keys()).slice(0, 20));
          console.log("'user' in map?:", scope_res.has("user" as any));
        }
      }

      // Get all resolved calls from main.ts (true integration test)
      const resolved_calls = project.resolutions.get_file_calls("main.ts" as FilePath);

      // Find the getName method call
      const get_name_call = resolved_calls.find(
        (c) => c.name === ("getName" as SymbolName) && c.call_type === "method"
      );
      expect(get_name_call).toBeDefined();
      expect(get_name_call?.symbol_id).toBeDefined();

      // Verify it resolves to method in types.ts
      const resolved_def = project.definitions.get(get_name_call!.symbol_id);
      expect(resolved_def?.location.file_path).toContain("types.ts");
      expect(resolved_def?.name).toBe("getName" as SymbolName);
      expect(resolved_def?.kind).toBe("method");
    });

    it("should resolve imported functions in Python", () => {
      project.update_file("utils.py" as FilePath, "def helper():\n    return 42");
      project.update_file("main.py" as FilePath, `
from utils import helper

result = helper()
      `);

      const main_index = project.get_semantic_index("main.py" as FilePath);
      const helper_call = main_index?.references.find(
        (r) => r.type === "call" && r.name === ("helper" as SymbolName)
      );

      if (helper_call) {
        const resolved = project.resolutions.resolve(helper_call.scope_id, helper_call.name);
        const resolved_def = project.definitions.get(resolved!);
        expect(resolved_def?.location.file_path).toContain("utils.py");
      }
    });

    it("should resolve imported modules in Rust", () => {
      project.update_file("user_mod.rs" as FilePath, `
pub struct User {
    pub name: String,
}

impl User {
    pub fn new(name: String) -> Self {
        User { name }
    }
}
      `);
      project.update_file("main.rs" as FilePath, `
mod user_mod;
use user_mod::User;

fn main() {
    let user = User::new(String::from("Alice"));
}
      `);

      const main_index = project.get_semantic_index("main.rs" as FilePath);

      // Find import
      const imports = Array.from(main_index!.imported_symbols.values());
      expect(imports.find((i) => i.name === ("User" as SymbolName))).toBeDefined();

      // Find User::new() call
      const new_call = main_index?.references.find(
        (r) => r.type === "call" && r.name === ("new" as SymbolName) && r.context?.receiver_location
      );
      expect(new_call).toBeDefined();
    });
  });

  describe("Namespace Import Resolution", () => {
    it("should resolve function call via namespace import in TypeScript", () => {
      project.update_file("utils.ts" as FilePath, "export function helper() { return 'utils'; }");
      project.update_file("main.ts" as FilePath, `
import * as utils from "./utils";
const result = utils.helper();
      `);

      const main_index = project.get_semantic_index("main.ts" as FilePath);

      // Find namespace import
      const imports = Array.from(main_index!.imported_symbols.values());
      const utils_import = imports.find((i) => i.name === ("utils" as SymbolName));
      expect(utils_import).toBeDefined();
      expect(utils_import?.import_kind).toBe("namespace");

      // Find method call (namespace member access becomes method call with receiver)
      const helper_call = main_index?.references.find(
        (r) => r.type === "call" && r.name === ("helper" as SymbolName)
      );
      expect(helper_call).toBeDefined();

      // Verify call resolves to helper function in utils.ts
      // Note: Namespace member access is a METHOD call, not simple name resolution
      // Use get_file_calls() to find resolved method calls
      if (helper_call) {
        const resolved_calls = project.resolutions.get_file_calls("main.ts" as FilePath);
        const resolved_helper_call = resolved_calls.find(
          (c) => c.name === ("helper" as SymbolName) && c.call_type === "method"
        );

        expect(resolved_helper_call).toBeDefined();
        expect(resolved_helper_call?.symbol_id).toBeDefined();

        if (resolved_helper_call?.symbol_id) {
          const resolved_def = project.definitions.get(resolved_helper_call.symbol_id);
          expect(resolved_def?.location.file_path).toContain("utils.ts");
          expect(resolved_def?.name).toBe("helper" as SymbolName);
        }
      }
    });

    it("should resolve multiple members on same namespace in TypeScript", () => {
      project.update_file("utils.ts" as FilePath, `
export function a() { return 1; }
export function b() { return 2; }
      `);
      project.update_file("main.ts" as FilePath, `
import * as utils from "./utils";
const x = utils.a();
const y = utils.b();
      `);

      const main_index = project.get_semantic_index("main.ts" as FilePath);

      // Find both calls
      const a_call = main_index?.references.find(
        (r) => r.type === "call" && r.name === ("a" as SymbolName)
      );
      const b_call = main_index?.references.find(
        (r) => r.type === "call" && r.name === ("b" as SymbolName)
      );

      expect(a_call).toBeDefined();
      expect(b_call).toBeDefined();

      // Both should resolve to their definitions in utils.ts
      // Use get_file_calls() for method call resolution
      const resolved_calls = project.resolutions.get_file_calls("main.ts" as FilePath);

      if (a_call) {
        const resolved_a_call = resolved_calls.find(
          (c) => c.name === ("a" as SymbolName) && c.call_type === "method"
        );
        expect(resolved_a_call).toBeDefined();
        if (resolved_a_call?.symbol_id) {
          const resolved_a_def = project.definitions.get(resolved_a_call.symbol_id);
          expect(resolved_a_def?.name).toBe("a" as SymbolName);
          expect(resolved_a_def?.location.file_path).toContain("utils.ts");
        }
      }

      if (b_call) {
        const resolved_b_call = resolved_calls.find(
          (c) => c.name === ("b" as SymbolName) && c.call_type === "method"
        );
        expect(resolved_b_call).toBeDefined();
        if (resolved_b_call?.symbol_id) {
          const resolved_b_def = project.definitions.get(resolved_b_call.symbol_id);
          expect(resolved_b_def?.name).toBe("b" as SymbolName);
          expect(resolved_b_def?.location.file_path).toContain("utils.ts");
        }
      }
    });

    it("should return undefined for missing namespace member", () => {
      project.update_file("utils.ts" as FilePath, "export function helper() { return 1; }");
      project.update_file("main.ts" as FilePath, `
import * as utils from "./utils";
const x = utils.missing();
      `);

      const main_index = project.get_semantic_index("main.ts" as FilePath);

      // Find call to missing function
      const missing_call = main_index?.references.find(
        (r) => r.type === "call" && r.name === ("missing" as SymbolName)
      );
      expect(missing_call).toBeDefined();

      // Should not resolve (missing member)
      // Check that the call is NOT in the resolved calls list
      if (missing_call) {
        const resolved_calls = project.resolutions.get_file_calls("main.ts" as FilePath);
        const resolved_missing_call = resolved_calls.find(
          (c) => c.name === ("missing" as SymbolName) && c.call_type === "method"
        );
        // Should not be in resolved calls because the member doesn't exist
        expect(resolved_missing_call).toBeUndefined();
      }
    });
  });

  describe("Output Structure Validation", () => {
    it("should produce well-formed Definition objects", () => {
      project.update_file("test.ts" as FilePath, `
function foo(x: number) { return x + 1; }
class Bar {
  method() { return 42; }
}
const baz = 100;
      `);

      const all_defs = project.definitions.get_all_definitions();

      for (const def of all_defs.values()) {
        // Required fields
        expect(def.symbol_id).toBeDefined();
        expect(def.name).toBeDefined();
        expect(def.kind).toBeDefined();
        expect(def.defining_scope_id).toBeDefined();
        expect(def.location).toBeDefined();
        expect(def.location.file_path).toBeDefined();
        expect(def.location.start_line).toBeGreaterThanOrEqual(1);
        expect(def.location.end_line).toBeGreaterThanOrEqual(def.location.start_line);
      }
    });

    it("should produce well-formed Scope objects", () => {
      project.update_file("test.ts" as FilePath, `
function outer() {
  function inner() {
    return 42;
  }
}
      `);

      const all_scopes = project.scopes.get_all_scopes();

      for (const scope of all_scopes.values()) {
        // LexicalScope fields: id, parent_id, type, location
        expect(scope.id).toBeDefined();
        expect(scope.type).toBeDefined();
        expect(scope.location).toBeDefined();

        // Parent scope should exist (except for root)
        if (scope.parent_id) {
          const parent = all_scopes.get(scope.parent_id);
          expect(parent).toBeDefined();
        }
      }
    });

    it("should produce well-formed Reference objects", () => {
      project.update_file("test.ts" as FilePath, `
function foo() { return bar(); }
function bar() { return 42; }
      `);

      const index = project.get_semantic_index("test.ts" as FilePath);

      for (const ref of index!.references) {
        // SymbolReference fields: location, type, scope_id, name
        expect(ref.name).toBeDefined();
        expect(ref.type).toBeDefined();
        expect(ref.scope_id).toBeDefined();
        expect(ref.location).toBeDefined();

        // call_type is only present for call/construct references
        if (ref.type === "call" || ref.type === "construct") {
          expect(ref.call_type).toBeDefined();
        }
      }
    });

    it("should maintain registry consistency", () => {
      project.update_file("test.ts" as FilePath, `
class User {
  getName() { return "Alice"; }
}
function foo() { return bar(); }
function bar() { return 42; }
      `);

      const all_defs = project.definitions.get_all_definitions();
      const all_scopes = project.scopes.get_all_scopes();

      // Every definition should reference a valid scope
      for (const def of all_defs.values()) {
        const scope = all_scopes.get(def.defining_scope_id);
        expect(scope).toBeDefined();
      }

      // Type members should reference valid definitions
      const index = project.get_semantic_index("test.ts" as FilePath);
      const user_class = Array.from(index!.classes.values())[0];
      if (user_class) {
        const type_members = project.types.get_type_members(user_class.symbol_id);
        if (type_members) {
          for (const method_id of type_members.methods.values()) {
            const method_def = project.definitions.get(method_id);
            expect(method_def).toBeDefined();
          }
        }
      }
    });
  });
});

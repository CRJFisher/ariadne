import { describe, it, expect, beforeEach } from "vitest";
import { Project } from "./project";
import type { FilePath, SymbolName } from "@ariadnejs/types";
import type {
  ConstructorCallReference,
  MethodCallReference,
  SelfReferenceCall,
  FunctionCallReference,
} from "@ariadnejs/types";

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

      const main_index = project.get_index_single_file("main.ts" as FilePath);
      const helper_call = main_index?.references.find(
        (r) => r.kind === "function_call" && r.name === ("helper" as SymbolName)
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

      const main_index = project.get_index_single_file("main.js" as FilePath);
      const helper_call = main_index?.references.find(
        (r) => r.kind === "function_call" && r.name === ("helper" as SymbolName)
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

      const main_index = project.get_index_single_file("main.py" as FilePath);
      const helper_call = main_index?.references.find(
        (r) => r.kind === "function_call" && r.name === ("helper" as SymbolName)
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

      const index = project.get_index_single_file("test.ts" as FilePath);
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

      const index = project.get_index_single_file("test.py" as FilePath);
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

      const index = project.get_index_single_file("test.rs" as FilePath);
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

      const index = project.get_index_single_file("test.ts" as FilePath);

      // Find constructor call
      const constructor_calls = index?.references.filter(
        (r): r is ConstructorCallReference => r.kind === "constructor_call"
      );
      expect(constructor_calls?.length).toBeGreaterThan(0);

      // Find method call
      const method_calls = index?.references.filter(
        (r) => r.kind === "method_call" && r.name === ("getName" as SymbolName)
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

      const index = project.get_index_single_file("test.py" as FilePath);

      // Find constructor call
      const constructor_calls = index?.references.filter(
        (r): r is ConstructorCallReference => r.kind === "constructor_call"
      );
      expect(constructor_calls?.length).toBeGreaterThan(0);

      // Find method call
      const method_calls = index?.references.filter(
        (r) => r.kind === "method_call" && r.name === ("get_name" as SymbolName)
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

      const index = project.get_index_single_file("test.rs" as FilePath);

      // Find User::new() call (associated function / static method)
      // Note: Rust associated function calls are captured as function_call, not method_call
      // They have the full scoped name (User::new)
      const new_calls = index?.references.filter(
        (r): r is FunctionCallReference => r.kind === "function_call" && r.name === "User::new"
      );
      expect(new_calls?.length).toBeGreaterThan(0);

      // Find get_name() method call
      const method_calls = index?.references.filter(
        (r) => r.kind === "method_call" && r.name === ("get_name" as SymbolName)
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

      const main_index = project.get_index_single_file("main.ts" as FilePath);

      // Find import - verifies import capture works
      const imports = Array.from(main_index!.imported_symbols.values());
      const helper_import = imports.find((i) => i.name === ("helper" as SymbolName));
      expect(helper_import).toBeDefined();
      expect(helper_import?.import_path).toBe("./utils");

      // Find call - verifies call capture works
      const helper_call = main_index?.references.find(
        (r) => r.kind === "function_call" && r.name === ("helper" as SymbolName)
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

      const main_index = project.get_index_single_file("main.ts" as FilePath);

      // Find class import
      const imports = Array.from(main_index!.imported_symbols.values());
      const user_import = imports.find((i) => i.name === ("User" as SymbolName));
      expect(user_import).toBeDefined();

      // Find constructor call
      const constructor_call = main_index?.references.find(
        (r): r is ConstructorCallReference => r.kind === "constructor_call" && r.name === ("User" as SymbolName)
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
        (r) => r.kind === "method_call" && r.name === ("getName" as SymbolName)
      );
      expect(method_call).toBeDefined();
    });

    it("should resolve imported functions in Python", () => {
      project.update_file("utils.py" as FilePath, "def helper():\n    return 42");
      project.update_file("main.py" as FilePath, `
from utils import helper

result = helper()
      `);

      const main_index = project.get_index_single_file("main.py" as FilePath);
      const helper_call = main_index?.references.find(
        (r) => r.kind === "function_call" && r.name === ("helper" as SymbolName)
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

      const main_index = project.get_index_single_file("main.rs" as FilePath);

      // Find import
      const imports = Array.from(main_index!.imported_symbols.values());
      expect(imports.find((i) => i.name === ("User" as SymbolName))).toBeDefined();

      // Find User::new() call (associated function / static method)
      // Note: Rust associated function calls are captured as function_call, not method_call
      const new_call = main_index?.references.find(
        (r): r is FunctionCallReference => r.kind === "function_call" && r.name === "User::new"
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

      const main_index = project.get_index_single_file("main.ts" as FilePath);

      // Find namespace import
      const imports = Array.from(main_index!.imported_symbols.values());
      const utils_import = imports.find((i) => i.name === ("utils" as SymbolName));
      expect(utils_import).toBeDefined();
      expect(utils_import?.import_kind).toBe("namespace");

      // Find method call (namespace member access becomes method call with receiver)
      const helper_call = main_index?.references.find(
        (r) => r.kind === "method_call" && r.name === ("helper" as SymbolName)
      );
      expect(helper_call).toBeDefined();

      // Verify call resolves to helper function in utils.ts
      // Note: Namespace member access is a METHOD call, not simple name resolution
      if (helper_call) {
        // Resolve the call using the public API
        const resolved_symbol_id = project.resolutions.resolve(
          helper_call.scope_id,
          helper_call.name
        );

        expect(resolved_symbol_id).toBeDefined();

        if (resolved_symbol_id) {
          const resolved_def = project.definitions.get(resolved_symbol_id);
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

      const main_index = project.get_index_single_file("main.ts" as FilePath);

      // Find both calls
      const a_call = main_index?.references.find(
        (r) => r.kind === "method_call" && r.name === ("a" as SymbolName)
      );
      const b_call = main_index?.references.find(
        (r) => r.kind === "method_call" && r.name === ("b" as SymbolName)
      );

      expect(a_call).toBeDefined();
      expect(b_call).toBeDefined();

      // Both should resolve to their definitions in utils.ts
      if (a_call) {
        const resolved_a_symbol = project.resolutions.resolve(
          a_call.scope_id,
          a_call.name
        );
        expect(resolved_a_symbol).toBeDefined();
        if (resolved_a_symbol) {
          const resolved_a_def = project.definitions.get(resolved_a_symbol);
          expect(resolved_a_def?.name).toBe("a" as SymbolName);
          expect(resolved_a_def?.location.file_path).toContain("utils.ts");
        }
      }

      if (b_call) {
        const resolved_b_symbol = project.resolutions.resolve(
          b_call.scope_id,
          b_call.name
        );
        expect(resolved_b_symbol).toBeDefined();
        if (resolved_b_symbol) {
          const resolved_b_def = project.definitions.get(resolved_b_symbol);
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

      const main_index = project.get_index_single_file("main.ts" as FilePath);

      // Find call to missing function
      const missing_call = main_index?.references.find(
        (r) => r.kind === "method_call" && r.name === ("missing" as SymbolName)
      );
      expect(missing_call).toBeDefined();

      // Should not resolve (missing member)
      if (missing_call) {
        // The reference should exist but not be resolved
        const resolved = project.resolutions.resolve(missing_call.scope_id, missing_call.name);
        expect(resolved).toBeNull();
      }
    });
  });

  describe("Output Structure Validation", () => {
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

      const index = project.get_index_single_file("test.ts" as FilePath);

      for (const ref of index!.references) {
        // SymbolReference fields: location, kind, scope_id, name
        expect(ref.name).toBeDefined();
        expect(ref.kind).toBeDefined();
        expect(ref.scope_id).toBeDefined();
        expect(ref.location).toBeDefined();
      }
    });

  });
});

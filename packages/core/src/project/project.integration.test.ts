import { describe, it, expect, beforeEach } from "vitest";
import { Project } from "./project";
import type { FilePath } from "@ariadnejs/types";

// Old API tests - these use removed APIs like resolve_file(), get_file_definitions()
// TODO: Remove this entire section or update to use current Project API
describe.skip("Project - Incremental Updates (Integration)", () => {
  let project: Project;

  beforeEach(async () => {
    project = new Project();
    await project.initialize();
  });

  describe("file update → registry update", () => {
    it("should update registries when file changes", () => {
      const file1 = "file1.ts" as FilePath;

      // Initial version
      project.update_file(file1, "function foo() {}");
      const defs_v1 = project.get_file_definitions(file1);
      expect(defs_v1).toHaveLength(1);
      expect(defs_v1[0].name).toBe("foo");

      // Updated version
      project.update_file(file1, "function bar() {}");
      const defs_v2 = project.get_file_definitions(file1);
      expect(defs_v2).toHaveLength(1);
      expect(defs_v2[0].name).toBe("bar");  // foo should be gone
    });

    it("should update all registries (definitions, types, scopes, exports, imports)", () => {
      const file1 = "file1.ts" as FilePath;

      // Complex file with multiple registry entries
      const complex_code = `
        export class Calculator {
          add(a: number, b: number): number {
            return a + b
          }
        }
        export function helper() { return 42 }
        const internal = 'not exported'
      `;

      project.update_file(file1, complex_code);

      // Verify definition registry updated
      const defs = project.get_file_definitions(file1);
      expect(defs.length).toBeGreaterThan(0);
      const calc_class = defs.find(d => d.name === "Calculator");
      const helper_fn = defs.find(d => d.name === "helper");
      const internal_var = defs.find(d => d.name === "internal");
      expect(calc_class).toBeDefined();
      expect(helper_fn).toBeDefined();
      expect(internal_var).toBeDefined();

      // Verify type registry updated (class has type members)
      const calc_type = project.get_type_info(calc_class!.symbol_id);
      expect(calc_type).toBeDefined();
      expect(calc_type!.methods.size).toBeGreaterThan(0);

      // Verify semantic index updated
      const semantic_index = project.get_semantic_index(file1);
      expect(semantic_index).toBeDefined();
      expect(semantic_index!.classes.size).toBe(1);
      expect(semantic_index!.functions.size).toBe(1);

      // Verify derived data updated
      const derived = project.get_derived_data(file1);
      expect(derived).toBeDefined();
      expect(derived!.exported_symbols.size).toBe(2);  // Calculator and helper
    });

    it("should update import graph when imports change", () => {
      const lib = "lib.ts" as FilePath;
      const main = "main.ts" as FilePath;

      // Initial state: main imports from lib
      project.update_file(lib, "export function foo() {}");
      project.update_file(main, "import { foo } from './lib'\nfoo()");

      expect(project.get_dependents(lib).has(main)).toBe(true);

      // Update main to add another import
      project.update_file(main, "function bar() {}");

      // Import graph should be updated
      expect(project.get_dependents(lib).has(main)).toBe(false);
    });

    it("should update type registry when file changes", () => {
      const file1 = "file1.ts" as FilePath;

      // Initial version with class (class definitions create type members)
      project.update_file(file1, "class Foo { method() {} }");
      const derived_v1 = project.get_derived_data(file1);
      const foo_def_v1 = project.get_file_definitions(file1).find(d => d.name === "Foo");
      const foo_type_v1 = project.get_type_info(foo_def_v1!.symbol_id);
      expect(foo_type_v1).toBeDefined();
      expect(foo_type_v1?.methods.size).toBe(1);

      // Updated version (different class)
      project.update_file(file1, "class Bar { prop: string }");
      const derived_v2 = project.get_derived_data(file1);
      const bar_def = project.get_file_definitions(file1).find(d => d.name === "Bar");
      const bar_type = project.get_type_info(bar_def!.symbol_id);

      // Foo should be gone, Bar should exist
      expect(project.get_file_definitions(file1).find(d => d.name === "Foo")).toBeUndefined();
      expect(bar_type).toBeDefined();
    });
  });

  describe("invalidation on file change", () => {
    it("should invalidate resolutions when file changes", () => {
      const file1 = "file1.ts" as FilePath;
      const code = `
        function foo() { return 42 }
        const x = foo()
      `;

      // Initial index and resolve
      project.update_file(file1, code);
      project.resolve_file(file1);

      const stats_before = project.get_stats();
      expect(stats_before.pending_resolution_count).toBe(0);

      // Update file
      project.update_file(file1, code + "\n// comment");

      const stats_after = project.get_stats();
      expect(stats_after.pending_resolution_count).toBe(1);  // file1 is pending
    });

    it("should invalidate dependent files when imports change", () => {
      const lib = "lib.ts" as FilePath;
      const main = "main.ts" as FilePath;

      // lib.ts exports foo
      project.update_file(lib, "export function foo() { return 42 }");

      // main.ts imports and uses foo
      project.update_file(main, `
        import { foo } from './lib'
        const x = foo()
      `);

      // Resolve both files
      project.resolve_file(lib);
      project.resolve_file(main);

      expect(project.get_stats().pending_resolution_count).toBe(0);

      // Update lib.ts (change implementation)
      project.update_file(lib, "export function foo() { return 100 }");

      // main.ts should be invalidated (it depends on lib.ts)
      const dependents = project.get_dependents(lib);
      expect(dependents.has(main)).toBe(true);

      const stats = project.get_stats();
      expect(stats.pending_resolution_count).toBe(2);  // lib and main
    });
  });

  describe("lazy re-resolution", () => {
    it("should not resolve until queried", () => {
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      // File is pending (never resolved)
      expect(project.get_stats().pending_resolution_count).toBe(1);

      // Trigger resolution
      project.resolve_file(file1);

      // Now resolved
      expect(project.get_stats().pending_resolution_count).toBe(0);
    });

    it("should use cached resolutions when available", () => {
      const file1 = "file1.ts" as FilePath;
      const code = `
        function foo() { return 42 }
        const x = foo()
      `;

      project.update_file(file1, code);
      project.resolve_file(file1);

      const cache_count_before = project.get_stats().cached_resolution_count;

      // Resolve again (should use cache, not re-resolve)
      project.resolve_file(file1);

      const cache_count_after = project.get_stats().cached_resolution_count;
      expect(cache_count_after).toBe(cache_count_before);  // No new resolutions
    });

    it("should re-resolve after invalidation", () => {
      const file1 = "file1.ts" as FilePath;
      const code = `
        function foo() { return 42 }
        const x = foo()
      `;

      project.update_file(file1, code);
      project.resolve_file(file1);

      // Update invalidates
      project.update_file(file1, code + "\n// changed");

      expect(project.get_stats().pending_resolution_count).toBe(1);

      // Re-resolve
      project.resolve_file(file1);

      expect(project.get_stats().pending_resolution_count).toBe(0);
    });
  });

  describe("call graph cache", () => {
    it("should invalidate call graph when file changes", () => {
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, `
        function foo() { return 42 }
        function bar() { return foo() }
      `);

      // Build call graph
      const graph1 = project.get_call_graph();
      expect(graph1).toBeDefined();

      // Update file
      project.update_file(file1, "function baz() {}");

      // Call graph should rebuild (cache invalidated)
      const graph2 = project.get_call_graph();
      expect(graph2).toBeDefined();
      // Graph2 should be different from graph1
      expect(graph1).not.toBe(graph2);
    });

    it("should automatically resolve pending files before building call graph", () => {
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, `
        function foo() { return 42 }
        const x = foo()
      `);

      // File is pending
      expect(project.get_stats().pending_resolution_count).toBe(1);

      // Get call graph triggers resolution
      const graph = project.get_call_graph();

      // Should have resolved pending files
      expect(project.get_stats().pending_resolution_count).toBe(0);
      expect(graph).toBeDefined();
    });

    it("should invalidate call graph when dependent file changes", () => {
      const lib = "lib.ts" as FilePath;
      const main = "main.ts" as FilePath;

      project.update_file(lib, "export function helper() { return 1 }");
      project.update_file(main, `
        import { helper } from './lib'
        function main() { return helper() }
      `);

      // Build call graph
      const graph1 = project.get_call_graph();
      expect(graph1).toBeDefined();

      // Update lib (a dependency)
      project.update_file(lib, "export function helper() { return 2 }");

      // Call graph should be invalidated
      const graph2 = project.get_call_graph();
      expect(graph1).not.toBe(graph2);
    });
  });

  describe("multi-file scenarios", () => {
    it("should handle updates to multiple files", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      project.update_file(file1, "export function foo() {}");
      project.update_file(file2, "export function bar() {}");
      project.update_file(file3, `
        import { foo } from './file1'
        import { bar } from './file2'
        foo()
        bar()
      `);

      // Resolve all
      project.resolve_file(file1);
      project.resolve_file(file2);
      project.resolve_file(file3);

      expect(project.get_stats().pending_resolution_count).toBe(0);

      // Update file1
      project.update_file(file1, "export function foo() { return 100 }");

      // file1 and file3 should be invalidated (file3 depends on file1)
      const stats = project.get_stats();
      expect(stats.pending_resolution_count).toBe(2);

      // file2 should still be resolved
      expect(project.get_dependents(file2).has(file3)).toBe(true);
    });

    it("should handle import graph changes", () => {
      const lib = "lib.ts" as FilePath;
      const main = "main.ts" as FilePath;

      project.update_file(lib, "export function foo() {}");
      project.update_file(main, `
        import { foo } from './lib'
        foo()
      `);

      // main depends on lib
      expect(project.get_dependents(lib).has(main)).toBe(true);

      // Update main to remove import
      project.update_file(main, "function bar() {}");

      // main should no longer depend on lib
      expect(project.get_dependents(lib).has(main)).toBe(false);
    });

    it("should handle deep dependency chains", () => {
      const lib = "lib.ts" as FilePath;
      const middle = "middle.ts" as FilePath;
      const top = "top.ts" as FilePath;

      // lib -> middle -> top
      project.update_file(lib, "export function base() { return 1 }");
      project.update_file(middle, `
        import { base } from './lib'
        export function middle() { return base() }
      `);
      project.update_file(top, `
        import { middle } from './middle'
        export function top() { return middle() }
      `);

      // Resolve all
      project.resolve_file(lib);
      project.resolve_file(middle);
      project.resolve_file(top);

      expect(project.get_stats().pending_resolution_count).toBe(0);

      // Update lib
      project.update_file(lib, "export function base() { return 2 }");

      // Only lib and middle should be invalidated
      // top is NOT invalidated because it doesn't import lib directly
      const stats = project.get_stats();
      expect(stats.pending_resolution_count).toBe(2);

      // Verify dependency graph
      expect(project.get_dependents(lib).has(middle)).toBe(true);
      expect(project.get_dependents(middle).has(top)).toBe(true);
      expect(project.get_dependents(lib).has(top)).toBe(false);
    });

    it("should handle simultaneous updates to multiple files", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      // Initial state
      project.update_file(file1, "export const a = 1");
      project.update_file(file2, "export const b = 2");
      project.update_file(file3, "export const c = 3");

      project.resolve_file(file1);
      project.resolve_file(file2);
      project.resolve_file(file3);

      expect(project.get_stats().pending_resolution_count).toBe(0);

      // Update all files
      project.update_file(file1, "export const a = 10");
      project.update_file(file2, "export const b = 20");
      project.update_file(file3, "export const c = 30");

      // All should be pending
      expect(project.get_stats().pending_resolution_count).toBe(3);

      // Re-resolve all
      project.resolve_file(file1);
      project.resolve_file(file2);
      project.resolve_file(file3);

      expect(project.get_stats().pending_resolution_count).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should handle circular imports", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      // file1 imports from file2
      project.update_file(file1, `
        import { bar } from './file2'
        export function foo() { return bar() }
      `);

      // file2 imports from file1 (circular!)
      project.update_file(file2, `
        import { foo } from './file1'
        export function bar() { return foo() }
      `);

      // Should not hang or crash
      expect(() => {
        project.resolve_file(file1);
        project.resolve_file(file2);
      }).not.toThrow();
    });

    it("should handle file removal", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      project.update_file(file1, "export function foo() {}");
      project.update_file(file2, `
        import { foo } from './file1'
        foo()
      `);

      project.resolve_file(file1);
      project.resolve_file(file2);

      // Remove file1
      project.remove_file(file1);

      // file2 should be invalidated
      expect(project.get_stats().pending_resolution_count).toBe(1);

      // file1 should be gone
      expect(project.get_all_files()).not.toContain(file1);
      expect(project.get_file_definitions(file1)).toEqual([]);
    });

    it("should handle empty files", () => {
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "");

      expect(project.get_file_definitions(file1)).toEqual([]);
      expect(() => project.resolve_file(file1)).not.toThrow();
    });

    it("should handle files with only comments", () => {
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "// just a comment\n/* and another */");

      expect(() => {
        project.resolve_file(file1);
        project.get_call_graph();
      }).not.toThrow();
    });
  });

  describe("cross-file resolution", () => {
    // NOTE: These tests require full resolve_symbols() implementation (task 138.9)
    // Currently resolve_file() only marks files as resolved but doesn't perform actual resolution
    it.skip("should resolve imported symbols across files", () => {
      const lib = "lib.ts" as FilePath;
      const main = "main.ts" as FilePath;

      project.update_file(lib, "export function add(a: number, b: number) { return a + b }");
      project.update_file(main, `
        import { add } from './lib'
        const result = add(1, 2)
      `);

      project.resolve_file(lib);
      project.resolve_file(main);

      // Find reference to 'add' in main
      const main_index = project.get_semantic_index(main)!;
      const add_ref = main_index.references.find(r => r.name === "add");

      expect(add_ref).toBeDefined();

      // Resolve the reference
      const resolved_symbol = project.resolve_reference(add_ref!.reference_id, main);

      // Should resolve to add from lib.ts
      expect(resolved_symbol).toBeDefined();
      const add_def = project.get_definition(resolved_symbol!);
      expect(add_def?.name).toBe("add");
      expect(add_def?.location.file).toBe(lib);
    });

    it.skip("should handle re-exports", () => {
      const original = "original.ts" as FilePath;
      const reexporter = "reexporter.ts" as FilePath;
      const consumer = "consumer.ts" as FilePath;

      project.update_file(original, "export function foo() {}");
      project.update_file(reexporter, "export { foo } from './original'");
      project.update_file(consumer, `
        import { foo } from './reexporter'
        foo()
      `);

      project.resolve_file(original);
      project.resolve_file(reexporter);
      project.resolve_file(consumer);

      // Should resolve foo in consumer to original definition
      const consumer_index = project.get_semantic_index(consumer)!;
      const foo_ref = consumer_index.references.find(r => r.name === "foo");

      const resolved = project.resolve_reference(foo_ref!.reference_id, consumer);
      const foo_def = project.get_definition(resolved!);

      expect(foo_def?.location.file).toBe(original);
    });
  });

  describe("incremental update performance", () => {
    it("should be faster than full rebuild for single file change", () => {
      const files = Array.from({ length: 10 }, (_, i) => `file${i}.ts` as FilePath);

      // Initial build
      for (const file of files) {
        project.update_file(file, `export function func_${file}() { return ${Math.random()} }`);
      }

      // Resolve all
      for (const file of files) {
        project.resolve_file(file);
      }

      // Update one file
      const start = performance.now();
      project.update_file(files[0], "export function func0() { return 999 }");
      project.resolve_file(files[0]);
      const incremental_time = performance.now() - start;

      // Full rebuild
      const project2 = new Project();
      const rebuild_start = performance.now();
      for (const file of files) {
        project2.update_file(file, `export function func_${file}() { return ${Math.random()} }`);
        project2.resolve_file(file);
      }
      const full_rebuild_time = performance.now() - rebuild_start;

      // Incremental should be significantly faster
      expect(incremental_time).toBeLessThan(full_rebuild_time / 2);
    });

    it("should be O(file_size) not O(project_size) for update_file", () => {
      // Test that update_file time scales with file size, not project size

      // Small project (3 files)
      const small_project = new Project();
      const small_files = Array.from({ length: 3 }, (_, i) => `small${i}.ts` as FilePath);
      for (const file of small_files) {
        small_project.update_file(file, "export function foo() {}");
      }

      // Large project (30 files) - 10x more files
      const large_project = new Project();
      const large_files = Array.from({ length: 30 }, (_, i) => `large${i}.ts` as FilePath);
      for (const file of large_files) {
        large_project.update_file(file, "export function foo() {}");
      }

      // Update one file in small project
      const small_start = performance.now();
      small_project.update_file(small_files[0], "export function bar() {}");
      const small_time = performance.now() - small_start;

      // Update one file in large project (same file size)
      const large_start = performance.now();
      large_project.update_file(large_files[0], "export function bar() {}");
      const large_time = performance.now() - large_start;

      // Times should be similar (within 5x) since file size is the same
      // If it was O(project_size), large would be ~10x slower
      expect(large_time).toBeLessThan(small_time * 5);
    }, 10000);
  });
});

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

    // TODO(task-154): Cross-file method resolution requires type resolution
    // Method resolution depends on knowing the type of 'user', which requires
    // resolving User's constructor, then looking up methods on that type.
    it.todo("should resolve method calls on imported classes across files in TypeScript", () => {
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

      // Find method call
      const method_call = main_index?.references.find(
        (r) => r.type === "call" && r.name === ("getName" as SymbolName)
      );
      expect(method_call).toBeDefined();

      // FULL TEST: Verify method call resolves to method definition in types.ts
      if (method_call) {
        const resolved = project.resolutions.resolve(method_call.scope_id, method_call.name);
        expect(resolved).toBeDefined();
        const resolved_def = project.definitions.get(resolved!);
        expect(resolved_def?.location.file_path).toContain("types.ts");
        expect(resolved_def?.name).toBe("getName" as SymbolName);
        expect(resolved_def?.kind).toBe("method");
      }
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

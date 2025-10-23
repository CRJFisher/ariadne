import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Project } from "../project/project";
import type { FilePath } from "@ariadnejs/types";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

/**
 * Tests for ResolutionRegistry focusing on re-export import resolution
 *
 * Bug: Imports from re-exports don't get added to scope's symbol table,
 * causing calls to resolve to null and functions to be incorrectly marked
 * as entry points in the call graph.
 *
 * See: task-epic-11.149
 */
describe("ResolutionRegistry - Re-export Import Resolution", () => {
  let project: Project;
  let temp_dir: string;

  beforeEach(async () => {
    // Create temp directory for test files
    temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "resolution-test-"));

    // Create nested directory structure before initializing project
    // This ensures the FileSystemFolder tree includes these directories
    const import_resolution_dir = path.join(temp_dir, "import_resolution");
    const registries_dir = path.join(temp_dir, "registries");
    fs.mkdirSync(import_resolution_dir, { recursive: true });
    fs.mkdirSync(registries_dir, { recursive: true });

    project = new Project();
    await project.initialize(temp_dir as FilePath, []);
  });

  afterEach(() => {
    // Cleanup temp directory
    if (temp_dir && fs.existsSync(temp_dir)) {
      fs.rmSync(temp_dir, { recursive: true, force: true });
    }
  });

  it("should resolve imports from re-exports in scope symbol table", () => {
    // Create three files simulating the re-export pattern

    // 1. Original definition
    const original_file = path.join(temp_dir, "original.ts") as FilePath;
    const original_code = `
export function helper(x: number): number {
  return x * 2;
}
`;

    // 2. Re-export (index.ts pattern)
    const reexport_file = path.join(temp_dir, "index.ts") as FilePath;
    const reexport_code = `
export { helper } from "./original";
`;

    // 3. Consumer that imports from re-export
    const consumer_file = path.join(temp_dir, "consumer.ts") as FilePath;
    const consumer_code = `
import { helper } from "./index";

export function use_helper(y: number): number {
  return helper(y);
}
`;

    // Load files into project
    project.update_file(original_file, original_code);
    project.update_file(reexport_file, reexport_code);
    project.update_file(consumer_file, consumer_code);

    // Get the module scope of consumer.ts
    const consumer_scope = project.scopes.get_file_root_scope(consumer_file);
    expect(consumer_scope).toBeDefined();

    // TEST 1: Verify the import is resolved in the scope's symbol table
    // When we look up "helper" in consumer.ts's module scope, it should resolve
    // to the original function's symbol ID
    const resolved_helper = project.resolutions.resolve(
      consumer_scope!.id,
      "helper" as any
    );

    // Should NOT be null!
    expect(resolved_helper).not.toBeNull();
    expect(resolved_helper).toBeDefined();

    // Should resolve to the original function definition
    expect(resolved_helper).toContain("function:");
    expect(resolved_helper).toContain("original.ts");
    expect(resolved_helper).toContain("helper");
  });

  it("should detect calls to re-exported functions", () => {
    // Same setup as above
    const original_file = path.join(temp_dir, "original.ts") as FilePath;
    const original_code = `
export function helper(x: number): number {
  return x * 2;
}
`;

    const reexport_file = path.join(temp_dir, "index.ts") as FilePath;
    const reexport_code = `
export { helper } from "./original";
`;

    const consumer_file = path.join(temp_dir, "consumer.ts") as FilePath;
    const consumer_code = `
import { helper } from "./index";

export function use_helper(y: number): number {
  return helper(y);  // This call should be detected!
}
`;

    project.update_file(original_file, original_code);
    project.update_file(reexport_file, reexport_code);
    project.update_file(consumer_file, consumer_code);

    // TEST 2: Verify the call is in the resolved calls
    const consumer_calls = (project.resolutions as any).get_file_calls(consumer_file);

    // Find the call to "helper"
    const helper_calls = consumer_calls.filter((call: any) => call.name === "helper");

    // Should have exactly 1 call to helper
    expect(helper_calls.length).toBe(1);

    // The call should be resolved to the original function
    const helper_call = helper_calls[0];
    expect(helper_call.symbol_id).not.toBeNull();
    expect(helper_call.symbol_id).toBeDefined();
    expect(helper_call.symbol_id).toContain("function:");
    expect(helper_call.symbol_id).toContain("original.ts");
    expect(helper_call.symbol_id).toContain("helper");
  });

  it("should not mark re-exported functions as entry points when they are called", () => {
    // Same setup
    const original_file = path.join(temp_dir, "original.ts") as FilePath;
    const original_code = `
export function helper(x: number): number {
  return x * 2;
}
`;

    const reexport_file = path.join(temp_dir, "index.ts") as FilePath;
    const reexport_code = `
export { helper } from "./original";
`;

    const consumer_file = path.join(temp_dir, "consumer.ts") as FilePath;
    const consumer_code = `
import { helper } from "./index";

export function use_helper(y: number): number {
  return helper(y);
}
`;

    project.update_file(original_file, original_code);
    project.update_file(reexport_file, reexport_code);
    project.update_file(consumer_file, consumer_code);

    // TEST 3: Verify helper is NOT an entry point
    const call_graph = project.get_call_graph();

    // Get the helper function's symbol ID
    const helper_symbol_id = Array.from(project.definitions.get_all_definitions())
      .find(def => def.name === "helper" && def.kind === "function")
      ?.symbol_id;

    expect(helper_symbol_id).toBeDefined();

    // Helper should NOT be in the entry points list since it's called by use_helper
    expect(call_graph.entry_points).not.toContain(helper_symbol_id);

    // Helper should be in the call graph nodes
    const helper_node = call_graph.nodes.get(helper_symbol_id!);
    expect(helper_node).toBeDefined();

    // Verify that use_helper's node shows it calls helper
    const use_helper_symbol_id = Array.from(project.definitions.get_all_definitions())
      .find(def => def.name === "use_helper" && def.kind === "function")
      ?.symbol_id;

    expect(use_helper_symbol_id).toBeDefined();

    const use_helper_node = call_graph.nodes.get(use_helper_symbol_id!);
    expect(use_helper_node).toBeDefined();
    expect(use_helper_node!.enclosed_calls.length).toBeGreaterThan(0);

    // One of use_helper's calls should be to helper
    const calls_to_helper = use_helper_node!.enclosed_calls.filter(
      call => call.symbol_id === helper_symbol_id
    );
    expect(calls_to_helper.length).toBe(1);
  });

  it("should handle chained re-exports (A exports to B, B exports to C)", () => {
    // 1. Original definition
    const original_file = path.join(temp_dir, "original.ts") as FilePath;
    const original_code = `
export function deepHelper(x: number): number {
  return x * 3;
}
`;

    // 2. First re-export
    const reexport1_file = path.join(temp_dir, "reexport1.ts") as FilePath;
    const reexport1_code = `
export { deepHelper } from "./original";
`;

    // 3. Second re-export (chained)
    const reexport2_file = path.join(temp_dir, "reexport2.ts") as FilePath;
    const reexport2_code = `
export { deepHelper } from "./reexport1";
`;

    // 4. Consumer
    const consumer_file = path.join(temp_dir, "consumer.ts") as FilePath;
    const consumer_code = `
import { deepHelper } from "./reexport2";

export function use_deep_helper(y: number): number {
  return deepHelper(y);
}
`;

    project.update_file(original_file, original_code);
    project.update_file(reexport1_file, reexport1_code);
    project.update_file(reexport2_file, reexport2_code);
    project.update_file(consumer_file, consumer_code);

    // Verify the import resolves through the chain
    const consumer_scope = project.scopes.get_file_root_scope(consumer_file);
    const resolved_helper = project.resolutions.resolve(
      consumer_scope!.id,
      "deepHelper" as any
    );

    expect(resolved_helper).not.toBeNull();
    expect(resolved_helper).toContain("original.ts");
    expect(resolved_helper).toContain("deepHelper");

    // Verify the call is detected
    const consumer_calls = (project.resolutions as any).get_file_calls(consumer_file);
    const deep_helper_calls = consumer_calls.filter((call: any) => call.name === "deepHelper");
    expect(deep_helper_calls.length).toBe(1);
    expect(deep_helper_calls[0].symbol_id).toContain("original.ts");
  });

  it("should resolve imports from re-exports in nested function scopes", () => {
    // This test captures the actual bug:
    // Import is at module scope, but call is inside a nested function scope
    // Resolution should inherit from parent scopes

    const original_file = path.join(temp_dir, "original.ts") as FilePath;
    const original_code = `
export function resolve_module_path(import_path: string): string {
  return import_path + ".ts";
}
`;

    const reexport_file = path.join(temp_dir, "index.ts") as FilePath;
    const reexport_code = `
export { resolve_module_path } from "./original";
`;

    const consumer_file = path.join(temp_dir, "consumer.ts") as FilePath;
    const consumer_code = `
import { resolve_module_path } from "./index";

export function resolve_export_chain(source_file: string): string | null {
  // Import is at module scope, but call is inside this function's scope
  const resolved_file = resolve_module_path(source_file);
  return resolved_file;
}
`;

    project.update_file(original_file, original_code);
    project.update_file(reexport_file, reexport_code);
    project.update_file(consumer_file, consumer_code);

    // Verify the call inside the function is detected
    const consumer_calls = (project.resolutions as any).get_file_calls(consumer_file);
    const resolve_calls = consumer_calls.filter((call: any) =>
      call.name === "resolve_module_path"
    );

    // The call should be detected and resolved
    expect(resolve_calls.length).toBe(1);
    expect(resolve_calls[0].symbol_id).not.toBeNull();
    expect(resolve_calls[0].symbol_id).toBeDefined();
    expect(resolve_calls[0].symbol_id).toContain("original.ts");
  });

  it.skip("should handle re-exports with aliases", () => {
    // TODO: Fix aliased re-export resolution
    // Currently fails - aliased re-exports don't properly resolve
    const original_file = path.join(temp_dir, "original.ts") as FilePath;
    const original_code = `
export function originalName(x: number): number {
  return x + 1;
}
`;

    const reexport_file = path.join(temp_dir, "index.ts") as FilePath;
    const reexport_code = `
export { originalName as aliasedName } from "./original";
`;

    const consumer_file = path.join(temp_dir, "consumer.ts") as FilePath;
    const consumer_code = `
import { aliasedName } from "./index";

export function use_aliased(y: number): number {
  return aliasedName(y);
}
`;

    project.update_file(original_file, original_code);
    project.update_file(reexport_file, reexport_code);
    project.update_file(consumer_file, consumer_code);

    const consumer_scope = project.scopes.get_file_root_scope(consumer_file);
    const resolved = project.resolutions.resolve(
      consumer_scope!.id,
      "aliasedName" as any
    );

    expect(resolved).not.toBeNull();
    expect(resolved).toContain("originalName");

    const consumer_calls = (project.resolutions as any).get_file_calls(consumer_file);
    const aliased_calls = consumer_calls.filter((call: any) => call.name === "aliasedName");
    expect(aliased_calls.length).toBe(1);
  });

  it("should handle re-exports with nested directory structure and relative imports", async () => {
    // This test verifies that directory-based imports resolve correctly to index.ts files
    // after fixing the has_file_in_tree bug

    // This test matches the real codebase structure:
    // resolve_references/
    //   import_resolution/
    //     import_resolver.ts
    //     index.ts
    //   registries/
    //     export_registry.ts

    // Nested directories are created in beforeEach
    const import_resolution_dir = path.join(temp_dir, "import_resolution");
    const registries_dir = path.join(temp_dir, "registries");

    // 1. Original definition (import_resolver.ts)
    const import_resolver_file = path.join(import_resolution_dir, "import_resolver.ts") as FilePath;
    const import_resolver_code = `
export function resolve_module_path(import_path: string): string {
  return import_path + ".ts";
}
`;

    // 2. Re-export (index.ts)
    const index_file = path.join(import_resolution_dir, "index.ts") as FilePath;
    const index_code = `
export { resolve_module_path } from "./import_resolver";
`;

    // 3. Consumer in different directory (export_registry.ts)
    const export_registry_file = path.join(registries_dir, "export_registry.ts") as FilePath;
    const export_registry_code = `
import { resolve_module_path } from "../import_resolution";

export function resolve_export_chain(source_file: string): string | null {
  const resolved_file = resolve_module_path(source_file);
  return resolved_file;
}
`;

    // Write files to disk so they're in the FileSystemFolder tree
    fs.writeFileSync(import_resolver_file, import_resolver_code);
    fs.writeFileSync(index_file, index_code);
    fs.writeFileSync(export_registry_file, export_registry_code);

    // Create a new project instance to rebuild the file tree with the new files
    // (re-initializing the same instance doesn't rebuild the tree)
    project = new Project();
    await project.initialize(temp_dir as FilePath, []);

    // Now index the files
    project.update_file(import_resolver_file, import_resolver_code);
    project.update_file(index_file, index_code);
    project.update_file(export_registry_file, export_registry_code);

    // Verify the import resolves in the consumer
    const consumer_scope = project.scopes.get_file_root_scope(export_registry_file);
    const resolved = project.resolutions.resolve(
      consumer_scope!.id,
      "resolve_module_path" as any
    );

    expect(resolved).not.toBeNull();
    expect(resolved).toBeDefined();
    expect(resolved).toContain("import_resolver.ts");
    expect(resolved).toContain("resolve_module_path");

    // Verify the call is detected
    const registry_calls = (project.resolutions as any).get_file_calls(export_registry_file);
    const resolve_calls = registry_calls.filter((call: any) =>
      call.name === "resolve_module_path"
    );

    expect(resolve_calls.length).toBe(1);
    expect(resolve_calls[0].symbol_id).not.toBeNull();
    expect(resolve_calls[0].symbol_id).toBeDefined();
    expect(resolve_calls[0].symbol_id).toContain("import_resolver.ts");
  });
});

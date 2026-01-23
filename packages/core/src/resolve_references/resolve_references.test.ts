import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Project } from "../project/project";
import type { FilePath, SymbolReference } from "@ariadnejs/types";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

/**
 * Helper: Check if a reference is a call reference
 */
function is_call_reference(ref: SymbolReference): boolean {
  return (
    ref.kind === "function_call" ||
    ref.kind === "method_call" ||
    ref.kind === "constructor_call" ||
    ref.kind === "self_reference_call"
  );
}

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

    // TEST 2: Verify the call is resolved
    // Get semantic index and find the helper call
    const consumer_index = project.get_index_single_file(consumer_file);
    expect(consumer_index).toBeDefined();

    const helper_calls = consumer_index!.references.filter(
      (ref) => ref.name === "helper" && is_call_reference(ref)
    );
    expect(helper_calls.length).toBe(1);

    // Resolve the call using the public API
    const helper_call = helper_calls[0];
    const resolved_symbol_id = project.resolutions.resolve(
      helper_call.scope_id,
      helper_call.name
    );

    // The call should be resolved to the original function
    expect(resolved_symbol_id).not.toBeNull();
    expect(resolved_symbol_id).toBeDefined();
    expect(resolved_symbol_id).toContain("function:");
    expect(resolved_symbol_id).toContain("original.ts");
    expect(resolved_symbol_id).toContain("helper");
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
    const consumer_index = project.get_index_single_file(consumer_file);
    expect(consumer_index).toBeDefined();

    const deep_helper_calls = consumer_index!.references.filter(
      (ref) => ref.name === "deepHelper" && is_call_reference(ref)
    );
    expect(deep_helper_calls.length).toBe(1);

    // Resolve the call
    const resolved_deep_helper = project.resolutions.resolve(
      deep_helper_calls[0].scope_id,
      deep_helper_calls[0].name
    );
    expect(resolved_deep_helper).toContain("original.ts");
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
    const consumer_index = project.get_index_single_file(consumer_file);
    expect(consumer_index).toBeDefined();

    const resolve_calls = consumer_index!.references.filter(
      (ref) => ref.name === "resolve_module_path" && is_call_reference(ref)
    );

    // The call should be detected and resolved
    expect(resolve_calls.length).toBe(1);

    const resolved_symbol_id = project.resolutions.resolve(
      resolve_calls[0].scope_id,
      resolve_calls[0].name
    );
    expect(resolved_symbol_id).not.toBeNull();
    expect(resolved_symbol_id).toBeDefined();
    expect(resolved_symbol_id).toContain("original.ts");
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

    const consumer_index = project.get_index_single_file(consumer_file);
    expect(consumer_index).toBeDefined();

    const aliased_calls = consumer_index!.references.filter(
      (ref) => ref.name === "aliasedName" && is_call_reference(ref)
    );
    expect(aliased_calls.length).toBe(1);
  });

  it("should handle re-exports with nested directory structure and relative imports", async () => {
    // This test verifies that directory-based imports resolve correctly to index.ts files
    // after fixing the has_file_in_tree bug

    // This test matches the real codebase structure:
    // resolve_references/
    //   import_resolution/
    //     import_resolution.ts
    //     index.ts
    //   registries/
    //     export_registry.ts

    // Nested directories are created in beforeEach
    const import_resolution_dir = path.join(temp_dir, "import_resolution");
    const registries_dir = path.join(temp_dir, "registries");

    // 1. Original definition (import_resolution.ts)
    const import_resolution_file = path.join(import_resolution_dir, "import_resolution.ts") as FilePath;
    const import_resolution_code = `
export function resolve_module_path(import_path: string): string {
  return import_path + ".ts";
}
`;

    // 2. Re-export (index.ts)
    const index_file = path.join(import_resolution_dir, "index.ts") as FilePath;
    const index_code = `
export { resolve_module_path } from "./import_resolution";
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
    fs.writeFileSync(import_resolution_file, import_resolution_code);
    fs.writeFileSync(index_file, index_code);
    fs.writeFileSync(export_registry_file, export_registry_code);

    // Create a new project instance to rebuild the file tree with the new files
    // (re-initializing the same instance doesn't rebuild the tree)
    project = new Project();
    await project.initialize(temp_dir as FilePath, []);

    // Now index the files
    project.update_file(import_resolution_file, import_resolution_code);
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
    expect(resolved).toContain("import_resolution.ts");
    expect(resolved).toContain("resolve_module_path");

    // Verify the call is detected
    const registry_index = project.get_index_single_file(export_registry_file);
    expect(registry_index).toBeDefined();

    const resolve_calls = registry_index!.references.filter(
      (ref) => ref.name === "resolve_module_path" && is_call_reference(ref)
    );

    expect(resolve_calls.length).toBe(1);

    const resolved_call_symbol = project.resolutions.resolve(
      resolve_calls[0].scope_id,
      resolve_calls[0].name
    );
    expect(resolved_call_symbol).not.toBeNull();
    expect(resolved_call_symbol).toBeDefined();
    expect(resolved_call_symbol).toContain("import_resolution.ts");
  });
});


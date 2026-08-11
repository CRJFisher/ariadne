/**
 * Stage-level integration suite for the resolve_references stage (with the
 * .{language}.test.ts siblings) — named for the folder, so it has no paired
 * source file by design. Also the common-ancestor host for test helpers
 * shared by call_resolution/ tests.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Project } from "../project/project";
import type {
  CallGraph,
  FilePath,
  Result,
  ScopeId,
  SymbolId,
  SymbolName,
  SymbolReference,
} from "@ariadnejs/types";
import type { ResolutionRegistry } from "./resolution_registry";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

/**
 * Unwrap a `Result` to its value, throwing if it's an error.
 * Imported by sibling call_resolution test files.
 */
export function unwrap<T>(r: Result<T, unknown>): T {
  if (!r.ok) {
    throw new Error(`Expected ok, got err: ${JSON.stringify(r.error)}`);
  }
  return r.value;
}

/**
 * Seed scope resolutions directly, bypassing name resolution so call-resolution
 * units can be exercised in isolation. Imported by sibling call_resolution tests.
 */
export function set_test_resolutions(
  registry: ResolutionRegistry,
  scope_id: ScopeId,
  resolutions: Map<SymbolName, SymbolId>
): void {
  const internal = (registry as object) as {
    state: { resolutions_by_scope: Map<ScopeId, Map<SymbolName, SymbolId>> };
  };
  if (!internal.state.resolutions_by_scope) {
    internal.state.resolutions_by_scope = new Map();
  }
  internal.state.resolutions_by_scope.set(scope_id, resolutions);
}

/** Locate the CallableNode for a caller function defined in a given file. */
export function find_caller_node(
  call_graph: CallGraph,
  caller_name: string,
  file_path: FilePath
) {
  return [...call_graph.nodes.values()].find(
    (node) =>
      node.name === (caller_name as SymbolName) &&
      node.location.file_path === file_path
  );
}

/** True when `name` (defined in `file_path`) is reported as an entry point. */
export function is_entry_point(
  call_graph: CallGraph,
  name: string,
  file_path: FilePath
): boolean {
  return call_graph.entry_points.some((ep) => {
    const node = call_graph.nodes.get(ep);
    return (
      node?.name === (name as SymbolName) &&
      node.location.file_path === file_path
    );
  });
}

function is_call_reference(ref: SymbolReference): boolean {
  return (
    ref.kind === "function_call" ||
    ref.kind === "method_call" ||
    ref.kind === "constructor_call" ||
    ref.kind === "self_reference_call"
  );
}

/**
 * The SymbolId of the one function defined in `file`, read back from the
 * orchestrated project index. Resolution targets are asserted against this
 * exact id rather than substring-matching the id string.
 */
function sole_function_id(project: Project, file: FilePath): SymbolId {
  const index = project.get_index_single_file(file);
  if (!index) {
    throw new Error(`no index for ${file}`);
  }
  const ids = [...index.functions.keys()];
  expect(ids.length).toBe(1);
  return ids[0];
}

/** The SymbolId of the function named `name` in `file`'s orchestrated index. */
function function_id_named(
  project: Project,
  file: FilePath,
  name: string
): SymbolId {
  const index = project.get_index_single_file(file);
  if (!index) {
    throw new Error(`no index for ${file}`);
  }
  const ids = [...index.functions.entries()]
    .filter(([, def]) => def.name === name)
    .map(([id]) => id);
  expect(ids.length).toBe(1);
  return ids[0];
}

/**
 * Resolve the single call to `name` inside `file` through the orchestrator,
 * returning both the call reference and its resolved target.
 */
function resolve_sole_call(
  project: Project,
  file: FilePath,
  name: string
): { call: SymbolReference; resolved: SymbolId | null } {
  const index = project.get_index_single_file(file);
  if (!index) {
    throw new Error(`no index for ${file}`);
  }
  const calls = index.references.filter(
    (ref) => ref.name === name && is_call_reference(ref)
  );
  expect(calls.length).toBe(1);
  const call = calls[0];
  return {
    call,
    resolved: project.resolutions.resolve(call.scope_id, call.name),
  };
}

/**
 * Imports pulled through a re-export must land in the consumer scope's symbol
 * table, otherwise calls to them resolve to null and the target is falsely
 * reported as an unreached entry point in the call graph.
 */
describe("ResolutionRegistry - re-export import resolution", () => {
  let project: Project;
  let temp_dir: string;

  beforeEach(async () => {
    temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "resolution-test-"));

    // FileSystemFolder tree is built at initialize() from directories on disk,
    // so directory-based import targets must exist before the project starts.
    fs.mkdirSync(path.join(temp_dir, "import_resolution"), { recursive: true });
    fs.mkdirSync(path.join(temp_dir, "registries"), { recursive: true });

    project = new Project();
    await project.initialize(temp_dir as FilePath, []);
  });

  afterEach(() => {
    if (temp_dir && fs.existsSync(temp_dir)) {
      fs.rmSync(temp_dir, { recursive: true, force: true });
    }
  });

  it("resolves an import from a re-export to the original definition", () => {
    const original_file = path.join(temp_dir, "original.ts") as FilePath;
    const reexport_file = path.join(temp_dir, "index.ts") as FilePath;
    const consumer_file = path.join(temp_dir, "consumer.ts") as FilePath;

    project.update_file(
      original_file,
      `
export function helper(x: number): number {
  return x * 2;
}
`
    );
    project.update_file(
      reexport_file,
      `
export { helper } from "./original";
`
    );
    project.update_file(
      consumer_file,
      `
import { helper } from "./index";

export function use_helper(y: number): number {
  return helper(y);
}
`
    );

    const helper_id = sole_function_id(project, original_file);
    const consumer_scope = project.scopes.get_file_root_scope(consumer_file);
    const resolved = project.resolutions.resolve(
      consumer_scope!.id,
      "helper" as SymbolName
    );

    expect(resolved).toEqual(helper_id);
  });

  it("resolves a call to a re-exported function to the original definition", () => {
    const original_file = path.join(temp_dir, "original.ts") as FilePath;
    const reexport_file = path.join(temp_dir, "index.ts") as FilePath;
    const consumer_file = path.join(temp_dir, "consumer.ts") as FilePath;

    project.update_file(
      original_file,
      `
export function helper(x: number): number {
  return x * 2;
}
`
    );
    project.update_file(
      reexport_file,
      `
export { helper } from "./original";
`
    );
    project.update_file(
      consumer_file,
      `
import { helper } from "./index";

export function use_helper(y: number): number {
  return helper(y);
}
`
    );

    const helper_id = sole_function_id(project, original_file);
    const { resolved } = resolve_sole_call(project, consumer_file, "helper");

    expect(resolved).toEqual(helper_id);
  });

  it("resolves a call through a chain of re-exports (A -> B -> C)", () => {
    const original_file = path.join(temp_dir, "original.ts") as FilePath;
    const reexport1_file = path.join(temp_dir, "reexport1.ts") as FilePath;
    const reexport2_file = path.join(temp_dir, "reexport2.ts") as FilePath;
    const consumer_file = path.join(temp_dir, "consumer.ts") as FilePath;

    project.update_file(
      original_file,
      `
export function deepHelper(x: number): number {
  return x * 3;
}
`
    );
    project.update_file(
      reexport1_file,
      `
export { deepHelper } from "./original";
`
    );
    project.update_file(
      reexport2_file,
      `
export { deepHelper } from "./reexport1";
`
    );
    project.update_file(
      consumer_file,
      `
import { deepHelper } from "./reexport2";

export function use_deep_helper(y: number): number {
  return deepHelper(y);
}
`
    );

    const deep_helper_id = sole_function_id(project, original_file);

    const consumer_scope = project.scopes.get_file_root_scope(consumer_file);
    expect(
      project.resolutions.resolve(consumer_scope!.id, "deepHelper" as SymbolName)
    ).toEqual(deep_helper_id);

    const { resolved } = resolve_sole_call(project, consumer_file, "deepHelper");
    expect(resolved).toEqual(deep_helper_id);
  });

  it("resolves a re-exported import used inside a nested function scope", () => {
    const original_file = path.join(temp_dir, "original.ts") as FilePath;
    const reexport_file = path.join(temp_dir, "index.ts") as FilePath;
    const consumer_file = path.join(temp_dir, "consumer.ts") as FilePath;

    project.update_file(
      original_file,
      `
export function resolve_module_path(import_path: string): string {
  return import_path + ".ts";
}
`
    );
    project.update_file(
      reexport_file,
      `
export { resolve_module_path } from "./original";
`
    );
    // The import binds at module scope; the call sits inside a function scope,
    // so resolution must walk from the call scope up to the module scope.
    project.update_file(
      consumer_file,
      `
import { resolve_module_path } from "./index";

export function resolve_export_chain(source_file: string): string | null {
  const resolved_file = resolve_module_path(source_file);
  return resolved_file;
}
`
    );

    const target_id = sole_function_id(project, original_file);
    const { resolved } = resolve_sole_call(
      project,
      consumer_file,
      "resolve_module_path"
    );

    expect(resolved).toEqual(target_id);
  });

  it("resolves an aliased re-export to the original definition", () => {
    const original_file = path.join(temp_dir, "original.ts") as FilePath;
    const reexport_file = path.join(temp_dir, "index.ts") as FilePath;
    const consumer_file = path.join(temp_dir, "consumer.ts") as FilePath;

    project.update_file(
      original_file,
      `
export function originalName(x: number): number {
  return x + 1;
}
`
    );
    project.update_file(
      reexport_file,
      `
export { originalName as aliasedName } from "./original";
`
    );
    project.update_file(
      consumer_file,
      `
import { aliasedName } from "./index";

export function use_aliased(y: number): number {
  return aliasedName(y);
}
`
    );

    const original_id = sole_function_id(project, original_file);

    const consumer_scope = project.scopes.get_file_root_scope(consumer_file);
    expect(
      project.resolutions.resolve(consumer_scope!.id, "aliasedName" as SymbolName)
    ).toEqual(original_id);

    const { resolved } = resolve_sole_call(project, consumer_file, "aliasedName");
    expect(resolved).toEqual(original_id);
  });

  it("resolves a directory-based import to the directory's index.ts across folders", async () => {
    const import_resolution_dir = path.join(temp_dir, "import_resolution");
    const registries_dir = path.join(temp_dir, "registries");

    const import_resolution_file = path.join(
      import_resolution_dir,
      "import_resolution.ts"
    ) as FilePath;
    const index_file = path.join(import_resolution_dir, "index.ts") as FilePath;
    const export_registry_file = path.join(
      registries_dir,
      "export_registry.ts"
    ) as FilePath;

    const import_resolution_code = `
export function resolve_module_path(import_path: string): string {
  return import_path + ".ts";
}
`;
    const index_code = `
export { resolve_module_path } from "./import_resolution";
`;
    // Imports "../import_resolution" (a directory) which must resolve to its index.ts.
    const export_registry_code = `
import { resolve_module_path } from "../import_resolution";

export function resolve_export_chain(source_file: string): string | null {
  const resolved_file = resolve_module_path(source_file);
  return resolved_file;
}
`;

    // Files must exist on disk before initialize() so the FileSystemFolder tree
    // includes them for directory-import resolution.
    fs.writeFileSync(import_resolution_file, import_resolution_code);
    fs.writeFileSync(index_file, index_code);
    fs.writeFileSync(export_registry_file, export_registry_code);

    project = new Project();
    await project.initialize(temp_dir as FilePath, []);

    project.update_file(import_resolution_file, import_resolution_code);
    project.update_file(index_file, index_code);
    project.update_file(export_registry_file, export_registry_code);

    const target_id = sole_function_id(project, import_resolution_file);

    const consumer_scope = project.scopes.get_file_root_scope(
      export_registry_file
    );
    expect(
      project.resolutions.resolve(
        consumer_scope!.id,
        "resolve_module_path" as SymbolName
      )
    ).toEqual(target_id);

    const { resolved } = resolve_sole_call(
      project,
      export_registry_file,
      "resolve_module_path"
    );
    expect(resolved).toEqual(target_id);
  });
});

describe("ResolutionRegistry - orchestration lifecycle", () => {
  let project: Project;
  let temp_dir: string;

  beforeEach(async () => {
    temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "resolution-lifecycle-"));
    project = new Project();
    await project.initialize(temp_dir as FilePath, []);
  });

  afterEach(() => {
    if (temp_dir && fs.existsSync(temp_dir)) {
      fs.rmSync(temp_dir, { recursive: true, force: true });
    }
  });

  it("holds no resolutions for an empty project", () => {
    expect(project.resolutions.size()).toBe(0);
  });

  it("leaves a call to an undefined function unresolved", () => {
    const file = path.join(temp_dir, "a.ts") as FilePath;
    project.update_file(
      file,
      `
export function caller(): void {
  ghost();
}
`
    );

    const { resolved } = resolve_sole_call(project, file, "ghost");
    expect(resolved).toBeNull();
  });

  it("re-resolves a call to the new definition after the file changes", () => {
    const file = path.join(temp_dir, "b.ts") as FilePath;
    project.update_file(
      file,
      `
export function helper(): number {
  return 1;
}
export function use(): number {
  return helper();
}
`
    );
    const first_id = function_id_named(project, file, "helper");
    expect(resolve_sole_call(project, file, "helper").resolved).toEqual(first_id);

    // Prepend blank lines so the definition shifts to a new SymbolId; the
    // orchestrator must drop the stale resolution and re-resolve to the new id.
    project.update_file(
      file,
      `



export function helper(): number {
  return 1;
}
export function use(): number {
  return helper();
}
`
    );
    const second_id = function_id_named(project, file, "helper");

    expect(second_id).not.toEqual(first_id);
    expect(resolve_sole_call(project, file, "helper").resolved).toEqual(second_id);
  });
});

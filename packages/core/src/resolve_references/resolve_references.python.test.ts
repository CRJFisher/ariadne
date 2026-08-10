/**
 * Python multi-file integration tests for resolve_references
 *
 * Verifies cross-file import resolution and call detection through the full
 * pipeline using real files in temp directories.
 */

import { describe, it, expect, afterAll } from "vitest";
import { Project } from "../project/project";
import {
  find_caller_node,
  is_entry_point,
} from "../trace_call_graph/trace_call_graph.test";
import type { FilePath, SymbolName } from "@ariadnejs/types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Helper to set up a project with files already on disk before initialization.
 * The Project scans the file tree at initialize() time, so files must exist first.
 */
async function setup_project(
  files: Record<string, string>
): Promise<{
  project: Project;
  temp_dir: string;
  file_paths: Record<string, FilePath>;
}> {
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-py-resolve-"));

  const file_paths: Record<string, FilePath> = {};
  for (const [relative_path, content] of Object.entries(files)) {
    const abs_path = path.join(temp_dir, relative_path);
    fs.mkdirSync(path.dirname(abs_path), { recursive: true });
    fs.writeFileSync(abs_path, content);
    file_paths[relative_path] = abs_path as FilePath;
  }

  const project = new Project();
  await project.initialize(temp_dir as FilePath);

  for (const [relative_path, content] of Object.entries(files)) {
    project.update_file(file_paths[relative_path], content);
  }

  return { project, temp_dir, file_paths };
}

const temp_dirs: string[] = [];

afterAll(() => {
  for (const dir of temp_dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("Python Multi-File Resolve References Integration", () => {
  describe("namespace-qualified class instantiation", () => {
    it("import models; user = models.User(name); user.greet() resolves greet to User method", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "models.py": `class User:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return "Hello, " + self.name
`,
        "app.py": `import models

def create_user(name):
    user = models.User(name)
    return user.greet()
`,
      });
      temp_dirs.push(temp_dir);

      // Verify namespace import resolves
      const app_scope = project.scopes.get_file_root_scope(file_paths["app.py"]);
      expect(app_scope).toBeDefined();

      const resolved_models = project.resolutions.resolve(
        app_scope!.id,
        "models" as SymbolName
      );
      expect(resolved_models).not.toBeNull();

      const call_graph = project.get_call_graph();

      // greet() should NOT be an entry point — user.greet() resolves through
      // the namespace import type binding for `user`
      const greet_entry = call_graph.entry_points.find((ep) => {
        const node = call_graph.nodes.get(ep);
        return (
          node?.name === ("greet" as SymbolName) &&
          node.location.file_path === file_paths["models.py"]
        );
      });
      expect(greet_entry).toBeUndefined();
    });
  });

  describe("underscore-private explicit named imports", () => {
    const LIB = `def _make_block(x):
    return x

def _ensure_sync_result(r):
    return r

def _parse_mapper_argument(a):
    return a

def make_block(x):
    return x
`;

    it("binds each underscore-private named import and resolves the calls to their _lib.py definitions", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "_lib.py": LIB,
        "app.py": `from ._lib import _make_block, _ensure_sync_result, _parse_mapper_argument

def run():
    _make_block(1)
    _ensure_sync_result(2)
    _parse_mapper_argument(3)
`,
      });
      temp_dirs.push(temp_dir);

      const private_names = [
        "_make_block",
        "_ensure_sync_result",
        "_parse_mapper_argument",
      ];

      const app_scope = project.scopes.get_file_root_scope(file_paths["app.py"]);
      expect(app_scope).not.toBeUndefined();

      // Each private name binds in app.py's scope to its _lib.py definition.
      for (const name of private_names) {
        const resolved = project.resolutions.resolve(
          app_scope!.id,
          name as SymbolName
        );
        expect(resolved).not.toBeNull();
        expect(resolved).toContain("_lib.py");
        expect(resolved).toContain(name);
      }

      const call_graph = project.get_call_graph();
      const run_node = find_caller_node(call_graph, "run", file_paths["app.py"]);
      expect(run_node).not.toBeUndefined();

      // Each call resolves to the matching _lib.py definition with no failure,
      // and none of the private names is left as an entry point.
      for (const name of private_names) {
        const call = run_node!.enclosed_calls.find(
          (c) => c.name === (name as SymbolName)
        );
        expect(call).not.toBeUndefined();
        expect(call!.resolution_failure).toBeUndefined();
        const target = call_graph.nodes.get(call!.resolutions[0].symbol_id);
        expect(target?.location.file_path).toEqual(file_paths["_lib.py"]);
        expect(target?.name).toEqual(name as SymbolName);

        expect(is_entry_point(call_graph, name, file_paths["_lib.py"])).toEqual(
          false
        );
      }
    });

    it("keeps the public control name resolving when imported alongside private names", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "_lib.py": LIB,
        "app.py": `from ._lib import make_block

def run():
    make_block(1)
`,
      });
      temp_dirs.push(temp_dir);

      const app_scope = project.scopes.get_file_root_scope(file_paths["app.py"]);
      expect(app_scope).not.toBeUndefined();

      const resolved = project.resolutions.resolve(
        app_scope!.id,
        "make_block" as SymbolName
      );
      expect(resolved).not.toBeNull();
      expect(resolved).toContain("_lib.py");
      expect(resolved).toContain("make_block");

      const call_graph = project.get_call_graph();
      const run_node = find_caller_node(call_graph, "run", file_paths["app.py"]);
      const call = run_node!.enclosed_calls.find(
        (c) => c.name === ("make_block" as SymbolName)
      );
      expect(call!.resolution_failure).toBeUndefined();
      const target = call_graph.nodes.get(call!.resolutions[0].symbol_id);
      expect(target?.location.file_path).toEqual(file_paths["_lib.py"]);
      expect(target?.name).toEqual("make_block" as SymbolName);

      expect(
        is_entry_point(call_graph, "make_block", file_paths["_lib.py"])
      ).toEqual(false);
    });

    it("does not surface an underscore-private name through a wildcard import", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "_lib.py": LIB,
        "wildcard_app.py": `from ._lib import *

def run():
    _make_block(1)
`,
      });
      temp_dirs.push(temp_dir);

      const app_scope = project.scopes.get_file_root_scope(
        file_paths["wildcard_app.py"]
      );
      expect(app_scope).not.toBeUndefined();

      // The wildcard binds the name "*", not "_make_block".
      const resolved = project.resolutions.resolve(
        app_scope!.id,
        "_make_block" as SymbolName
      );
      expect(resolved).toBeNull();

      // The unresolved call leaves _make_block an entry point.
      const call_graph = project.get_call_graph();
      expect(
        is_entry_point(call_graph, "_make_block", file_paths["_lib.py"])
      ).toEqual(true);
    });

    it("does not resolve an underscore-private member accessed through a namespace import", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "_lib.py": LIB,
        "namespace_app.py": `import _lib as ns

def run():
    ns._make_block(1)
`,
      });
      temp_dirs.push(temp_dir);

      const call_graph = project.get_call_graph();

      // _make_block is not reached via the namespace member access.
      expect(
        is_entry_point(call_graph, "_make_block", file_paths["_lib.py"])
      ).toEqual(true);

      const run_node = find_caller_node(
        call_graph,
        "run",
        file_paths["namespace_app.py"]
      );
      const call = run_node!.enclosed_calls.find(
        (c) => c.name === ("_make_block" as SymbolName)
      );
      const resolved_to_private = (call?.resolutions ?? []).some((r) => {
        const target = call_graph.nodes.get(r.symbol_id);
        return (
          target?.location.file_path === file_paths["_lib.py"] &&
          target?.name === ("_make_block" as SymbolName)
        );
      });
      expect(resolved_to_private).toEqual(false);
    });

    it("binds an aliased underscore import under its alias and resolves the call to the original definition", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "_lib.py": LIB,
        "app.py": `from ._lib import _make_block as mb

def run():
    mb(1)
`,
      });
      temp_dirs.push(temp_dir);

      const app_scope = project.scopes.get_file_root_scope(file_paths["app.py"]);
      expect(app_scope).not.toBeUndefined();

      // The alias is the bound name; the original private name is not in scope.
      const resolved_alias = project.resolutions.resolve(
        app_scope!.id,
        "mb" as SymbolName
      );
      expect(resolved_alias).not.toBeNull();
      expect(resolved_alias).toContain("_lib.py");
      expect(resolved_alias).toContain("_make_block");
      expect(
        project.resolutions.resolve(app_scope!.id, "_make_block" as SymbolName)
      ).toBeNull();

      const call_graph = project.get_call_graph();
      const run_node = find_caller_node(call_graph, "run", file_paths["app.py"]);
      const call = run_node!.enclosed_calls.find(
        (c) => c.name === ("mb" as SymbolName)
      );
      expect(call!.resolution_failure).toBeUndefined();
      const target = call_graph.nodes.get(call!.resolutions[0].symbol_id);
      expect(target?.location.file_path).toEqual(file_paths["_lib.py"]);
      expect(target?.name).toEqual("_make_block" as SymbolName);
      expect(
        is_entry_point(call_graph, "_make_block", file_paths["_lib.py"])
      ).toEqual(false);
    });

    it("binds an explicit import to the module-level definition, never a nested same-named definition", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "_lib.py": `def _make_block(x):
    return x

def _outer():
    def _make_block(y):
        return y

    return _make_block(0)
`,
        "app.py": `from ._lib import _make_block

def run():
    _make_block(1)
`,
      });
      temp_dirs.push(temp_dir);

      const call_graph = project.get_call_graph();
      const run_node = find_caller_node(call_graph, "run", file_paths["app.py"]);
      const call = run_node!.enclosed_calls.find(
        (c) => c.name === ("_make_block" as SymbolName)
      );
      expect(call!.resolution_failure).toBeUndefined();
      const target = call_graph.nodes.get(call!.resolutions[0].symbol_id);
      expect(target?.location.file_path).toEqual(file_paths["_lib.py"]);
      // The module-level def is on line 1; the nested one is on line 5. The
      // module-scope lookup must bind the former.
      expect(target?.location.start_line).toEqual(1);
    });

    it("leaves an explicit import of a name absent from the source module unbound", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "_lib.py": LIB,
        "app.py": `from ._lib import _does_not_exist

def run():
    _does_not_exist(1)
`,
      });
      temp_dirs.push(temp_dir);

      const app_scope = project.scopes.get_file_root_scope(file_paths["app.py"]);
      expect(app_scope).not.toBeUndefined();
      expect(
        project.resolutions.resolve(
          app_scope!.id,
          "_does_not_exist" as SymbolName
        )
      ).toBeNull();
    });

    it("does not place an underscore-private name on the package surface for a re-export consumer", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "pkg/_lib.py": LIB,
        "pkg/__init__.py": `from ._lib import make_block
`,
        "reexport_app.py": `from pkg import _make_block

def run():
    _make_block(1)
`,
      });
      temp_dirs.push(temp_dir);

      const app_scope = project.scopes.get_file_root_scope(
        file_paths["reexport_app.py"]
      );
      expect(app_scope).not.toBeUndefined();

      // __init__.py re-exports only `make_block`; `_make_block` is not defined
      // there, so the explicit import through the package stays unbound.
      const resolved = project.resolutions.resolve(
        app_scope!.id,
        "_make_block" as SymbolName
      );
      expect(resolved).toBeNull();

      const call_graph = project.get_call_graph();
      expect(
        is_entry_point(call_graph, "_make_block", file_paths["pkg/_lib.py"])
      ).toEqual(true);
    });
  });
});

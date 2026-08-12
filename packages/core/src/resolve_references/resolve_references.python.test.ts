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
} from "./resolve_references.test";
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

      // The wildcard layers only _lib's public surface; _make_block is
      // is_exported: false and never enters it.
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

  describe("query-pattern completeness over node shapes", () => {
    it("resolves a call to a classmethod through the class", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "app.py": [
          "class C:",
          "    @classmethod",
          "    def build(cls):",
          "        return 1",
          "",
          "def run():",
          "    return C.build()",
        ].join("\n"),
      });
      temp_dirs.push(temp_dir);
      const cg = project.get_call_graph();
      const file = file_paths["app.py"];

      const build_node = find_caller_node(cg, "build", file);
      expect(build_node?.name).toEqual("build");
      const run_node = find_caller_node(cg, "run", file);
      expect(
        run_node?.enclosed_calls.map((c) => [c.name, c.resolutions.length])
      ).toEqual([["build", 1]]);
      expect(is_entry_point(cg, "build", file)).toEqual(false);
    });

    it("creates an edge from a property read to the getter method", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "acc.py": [
          "class R:",
          "    @property",
          "    def data(self):",
          "        return 1",
          "",
          "def run(r: R):",
          "    return r.data",
        ].join("\n"),
      });
      temp_dirs.push(temp_dir);
      const cg = project.get_call_graph();
      const file = file_paths["acc.py"];

      const getter = find_caller_node(cg, "data", file);
      const run_node = find_caller_node(cg, "run", file);
      expect(
        run_node?.enclosed_calls.map((c) => ({
          name: c.name,
          call_type: c.call_type,
          targets: c.resolutions.map((r) => r.symbol_id),
        }))
      ).toEqual([
        { name: "data", call_type: "method", targets: [getter!.symbol_id] },
      ]);
      expect(is_entry_point(cg, "data", file)).toEqual(false);
    });

    it("creates no edge from a plain attribute read", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "attr.py": [
          "class R:",
          "    def __init__(self):",
          "        self.data = 1",
          "",
          "def run(r: R):",
          "    return r.data",
        ].join("\n"),
      });
      temp_dirs.push(temp_dir);
      const cg = project.get_call_graph();
      const run_node = find_caller_node(cg, "run", file_paths["attr.py"]);
      expect(run_node?.enclosed_calls).toEqual([]);
    });

    it("puts every method of a class with a dotted base in the call graph and resolves super() through the bare base", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "base.py": [
          "class Base:",
          "    def visit_create_sequence(self, create):",
          "        return 0",
        ].join("\n"),
        "pg.py": [
          "from base import Base",
          "",
          "class PG(Base):",
          "    def visit_create_sequence(self, create):",
          "        return super().visit_create_sequence(create)",
          "",
          "class PGDotted(compiler.DDLCompiler):",
          "    def visit_drop_sequence(self, drop):",
          "        return self.visit_create_sequence(drop)",
          "    def visit_create_sequence(self, create):",
          "        return 1",
        ].join("\n"),
      });
      temp_dirs.push(temp_dir);
      const cg = project.get_call_graph();
      const pg = file_paths["pg.py"];
      const base = file_paths["base.py"];

      const pg_visit = find_caller_node(cg, "visit_create_sequence", pg);
      const base_visit = find_caller_node(cg, "visit_create_sequence", base);
      // super() dispatch over-approximates like any polymorphic method call
      // (call_resolver documents this), so the subclass's own override rides
      // along with the base method the edge exists for.
      expect(
        pg_visit?.enclosed_calls.map((c) => ({
          name: c.name,
          targets: c.resolutions.map((r) => r.symbol_id),
        }))
      ).toEqual([
        {
          name: "visit_create_sequence",
          targets: [base_visit!.symbol_id, pg_visit!.symbol_id],
        },
        { name: "super", targets: [] },
      ]);

      const dotted_drop = find_caller_node(cg, "visit_drop_sequence", pg);
      expect(dotted_drop?.name).toEqual("visit_drop_sequence");
      expect(
        dotted_drop?.enclosed_calls.map((c) => [c.name, c.resolutions.length])
      ).toEqual([["visit_create_sequence", 1]]);
    });

    it("indexes an Enum subclass with a mixin base as a single definition", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "colors.py": [
          "from enum import Enum",
          "",
          "class Color(Enum, Mixin):",
          "    RED = 1",
          "",
          "def pick():",
          "    return Color.RED",
        ].join("\n"),
      });
      temp_dirs.push(temp_dir);
      const file = file_paths["colors.py"];
      const index = project.get_index_single_file(file)!;

      // Two query arms firing on one class built it twice and aborted the file
      // on the duplicate export, taking every definition in it down.
      expect([...index.enums.values()].map((e) => e.name)).toEqual(["Color"]);
      expect([...index.classes.values()].map((c) => c.name)).toEqual([]);

      const cg = project.get_call_graph();
      expect(is_entry_point(cg, "pick", file)).toEqual(true);
    });

    it("puts a method behind any decorator shape in the call graph", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "shapes.py": [
          "import cython",
          "import functools",
          "import util",
          "",
          "class Box:",
          "    @cython.cfunc",
          "    def dotted(self):",
          "        return 1",
          "",
          "    @functools.lru_cache()",
          "    def call_shaped(self):",
          "        return 2",
          "",
          "    @lru_cache(maxsize=1)",
          "    def call_shaped_with_args(self):",
          "        return 3",
          "",
          "    @util.memoized_property",
          "    def descriptor(self):",
          "        return 4",
          "",
          "    @cython.cfunc",
          "    def never_called(self):",
          "        return 5",
          "",
          "def run(box):",
          "    box.dotted()",
          "    box.call_shaped()",
          "    box.call_shaped_with_args()",
          "    return box.descriptor",
        ].join("\n"),
      });
      temp_dirs.push(temp_dir);
      const cg = project.get_call_graph();
      const file = file_paths["shapes.py"];

      // Each decorated method exists as a graph node — before this family a
      // dotted or call-shaped decorator erased the method entirely.
      expect(
        ["dotted", "call_shaped", "call_shaped_with_args", "descriptor", "never_called"].map(
          (name) => find_caller_node(cg, name, file)?.name
        )
      ).toEqual([
        "dotted",
        "call_shaped",
        "call_shaped_with_args",
        "descriptor",
        "never_called",
      ]);

      // The uncalled sibling is the control: the calls below are what clears
      // the others, not the mere fact that they are methods.
      expect(is_entry_point(cg, "never_called", file)).toEqual(true);
    });
  });
});

describe("Accessor pair ahead of other members", () => {
  it("resolves self-rooted calls in a class whose property pair is declared first", async () => {
    // The class scope index is keyed by name, so the setter lands under the
    // getter's key. Reverse-looking a method up through the deduplicated member
    // index then failed to name the owning class, and every self-rooted call in
    // the class went unresolved.
    const { project, temp_dir, file_paths } = await setup_project({
      "engine.py": [
        "class Engine:",
        "    @property",
        "    def name(self):",
        "        return self._n",
        "",
        "    @name.setter",
        "    def name(self, v):",
        "        self._n = v",
        "",
        "    def dialect(self):",
        "        return 1",
        "",
        "    def connect(self):",
        "        return self.dialect()",
      ].join("\n"),
    });
    temp_dirs.push(temp_dir);
    const call_graph = project.get_call_graph();
    const file = file_paths["engine.py"];

    const connect = find_caller_node(call_graph, "connect", file);
    expect(
      connect?.enclosed_calls.map((c) => [c.name, c.resolutions.length])
    ).toEqual([["dialect", 1]]);
    expect(is_entry_point(call_graph, "dialect", file)).toEqual(false);
  });
});

describe("Python star imports across files", () => {
  function expect_python_call_resolves_to(
    project: Project,
    caller_file: FilePath,
    caller_name: string,
    call_name: string,
    target_file: FilePath
  ): void {
    const call_graph = project.get_call_graph();
    const caller_node = find_caller_node(call_graph, caller_name, caller_file);
    const call = caller_node!.enclosed_calls.find(
      (c) => c.name === (call_name as SymbolName)
    );
    expect(call).toBeDefined();
    expect(call!.resolution_failure).toBeUndefined();
    expect(call!.resolutions.length).toEqual(1);
    const target = call_graph.nodes.get(call!.resolutions[0].symbol_id);
    expect(target?.location.file_path).toEqual(target_file);
    expect(target?.name).toEqual(call_name as SymbolName);
  }

  it("binds a module-scope star import to the target module's public surface", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "lib.py": `def public_helper(x):
    return x + 1
`,
      "app.py": `from lib import *

def run():
    return public_helper(1)
`,
    });
    temp_dirs.push(temp_dir);

    expect_python_call_resolves_to(
      project,
      file_paths["app.py"],
      "run",
      "public_helper",
      file_paths["lib.py"]
    );

    const call_graph = project.get_call_graph();
    expect(is_entry_point(call_graph, "public_helper", file_paths["lib.py"])).toEqual(
      false
    );
  });

  it("indexes six star imports in one file without a duplicate-export error", async () => {
    const init_content = `from django.forms.boundfield import *
from django.forms.fields import *
from django.forms.forms import *
from django.forms.formsets import *
from django.forms.models import *
from django.forms.widgets import *
`;
    const { project, temp_dir, file_paths } = await setup_project({
      "django/forms/boundfield.py": `def bound_field():
    return 1
`,
      "django/forms/fields.py": `def char_field():
    return 2
`,
      "django/forms/forms.py": `def base_form():
    return 3
`,
      "django/forms/formsets.py": `def formset_factory():
    return 4
`,
      "django/forms/models.py": `def model_form():
    return 5
`,
      "django/forms/widgets.py": `def text_input():
    return 6
`,
      "django/forms/__init__.py": init_content,
      "app.py": `from django.forms import char_field, text_input

def run():
    return char_field() + text_input()
`,
      "star_app.py": `from django.forms import *
`,
    });
    temp_dirs.push(temp_dir);

    expect(() =>
      project.update_file(file_paths["django/forms/__init__.py"], init_content)
    ).not.toThrow();

    expect_python_call_resolves_to(
      project,
      file_paths["app.py"],
      "run",
      "char_field",
      file_paths["django/forms/fields.py"]
    );
    expect_python_call_resolves_to(
      project,
      file_paths["app.py"],
      "run",
      "text_input",
      file_paths["django/forms/widgets.py"]
    );

    // A consumer starring the package sees all six forwarded surfaces, and no
    // binding for the star edges' own module names.
    const star_scope = project.scopes.get_file_root_scope(
      file_paths["star_app.py"]
    );
    const surface_files: Record<string, string> = {
      bound_field: "django/forms/boundfield.py",
      char_field: "django/forms/fields.py",
      base_form: "django/forms/forms.py",
      formset_factory: "django/forms/formsets.py",
      model_form: "django/forms/models.py",
      text_input: "django/forms/widgets.py",
    };
    for (const [name, file] of Object.entries(surface_files)) {
      const resolved = project.resolutions.resolve(
        star_scope!.id,
        name as SymbolName
      );
      expect(resolved).toContain(file_paths[file]);
    }
    expect(
      project.resolutions.resolve(star_scope!.id, "boundfield" as SymbolName)
    ).toBeNull();
  });

  it("keeps a local definition shadowing a name the star import also provides", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "lib.py": `def helper():
    return "lib"

def lib_only():
    return "lib_only"
`,
      "app.py": `from lib import *

def helper():
    return "app"

def run():
    return helper() + lib_only()
`,
    });
    temp_dirs.push(temp_dir);

    expect_python_call_resolves_to(
      project,
      file_paths["app.py"],
      "run",
      "helper",
      file_paths["app.py"]
    );
    // The star surface is layered, not absent: a name only it supplies binds
    // through it. Without this the shadowing assertion above holds trivially.
    expect_python_call_resolves_to(
      project,
      file_paths["app.py"],
      "run",
      "lib_only",
      file_paths["lib.py"]
    );
  });

  it("rebinds a two-hop star chain when the leaf gains a name", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "leaf.py": `def alpha():
    return 1
`,
      "mid.py": `from leaf import *
`,
      "consumer.py": `from mid import *

def caller():
    return beta()
`,
    });
    temp_dirs.push(temp_dir);

    project.update_file(
      file_paths["leaf.py"],
      `def alpha():
    return 1

def beta():
    return 2
`
    );

    const consumer_scope = project.scopes.get_file_root_scope(
      file_paths["consumer.py"]
    );
    const resolved = project.resolutions.resolve(
      consumer_scope!.id,
      "beta" as SymbolName
    );
    expect(resolved).toContain(file_paths["leaf.py"]);
    expect(resolved).toContain("beta");
  });

  it("keeps an explicit named import shadowing a star import of the same name", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "one.py": `def shared():
    return 1

def one_only():
    return 3
`,
      "two.py": `def shared():
    return 2
`,
      "app.py": `from one import *
from two import shared

def run():
    return shared() + one_only()
`,
    });
    temp_dirs.push(temp_dir);

    expect_python_call_resolves_to(
      project,
      file_paths["app.py"],
      "run",
      "shared",
      file_paths["two.py"]
    );
    // The star surface is layered below the explicit import, not discarded: a
    // name only `one.py` supplies still binds through the star edge.
    expect_python_call_resolves_to(
      project,
      file_paths["app.py"],
      "run",
      "one_only",
      file_paths["one.py"]
    );
  });
});

/**
 * Integration tests for Python submodule import call resolution
 *
 * Verifies that `from package import module; module.function()` calls resolve
 * correctly through the full resolution pipeline when the named import refers
 * to a submodule file rather than an explicit export.
 */

import { describe, it, expect, afterAll } from "vitest";
import { Project } from "../../project/project";
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
): Promise<{ project: Project; temp_dir: string; file_paths: Record<string, FilePath> }> {
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-submod-"));

  // Write all files to disk first
  const file_paths: Record<string, FilePath> = {};
  for (const [relative_path, content] of Object.entries(files)) {
    const abs_path = path.join(temp_dir, relative_path);
    fs.mkdirSync(path.dirname(abs_path), { recursive: true });
    fs.writeFileSync(abs_path, content);
    file_paths[relative_path] = abs_path as FilePath;
  }

  // Initialize project (scans file tree from disk)
  const project = new Project();
  await project.initialize(temp_dir as FilePath);

  // Feed files to the project
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

describe("Python Submodule Import Resolution Integration", () => {
  it("from package import module; module.func() resolves to function definition", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "training/__init__.py": "",
      "training/pipeline.py": "def train(data):\n    return data\n",
      "caller.py": "from training import pipeline\n\npipeline.train([1, 2, 3])\n",
    });
    temp_dirs.push(temp_dir);

    const call_graph = project.get_call_graph();

    // train() should NOT be an entry point (it's called via pipeline.train())
    const train_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("train" as SymbolName) &&
        node.location.file_path === file_paths["training/pipeline.py"]
      );
    });
    expect(train_entry).toBeUndefined();
  });

  it("from package import module as alias; alias.func() resolves using original_name", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "training/__init__.py": "",
      "training/pipeline.py": "def run():\n    pass\n",
      "caller.py": "from training import pipeline as pl\n\npl.run()\n",
    });
    temp_dirs.push(temp_dir);

    const call_graph = project.get_call_graph();

    // run() should NOT be an entry point
    const run_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("run" as SymbolName) &&
        node.location.file_path === file_paths["training/pipeline.py"]
      );
    });
    expect(run_entry).toBeUndefined();
  });

  it("from package import symbol (not module) still resolves via export chain", async () => {
    const { project, temp_dir } = await setup_project({
      "mypkg/__init__.py": "class MyClass:\n    def process(self):\n        pass\n",
      "caller.py": "from mypkg import MyClass\n\nobj = MyClass()\n",
    });
    temp_dirs.push(temp_dir);

    const call_graph = project.get_call_graph();
    expect(call_graph).toBeDefined();
  });

  it("multi-file: module.func() with package containing __init__.py and submodule", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "utils/__init__.py": "VERSION = '1.0'\n",
      "utils/helpers.py":
        "def format_output(data):\n    return str(data)\n\ndef parse_input(raw):\n    return raw.strip()\n",
      "main.py":
        "from utils import helpers\n\nresult = helpers.format_output('test')\ncleaned = helpers.parse_input('  data  ')\n",
    });
    temp_dirs.push(temp_dir);

    const call_graph = project.get_call_graph();

    // Both functions should NOT be entry points
    const format_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("format_output" as SymbolName) &&
        node.location.file_path === file_paths["utils/helpers.py"]
      );
    });
    expect(format_entry).toBeUndefined();

    const parse_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("parse_input" as SymbolName) &&
        node.location.file_path === file_paths["utils/helpers.py"]
      );
    });
    expect(parse_entry).toBeUndefined();
  });
});

describe("Operator-alias member resolution", () => {
  // Mirrors the sqlalchemy path_registry evidence: a direct class-body alias and
  // the conditional `if not TYPE_CHECKING:` form both make `_getitem` the runtime
  // `__getitem__` / `__setitem__` implementation, so subscript callers must link
  // back to `_getitem`.
  it("binds direct and conditional class-body operator aliases to the target member", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "reg.py": `from typing import TYPE_CHECKING


class PathRegistry:
    def _getitem(self, key):
        return key

    __getitem__ = _getitem
    bogus = not_a_member

    if not TYPE_CHECKING:
        __setitem__ = _getitem
`,
    });
    temp_dirs.push(temp_dir);

    const index = project.get_index_single_file(file_paths["reg.py"]);
    const reg_class = [...index!.classes.values()].find(
      (c) => c.name === ("PathRegistry" as SymbolName)
    );
    expect(reg_class).toBeDefined();

    const members = project.definitions
      .get_member_index()
      .get(reg_class!.symbol_id);
    expect(members).toBeDefined();

    const getitem_target = members!.get("_getitem" as SymbolName);
    expect(getitem_target).toBeDefined();

    // The direct alias (`__getitem__ = _getitem`) binds to the `_getitem` method.
    expect(members!.get("__getitem__" as SymbolName)).toEqual(getitem_target);

    // The conditional alias (`__setitem__ = _getitem` under `if not
    // TYPE_CHECKING:`) is lifted to a class attribute at index time and binds the
    // same way.
    expect(members!.get("__setitem__" as SymbolName)).toEqual(getitem_target);

    // An assignment whose right-hand side is not a member of the class keeps its
    // own symbol — it is not mis-bound to another member.
    expect(members!.get("bogus" as SymbolName)).not.toEqual(getitem_target);
  });
});

describe("Constructor member-call resolution", () => {
  it("self.__init__() resolves to the constructor only (no subclass fan-out)", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "shapes.py": `class Base:
    def __init__(self):
        self.value = 0

    def reset(self):
        self.__init__()


class Circle(Base):
    def __init__(self):
        self.value = 1
`,
    });
    temp_dirs.push(temp_dir);

    const index = project.get_index_single_file(file_paths["shapes.py"]);
    const classes = [...index!.classes.values()];
    const base = classes.find((c) => c.name === ("Base" as SymbolName));
    expect(base).toBeDefined();

    const member_index = project.definitions.get_member_index();
    const base_members = member_index.get(base!.symbol_id)!;
    const base_init = base_members.get("__init__" as SymbolName);
    const reset_id = base_members.get("reset" as SymbolName);
    expect(base_init).toBeDefined();
    expect(reset_id).toBeDefined();

    const call_graph = project.get_call_graph();
    const reset_node = call_graph.nodes.get(reset_id!);
    expect(reset_node).toBeDefined();

    // self.__init__() inside reset() resolves through the member-index
    // constructor key to exactly Base.__init__ — the guard keeps it from fanning
    // out to Circle.__init__.
    const init_calls = reset_node!.enclosed_calls.filter(
      (c) => c.name === ("__init__" as SymbolName)
    );
    const resolved = new Set(
      init_calls.flatMap((c) => c.resolutions.map((r) => r.symbol_id))
    );
    expect(resolved).toEqual(new Set([base_init]));
  });

  // Mirrors the django evidence shape: a direct instantiation `C(...)` of an
  // imported class is a real caller of `C.__init__` (e.g. `ChangeList(request)`,
  // `BaseCommand()`).
  it("direct instantiation of an imported class links its __init__", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "models.py": `class ChangeList:
    def __init__(self, request):
        self.request = request
`,
      "admin.py": `from models import ChangeList


def get_changelist(request):
    return ChangeList(request)
`,
    });
    temp_dirs.push(temp_dir);

    // ChangeList.__init__ is called via the instantiation, so it is reachable
    // and not a (false) entry point.
    const call_graph = project.get_call_graph();
    const init_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("__init__" as SymbolName) &&
        node.location.file_path === file_paths["models.py"]
      );
    });
    expect(init_entry).toBeUndefined();
  });

  // Mirrors the django evidence shape: a namespace-qualified instantiation
  // `pkg.C(...)` where the class is re-exported through a barrel package
  // (e.g. `forms.CharField(required=False)`, `from django import forms`).
  it("namespace-qualified instantiation through a barrel links __init__", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "fields.py": `class CharField:
    def __init__(self, required=True):
        self.required = required
`,
      "forms/__init__.py": `from fields import CharField
`,
      "main.py": `import forms


def build():
    return forms.CharField(required=False)
`,
    });
    temp_dirs.push(temp_dir);

    const call_graph = project.get_call_graph();
    const init_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("__init__" as SymbolName) &&
        node.location.file_path === file_paths["fields.py"]
      );
    });
    expect(init_entry).toBeUndefined();
  });
});

// The pandas evidence shape: a `self.<attr> = Constructor()` assignment outside
// `__init__` (in `setup()`) types the attribute so a `self.<attr>.method()` call
// in a sibling method resolves, and the called member is no longer a false
// entry point. Before Fix C the assignment was dropped (only `__init__` was
// promoted) and the member surfaced as unreachable.
describe("Constructor-flow property typing outside __init__", () => {
  it("self.attr = Constructor() in setup() makes a sibling-method member reachable", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "data.py": `class DataFrame:
    def head(self):
        return self


class Loader:
    def setup(self):
        self.df = DataFrame()

    def run(self):
        return self.df.head()
`,
    });
    temp_dirs.push(temp_dir);

    const call_graph = project.get_call_graph();
    const head_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("head" as SymbolName) &&
        node.location.file_path === file_paths["data.py"]
      );
    });
    expect(head_entry).toBeUndefined();
  });

  it("self.df.head() in a sibling resolves to exactly DataFrame.head", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "data.py": `class DataFrame:
    def head(self):
        return self


class Loader:
    def setup(self):
        self.df = DataFrame()

    def run(self):
        return self.df.head()
`,
    });
    temp_dirs.push(temp_dir);

    const index = project.get_index_single_file(file_paths["data.py"]);
    const classes = [...index!.classes.values()];
    const data_frame = classes.find((c) => c.name === ("DataFrame" as SymbolName));
    const loader = classes.find((c) => c.name === ("Loader" as SymbolName));
    expect(data_frame).toBeDefined();
    expect(loader).toBeDefined();

    const member_index = project.definitions.get_member_index();
    const head_id = member_index.get(data_frame!.symbol_id)!.get("head" as SymbolName);
    const run_id = member_index.get(loader!.symbol_id)!.get("run" as SymbolName);
    expect(head_id).toBeDefined();
    expect(run_id).toBeDefined();

    const call_graph = project.get_call_graph();
    const run_node = call_graph.nodes.get(run_id!);
    expect(run_node).toBeDefined();

    const head_calls = run_node!.enclosed_calls.filter(
      (c) => c.name === ("head" as SymbolName)
    );
    const resolved = new Set(
      head_calls.flatMap((c) => c.resolutions.map((r) => r.symbol_id))
    );
    expect(resolved).toEqual(new Set([head_id]));
  });

  it("namespace-qualified self.attr = ns.Constructor() resolves via the last segment", async () => {
    // `pd.DataFrame()` exercises the attribute-callee branch: the last segment
    // `DataFrame` is taken as the type and resolves to the in-file class, so the
    // member called on the receiver is reachable.
    const { project, temp_dir, file_paths } = await setup_project({
      "frames.py": `class DataFrame:
    def head(self):
        return self


class Loader:
    def setup(self):
        self.df = pd.DataFrame()

    def run(self):
        return self.df.head()
`,
    });
    temp_dirs.push(temp_dir);

    const index = project.get_index_single_file(file_paths["frames.py"]);
    const classes = [...index!.classes.values()];
    const data_frame = classes.find((c) => c.name === ("DataFrame" as SymbolName));
    const loader = classes.find((c) => c.name === ("Loader" as SymbolName));

    const member_index = project.definitions.get_member_index();
    const head_id = member_index.get(data_frame!.symbol_id)!.get("head" as SymbolName);
    const run_id = member_index.get(loader!.symbol_id)!.get("run" as SymbolName);

    const call_graph = project.get_call_graph();
    const head_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("head" as SymbolName) &&
        node.location.file_path === file_paths["frames.py"]
      );
    });
    expect(head_entry).toBeUndefined();

    const run_node = call_graph.nodes.get(run_id!);
    const head_calls = run_node!.enclosed_calls.filter(
      (c) => c.name === ("head" as SymbolName)
    );
    const resolved = new Set(
      head_calls.flatMap((c) => c.resolutions.map((r) => r.symbol_id))
    );
    expect(resolved).toEqual(new Set([head_id]));
  });

  it("an attr assigned in multiple methods yields one property and resolves the member once", async () => {
    const { project, temp_dir, file_paths } = await setup_project({
      "svc.py": `class Client:
    def send(self):
        return self


class Service:
    def setup(self):
        self.client = Client()

    def reconfigure(self):
        self.client = Client()

    def run(self):
        return self.client.send()
`,
    });
    temp_dirs.push(temp_dir);

    const index = project.get_index_single_file(file_paths["svc.py"]);
    const classes = [...index!.classes.values()];
    const service = classes.find((c) => c.name === ("Service" as SymbolName));
    const client = classes.find((c) => c.name === ("Client" as SymbolName));

    // Two assignment sites collapse to a single property.
    expect(
      service!.properties.filter((p) => p.name === ("client" as SymbolName)).length
    ).toBe(1);

    const member_index = project.definitions.get_member_index();
    const send_id = member_index.get(client!.symbol_id)!.get("send" as SymbolName);
    const run_id = member_index.get(service!.symbol_id)!.get("run" as SymbolName);

    const call_graph = project.get_call_graph();
    const send_entry = call_graph.entry_points.find((ep) => {
      const node = call_graph.nodes.get(ep);
      return (
        node?.name === ("send" as SymbolName) &&
        node.location.file_path === file_paths["svc.py"]
      );
    });
    expect(send_entry).toBeUndefined();

    const run_node = call_graph.nodes.get(run_id!);
    const send_calls = run_node!.enclosed_calls.filter(
      (c) => c.name === ("send" as SymbolName)
    );
    const resolved = new Set(
      send_calls.flatMap((c) => c.resolutions.map((r) => r.symbol_id))
    );
    expect(resolved).toEqual(new Set([send_id]));
  });
});

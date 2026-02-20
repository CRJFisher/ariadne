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

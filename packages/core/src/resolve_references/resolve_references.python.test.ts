/**
 * Python multi-file integration tests for resolve_references
 *
 * Verifies cross-file import resolution and call detection through the full
 * pipeline using real files in temp directories.
 */

import { describe, it, expect, afterAll } from "vitest";
import { Project } from "../project/project";
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
});

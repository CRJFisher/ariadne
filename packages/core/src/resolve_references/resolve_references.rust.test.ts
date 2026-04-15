/**
 * Rust multi-file integration tests for resolve_references
 *
 * Verifies cross-file mod/use resolution and call detection through the full
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
 */
async function setup_project(
  files: Record<string, string>
): Promise<{
  project: Project;
  temp_dir: string;
  file_paths: Record<string, FilePath>;
}> {
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-rs-resolve-"));

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

describe("Rust Multi-File Resolve References Integration", () => {
  describe("cross-file use + function call", () => {
    it("should resolve use import function call across files", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod utils;

use utils::format_name;

pub fn greet(name: &str) -> String {
    format_name(name)
}
`,
        "utils.rs": `pub fn format_name(name: &str) -> String {
    name.to_uppercase()
}
`,
      });
      temp_dirs.push(temp_dir);

      const call_graph = project.get_call_graph();

      // format_name should NOT be an entry point (it's called from lib.rs)
      const format_entry = call_graph.entry_points.find((ep) => {
        const node = call_graph.nodes.get(ep);
        return (
          node?.name === ("format_name" as SymbolName) &&
          node.location.file_path === file_paths["utils.rs"]
        );
      });
      expect(format_entry).toBeUndefined();
    });

    it("should resolve multiple use imports from the same module", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod math;

use math::add;
use math::multiply;

pub fn compute(x: i32, y: i32) -> i32 {
    add(x, y) + multiply(x, y)
}
`,
        "math.rs": `pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

pub fn multiply(a: i32, b: i32) -> i32 {
    a * b
}
`,
      });
      temp_dirs.push(temp_dir);

      const call_graph = project.get_call_graph();

      for (const fn_name of ["add", "multiply"]) {
        const entry = call_graph.entry_points.find((ep) => {
          const node = call_graph.nodes.get(ep);
          return (
            node?.name === (fn_name as SymbolName) &&
            node.location.file_path === file_paths["math.rs"]
          );
        });
        expect(entry).toBeUndefined();
      }
    });
  });

  describe("cross-file struct with impl", () => {
    it("should resolve struct and methods imported from another file", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod models;

use models::User;

pub fn create_user(name: &str) -> User {
    User::new(name)
}
`,
        "models.rs": `pub struct User {
    name: String,
}

impl User {
    pub fn new(name: &str) -> Self {
        User { name: name.to_string() }
    }

    pub fn greet(&self) -> String {
        format!("Hi, {}", self.name)
    }
}
`,
      });
      temp_dirs.push(temp_dir);

      // Verify name resolution resolves User in lib.rs
      const lib_scope = project.scopes.get_file_root_scope(file_paths["lib.rs"]);
      expect(lib_scope).toBeDefined();

      const resolved_user = project.resolutions.resolve(
        lib_scope!.id,
        "User" as SymbolName
      );
      expect(resolved_user).not.toBeNull();
      expect(resolved_user).toContain("User");
    });
  });

  describe("cross-file mod.rs directory modules", () => {
    it("should resolve imports from mod.rs-based module directories", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "main.rs": `mod utils;

use utils::helper;

pub fn run() -> i32 {
    helper(5)
}
`,
        "utils/mod.rs": `pub fn helper(x: i32) -> i32 {
    x + 1
}
`,
      });
      temp_dirs.push(temp_dir);

      const call_graph = project.get_call_graph();

      const helper_entry = call_graph.entry_points.find((ep) => {
        const node = call_graph.nodes.get(ep);
        return (
          node?.name === ("helper" as SymbolName) &&
          node.location.file_path === file_paths["utils/mod.rs"]
        );
      });
      expect(helper_entry).toBeUndefined();
    });
  });

  describe("struct literal with qualified path", () => {
    it("should resolve struct method after struct literal with scoped type (models::User { ... })", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod models;

use models::User;

pub fn create_user() -> String {
    let user = models::User { name: String::from("Alice") };
    user.greet()
}
`,
        "models.rs": `pub struct User {
    pub name: String,
}

impl User {
    pub fn greet(&self) -> String {
        format!("Hello, {}", self.name)
    }
}
`,
      });
      temp_dirs.push(temp_dir);

      const call_graph = project.get_call_graph();

      // greet() should NOT be an entry point — user.greet() resolves via struct literal type binding
      const greet_entry = call_graph.entry_points.find((ep) => {
        const node = call_graph.nodes.get(ep);
        return (
          node?.name === ("greet" as SymbolName) &&
          node.location.file_path === file_paths["models.rs"]
        );
      });
      expect(greet_entry).toBeUndefined();
    });
  });

  describe("cross-file self.method() in impl", () => {
    it("should resolve self.method() calls within impl blocks across files", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod counter;
`,
        "counter.rs": `pub struct Counter {
    count: i32,
}

impl Counter {
    pub fn new() -> Self {
        Counter { count: 0 }
    }

    pub fn increment(&mut self) {
        self.set_count(self.count + 1);
    }

    fn set_count(&mut self, value: i32) {
        self.count = value;
    }
}
`,
      });
      temp_dirs.push(temp_dir);

      // Verify type info and self-reference resolution
      const counter_index = project.get_index_single_file(file_paths["counter.rs"]);
      expect(counter_index).toBeDefined();

      const counter_struct = Array.from(counter_index!.classes.values()).find(
        (c) => c.name === ("Counter" as SymbolName)
      );
      expect(counter_struct).toBeDefined();

      const type_info = project.get_type_info(counter_struct!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("set_count" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("increment" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("new" as SymbolName)).toBe(true);

      // set_count should be referenced via self.set_count() in increment
      const referenced = project.resolutions.get_all_referenced_symbols();
      const set_count_id = type_info!.methods.get("set_count" as SymbolName);
      expect(set_count_id).toBeDefined();
      expect(referenced.has(set_count_id!)).toBe(true);
    });
  });
});

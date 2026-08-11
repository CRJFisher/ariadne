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

  describe("crate-path single-hop named import of a non-pub item", () => {
    it("resolves use crate::helpers::format_value to its private definition via the widened lookup", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod helpers;

use crate::helpers::format_value;

pub fn run(x: i32) -> i32 {
    format_value(x)
}
`,
        // Non-pub item: is_exported=false, so it never enters the export
        // registry — only the explicit-named-import fallback binds it.
        "helpers.rs": `fn format_value(x: i32) -> i32 {
    x + 1
}
`,
      });
      temp_dirs.push(temp_dir);

      const call_graph = project.get_call_graph();

      const run_node = [...call_graph.nodes.values()].find(
        (node) =>
          node.name === ("run" as SymbolName) &&
          node.location.file_path === file_paths["lib.rs"]
      );
      expect(run_node).not.toBeUndefined();

      const call = run_node!.enclosed_calls.find(
        (c) => c.name === ("format_value" as SymbolName)
      );
      expect(call).not.toBeUndefined();
      expect(call!.resolution_failure).toBeUndefined();
      const target = call_graph.nodes.get(call!.resolutions[0].symbol_id);
      expect(target?.location.file_path).toEqual(file_paths["helpers.rs"]);
      expect(target?.name).toEqual("format_value" as SymbolName);

      const entry = call_graph.entry_points.find((ep) => {
        const node = call_graph.nodes.get(ep);
        return (
          node?.name === ("format_value" as SymbolName) &&
          node.location.file_path === file_paths["helpers.rs"]
        );
      });
      expect(entry).toBeUndefined();
    });
  });

  // Same-file binding gaps (task-349.3, Change C): a self-initializer must not
  // shadow its own import, and a function declared in a nested block must hoist
  // to sibling scopes that lexically reach it.
  describe("same-file binding gaps", () => {
    it("resolves a self-initializer call to the import, not the local binding", async () => {
      // serde struct_.rs:67 shape — `let has_flatten = has_flatten(fields)`.
      // The binding is not yet live while its initializer runs, so the call
      // resolves to the imported function.
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod helpers;
use helpers::has_flatten;

pub fn build(fields: &[u8]) -> bool {
    let has_flatten = has_flatten(fields);
    has_flatten
}
`,
        "helpers.rs": `pub fn has_flatten(fields: &[u8]) -> bool {
    !fields.is_empty()
}
`,
      });
      temp_dirs.push(temp_dir);

      const imported_fn = project.definitions
        .get_definitions_by_name("has_flatten" as SymbolName)
        .find((def) => def.location.file_path === file_paths["helpers.rs"]);
      expect(imported_fn).not.toBeUndefined();

      const call = project.resolutions
        .get_calls_for_file(file_paths["lib.rs"])
        .find((c) => c.name === ("has_flatten" as SymbolName));
      expect(call!.resolution_failure).toBeUndefined();
      expect(call!.resolutions.map((r) => r.symbol_id)).toEqual([
        imported_fn!.symbol_id,
      ]);

      // The imported function is now reached by the call, so it is not an
      // unreachable entry point.
      const entry = project
        .get_call_graph()
        .entry_points.find((ep) => ep === imported_fn!.symbol_id);
      expect(entry).toBeUndefined();
    });

    it("keeps a non-self-initializer local binding shadowing its import", async () => {
      // Negative control: `let tally = compute_len(items)` shadows the import
      // `tally`, but its initializer does not call `tally`, so ordinary lexical
      // shadowing stands — the name resolves to the local binding.
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod helpers;
use helpers::tally;

pub fn build(items: &[u8]) -> usize {
    let tally = compute_len(items);
    tally + 1
}

fn compute_len(items: &[u8]) -> usize {
    items.len()
}
`,
        "helpers.rs": `pub fn tally(items: &[u8]) -> usize {
    items.len()
}
`,
      });
      temp_dirs.push(temp_dir);

      const local_tally = project.definitions
        .get_definitions_by_name("tally" as SymbolName)
        .find(
          (def) =>
            def.kind === "variable" &&
            def.location.file_path === file_paths["lib.rs"]
        );
      expect(local_tally).not.toBeUndefined();

      const resolved = project.resolutions.resolve(
        local_tally!.defining_scope_id,
        "tally" as SymbolName
      );
      expect(resolved).toEqual(local_tally!.symbol_id);
    });

    it("resolves a call to a function declared in a sibling inner block", async () => {
      // serde content_as_str shape — a `fn` declared in a nested block is
      // reachable from a sibling statement in the same body. Without hoisting
      // the call would fail with `name_not_in_scope`.
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `pub fn outer(cond: bool) -> i32 {
    let v = { content_as_str() };
    if cond {
        fn content_as_str() -> i32 { 1 }
    }
    v
}
`,
      });
      temp_dirs.push(temp_dir);

      const nested_fn = project.definitions
        .get_definitions_by_name("content_as_str" as SymbolName)
        .find((def) => def.location.file_path === file_paths["lib.rs"]);
      expect(nested_fn).not.toBeUndefined();

      const call = project.resolutions
        .get_calls_for_file(file_paths["lib.rs"])
        .find((c) => c.name === ("content_as_str" as SymbolName));
      expect(call!.resolution_failure).toBeUndefined();
      expect(call!.resolutions.map((r) => r.symbol_id)).toEqual([
        nested_fn!.symbol_id,
      ]);

      const entry = project
        .get_call_graph()
        .entry_points.find((ep) => ep === nested_fn!.symbol_id);
      expect(entry).toBeUndefined();
    });
  });

  describe("cross-file super::super import", () => {
    it("resolves a call through a use super::super:: import two module levels up", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod a;
mod helpers;
`,
        "a.rs": `pub mod b;
`,
        "a/b.rs": `use super::super::helpers::compute;

pub fn run() -> i32 {
    compute(3)
}
`,
        "helpers.rs": `pub fn compute(x: i32) -> i32 {
    x * 2
}
`,
      });
      temp_dirs.push(temp_dir);

      const compute_def = project.definitions
        .get_definitions_by_name("compute" as SymbolName)
        .find((def) => def.location.file_path === file_paths["helpers.rs"]);
      expect(compute_def).not.toBeUndefined();

      const call = project.resolutions
        .get_calls_for_file(file_paths["a/b.rs"])
        .find((c) => c.name === ("compute" as SymbolName));
      expect(call!.resolution_failure).toBeUndefined();
      expect(call!.resolutions.map((r) => r.symbol_id)).toEqual([
        compute_def!.symbol_id,
      ]);
    });
  });

  describe("cross-file self group member import", () => {
    it("binds the group module via self and resolves the sibling item's call", async () => {
      // consumer.rs has no `mod` declaration for utils, so the name `utils`
      // can only enter its scope through the `self` group member.
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod a;
mod consumer;
`,
        "a.rs": `pub mod utils;
`,
        "a/utils.rs": `pub fn helper(x: i32) -> i32 {
    x + 1
}
`,
        "consumer.rs": `use a::utils::{self, helper};

pub fn run() -> i32 {
    helper(5)
}
`,
      });
      temp_dirs.push(temp_dir);

      const utils_mod_def = project.definitions
        .get_definitions_by_name("utils" as SymbolName)
        .find((def) => def.location.file_path === file_paths["a.rs"]);
      expect(utils_mod_def).not.toBeUndefined();

      const consumer_scope = project.scopes.get_file_root_scope(
        file_paths["consumer.rs"]
      );
      const resolved_utils = project.resolutions.resolve(
        consumer_scope!.id,
        "utils" as SymbolName
      );
      expect(resolved_utils).toEqual(utils_mod_def!.symbol_id);

      const helper_def = project.definitions
        .get_definitions_by_name("helper" as SymbolName)
        .find((def) => def.location.file_path === file_paths["a/utils.rs"]);
      expect(helper_def).not.toBeUndefined();

      const call = project.resolutions
        .get_calls_for_file(file_paths["consumer.rs"])
        .find((c) => c.name === ("helper" as SymbolName));
      expect(call!.resolution_failure).toBeUndefined();
      expect(call!.resolutions.map((r) => r.symbol_id)).toEqual([
        helper_def!.symbol_id,
      ]);
    });
  });

  describe("glob and pub use re-export edges", () => {
    function expect_rust_call_resolves_to(
      project: Project,
      caller_file: FilePath,
      call_name: string,
      target_file: FilePath
    ): void {
      const target_def = project.definitions
        .get_definitions_by_name(call_name as SymbolName)
        .find(
          (def) =>
            def.location.file_path === target_file && def.kind !== "import"
        );
      expect(target_def).not.toBeUndefined();

      const call = project.resolutions
        .get_calls_for_file(caller_file)
        .find((c) => c.name === (call_name as SymbolName));
      expect(call).toBeDefined();
      expect(call!.resolution_failure).toBeUndefined();
      expect(call!.resolutions.map((r) => r.symbol_id)).toEqual([
        target_def!.symbol_id,
      ]);
    }

    it("binds a name reached through an intra-crate glob import", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `pub mod transaction;
pub mod postgres;
`,
        "src/transaction.rs": `pub fn begin_ansi_transaction_sql(depth: usize) -> String {
    format!("BEGIN {}", depth)
}
`,
        "src/postgres.rs": `use crate::transaction::*;

pub fn begin(depth: usize) -> String {
    begin_ansi_transaction_sql(depth)
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/postgres.rs"],
        "begin_ansi_transaction_sql",
        file_paths["src/transaction.rs"]
      );
    });

    it("binds the same glob name in a second module of the crate", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `pub mod transaction;
pub mod postgres;
pub mod mysql;
`,
        "src/transaction.rs": `pub fn begin_ansi_transaction_sql(depth: usize) -> String {
    format!("BEGIN {}", depth)
}
`,
        "src/postgres.rs": `use crate::transaction::*;

pub fn begin(depth: usize) -> String {
    begin_ansi_transaction_sql(depth)
}
`,
        "src/mysql.rs": `use crate::transaction::*;

pub fn begin(depth: usize) -> String {
    begin_ansi_transaction_sql(depth)
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/postgres.rs"],
        "begin_ansi_transaction_sql",
        file_paths["src/transaction.rs"]
      );
      expect_rust_call_resolves_to(
        project,
        file_paths["src/mysql.rs"],
        "begin_ansi_transaction_sql",
        file_paths["src/transaction.rs"]
      );
    });

    it("does not surface a private item through a glob import", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `pub mod transaction;
pub mod postgres;
`,
        "src/transaction.rs": `pub fn public_helper() -> usize {
    private_helper()
}

fn private_helper() -> usize {
    1
}
`,
        "src/postgres.rs": `use crate::transaction::*;

pub fn run() -> usize {
    private_helper()
}
`,
      });
      temp_dirs.push(temp_dir);

      const call = project.resolutions
        .get_calls_for_file(file_paths["src/postgres.rs"])
        .find((c) => c.name === ("private_helper" as SymbolName));
      expect(call).toBeDefined();
      expect(call!.resolutions.length).toEqual(0);
    });

    it("resolves a named import through one pub use hop", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `pub mod api;
pub mod deep;
pub mod app;
`,
        "src/deep.rs": `pub fn helper(x: i32) -> i32 {
    x + 1
}
`,
        "src/api.rs": `pub use crate::deep::helper;
`,
        "src/app.rs": `use crate::api::helper;

pub fn run() -> i32 {
    helper(1)
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/app.rs"],
        "helper",
        file_paths["src/deep.rs"]
      );
    });

    it("resolves a named import through two chained pub use hops", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `pub mod api;
pub mod mid;
pub mod deep;
pub mod app;
`,
        "src/deep.rs": `pub fn helper2(x: i32) -> i32 {
    x + 2
}
`,
        "src/mid.rs": `pub use crate::deep::helper2;
`,
        "src/api.rs": `pub use crate::mid::helper2;
`,
        "src/app.rs": `use crate::api::helper2;

pub fn run2() -> i32 {
    helper2(1)
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/app.rs"],
        "helper2",
        file_paths["src/deep.rs"]
      );
    });

    it("binds a name reached through a pub use glob re-export", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `pub mod inner;
pub mod facade;
pub mod app;
`,
        "src/inner.rs": `pub fn facade_fn(x: i32) -> i32 {
    x * 2
}
`,
        "src/facade.rs": `pub use crate::inner::*;
`,
        "src/app.rs": `use crate::facade::facade_fn;

pub fn run3() -> i32 {
    facade_fn(2)
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/app.rs"],
        "facade_fn",
        file_paths["src/inner.rs"]
      );
    });
  });
});

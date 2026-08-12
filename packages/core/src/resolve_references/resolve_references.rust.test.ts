/**
 * Rust multi-file integration tests for resolve_references
 *
 * Verifies cross-file mod/use resolution and call detection through the full
 * pipeline using real files in temp directories.
 */

import { describe, it, expect, afterAll } from "vitest";
import { Project } from "../project/project";
import { load_project } from "../project/load_project";
import type { FilePath, SymbolName } from "@ariadnejs/types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Write a crate layout to a fresh temp directory without indexing it, for the
 * cases that need the real loader rather than a hand-driven `update_file`.
 */
function write_files(files: Record<string, string>): {
  temp_dir: string;
  file_paths: Record<string, FilePath>;
} {
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-rs-resolve-"));

  const file_paths: Record<string, FilePath> = {};
  for (const [relative_path, content] of Object.entries(files)) {
    const abs_path = path.join(temp_dir, relative_path);
    fs.mkdirSync(path.dirname(abs_path), { recursive: true });
    fs.writeFileSync(abs_path, content);
    file_paths[relative_path] = abs_path as FilePath;
  }

  return { temp_dir, file_paths };
}

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
  const { temp_dir, file_paths } = write_files(files);

  const project = new Project();
  await project.initialize(temp_dir as FilePath);

  // Manifests belong on disk for the specifier index to read, but only source
  // files are indexed — the same split the real loader makes.
  for (const [relative_path, content] of Object.entries(files)) {
    if (relative_path.endsWith(".rs")) {
      project.update_file(file_paths[relative_path], content);
    }
  }

  return { project, temp_dir, file_paths };
}

/**
 * Assert a named call in `caller_file` resolves to the sole definition of that
 * name in `target_file`.
 */
function expect_rust_call_resolves_to(
  project: Project,
  caller_file: FilePath,
  call_name: string,
  target_file: FilePath
): void {
  const target_def = project.definitions
    .get_definitions_by_name(call_name as SymbolName)
    .find(
      (def) => def.location.file_path === target_file && def.kind !== "import"
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

/**
 * Assert a named call in `caller_file` binds to nothing — the shape the path
 * resolver must leave alone rather than fabricate an edge for.
 */
function expect_rust_call_unresolved(
  project: Project,
  caller_file: FilePath,
  call_name: string
): void {
  const call = project.resolutions
    .get_calls_for_file(caller_file)
    .find((c) => c.name === (call_name as SymbolName));
  expect(call).toBeDefined();
  expect(call!.resolutions).toEqual([]);
  expect(call!.resolution_failure?.reason).toEqual("name_not_in_scope");
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

    it("keeps the crate root and its mod edges when cfg arms re-export one name twice", async () => {
      // Two cfg arms publishing `Handle` are legal Rust, not an indexing bug.
      // Treating them as a duplicate export throws mid-index and the loader
      // drops src/lib.rs, taking the crate root's whole published surface —
      // its `mod` declarations and its re-exports — out of the corpus.
      const { temp_dir, file_paths } = write_files({
        "src/lib.rs": `pub mod unix_impl;
pub mod windows_impl;
pub mod unix_app;
pub mod windows_app;
pub mod root_app;

#[cfg(unix)]
pub use crate::unix_impl::Handle;
#[cfg(windows)]
pub use crate::windows_impl::Handle;
`,
        "src/unix_impl.rs": `pub struct Handle;

impl Handle {
    pub fn open() -> i32 {
        1
    }
}
`,
        "src/windows_impl.rs": `pub struct Handle;

impl Handle {
    pub fn open() -> i32 {
        2
    }
}
`,
        "src/unix_app.rs": `use crate::unix_impl::Handle;

pub fn run_unix() -> i32 {
    Handle::open()
}
`,
        "src/windows_app.rs": `use crate::windows_impl::Handle;

pub fn run_windows() -> i32 {
    Handle::open()
}
`,
        "src/root_app.rs": `use crate::Handle;

pub fn run_root() -> i32 {
    Handle::open()
}
`,
      });
      temp_dirs.push(temp_dir);

      const { project, dropped_files } = await load_project({
        project_path: temp_dir,
      });

      expect([...dropped_files]).toEqual([]);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/unix_app.rs"],
        "open",
        file_paths["src/unix_impl.rs"]
      );
      expect_rust_call_resolves_to(
        project,
        file_paths["src/windows_app.rs"],
        "open",
        file_paths["src/windows_impl.rs"]
      );
      // The crate-root surface is reachable only through src/lib.rs, and the
      // first cfg arm is the record that wins there.
      expect_rust_call_resolves_to(
        project,
        file_paths["src/root_app.rs"],
        "open",
        file_paths["src/unix_impl.rs"]
      );
    });

    it("does not leak a nested mod's pub use glob onto the file surface", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `pub mod leaf;
pub mod other;
pub mod consumer;
`,
        "src/leaf.rs": `pub fn leaf_fn() -> i32 {
    1
}
`,
        "src/other.rs": `pub mod inner {
    pub use crate::leaf::*;
}

pub fn other_fn() -> i32 {
    2
}
`,
        "src/consumer.rs": `use crate::other::*;

pub fn caller() -> i32 {
    leaf_fn() + other_fn()
}
`,
      });
      temp_dirs.push(temp_dir);

      const consumer_scope = project.scopes.get_file_root_scope(
        file_paths["src/consumer.rs"]
      );
      expect(
        project.resolutions.resolve(consumer_scope!.id, "other_fn" as SymbolName)
      ).not.toBeNull();
      // leaf_fn is only reachable as crate::other::inner::leaf_fn; the file
      // glob must not surface it.
      expect(
        project.resolutions.resolve(consumer_scope!.id, "leaf_fn" as SymbolName)
      ).toBeNull();
    });

    it("does not forward a private glob to consumers of the file", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `pub mod inner;
pub mod facade;
pub mod app;
`,
        "src/inner.rs": `pub fn hidden_fn(x: i32) -> i32 {
    x * 2
}
`,
        "src/facade.rs": `use crate::inner::*;

pub fn facade_public() -> i32 {
    hidden_fn(1)
}
`,
        "src/app.rs": `use crate::facade::*;

pub fn run4() -> i32 {
    hidden_fn(2)
}
`,
      });
      temp_dirs.push(temp_dir);

      // facade.rs itself binds hidden_fn through its private glob…
      const facade_scope = project.scopes.get_file_root_scope(
        file_paths["src/facade.rs"]
      );
      expect(
        project.resolutions.resolve(facade_scope!.id, "hidden_fn" as SymbolName)
      ).not.toBeNull();

      // …but a private `use` forwards nothing, so app.rs must not see it.
      const app_scope = project.scopes.get_file_root_scope(
        file_paths["src/app.rs"]
      );
      expect(
        project.resolutions.resolve(app_scope!.id, "hidden_fn" as SymbolName)
      ).toBeNull();
    });

    it("resolves a cross-crate item through the workspace crate index", async () => {
      // sqlx: `use sqlx_core::raw_sql::raw_sql;` from sqlx-postgres, where the
      // crate directory spells its name with a dash.
      const { project, temp_dir, file_paths } = await setup_project({
        "sqlx-core/Cargo.toml": "[package]\nname = \"sqlx-core\"\n",
        "sqlx-core/src/lib.rs": `pub mod raw_sql;
`,
        "sqlx-core/src/raw_sql.rs": `pub fn raw_sql(sql: &str) -> usize {
    sql.len()
}
`,
        "sqlx-postgres/Cargo.toml": "[package]\nname = \"sqlx-postgres\"\n",
        "sqlx-postgres/src/lib.rs": `pub mod connection;
`,
        "sqlx-postgres/src/connection.rs": `use sqlx_core::raw_sql::raw_sql;

pub fn run() -> usize {
    raw_sql("SELECT 1")
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["sqlx-postgres/src/connection.rs"],
        "raw_sql",
        file_paths["sqlx-core/src/raw_sql.rs"]
      );
    });

    it("resolves a cross-crate item through a crate-visible glob re-export", async () => {
      // sqlx: `pub(crate) use sqlx_core::transaction::*;` in sqlx-mysql, whose
      // TransactionManager then calls the ANSI SQL builders by bare name.
      const { project, temp_dir, file_paths } = await setup_project({
        "sqlx-core/Cargo.toml": "[package]\nname = \"sqlx-core\"\n",
        "sqlx-core/src/lib.rs": `pub mod transaction;
`,
        "sqlx-core/src/transaction.rs": `pub fn rollback_ansi_transaction_sql(depth: usize) -> String {
    format!("ROLLBACK {}", depth)
}
`,
        "sqlx-mysql/Cargo.toml": "[package]\nname = \"sqlx-mysql\"\n",
        "sqlx-mysql/src/lib.rs": `pub mod transaction;
`,
        "sqlx-mysql/src/transaction.rs": `pub(crate) use sqlx_core::transaction::*;

pub fn rollback(depth: usize) -> String {
    rollback_ansi_transaction_sql(depth)
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["sqlx-mysql/src/transaction.rs"],
        "rollback_ansi_transaction_sql",
        file_paths["sqlx-core/src/transaction.rs"]
      );
    });

    it("binds a cross-crate glob through the workspace crate index", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "other-crate/Cargo.toml": "[package]\nname = \"other-crate\"\n",
        "other-crate/src/lib.rs": `pub mod m;
`,
        "other-crate/src/m.rs": `pub fn shared_fn() -> i32 {
    7
}
`,
        "consumer/Cargo.toml": "[package]\nname = \"consumer\"\n",
        "consumer/src/lib.rs": `use other_crate::m::*;

pub fn run() -> i32 {
    shared_fn()
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["consumer/src/lib.rs"],
        "shared_fn",
        file_paths["other-crate/src/m.rs"]
      );
    });

    it("leaves a genuinely external crate opaque", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `use serde_json::to_string;

pub fn run() -> String {
    to_string("x")
}
`,
      });
      temp_dirs.push(temp_dir);

      const call = project.resolutions
        .get_calls_for_file(file_paths["src/lib.rs"])
        .find((c) => c.name === ("to_string" as SymbolName));
      expect(call).toBeDefined();
      expect(call!.resolutions.length).toEqual(0);
    });

    it("resolves a crate-root item imported with use crate::Item", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `pub mod other;
pub mod inner;

pub struct S;

impl S {
    pub fn assoc() -> i32 {
        4
    }
}
`,
        "src/inner.rs": `pub struct T;

impl T {
    pub fn make() -> i32 {
        5
    }
}
`,
        "src/other.rs": `use crate::S;
use crate::inner::T;

pub fn run() -> i32 {
    S::assoc() + T::make()
}
`,
      });
      temp_dirs.push(temp_dir);

      // The crate-root item and the sibling control both resolve.
      expect_rust_call_resolves_to(
        project,
        file_paths["src/other.rs"],
        "assoc",
        file_paths["src/lib.rs"]
      );
      expect_rust_call_resolves_to(
        project,
        file_paths["src/other.rs"],
        "make",
        file_paths["src/inner.rs"]
      );
    });

    it("resolves a braced crate-root group import", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `pub mod path;

pub struct Item;

impl Item {
    pub fn build() -> i32 {
        6
    }
}
`,
        "src/path.rs": `use crate::{Item};

pub fn run() -> i32 {
    Item::build()
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/path.rs"],
        "build",
        file_paths["src/lib.rs"]
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

  // A `mod x;` declaration names the file that backs the module. The path
  // resolver reaches into that file, so a `::`-qualified call resolves without
  // the module ever being bound as an in-file `mod x { … }` block.
  describe("file-backed mod path resolution", () => {
    it("records the module file as a dependency and re-resolves its declarer when it changes", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod config;

pub fn run() -> i32 {
    config::build()
}
`,
        "config.rs": `pub fn build() -> i32 {
    1
}
`,
      });
      temp_dirs.push(temp_dir);

      expect([...project.imports.get_dependents(file_paths["config.rs"])]).toEqual([
        file_paths["lib.rs"],
      ]);

      // The rewritten module moves `build` down a line, so its symbol id
      // changes: the lib.rs call site can only carry the new id if editing the
      // module re-resolved its declarer.
      project.update_file(
        file_paths["config.rs"],
        `
pub fn build() -> i32 {
    2
}
`
      );

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "build",
        file_paths["config.rs"]
      );
    });

    it("resolves a bare module-qualified call to the mod's file", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod config;

pub fn run() -> i32 {
    config::build()
}
`,
        "config.rs": `pub fn build() -> i32 {
    1
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "build",
        file_paths["config.rs"]
      );
    });

    it("resolves a crate-anchored module-qualified call", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod intrinsic;

pub fn run() -> i32 {
    crate::intrinsic::check()
}
`,
        "intrinsic.rs": `pub fn check() -> i32 {
    1
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "check",
        file_paths["intrinsic.rs"]
      );
    });

    it("resolves a self-anchored module-qualified call", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod config;

pub fn run() -> i32 {
    self::config::build()
}
`,
        "config.rs": `pub fn build() -> i32 {
    1
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "build",
        file_paths["config.rs"]
      );
    });

    it("resolves a call qualified by a module brought in with use", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod config;

use crate::config;

pub fn run() -> i32 {
    config::build()
}
`,
        "config.rs": `pub fn build() -> i32 {
    1
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "build",
        file_paths["config.rs"]
      );
    });

    it("resolves a two-hop path through a 2018-style module directory", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod deep;

pub fn run() -> i32 {
    crate::deep::inner::deep_fn()
}
`,
        "deep.rs": `pub mod inner;
`,
        "deep/inner.rs": `pub fn deep_fn() -> i32 {
    1
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "deep_fn",
        file_paths["deep/inner.rs"]
      );
    });

    it("resolves a type-qualified associated function inside a module file", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod x;

pub fn run() -> i32 {
    x::Type::assoc()
}
`,
        "x.rs": `pub struct Type;

impl Type {
    pub fn assoc() -> i32 {
        1
    }
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "assoc",
        file_paths["x.rs"]
      );
    });

    it("binds a module-qualified call over a same-name local shadow", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod x;

pub fn run() -> i32 {
    let x = 1;
    x::helper() + x
}
`,
        "x.rs": `pub fn helper() -> i32 {
    2
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "helper",
        file_paths["x.rs"]
      );
    });

    it("resolves a non-pub item named explicitly by the author's path", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod config;

pub fn run() -> i32 {
    config::private_build()
}
`,
        "config.rs": `fn private_build() -> i32 {
    1
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "private_build",
        file_paths["config.rs"]
      );
    });

    it("resolves a module whose backing file a #[path] attribute names", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `#[cfg(unix)]
#[path = "sys/unix.rs"]
mod imp;

pub fn run() {
    self::imp::ctrl_c()
}
`,
        "sys/unix.rs": `pub fn ctrl_c() {}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "ctrl_c",
        file_paths["sys/unix.rs"]
      );
    });

    it("fabricates no edge for a path whose file the project has not indexed", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `pub fn run() {
    Foo::bar();
    serde_json::to_string();
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_unresolved(project, file_paths["lib.rs"], "bar");
      expect_rust_call_unresolved(project, file_paths["lib.rs"], "to_string");
    });

    it("fabricates no edge to an indexed sibling no mod declaration names", async () => {
      // A file sharing its name with an external crate is not that crate. A bare
      // path segment must name something the author brought into scope, so this
      // must stay unresolved however the files were indexed — the caller is
      // re-indexed here so load order cannot be what protects it.
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `pub fn run() {
    serde_json::to_string();
}
`,
        "serde_json.rs": `pub fn to_string() -> i32 {
    1
}
`,
      });
      temp_dirs.push(temp_dir);
      project.update_file(
        file_paths["lib.rs"],
        `pub fn run() {
    serde_json::to_string();
}
`
      );

      expect_rust_call_unresolved(project, file_paths["lib.rs"], "to_string");
    });

    it("fabricates no edge when a foreign path's tail matches a local module", async () => {
      // `std::fs` is not this crate's `fs` module. Every segment of a path has to
      // match, or a foreign path collapses onto whatever its last segment names.
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `mod fs;

pub fn run() {
    std::fs::read_to_string("x");
}
`,
        "src/fs.rs": `pub fn read_to_string(p: &str) -> String {
    String::new()
}
`,
      });
      temp_dirs.push(temp_dir);
      project.update_file(
        file_paths["src/lib.rs"],
        `mod fs;

pub fn run() {
    std::fs::read_to_string("x");
}
`
      );

      expect_rust_call_unresolved(
        project,
        file_paths["src/lib.rs"],
        "read_to_string"
      );
    });

    it("fabricates no edge from a use of a type read as if it were a module", async () => {
      // `use crate::model::User;` binds a type, not a module, so `User::from_str()`
      // must not reach the free `from_str` sitting beside it in model.rs.
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `mod model;
mod caller;
`,
        "src/model.rs": `pub struct User;

pub fn from_str() -> i32 {
    7
}
`,
        "src/caller.rs": `use crate::model::User;

pub fn go() -> i32 {
    User::from_str()
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_unresolved(project, file_paths["src/caller.rs"], "from_str");
    });

    it("binds every #[cfg]-gated variant of one module name", async () => {
      // rustc's `sys::process::{unix,windows}` shape. Ariadne does not evaluate
      // `cfg`, so each variant is a candidate and the call binds rather than
      // being dropped as ambiguous.
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `#[cfg(unix)]
#[path = "sys/unix.rs"]
mod imp;

#[cfg(windows)]
#[path = "sys/windows.rs"]
mod imp;

pub fn run() {
    self::imp::ctrl_c()
}
`,
        "sys/unix.rs": `pub fn ctrl_c() {}
`,
        "sys/windows.rs": `pub fn ctrl_c() {}
`,
      });
      temp_dirs.push(temp_dir);

      const call = project.resolutions
        .get_calls_for_file(file_paths["lib.rs"])
        .find((c) => c.name === ("ctrl_c" as SymbolName));
      expect(call).toBeDefined();
      expect(call!.resolution_failure).toBeUndefined();

      const target = project.definitions.get(call!.resolutions[0].symbol_id);
      expect(target?.location.file_path).toEqual(file_paths["sys/unix.rs"]);
    });

    it("resolves a #[path] module declared in a non-root module file", async () => {
      // `#[path]` is relative to the directory the declaring file sits in,
      // whatever that file is called.
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `mod sys;
`,
        "src/sys.rs": `#[path = "unix.rs"]
mod imp;

pub fn go() {
    imp::boot()
}
`,
        "src/unix.rs": `pub fn boot() {}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/sys.rs"],
        "boot",
        file_paths["src/unix.rs"]
      );
    });

    it("resolves a #[path] mod nested in an inline module against that module's directory", async () => {
      // rustc resolves a nested declaration's `#[path]` under the declaring
      // module's own directory. The unrelated crate-root `backend.rs` is the
      // decoy a directory-only base would bind instead.
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `mod sys;
mod backend;
`,
        "src/sys.rs": `pub mod outer {
    #[path = "backend.rs"]
    pub mod inner;

    pub fn go() -> i32 {
        inner::boot()
    }
}
`,
        "src/backend.rs": `pub fn boot() -> i32 {
    111
}
`,
        "src/sys/outer/backend.rs": `pub fn boot() -> i32 {
    222
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/sys.rs"],
        "boot",
        file_paths["src/sys/outer/backend.rs"]
      );
    });

    it("resolves a #[path] separated from its mod by a comment", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `#[path = "sys/unix.rs"]
// pick the unix backend
mod imp;

pub fn run() {
    imp::boot()
}
`,
        "sys/unix.rs": `pub fn boot() {}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "boot",
        file_paths["sys/unix.rs"]
      );
    });

    it("resolves a path into an inline mod block of the module file it landed on", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `pub mod a;

pub fn go() {
    crate::a::b::f()
}
`,
        "src/a.rs": `pub mod b {
    pub fn f() {}
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/lib.rs"],
        "f",
        file_paths["src/a.rs"]
      );
    });

    it("keeps a mod edge and a glob re-export written on one line apart", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `pub use inner::*; mod inner;
`,
        "src/inner.rs": `pub fn shared() -> i32 {
    1
}
`,
        "src/app.rs": `use crate::shared;

pub fn run() -> i32 {
    shared()
}
`,
      });
      temp_dirs.push(temp_dir);

      const lib_index = project.get_index_single_file(file_paths["src/lib.rs"]);
      expect(
        Array.from(lib_index!.imported_symbols.values())
          .map((imp) => imp.import_kind)
          .sort()
      ).toEqual(["namespace", "wildcard"]);
    });

    it("resolves a module-qualified call over a same-name local function", async () => {
      // The author's qualifier names config.rs, so the crate-root `build` beside
      // the call does not capture it.
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod config;

fn build() -> i32 {
    9
}

pub fn run() -> i32 {
    config::build() + build()
}
`,
        "config.rs": `pub fn build() -> i32 {
    1
}
`,
      });
      temp_dirs.push(temp_dir);

      const calls = project.resolutions
        .get_calls_for_file(file_paths["lib.rs"])
        .filter((c) => c.name === ("build" as SymbolName));
      expect(calls.length).toEqual(2);

      const target_files = calls.flatMap((c) =>
        c.resolutions.map(
          (r) => project.definitions.get(r.symbol_id)?.location.file_path
        )
      );
      expect(target_files.sort()).toEqual(
        [file_paths["config.rs"], file_paths["lib.rs"]].sort()
      );
    });

    it("re-resolves a two-hop path's caller when the leaf module changes", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `mod deep;

pub fn run() -> i32 {
    crate::deep::inner::deep_fn()
}
`,
        "deep.rs": `pub mod inner;
`,
        "deep/inner.rs": `pub fn deep_fn() -> i32 {
    1
}
`,
      });
      temp_dirs.push(temp_dir);

      // Moving `deep_fn` down a line changes its symbol id, so the lib.rs call
      // can only carry the new one if editing the leaf re-resolved a file two
      // module hops above it.
      project.update_file(
        file_paths["deep/inner.rs"],
        `
pub fn deep_fn() -> i32 {
    2
}
`
      );

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "deep_fn",
        file_paths["deep/inner.rs"]
      );
    });

    it("re-resolves a caller that reaches the edited module only through its path", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "deep/inner.rs": `pub fn deep_fn() -> i32 {
    1
}
`,
        "deep.rs": `pub mod inner;
`,
        "lib.rs": `mod caller;
mod deep;
`,
        // `caller.rs` declares no module: the path is the only thing that names
        // `deep/inner.rs` here, so the edit reaches this file only if reading a
        // module file made it a dependent of that file.
        "caller.rs": `pub fn run() -> i32 {
    crate::deep::inner::deep_fn()
}
`,
      });
      temp_dirs.push(temp_dir);

      project.update_file(
        file_paths["deep/inner.rs"],
        `
pub fn deep_fn() -> i32 {
    2
}
`
      );

      expect_rust_call_resolves_to(
        project,
        file_paths["caller.rs"],
        "deep_fn",
        file_paths["deep/inner.rs"]
      );
    });

    it("re-resolves a caller whose path hopped through a #[path]-remapped module", async () => {
      // The path spells `deep::inner`, but `inner`'s file is named by the
      // attribute, so only the hop itself knows which file the call read.
      const { project, temp_dir, file_paths } = await setup_project({
        "src/renamed.rs": `pub fn deep_fn() -> i32 {
    1
}
`,
        "src/deep.rs": `#[path = "renamed.rs"]
pub mod inner;
`,
        "src/lib.rs": `mod caller;
mod deep;
`,
        "src/caller.rs": `pub fn run() -> i32 {
    crate::deep::inner::deep_fn()
}
`,
      });
      temp_dirs.push(temp_dir);

      project.update_file(
        file_paths["src/renamed.rs"],
        `
pub fn deep_fn() -> i32 {
    2
}
`
      );

      expect_rust_call_resolves_to(
        project,
        file_paths["src/caller.rs"],
        "deep_fn",
        file_paths["src/renamed.rs"]
      );
    });
  });

  // Module-qualified shapes taken from the Rust corpora the triage sampled.
  describe("corpus module-qualified call shapes", () => {
    it("resolves sqlx migrate::expand", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `mod migrate;

pub fn run() -> i32 {
    migrate::expand()
}
`,
        "src/migrate.rs": `pub fn expand() -> i32 {
    1
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/lib.rs"],
        "expand",
        file_paths["src/migrate.rs"]
      );
    });

    it("resolves tokio list::channel", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `pub mod sync;
`,
        "src/sync.rs": `mod list;

pub fn broadcast() -> i32 {
    list::channel()
}
`,
        "src/sync/list.rs": `pub fn channel() -> i32 {
    1
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/sync.rs"],
        "channel",
        file_paths["src/sync/list.rs"]
      );
    });

    it("resolves rustc back::write::optimize", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `mod back;

pub fn run() -> i32 {
    back::write::optimize()
}
`,
        "src/back.rs": `pub mod write;
`,
        "src/back/write.rs": `pub fn optimize() -> i32 {
    1
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/lib.rs"],
        "optimize",
        file_paths["src/back/write.rs"]
      );
    });

    it("resolves rustc MetaVarExpr::parse on an enum's associated function", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `mod metavar_expr;

use crate::metavar_expr::MetaVarExpr;

pub fn run() -> i32 {
    MetaVarExpr::parse()
}
`,
        "src/metavar_expr.rs": `pub enum MetaVarExpr {
    Count,
}

impl MetaVarExpr {
    pub fn parse() -> i32 {
        1
    }
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/lib.rs"],
        "parse",
        file_paths["src/metavar_expr.rs"]
      );
    });

    it("resolves rustc config::Options::from_matches", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `mod config;

pub fn run() -> i32 {
    config::Options::from_matches()
}
`,
        "src/config.rs": `pub struct Options;

impl Options {
    pub fn from_matches() -> i32 {
        1
    }
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/lib.rs"],
        "from_matches",
        file_paths["src/config.rs"]
      );
    });

    it("resolves serde attr::Container::from_ast through a module bound by use", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `mod internals;
mod derive;
`,
        "src/internals.rs": `pub mod attr;
`,
        "src/internals/attr.rs": `pub struct Container;

impl Container {
    pub fn from_ast() -> i32 {
        1
    }
}
`,
        "src/derive.rs": `use crate::internals::attr;

pub fn expand() -> i32 {
    attr::Container::from_ast()
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/derive.rs"],
        "from_ast",
        file_paths["src/internals/attr.rs"]
      );
    });
  });

  // `Self` names the enclosing impl/trait type, and a module brought into scope
  // under an alias is still a module a path can traverse.
  describe("Self and module aliases", () => {
    it("resolves Self::assoc inside the defining impl block", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `pub struct Driver;

impl Driver {
    pub fn assoc() -> i32 {
        1
    }

    pub fn run() -> i32 {
        Self::assoc()
    }
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "assoc",
        file_paths["lib.rs"]
      );
    });

    it("resolves Self::assoc from a second impl block for the same type", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `pub struct Driver;

impl Driver {
    pub fn assoc() -> i32 {
        1
    }
}

impl Driver {
    pub fn run() -> i32 {
        Self::assoc()
    }
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "assoc",
        file_paths["lib.rs"]
      );
    });

    it("resolves Self::assoc from an instance method body", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `pub struct Driver;

impl Driver {
    pub fn assoc() -> i32 {
        1
    }

    pub fn run(&self) -> i32 {
        Self::assoc()
    }
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "assoc",
        file_paths["lib.rs"]
      );
    });

    it("resolves Self::assoc on an enum's own impl", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `pub enum Shape {
    Round,
}

impl Shape {
    pub fn assoc() -> i32 {
        1
    }

    pub fn run() -> i32 {
        Self::assoc()
    }
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "assoc",
        file_paths["lib.rs"]
      );
    });

    it("resolves Self::required from a trait's own default method body", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `pub trait Named {
    fn required() -> i32;

    fn provided() -> i32 {
        Self::required()
    }
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "required",
        file_paths["lib.rs"]
      );
    });

    it("resolves Self::assoc declared in a trait impl on the same type", async () => {
      // The associated function is reached through the type's own impl of a
      // trait, not the inherent impl the call sits in.
      const { project, temp_dir, file_paths } = await setup_project({
        "lib.rs": `pub trait Build {
    fn assoc() -> i32;
}

pub struct Driver;

impl Build for Driver {
    fn assoc() -> i32 {
        1
    }
}

impl Driver {
    pub fn run() -> i32 {
        Self::assoc()
    }
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["lib.rs"],
        "assoc",
        file_paths["lib.rs"]
      );
    });

    it("resolves a trait-qualified associated call", async () => {
      // `Default::default(x)` — the qualifier names a trait, whose methods sit in
      // the same member index a struct's do.
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `mod io;
mod app;
`,
        "src/io.rs": `pub trait Read {
    fn read(&self) -> usize;
}
`,
        "src/app.rs": `use crate::io::Read;

pub fn go<R: Read>(r: &R) -> usize {
    Read::read(r)
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/app.rs"],
        "read",
        file_paths["src/io.rs"]
      );
    });

    it("resolves a module-qualified call anchored by a glob import", async () => {
      // `use crate::deep::*;` puts `deep`'s surface in scope, which is what binds
      // the module name `m`; the call then names `f` inside it.
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `pub mod deep;
pub mod app;
`,
        "src/deep.rs": `pub mod m;
`,
        "src/deep/m.rs": `pub fn f() -> i32 {
    1
}
`,
        "src/app.rs": `use crate::deep::*;

pub fn run() -> i32 {
    m::f()
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/app.rs"],
        "f",
        file_paths["src/deep/m.rs"]
      );
    });

    it("resolves a path through a module brought into scope under an alias", async () => {
      const { project, temp_dir, file_paths } = await setup_project({
        "src/lib.rs": `mod a;
mod real;
`,
        "src/a.rs": `mod child;

use crate::real as alias;
`,
        "src/real.rs": `pub fn item() -> i32 {
    1
}
`,
        "src/a/child.rs": `pub fn describe() -> i32 {
    super::alias::item()
}
`,
      });
      temp_dirs.push(temp_dir);

      expect_rust_call_resolves_to(
        project,
        file_paths["src/a/child.rs"],
        "item",
        file_paths["src/real.rs"]
      );
    });
  });
});

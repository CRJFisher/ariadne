import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { Project } from "../project/project";
import type { SemanticIndex } from "../index_single_file/index_single_file";
import {
  serialize_semantic_index,
  deserialize_semantic_index,
} from "./serialize_index";
import { InMemoryStorage } from "./storage.test";
import { FileSystemStorage } from "./file_system_storage";
import { load_project } from "../project/load_project";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

const exec_file = promisify(execFile);

/** Build a clean env for git commands in temp dirs, removing inherited git vars. */
function clean_git_env(): typeof process.env {
  const { GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, ...env } = process.env;
  return env;
}

// ============================================================================
// Helpers
// ============================================================================

function fp(s: string): FilePath {
  return s as FilePath;
}

/**
 * Assert two projects produce equivalent call graphs, stats, and definitions.
 */
function assert_projects_equivalent(fresh: Project, cached: Project): void {
  // Same files tracked
  expect(new Set(cached.get_all_files())).toEqual(
    new Set(fresh.get_all_files()),
  );

  // Same stats
  expect(cached.get_stats()).toEqual(fresh.get_stats());

  // Deep per-file semantic index comparison (content, not just sizes)
  for (const file_path of fresh.get_all_files()) {
    const fresh_index = fresh.get_index_single_file(file_path);
    const cached_index = cached.get_index_single_file(file_path);
    expect(cached_index).toBeDefined();
    expect(cached_index?.language).toEqual(fresh_index?.language);
    expect(cached_index?.root_scope_id).toEqual(fresh_index?.root_scope_id);

    // Compare all definition maps entry-by-entry
    for (const [key, val] of fresh_index?.functions ?? []) {
      expect(cached_index?.functions.get(key)).toEqual(val);
    }
    for (const [key, val] of fresh_index?.classes ?? []) {
      expect(cached_index?.classes.get(key)).toEqual(val);
    }
    for (const [key, val] of fresh_index?.variables ?? []) {
      expect(cached_index?.variables.get(key)).toEqual(val);
    }
    for (const [key, val] of fresh_index?.interfaces ?? []) {
      expect(cached_index?.interfaces.get(key)).toEqual(val);
    }
    for (const [key, val] of fresh_index?.enums ?? []) {
      expect(cached_index?.enums.get(key)).toEqual(val);
    }
    for (const [key, val] of fresh_index?.namespaces ?? []) {
      expect(cached_index?.namespaces.get(key)).toEqual(val);
    }
    for (const [key, val] of fresh_index?.types ?? []) {
      expect(cached_index?.types.get(key)).toEqual(val);
    }
    for (const [key, val] of fresh_index?.imported_symbols ?? []) {
      expect(cached_index?.imported_symbols.get(key)).toEqual(val);
    }
    for (const [key, val] of fresh_index?.scopes ?? []) {
      expect(cached_index?.scopes.get(key)).toEqual(val);
    }

    // Compare references
    expect([...(cached_index?.references ?? [])]).toEqual([
      ...(fresh_index?.references ?? []),
    ]);
  }

  // Deep call graph comparison
  const fresh_graph = fresh.get_call_graph();
  const cached_graph = cached.get_call_graph();
  expect(cached_graph.nodes.size).toEqual(fresh_graph.nodes.size);
  expect(new Set(cached_graph.entry_points)).toEqual(
    new Set(fresh_graph.entry_points),
  );
  for (const [sym_id, fresh_node] of fresh_graph.nodes) {
    const cached_node = cached_graph.nodes.get(sym_id);
    expect(cached_node).toBeDefined();
    expect(cached_node?.name).toEqual(fresh_node.name);
    // Compare enclosed calls content, not just length
    expect(cached_node?.enclosed_calls).toEqual(fresh_node.enclosed_calls);
  }

  // Resolution count
  expect(cached.resolutions.size()).toEqual(fresh.resolutions.size());
}

/**
 * Build a project from file entries, extract and round-trip all SemanticIndex,
 * then build a second project using restore_file with the round-tripped indexes.
 */
async function build_fresh_and_cached(
  files: Map<FilePath, string>,
): Promise<{ fresh: Project; cached: Project }> {
  const fresh = new Project();
  await fresh.initialize();
  for (const [file_path, content] of files) {
    fresh.update_file(file_path, content);
  }

  // Round-trip all indexes through serialization
  const cached_indexes = new Map<FilePath, SemanticIndex>();
  for (const file_path of fresh.get_all_files()) {
    const index = fresh.get_index_single_file(file_path);
    if (index) {
      const json = serialize_semantic_index(index);
      cached_indexes.set(file_path, deserialize_semantic_index(json));
    }
  }

  const cached = new Project();
  await cached.initialize();
  for (const [file_path, content] of files) {
    const cached_index = cached_indexes.get(file_path);
    if (cached_index) {
      cached.restore_file(file_path, content, cached_index);
    }
  }

  return { fresh, cached };
}

// ============================================================================
// A. Golden Invariant Tests
// ============================================================================

describe("Golden Invariant: fresh === cached", () => {
  it("TypeScript: cross-file function calls", async () => {
    const files = new Map<FilePath, string>([
      [
        fp("utils.ts"),
        `export function helper() { return 42; }
export function add(a: number, b: number) { return a + b; }`,
      ],
      [
        fp("main.ts"),
        `import { helper, add } from './utils';
const x = helper();
const y = add(1, 2);`,
      ],
    ]);
    const { fresh, cached } = await build_fresh_and_cached(files);
    assert_projects_equivalent(fresh, cached);
  });

  it("TypeScript: class with methods and constructor", async () => {
    const files = new Map<FilePath, string>([
      [
        fp("animal.ts"),
        `export class Animal {
  name: string;
  constructor(name: string) { this.name = name; }
  speak(): string { return this.name; }
}`,
      ],
      [
        fp("main.ts"),
        `import { Animal } from './animal';
const a = new Animal("dog");
a.speak();`,
      ],
    ]);
    const { fresh, cached } = await build_fresh_and_cached(files);
    assert_projects_equivalent(fresh, cached);
  });

  it("Python: cross-module function calls", async () => {
    const files = new Map<FilePath, string>([
      [
        fp("utils.py"),
        `def helper():
    return 42

def add(a, b):
    return a + b`,
      ],
      [
        fp("main.py"),
        `from utils import helper, add

x = helper()
y = add(1, 2)`,
      ],
    ]);
    const { fresh, cached } = await build_fresh_and_cached(files);
    assert_projects_equivalent(fresh, cached);
  });

  it("JavaScript: ES6 module imports", async () => {
    const files = new Map<FilePath, string>([
      [
        fp("utils.js"),
        "export function greet(name) { return \"Hello \" + name; }",
      ],
      [
        fp("main.js"),
        `import { greet } from './utils';
const msg = greet("world");`,
      ],
    ]);
    const { fresh, cached } = await build_fresh_and_cached(files);
    assert_projects_equivalent(fresh, cached);
  });

  it("Rust: function calls across modules", async () => {
    const files = new Map<FilePath, string>([
      [
        fp("lib.rs"),
        `pub fn helper() -> i32 { 42 }
pub fn add(a: i32, b: i32) -> i32 { a + b }`,
      ],
      [
        fp("main.rs"),
        `use lib::{helper, add};
fn main() {
    let x = helper();
    let y = add(1, 2);
}`,
      ],
    ]);
    const { fresh, cached } = await build_fresh_and_cached(files);
    assert_projects_equivalent(fresh, cached);
  });

  it("single file: function calling function", async () => {
    const files = new Map<FilePath, string>([
      [
        fp("single.ts"),
        `function foo() { return 42; }
function bar() { return foo(); }
const x = bar();`,
      ],
    ]);
    const { fresh, cached } = await build_fresh_and_cached(files);
    assert_projects_equivalent(fresh, cached);
  });

  it("empty project", async () => {
    const files = new Map<FilePath, string>();
    const { fresh, cached } = await build_fresh_and_cached(files);
    assert_projects_equivalent(fresh, cached);
  });
});

// ============================================================================
// C. Staleness Detection Tests
// ============================================================================

describe("Staleness Detection", () => {
  it("reuses cached index when file has not changed", async () => {
    const files = new Map<FilePath, string>([
      [fp("a.ts"), "export function foo() { return 42; }"],
      [fp("b.ts"), "import { foo } from './a'; const x = foo();"],
    ]);
    const { fresh, cached } = await build_fresh_and_cached(files);
    assert_projects_equivalent(fresh, cached);
  });

  it("re-indexes when file content changes", async () => {
    // Build v1
    const v1_files = new Map<FilePath, string>([
      [fp("a.ts"), "export function foo() { return 42; }"],
      [fp("b.ts"), "import { foo } from './a'; const x = foo();"],
    ]);
    const fresh_v1 = new Project();
    await fresh_v1.initialize();
    for (const [file_path, content] of v1_files) {
      fresh_v1.update_file(file_path, content);
    }

    // Cache v1 indexes
    const cached_indexes = new Map<FilePath, SemanticIndex>();
    for (const file_path of fresh_v1.get_all_files()) {
      const index = fresh_v1.get_index_single_file(file_path);
      if (index) {
        const json = serialize_semantic_index(index);
        cached_indexes.set(file_path, deserialize_semantic_index(json));
      }
    }

    // Build v2 (a.ts changed, b.ts unchanged)
    const v2_a_content = "export function foo() { return 999; }";
    const v2_b_content = v1_files.get(fp("b.ts"));

    // Build v2 fresh
    const fresh_v2 = new Project();
    await fresh_v2.initialize();
    fresh_v2.update_file(fp("a.ts"), v2_a_content);
    fresh_v2.update_file(fp("b.ts"), v2_b_content!);

    // Build v2 with partial cache (b.ts from cache, a.ts fresh)
    const cached_v2 = new Project();
    await cached_v2.initialize();
    cached_v2.update_file(fp("a.ts"), v2_a_content); // changed, fresh parse
    cached_v2.restore_file(fp("b.ts"), v2_b_content!, cached_indexes.get(fp("b.ts"))!); // unchanged, from cache

    assert_projects_equivalent(fresh_v2, cached_v2);
  });

  it("handles file deletion gracefully", async () => {
    // Build with two files
    const fresh = new Project();
    await fresh.initialize();
    fresh.update_file(fp("a.ts"), "export function foo() { return 42; }");
    fresh.update_file(
      fp("b.ts"),
      "import { foo } from './a'; const x = foo();",
    );

    // Now build project with only a.ts (b.ts was deleted)
    const after_delete = new Project();
    await after_delete.initialize();
    after_delete.update_file(
      fp("a.ts"),
      "export function foo() { return 42; }",
    );

    // Should have only one file
    expect(after_delete.get_all_files().length).toEqual(1);
    expect(after_delete.get_stats().file_count).toEqual(1);
  });

  it("handles new file addition", async () => {
    // Start with one file
    const initial = new Project();
    await initial.initialize();
    initial.update_file(fp("a.ts"), "export function foo() { return 42; }");

    // Cache a.ts index
    const a_index = initial.get_index_single_file(fp("a.ts"));
    const a_json = serialize_semantic_index(a_index!);
    const a_cached = deserialize_semantic_index(a_json);

    // Build project with a.ts from cache + new b.ts
    const with_new_file = new Project();
    await with_new_file.initialize();
    with_new_file.restore_file(
      fp("a.ts"),
      "export function foo() { return 42; }",
      a_cached,
    );
    with_new_file.update_file(
      fp("b.ts"),
      "import { foo } from './a'; const x = foo();",
    );

    // Build fresh equivalent
    const fresh = new Project();
    await fresh.initialize();
    fresh.update_file(fp("a.ts"), "export function foo() { return 42; }");
    fresh.update_file(
      fp("b.ts"),
      "import { foo } from './a'; const x = foo();",
    );

    assert_projects_equivalent(fresh, with_new_file);
  });
});

// ============================================================================
// D. Corruption/Recovery Tests
// ============================================================================

describe("Corruption/Recovery", () => {
  let temp_dir: string;

  async function setup_project_dir(
    files: Record<string, string>,
  ): Promise<string> {
    temp_dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ariadne-corruption-test-"),
    );
    for (const [name, content] of Object.entries(files)) {
      await fs.writeFile(path.join(temp_dir, name), content, "utf-8");
    }
    return temp_dir;
  }

  async function cleanup(): Promise<void> {
    if (temp_dir) {
      await fs.rm(temp_dir, { recursive: true, force: true });
    }
  }

  it("falls back to full re-index on truncated manifest JSON", async () => {
    const dir = await setup_project_dir({
      "a.ts": "export function foo() { return 42; }",
    });
    try {
      const storage = new InMemoryStorage();

      // First load to populate cache
      const first = await load_project({
        project_path: dir,
        storage,
      });
      const first_graph = first.get_call_graph();

      // Corrupt manifest
      const raw = (await storage.read_manifest()) ?? "";
      storage.set_manifest(raw.slice(0, 20));

      // Second load should fall back gracefully
      const second = await load_project({
        project_path: dir,
        storage,
      });
      const second_graph = second.get_call_graph();

      expect(second_graph.nodes.size).toEqual(first_graph.nodes.size);
      expect(second.get_stats()).toEqual(first.get_stats());
    } finally {
      await cleanup();
    }
  });

  it("falls back to full re-index on corrupt index JSON", async () => {
    const dir = await setup_project_dir({
      "a.ts": "export function foo() { return 42; }",
      "b.ts": "import { foo } from './a'; const x = foo();",
    });
    try {
      const storage = new InMemoryStorage();

      const first = await load_project({ project_path: dir, storage });
      const first_stats = first.get_stats();

      // Corrupt one file's index
      const a_path = path.join(dir, "a.ts");
      storage.set_index(a_path, "{invalid json");

      const second = await load_project({ project_path: dir, storage });
      expect(second.get_stats()).toEqual(first_stats);
    } finally {
      await cleanup();
    }
  });

  it("falls back on empty cache", async () => {
    const dir = await setup_project_dir({
      "a.ts": "export function foo() { return 42; }",
    });
    try {
      const storage = new InMemoryStorage();

      // Load with empty storage (no prior cache)
      const project = await load_project({ project_path: dir, storage });
      expect(project.get_stats().file_count).toEqual(1);
      expect(project.get_stats().definition_count).toBeGreaterThan(0);
    } finally {
      await cleanup();
    }
  });

  it("prunes manifest entries for deleted files on warm load", async () => {
    const dir = await setup_project_dir({
      "a.ts": "export function foo() { return 42; }",
      "b.ts": "import { foo } from './a'; const x = foo();",
    });
    try {
      const storage = new InMemoryStorage();

      // Cold load populates cache with both files
      const cold = await load_project({ project_path: dir, storage });
      expect(cold.get_stats().file_count).toEqual(2);

      const manifest_v1 = JSON.parse((await storage.read_manifest())!);
      expect(manifest_v1.entries.length).toEqual(2);

      // Delete b.ts from disk
      await fs.unlink(path.join(dir, "b.ts"));

      // Warm load — b.ts is gone, its manifest entry should be pruned
      const warm = await load_project({ project_path: dir, storage });
      expect(warm.get_stats().file_count).toEqual(1);

      const manifest_v2 = JSON.parse((await storage.read_manifest())!);
      expect(manifest_v2.entries.length).toEqual(1);

      const entry_paths = manifest_v2.entries.map(
        (e: [string, unknown]) => e[0],
      );
      expect(entry_paths).toEqual([path.join(dir, "a.ts")]);
    } finally {
      await cleanup();
    }
  });

  it("falls back on missing index entry", async () => {
    const dir = await setup_project_dir({
      "a.ts": "export function foo() { return 42; }",
    });
    try {
      const storage = new InMemoryStorage();

      // First load
      const first = await load_project({ project_path: dir, storage });
      const first_stats = first.get_stats();

      // Delete index for a.ts but keep manifest
      const a_path = path.join(dir, "a.ts");
      storage.delete_index(a_path);

      const second = await load_project({ project_path: dir, storage });
      expect(second.get_stats()).toEqual(first_stats);
    } finally {
      await cleanup();
    }
  });
});

// ============================================================================
// E. Incremental Consistency Tests
// ============================================================================

describe("Incremental Consistency", () => {
  let temp_dir: string;

  async function setup_project_dir(
    files: Record<string, string>,
  ): Promise<string> {
    temp_dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ariadne-incremental-test-"),
    );
    for (const [name, content] of Object.entries(files)) {
      await fs.writeFile(path.join(temp_dir, name), content, "utf-8");
    }
    return temp_dir;
  }

  async function cleanup(): Promise<void> {
    if (temp_dir) {
      await fs.rm(temp_dir, { recursive: true, force: true });
    }
  }

  it("partial cache + re-parse matches full rebuild after adding export", async () => {
    const dir = await setup_project_dir({
      "a.ts": "function helper() { return 42; }",
      "b.ts": "import { helper } from './a'; const x = helper();",
    });
    try {
      const storage = new InMemoryStorage();
      await load_project({ project_path: dir, storage });

      // Modify a.ts to add export
      await fs.writeFile(
        path.join(dir, "a.ts"),
        "export function helper() { return 42; }",
        "utf-8",
      );

      // Warm load (a.ts has changed, b.ts from cache)
      const warm = await load_project({ project_path: dir, storage });

      // Cold rebuild
      const cold = await load_project({ project_path: dir });

      assert_projects_equivalent(cold, warm);
    } finally {
      await cleanup();
    }
  });

  it("partial cache + re-parse matches full rebuild after renaming function", async () => {
    const dir = await setup_project_dir({
      "utils.ts": "export function process_data() { return 42; }",
      "main.ts":
        "import { process_data } from './utils'; const x = process_data();",
    });
    try {
      const storage = new InMemoryStorage();
      await load_project({ project_path: dir, storage });

      // Rename function
      await fs.writeFile(
        path.join(dir, "utils.ts"),
        "export function transform_data() { return 42; }",
        "utf-8",
      );

      const warm = await load_project({ project_path: dir, storage });
      const cold = await load_project({ project_path: dir });

      assert_projects_equivalent(cold, warm);
    } finally {
      await cleanup();
    }
  });
});

// ============================================================================
// Project.save() Tests
// ============================================================================

describe("Project.save()", () => {
  it("saves and restores project via storage", async () => {
    const storage = new InMemoryStorage();

    // Build and save
    const original = new Project();
    await original.initialize();
    original.update_file(
      fp("a.ts"),
      "export function foo() { return 42; }",
    );
    original.update_file(
      fp("b.ts"),
      "import { foo } from './a'; const x = foo();",
    );
    await original.save(storage);

    // Verify manifest was written
    const manifest = await storage.read_manifest();
    expect(manifest).not.toBeNull();

    // Verify indexes were written
    expect(await storage.read_index("a.ts")).not.toBeNull();
    expect(await storage.read_index("b.ts")).not.toBeNull();
  });

  it("save then load round-trip produces equivalent project", async () => {
    const storage = new InMemoryStorage();
    const a_content = "export function foo() { return 42; }";
    const b_content = "import { foo } from './a'; const x = foo();";

    // Build and save
    const original = new Project();
    await original.initialize();
    original.update_file(fp("a.ts"), a_content);
    original.update_file(fp("b.ts"), b_content);
    await original.save(storage);

    // Load from saved storage
    const restored = new Project();
    await restored.initialize();
    for (const file_path of original.get_all_files()) {
      const raw = await storage.read_index(file_path);
      if (raw) {
        const content =
          file_path === ("a.ts" as FilePath) ? a_content : b_content;
        const index = deserialize_semantic_index(raw);
        restored.restore_file(file_path, content, index);
      }
    }

    assert_projects_equivalent(original, restored);
  });
});

// ============================================================================
// Schema Version Mismatch Test
// ============================================================================

describe("Schema version mismatch", () => {
  let temp_dir: string;

  async function cleanup(): Promise<void> {
    if (temp_dir) {
      await fs.rm(temp_dir, { recursive: true, force: true });
    }
  }

  it("discards cache when schema version does not match", async () => {
    temp_dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ariadne-schema-test-"),
    );
    await fs.writeFile(
      path.join(temp_dir, "a.ts"),
      "export function foo() { return 42; }",
      "utf-8",
    );

    try {
      const storage = new InMemoryStorage();

      // First load to populate cache
      const first = await load_project({ project_path: temp_dir, storage });
      const first_stats = first.get_stats();

      // Corrupt manifest with wrong schema version
      const raw_manifest = (await storage.read_manifest()) ?? "";
      const parsed_manifest = JSON.parse(raw_manifest);
      parsed_manifest.schema_version = 999;
      storage.set_manifest(JSON.stringify(parsed_manifest));

      // Second load should discard cache and re-index
      const second = await load_project({ project_path: temp_dir, storage });
      expect(second.get_stats()).toEqual(first_stats);
    } finally {
      await cleanup();
    }
  });
});

// ============================================================================
// Git-Accelerated Warm Load Tests
// ============================================================================

describe("Git-accelerated warm load", { timeout: 30_000 }, () => {
  let temp_dir: string;

  async function git(args: string[]): Promise<string> {
    const { stdout } = await exec_file("git", args, {
      cwd: temp_dir,
      env: clean_git_env(),
    });
    return stdout;
  }

  async function setup_git_repo(
    files: Record<string, string>,
  ): Promise<string> {
    temp_dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ariadne-git-warm-test-"),
    );
    await git(["init"]);
    await git(["config", "user.email", "test@test.com"]);
    await git(["config", "user.name", "Test"]);

    for (const [name, content] of Object.entries(files)) {
      const file_path = path.join(temp_dir, name);
      await fs.mkdir(path.dirname(file_path), { recursive: true });
      await fs.writeFile(file_path, content, "utf-8");
    }
    await git(["add", "."]);
    await git(["commit", "-m", "initial"]);
    return temp_dir;
  }

  async function cleanup(): Promise<void> {
    if (temp_dir) {
      await fs.rm(temp_dir, { recursive: true, force: true });
    }
  }

  it("tree-unchanged fast path: warm load skips all re-indexing", async () => {
    await setup_git_repo({
      "a.ts": "export function foo() { return 42; }",
      "b.ts": "import { foo } from './a';\nconst x = foo();",
    });
    try {
      const storage = new InMemoryStorage();

      // Cold load populates cache
      const cold = await load_project({ project_path: temp_dir, storage });
      const cold_stats = cold.get_stats();

      // Manifest should have git_tree_hash
      const manifest_json = await storage.read_manifest();
      expect(manifest_json).not.toBeNull();
      const manifest = JSON.parse(manifest_json!);
      expect(typeof manifest.git_tree_hash).toEqual("string");
      expect(manifest.git_tree_hash.length).toEqual(40); // SHA-1

      // Warm load with unchanged tree — all files should use cache
      const warm = await load_project({ project_path: temp_dir, storage });

      assert_projects_equivalent(cold, warm);
    } finally {
      await cleanup();
    }
  });

  it("tree-changed, blob-hash match: unchanged files still use cache", async () => {
    await setup_git_repo({
      "a.ts": "export function foo() { return 42; }",
      "b.ts": "import { foo } from './a';\nconst x = foo();",
    });
    try {
      const storage = new InMemoryStorage();

      // Cold load
      await load_project({ project_path: temp_dir, storage });

      // Add a new file and commit — tree hash changes, but a.ts and b.ts are unchanged
      await fs.writeFile(
        path.join(temp_dir, "c.ts"),
        "export function bar() { return 99; }",
        "utf-8",
      );
      await git(["add", "c.ts"]);
      await git(["commit", "-m", "add c.ts"]);

      // Warm load — a.ts and b.ts should use cached blob hashes, c.ts is new
      const warm = await load_project({ project_path: temp_dir, storage });

      // All three files should be present
      const files = warm.get_all_files();
      expect(files.length).toEqual(3);

      // Full rebuild should match
      const fresh = await load_project({ project_path: temp_dir });
      assert_projects_equivalent(fresh, warm);
    } finally {
      await cleanup();
    }
  });

  it("dirty file (unstaged changes) forces re-index", async () => {
    await setup_git_repo({
      "a.ts": "export function foo() { return 42; }",
      "b.ts": "import { foo } from './a';\nconst x = foo();",
    });
    try {
      const storage = new InMemoryStorage();

      // Cold load
      await load_project({ project_path: temp_dir, storage });

      // Modify a.ts without staging — file becomes dirty
      await fs.writeFile(
        path.join(temp_dir, "a.ts"),
        "export function foo() { return 999; }\nexport function baz() { return 1; }",
        "utf-8",
      );

      // Warm load — a.ts is dirty so must be re-indexed
      const warm = await load_project({ project_path: temp_dir, storage });

      // Fresh build for comparison
      const fresh = await load_project({ project_path: temp_dir });
      assert_projects_equivalent(fresh, warm);
    } finally {
      await cleanup();
    }
  });

  it("untracked file is indexed on warm load", async () => {
    await setup_git_repo({
      "a.ts": "export function foo() { return 42; }",
    });
    try {
      const storage = new InMemoryStorage();

      // Cold load
      await load_project({ project_path: temp_dir, storage });

      // Add untracked file (not git-added)
      await fs.writeFile(
        path.join(temp_dir, "untracked.ts"),
        "export function untracked_fn() { return 0; }",
        "utf-8",
      );

      // Warm load — untracked file should be discovered and indexed
      const warm = await load_project({ project_path: temp_dir, storage });
      expect(warm.get_all_files().length).toEqual(2);

      const fresh = await load_project({ project_path: temp_dir });
      assert_projects_equivalent(fresh, warm);
    } finally {
      await cleanup();
    }
  });

  it("modified + committed file uses new content on warm load", async () => {
    await setup_git_repo({
      "a.ts": "export function foo() { return 42; }",
    });
    try {
      const storage = new InMemoryStorage();

      // Cold load
      const cold = await load_project({ project_path: temp_dir, storage });

      // Modify and commit — blob hash changes
      const new_content =
        "export function foo() { return 42; }\nexport function bar() { return 1; }";
      await fs.writeFile(path.join(temp_dir, "a.ts"), new_content, "utf-8");
      await git(["add", "a.ts"]);
      await git(["commit", "-m", "add bar"]);

      // Warm load — blob hash differs from cache, so a.ts is re-indexed
      const warm = await load_project({ project_path: temp_dir, storage });

      // Should have bar now
      const fresh = await load_project({ project_path: temp_dir });
      assert_projects_equivalent(fresh, warm);

      // Verify more definitions than cold load
      expect(warm.get_stats().definition_count).toBeGreaterThan(
        cold.get_stats().definition_count,
      );
    } finally {
      await cleanup();
    }
  });

  it("manifest git_tree_hash is updated after warm load with changes", async () => {
    await setup_git_repo({
      "a.ts": "export function foo() { return 42; }",
    });
    try {
      const storage = new InMemoryStorage();

      // Cold load
      await load_project({ project_path: temp_dir, storage });
      const manifest_v1 = JSON.parse((await storage.read_manifest())!);
      const tree_hash_v1 = manifest_v1.git_tree_hash;

      // Modify and commit
      await fs.writeFile(
        path.join(temp_dir, "b.ts"),
        "export function bar() {}",
        "utf-8",
      );
      await git(["add", "b.ts"]);
      await git(["commit", "-m", "add b"]);

      // Warm load
      await load_project({ project_path: temp_dir, storage });
      const manifest_v2 = JSON.parse((await storage.read_manifest())!);
      const tree_hash_v2 = manifest_v2.git_tree_hash;

      // Tree hash should be updated
      expect(tree_hash_v2).not.toEqual(tree_hash_v1);
      expect(typeof tree_hash_v2).toEqual("string");
      expect(tree_hash_v2.length).toEqual(40);
    } finally {
      await cleanup();
    }
  });
});

// ============================================================================
// load_project + FileSystemStorage Integration Tests
// ============================================================================

describe("load_project + FileSystemStorage", { timeout: 30_000 }, () => {
  let project_dir: string;
  let cache_dir: string;

  async function cleanup(): Promise<void> {
    if (project_dir) {
      await fs.rm(project_dir, { recursive: true, force: true });
    }
    if (cache_dir) {
      await fs.rm(cache_dir, { recursive: true, force: true });
    }
  }

  it("cold load persists indexes and manifest to disk", async () => {
    project_dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ariadne-fss-project-"),
    );
    cache_dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ariadne-fss-cache-"),
    );
    try {
      await fs.writeFile(
        path.join(project_dir, "a.ts"),
        "export function foo() { return 42; }",
        "utf-8",
      );
      await fs.writeFile(
        path.join(project_dir, "b.ts"),
        "import { foo } from './a';\nconst x = foo();",
        "utf-8",
      );

      const storage = new FileSystemStorage(cache_dir);
      const project = await load_project({
        project_path: project_dir,
        storage,
      });

      // Manifest should exist on disk
      const manifest_raw = await storage.read_manifest();
      expect(manifest_raw).not.toBeNull();
      const manifest = JSON.parse(manifest_raw!);
      expect(manifest.schema_version).toEqual(1);
      expect(manifest.entries.length).toEqual(2);

      // Indexes should exist on disk
      const a_path = path.join(project_dir, "a.ts");
      const b_path = path.join(project_dir, "b.ts");
      expect(await storage.read_index(a_path)).not.toBeNull();
      expect(await storage.read_index(b_path)).not.toBeNull();

      // Project should have correct stats
      expect(project.get_stats().file_count).toEqual(2);
    } finally {
      await cleanup();
    }
  });

  it("warm load from FileSystemStorage matches cold load (content-hash path)", async () => {
    project_dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ariadne-fss-warm-"),
    );
    cache_dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ariadne-fss-wcache-"),
    );
    try {
      await fs.writeFile(
        path.join(project_dir, "a.ts"),
        "export function foo() { return 42; }",
        "utf-8",
      );
      await fs.writeFile(
        path.join(project_dir, "b.ts"),
        "import { foo } from './a';\nconst x = foo();",
        "utf-8",
      );

      const storage = new FileSystemStorage(cache_dir);

      // Cold load — populates cache
      const cold = await load_project({
        project_path: project_dir,
        storage,
      });

      // Warm load — files unchanged, should use content-hash match
      const warm = await load_project({
        project_path: project_dir,
        storage,
      });

      assert_projects_equivalent(cold, warm);
    } finally {
      await cleanup();
    }
  });

  it("FileSystemStorage survives storage instance recreation", async () => {
    project_dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ariadne-fss-recreate-"),
    );
    cache_dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ariadne-fss-rcache-"),
    );
    try {
      await fs.writeFile(
        path.join(project_dir, "a.ts"),
        "export function foo() { return 42; }",
        "utf-8",
      );

      // Cold load with first storage instance
      const storage_v1 = new FileSystemStorage(cache_dir);
      const cold = await load_project({
        project_path: project_dir,
        storage: storage_v1,
      });

      // Create new storage instance pointing to same cache dir (simulates process restart)
      const storage_v2 = new FileSystemStorage(cache_dir);

      // Warm load with new instance — should read cached data from disk
      const warm = await load_project({
        project_path: project_dir,
        storage: storage_v2,
      });

      assert_projects_equivalent(cold, warm);
    } finally {
      await cleanup();
    }
  });

  it("FileSystemStorage + git repo: full end-to-end", async () => {
    project_dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ariadne-fss-git-"),
    );
    cache_dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ariadne-fss-gcache-"),
    );
    const exec = promisify(execFile);
    const git = (args: string[]) =>
      exec("git", args, { cwd: project_dir, env: clean_git_env() });
    try {
      // Set up git repo
      await git(["init"]);
      await git(["config", "user.email", "test@test.com"]);
      await git(["config", "user.name", "Test"]);

      await fs.writeFile(
        path.join(project_dir, "a.ts"),
        "export function foo() { return 42; }",
        "utf-8",
      );
      await git(["add", "."]);
      await git(["commit", "-m", "initial"]);

      const storage = new FileSystemStorage(cache_dir);

      // Cold load
      const cold = await load_project({
        project_path: project_dir,
        storage,
      });

      // Manifest should have git_tree_hash on disk
      const manifest_raw = await storage.read_manifest();
      const manifest = JSON.parse(manifest_raw!);
      expect(typeof manifest.git_tree_hash).toEqual("string");

      // Warm load — should use git fast path with on-disk storage
      const warm = await load_project({
        project_path: project_dir,
        storage,
      });

      assert_projects_equivalent(cold, warm);
    } finally {
      await cleanup();
    }
  });
});

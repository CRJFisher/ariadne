import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { Project } from "../project/project";
import type { SemanticIndex } from "../index_single_file/index_single_file";
import {
  serialize_semantic_index,
  deserialize_semantic_index,
} from "./serialize_index";
import { InMemoryStorage } from "./storage.test";
import { load_project } from "../project/load_project";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

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

  // Same call graph structure
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
    expect(cached_node?.enclosed_calls.length).toEqual(
      fresh_node.enclosed_calls.length,
    );
  }

  // Same per-file semantic index sizes
  for (const file_path of fresh.get_all_files()) {
    const fresh_index = fresh.get_index_single_file(file_path);
    const cached_index = cached.get_index_single_file(file_path);
    expect(cached_index?.functions.size).toEqual(fresh_index?.functions.size);
    expect(cached_index?.classes.size).toEqual(fresh_index?.classes.size);
    expect(cached_index?.variables.size).toEqual(fresh_index?.variables.size);
    expect(cached_index?.references.length).toEqual(
      fresh_index?.references.length,
    );
  }
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
});

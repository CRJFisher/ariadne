import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import type { CallGraph, FilePath, SymbolId } from "@ariadnejs/types";
import { load_project } from "./load_project";
import type { Project } from "./project";
import { trace_call_graph } from "../trace_call_graph/trace_call_graph";
import { IGNORED_DIRECTORIES } from "./file_loading";

describe("load_project", () => {
  let temp_dir: string;

  beforeEach(async () => {
    temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "ariadne-load-project-test-"));
  });

  afterEach(async () => {
    try {
      await fs.rm(temp_dir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should load all supported files from project_path", async () => {
    await fs.writeFile(path.join(temp_dir, "main.ts"), "export function main() {}");
    await fs.writeFile(path.join(temp_dir, "utils.ts"), "export function helper() {}");
    await fs.writeFile(path.join(temp_dir, "readme.md"), "# readme");

    const { project } = await load_project({ project_path: temp_dir });

    const call_graph = project.get_call_graph();
    // Should find the two TS functions as entry points
    expect(call_graph.entry_points.length).toBeGreaterThanOrEqual(2);
  });

  it("should load only specified files when files filter is provided", async () => {
    await fs.writeFile(path.join(temp_dir, "included.ts"), "export function included() {}");
    await fs.writeFile(path.join(temp_dir, "excluded.ts"), "export function excluded() {}");

    const { project } = await load_project({
      project_path: temp_dir,
      files: ["included.ts"],
    });

    const call_graph = project.get_call_graph();
    const names = [...call_graph.nodes.values()].map((n) => n.name);
    expect(names).toContain("included");
    expect(names).not.toContain("excluded");
  });

  it("should load files from specified folders", async () => {
    const sub_dir = path.join(temp_dir, "src");
    await fs.mkdir(sub_dir);
    await fs.writeFile(path.join(sub_dir, "app.ts"), "export function app() {}");
    await fs.writeFile(path.join(temp_dir, "root.ts"), "export function root() {}");

    const { project } = await load_project({
      project_path: temp_dir,
      folders: ["src"],
    });

    const call_graph = project.get_call_graph();
    const names = [...call_graph.nodes.values()].map((n) => n.name);
    expect(names).toContain("app");
    expect(names).not.toContain("root");
  });

  it("should skip unsupported files in files filter", async () => {
    await fs.writeFile(path.join(temp_dir, "data.json"), "{\"key\": \"value\"}");
    await fs.writeFile(path.join(temp_dir, "code.ts"), "export function code() {}");

    const { project } = await load_project({
      project_path: temp_dir,
      files: ["data.json", "code.ts"],
    });

    const call_graph = project.get_call_graph();
    const names = [...call_graph.nodes.values()].map((n) => n.name);
    expect(names).toContain("code");
  });

  it("should handle absolute file paths", async () => {
    await fs.writeFile(path.join(temp_dir, "abs.ts"), "export function abs_func() {}");

    const { project } = await load_project({
      project_path: temp_dir,
      files: [path.join(temp_dir, "abs.ts")],
    });

    const call_graph = project.get_call_graph();
    const names = [...call_graph.nodes.values()].map((n) => n.name);
    expect(names).toContain("abs_func");
  });

  it("should skip unreadable files gracefully", async () => {
    await fs.writeFile(path.join(temp_dir, "good.ts"), "export function good() {}");
    // Reference a file that doesn't exist
    const { project } = await load_project({
      project_path: temp_dir,
      files: ["nonexistent.ts", "good.ts"],
    });

    const call_graph = project.get_call_graph();
    const names = [...call_graph.nodes.values()].map((n) => n.name);
    expect(names).toContain("good");
  });

  describe("MDX component reachability (TASK-357)", () => {
    const BUTTON = "export function Button(props) {\n  return props.label;\n}\n";

    it("flags an unused exported component as an entry point", async () => {
      await fs.writeFile(path.join(temp_dir, "button.jsx"), BUTTON);

      const { project } = await load_project({ project_path: temp_dir });

      const call_graph = project.get_call_graph();
      const entry_names = call_graph.entry_points.map(
        (id) => call_graph.nodes.get(id)?.name,
      );
      expect(entry_names).toContain("Button");
    });

    it("does not flag a component whose only usage is a JSX element in an MDX file", async () => {
      await fs.writeFile(path.join(temp_dir, "button.jsx"), BUTTON);
      // Frontmatter precedes the `Button` import, and the sole usage is the JSX
      // element in the Markdown body — indexing must blank the frontmatter,
      // register the import, and resolve the JSX usage as a reference.
      await fs.writeFile(
        path.join(temp_dir, "page.mdx"),
        "---\ntitle: Demo\n---\n\nimport { Button } from \"./button\";\n\n# Heading\n\nBody copy before the component.\n\n<Button label=\"Click\" />\n",
      );

      const { project } = await load_project({ project_path: temp_dir });

      const call_graph = project.get_call_graph();
      const names = [...call_graph.nodes.values()].map((n) => n.name);
      expect(names).toContain("Button");

      const entry_names = call_graph.entry_points.map(
        (id) => call_graph.nodes.get(id)?.name,
      );
      expect(entry_names).not.toContain("Button");
    });

    it("resolves an MDX usage to a component defined in a .tsx module", async () => {
      // The typeorm origin case: components live in `.tsx`. MDX routes to the
      // JavaScript grammar, so its import resolver must reach the TypeScript
      // source for the component to count as reached.
      await fs.writeFile(
        path.join(temp_dir, "button.tsx"),
        "export function Button(props: { label: string }) {\n  return props.label;\n}\n",
      );
      await fs.writeFile(
        path.join(temp_dir, "page.mdx"),
        "import { Button } from \"./button\";\n\n# Heading\n\n<Button label=\"Click\" />\n",
      );

      const { project } = await load_project({ project_path: temp_dir });

      const call_graph = project.get_call_graph();
      const names = [...call_graph.nodes.values()].map((n) => n.name);
      expect(names).toContain("Button");

      const entry_names = call_graph.entry_points.map(
        (id) => call_graph.nodes.get(id)?.name,
      );
      expect(entry_names).not.toContain("Button");
    });

    it("resolves a default-exported component used from MDX", async () => {
      await fs.writeFile(
        path.join(temp_dir, "button.jsx"),
        "export default function Button(props) {\n  return props.label;\n}\n",
      );
      await fs.writeFile(
        path.join(temp_dir, "page.mdx"),
        "import Button from \"./button\";\n\n# Heading\n\n<Button label=\"Click\" />\n",
      );

      const { project } = await load_project({ project_path: temp_dir });

      const call_graph = project.get_call_graph();
      const names = [...call_graph.nodes.values()].map((n) => n.name);
      expect(names).toContain("Button");

      const entry_names = call_graph.entry_points.map(
        (id) => call_graph.nodes.get(id)?.name,
      );
      expect(entry_names).not.toContain("Button");
    });

    it("does not index plain .md files, so a component used only in Markdown stays an entry point", async () => {
      // Only `.mdx` is indexed; `.md` must not route to the JavaScript grammar,
      // so a component used solely inside a `.md` file has no textual caller.
      await fs.writeFile(
        path.join(temp_dir, "button.jsx"),
        "export function Button(props) {\n  return props.label;\n}\n",
      );
      await fs.writeFile(
        path.join(temp_dir, "page.md"),
        "import { Button } from \"./button\";\n\n# Heading\n\n<Button label=\"Click\" />\n",
      );

      const { project } = await load_project({ project_path: temp_dir });

      const call_graph = project.get_call_graph();
      const entry_names = call_graph.entry_points.map(
        (id) => call_graph.nodes.get(id)?.name,
      );
      expect(entry_names).toContain("Button");
    });
  });

  describe("every discovered caller file is in the corpus", () => {
    function raw_call_graph(project: Project, include_tests: boolean): CallGraph {
      return trace_call_graph(
        project.definitions,
        project.resolutions,
        project.get_languages(),
        { include_tests },
      );
    }

    function entry_point_names(call_graph: CallGraph): string[] {
      return call_graph.entry_points
        .map((id) => call_graph.nodes.get(id)?.name as string)
        .sort();
    }

    function node_names(call_graph: CallGraph): string[] {
      return [...call_graph.nodes.values()].map((n) => n.name as string).sort();
    }

    /**
     * Names the callable at `caller_name` resolves its calls to.
     *
     * `detect_entry_points` skips any symbol that appears as a resolution
     * target, and a bare import is enough to do that — so asserting only the
     * entry-point set cannot tell a real call edge from an import. This reads
     * the edge itself.
     */
    function resolved_call_targets(call_graph: CallGraph, caller_name: string): string[] {
      const caller = [...call_graph.nodes.values()].find((n) => n.name === caller_name);
      if (caller === undefined) {
        throw new Error(
          `expected a call-graph node named ${caller_name}, got ${node_names(call_graph).join(", ")}`,
        );
      }
      const targets = new Set(
        caller.enclosed_calls
          .flatMap((c) => c.resolutions.map((r) => r.symbol_id as SymbolId))
          .map((symbol_id) => call_graph.nodes.get(symbol_id)?.name as string)
          .filter((n) => n !== undefined),
      );
      return [...targets].sort();
    }

    async function write_file(relative_path: string, content: string): Promise<void> {
      const absolute_path = path.join(temp_dir, relative_path);
      await fs.mkdir(path.dirname(absolute_path), { recursive: true });
      await fs.writeFile(absolute_path, content, "utf-8");
    }

    it("resolves a callee whose only caller lives under __tests__ (prisma compileFile shape)", async () => {
      await write_file(
        "src/compile.ts",
        "export function compileFile(source: string): string {\n  return source;\n}\n",
      );
      await write_file(
        "src/__tests__/compile.test.ts",
        [
          "import { compileFile } from \"../compile\";",
          "",
          "export function compiles_a_file(): string {",
          "  return compileFile(\"x\");",
          "}",
          "",
        ].join("\n"),
      );

      const { project } = await load_project({ project_path: temp_dir });

      const production_only = raw_call_graph(project, false);
      const with_tests = raw_call_graph(project, true);

      expect(node_names(production_only)).toEqual(["compileFile", "compiles_a_file"]);
      expect(resolved_call_targets(with_tests, "compiles_a_file")).toEqual(["compileFile"]);
      expect(entry_point_names(production_only)).toEqual([]);
      expect(entry_point_names(with_tests)).toEqual(["compiles_a_file"]);
    });

    it("resolves a callee whose only callers are filename-marked test modules (celery long_running_task shape)", async () => {
      for (const package_dir of ["t", "t/smoke", "t/smoke/tests", "t/unit", "t/unit/app"]) {
        await write_file(`${package_dir}/__init__.py`, "");
      }
      await write_file(
        "t/smoke/tasks.py",
        "def long_running_task(seconds):\n    return seconds\n",
      );
      await write_file(
        "t/smoke/tests/test_worker.py",
        [
          "from t.smoke.tasks import long_running_task",
          "",
          "",
          "def test_worker():",
          "    return long_running_task.si(5)",
          "",
        ].join("\n"),
      );
      // Marked as a test by filename alone — `t/unit/app` matches no test-directory rule.
      await write_file(
        "t/unit/app/test_control.py",
        [
          "from t.smoke.tasks import long_running_task",
          "",
          "",
          "def test_control():",
          "    return long_running_task(1)",
          "",
        ].join("\n"),
      );

      const { project } = await load_project({ project_path: temp_dir });

      const production_only = raw_call_graph(project, false);
      const with_tests = raw_call_graph(project, true);

      expect(node_names(production_only)).toEqual([
        "long_running_task",
        "test_control",
        "test_worker",
      ]);
      // `t/unit/app` matches no test-directory rule, so this file is in the
      // corpus purely on its filename — and it is the one carrying the edge.
      expect(resolved_call_targets(with_tests, "test_control")).toEqual(["long_running_task"]);
      expect(entry_point_names(production_only)).toEqual([]);
      expect(entry_point_names(with_tests)).toEqual(["test_control", "test_worker"]);
    });

    it("indexes caller files whose path merely contains an ignored directory name", async () => {
      await write_file(
        "src/outputs.ts",
        "export function getAllProjectOutputs(): string[] {\n  return [];\n}\n",
      );
      await write_file(
        "src/compiler/tsbuildPublic.ts",
        [
          "import { getAllProjectOutputs } from \"../outputs\";",
          "",
          "export function build_all(): string[] {",
          "  return getAllProjectOutputs();",
          "}",
          "",
        ].join("\n"),
      );
      await write_file(
        "packages/compiler/src/template/pipeline/emit.ts",
        [
          "import { build_all } from \"../../../../../src/compiler/tsbuildPublic\";",
          "",
          "export function emit_template(): string[] {",
          "  return build_all();",
          "}",
          "",
        ].join("\n"),
      );
      await write_file(
        "packages/compiler/src/render3/r3_template_transform.ts",
        [
          "import { emit_template } from \"../template/pipeline/emit\";",
          "",
          "export function transform_template(): string[] {",
          "  return emit_template();",
          "}",
          "",
        ].join("\n"),
      );
      await write_file(
        "tools/write-locale-files-to-dist.ts",
        [
          "import { transform_template } from \"../packages/compiler/src/render3/r3_template_transform\";",
          "",
          "export function write_locales(): string[] {",
          "  return transform_template();",
          "}",
          "",
        ].join("\n"),
      );

      const { project } = await load_project({ project_path: temp_dir });

      const indexed = [...project.get_file_contents().keys()].map((f) =>
        path.relative(temp_dir, f),
      );
      expect(indexed.sort()).toEqual([
        "packages/compiler/src/render3/r3_template_transform.ts",
        "packages/compiler/src/template/pipeline/emit.ts",
        "src/compiler/tsbuildPublic.ts",
        "src/outputs.ts",
        "tools/write-locale-files-to-dist.ts",
      ]);
      const call_graph = raw_call_graph(project, false);
      expect(resolved_call_targets(call_graph, "build_all")).toEqual([
        "getAllProjectOutputs",
      ]);
      expect(resolved_call_targets(call_graph, "emit_template")).toEqual(["build_all"]);
      expect(resolved_call_targets(call_graph, "transform_template")).toEqual([
        "emit_template",
      ]);
      expect(entry_point_names(call_graph)).toEqual(["write_locales"]);
    });

    it("indexes a file that binds one export name twice (express lib/response.js shape)", async () => {
      await write_file(
        "lib/response.js",
        "exports.res = function res() {};\nexports.res = function res() {};\n",
      );
      await write_file("lib/app.js", "export function app() {}\n");

      const { project, dropped_files } = await load_project({
        project_path: temp_dir,
      });

      expect([...dropped_files]).toEqual([]);
      expect(project.get_file_contents().has(
        path.join(temp_dir, "lib/response.js") as FilePath,
      )).toBe(true);
      expect(project.get_file_contents().has(
        path.join(temp_dir, "lib/app.js") as FilePath,
      )).toBe(true);
      expect(node_names(raw_call_graph(project, false)).sort()).toEqual([
        "app",
        "res",
        "res",
      ]);
    });

    it("refuses a corpus over max_files rather than indexing an arbitrary subset", async () => {
      await write_file("a.ts", "export function a() {}\n");
      await write_file("b.ts", "export function b() {}\n");
      await write_file("c.ts", "export function c() {}\n");

      await expect(
        load_project({ project_path: temp_dir, max_files: 2 }),
      ).rejects.toThrow(/Discovered 3 source files, over the 2-file cap/);
    });

    it("indexes a corpus that sits on the cap", async () => {
      await write_file("a.ts", "export function a() {}\n");
      await write_file("b.ts", "export function b() {}\n");

      const { project } = await load_project({ project_path: temp_dir, max_files: 2 });

      expect(project.get_file_contents().size).toEqual(2);
    });

    it("reports no dropped files when every discovered file indexes", async () => {
      await write_file("lib/app.js", "export function app() {}\n");

      const { dropped_files } = await load_project({ project_path: temp_dir });

      expect([...dropped_files]).toEqual([]);
    });

    it("indexes the same corpus when the harness passes IGNORED_DIRECTORIES as exclude", async () => {
      await write_file(
        "src/outputs.ts",
        "export function getAllProjectOutputs(): string[] {\n  return [];\n}\n",
      );
      await write_file(
        "packages/compiler/src/template/pipeline/emit.ts",
        [
          "import { getAllProjectOutputs } from \"../../../../../src/outputs\";",
          "",
          "export function emit_template(): string[] {",
          "  return getAllProjectOutputs();",
          "}",
          "",
        ].join("\n"),
      );

      const { project } = await load_project({
        project_path: temp_dir,
        exclude: [...IGNORED_DIRECTORIES],
      });

      const indexed = [...project.get_file_contents().keys()]
        .map((f) => path.relative(temp_dir, f))
        .sort();
      expect(indexed).toEqual([
        "packages/compiler/src/template/pipeline/emit.ts",
        "src/outputs.ts",
      ]);

      const call_graph = raw_call_graph(project, false);
      expect(resolved_call_targets(call_graph, "emit_template")).toEqual([
        "getAllProjectOutputs",
      ]);
      expect(entry_point_names(call_graph)).toEqual(["emit_template"]);
    });
  });

  /**
   * A corpus arrives one file at a time, and a caller can arrive before the
   * callee it names. Nothing re-reads the whole corpus afterwards, so every
   * cross-file read a file makes has to be recorded as a dependency of it —
   * these pin the two reads that reach a file no import statement in the
   * caller names.
   */
  describe("resolution does not depend on the order files arrive in", () => {
    async function write_file(relative_path: string, content: string): Promise<void> {
      const absolute_path = path.join(temp_dir, relative_path);
      await fs.mkdir(path.dirname(absolute_path), { recursive: true });
      await fs.writeFile(absolute_path, content, "utf-8");
    }

    /**
     * The files a named call in `caller` binds to, by defining file. Reading
     * the edge itself rather than the entry-point set: a stale binding still
     * keeps its target off the entry points.
     */
    function call_target_files(
      project: Project,
      caller: string,
      call_name: string,
    ): string[] {
      const call = project.resolutions
        .get_calls_for_file(path.join(temp_dir, caller) as FilePath)
        .find((c) => (c.name as string) === call_name);
      if (call === undefined) {
        throw new Error(`expected a call named ${call_name} in ${caller}`);
      }
      return call.resolutions
        .map((r) => project.definitions.get(r.symbol_id)?.location.file_path as string)
        .map((file_path) => path.relative(temp_dir, file_path))
        .sort();
    }

    it("resolves a Rust qualified path whose module file is indexed after the caller", async () => {
      await write_file("lib.rs", "mod caller;\nmod deep;\n");
      // `caller.rs` declares no module of its own: `crate::deep::inner` is the
      // only thing naming the file the call lands in.
      await write_file(
        "caller.rs",
        "pub fn run() -> i32 {\n    crate::deep::inner::deep_fn()\n}\n",
      );
      await write_file("deep.rs", "pub mod inner;\n");
      await write_file("deep/inner.rs", "pub fn deep_fn() -> i32 {\n    1\n}\n");

      const { project } = await load_project({
        project_path: temp_dir,
        files: ["caller.rs", "deep/inner.rs", "deep.rs", "lib.rs"],
      });

      expect(call_target_files(project, "caller.rs", "deep_fn")).toEqual([
        "deep/inner.rs",
      ]);
    });

    it("resolves a name through a star-re-exporting barrel indexed after the consumer", async () => {
      // Named so a plain alphabetical walk is consumer-first too, not only the
      // explicit order below.
      await write_file(
        "app.ts",
        "import { leaf_fn } from './barrel';\n\nexport function drive(): number {\n  return leaf_fn();\n}\n",
      );
      await write_file("barrel.ts", "export * from './leaf';\n");
      await write_file("leaf.ts", "export function leaf_fn(): number {\n  return 1;\n}\n");

      const { project } = await load_project({
        project_path: temp_dir,
        files: ["app.ts", "barrel.ts", "leaf.ts"],
      });

      expect(call_target_files(project, "app.ts", "leaf_fn")).toEqual(["leaf.ts"]);
    });

    it("resolves a path hopping through a #[path]-remapped module indexed after the caller", async () => {
      // Nothing names `renamed.rs` but the `#[path]` attribute, so the hop is
      // the only edge that can bring the caller back when the file arrives.
      await write_file("lib.rs", "mod caller;\nmod deep;\n");
      await write_file(
        "caller.rs",
        "pub fn run() -> i32 {\n    crate::deep::inner::deep_fn()\n}\n",
      );
      await write_file("deep.rs", "#[path = \"renamed.rs\"]\npub mod inner;\n");
      await write_file("renamed.rs", "pub fn deep_fn() -> i32 {\n    1\n}\n");

      const { project } = await load_project({
        project_path: temp_dir,
        files: ["caller.rs", "deep.rs", "lib.rs", "renamed.rs"],
      });

      expect(call_target_files(project, "caller.rs", "deep_fn")).toEqual([
        "renamed.rs",
      ]);
    });

    it("resolves a path hopping through a re-exported module indexed after the caller", async () => {
      // `deep.rs` publishes the module rather than declaring it, so the file the
      // path lands in is named by neither the caller nor the declaring module.
      await write_file("lib.rs", "mod caller;\nmod deep;\nmod other;\n");
      await write_file(
        "caller.rs",
        "pub fn run() -> i32 {\n    crate::deep::inner::deep_fn()\n}\n",
      );
      await write_file("deep.rs", "pub use crate::other::inner;\n");
      await write_file("other/mod.rs", "pub mod inner;\n");
      await write_file("other/inner.rs", "pub fn deep_fn() -> i32 {\n    1\n}\n");

      const { project } = await load_project({
        project_path: temp_dir,
        files: ["caller.rs", "deep.rs", "lib.rs", "other/mod.rs", "other/inner.rs"],
      });

      expect(call_target_files(project, "caller.rs", "deep_fn")).toEqual([
        "other/inner.rs",
      ]);
    });
  });
});

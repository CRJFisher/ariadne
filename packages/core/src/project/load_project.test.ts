import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import type { FilePath } from "@ariadnejs/types";
import { load_project } from "./load_project";
import type { Project } from "./project";
import { trace_call_graph } from "../trace_call_graph/trace_call_graph";

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
    function raw_entry_point_names(project: Project): string[] {
      const call_graph = trace_call_graph(
        project.definitions,
        project.resolutions,
        project.get_languages(),
        { include_tests: false },
      );
      return call_graph.entry_points
        .map((id) => call_graph.nodes.get(id)?.name as string)
        .sort();
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

      expect(raw_entry_point_names(project)).toEqual([]);
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

      expect(raw_entry_point_names(project)).toEqual([]);
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
        "tools/write-locale-files-to-dist.ts",
        [
          "import { emit_template } from \"../packages/compiler/src/template/pipeline/emit\";",
          "",
          "export function write_locales(): string[] {",
          "  return emit_template();",
          "}",
          "",
        ].join("\n"),
      );

      const { project } = await load_project({ project_path: temp_dir });

      const indexed = [...project.get_file_contents().keys()].map((f) =>
        path.relative(temp_dir, f),
      );
      expect(indexed.sort()).toEqual([
        "packages/compiler/src/template/pipeline/emit.ts",
        "src/compiler/tsbuildPublic.ts",
        "src/outputs.ts",
        "tools/write-locale-files-to-dist.ts",
      ]);
      expect(raw_entry_point_names(project)).toEqual(["write_locales"]);
    });

    it("reports a file dropped by an indexing error (express lib/response.js shape)", async () => {
      await write_file(
        "lib/response.js",
        "exports.res = function res() {};\nexports.res = function res() {};\n",
      );
      await write_file("lib/app.js", "export function app() {}\n");

      const { project, dropped_files } = await load_project({
        project_path: temp_dir,
      });

      expect([...dropped_files]).toEqual([path.join(temp_dir, "lib/response.js")]);
      // A dropped file keeps the content `update_file` stored before indexing
      // threw, so membership of `get_file_contents()` does not mean a file was
      // indexed — anything computing "discovered minus indexed" has to add the
      // dropped set back after subtracting the contents map.
      expect(project.get_file_contents().has(
        path.join(temp_dir, "lib/response.js") as FilePath,
      )).toBe(true);
      expect(project.get_file_contents().has(
        path.join(temp_dir, "lib/app.js") as FilePath,
      )).toBe(true);
    });

    it("reports no dropped files when every discovered file indexes", async () => {
      await write_file("lib/app.js", "export function app() {}\n");

      const { dropped_files } = await load_project({ project_path: temp_dir });

      expect([...dropped_files]).toEqual([]);
    });
  });
});

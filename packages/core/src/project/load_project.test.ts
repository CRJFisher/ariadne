import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { load_project } from "./load_project";

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

    const project = await load_project({ project_path: temp_dir });

    const call_graph = project.get_call_graph();
    // Should find the two TS functions as entry points
    expect(call_graph.entry_points.length).toBeGreaterThanOrEqual(2);
  });

  it("should load only specified files when files filter is provided", async () => {
    await fs.writeFile(path.join(temp_dir, "included.ts"), "export function included() {}");
    await fs.writeFile(path.join(temp_dir, "excluded.ts"), "export function excluded() {}");

    const project = await load_project({
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

    const project = await load_project({
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

    const project = await load_project({
      project_path: temp_dir,
      files: ["data.json", "code.ts"],
    });

    const call_graph = project.get_call_graph();
    const names = [...call_graph.nodes.values()].map((n) => n.name);
    expect(names).toContain("code");
  });

  it("should handle absolute file paths", async () => {
    await fs.writeFile(path.join(temp_dir, "abs.ts"), "export function abs_func() {}");

    const project = await load_project({
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
    const project = await load_project({
      project_path: temp_dir,
      files: ["nonexistent.ts", "good.ts"],
    });

    const call_graph = project.get_call_graph();
    const names = [...call_graph.nodes.values()].map((n) => n.name);
    expect(names).toContain("good");
  });
});

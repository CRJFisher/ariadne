import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

import { preview_folders } from "./preview_folders.js";
import type { FolderPreview, FolderPreviewResult } from "./preview_folders.js";

let temp_dir: string;

beforeEach(async () => {
  temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "preview-folders-test-"));
});

afterEach(async () => {
  await fs.rm(temp_dir, { recursive: true, force: true });
});

async function write_file(relative: string, content: string = ""): Promise<void> {
  const full = path.join(temp_dir, relative);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content);
}

async function write_files(count: number, dir_relative: string, ext: string): Promise<void> {
  for (let i = 0; i < count; i++) {
    await write_file(path.join(dir_relative, `f_${i}.${ext}`));
  }
}

function find_dir(result: FolderPreviewResult, relative_path: string): FolderPreview | undefined {
  return result.directories.find((d) => d.relative_path === relative_path);
}

describe("preview_folders", () => {
  it("returns empty directories and zero total for an empty project", async () => {
    const result = await preview_folders({ project_path: temp_dir });
    const expected: FolderPreviewResult = {
      project_path: temp_dir,
      max_depth: 5,
      total_source_files: 0,
      directories: [],
    };
    expect(result).toEqual(expected);
  });

  it("counts direct and recursive source files for a src/ tree", async () => {
    await write_files(3, "src", "ts");
    await write_files(5, "src/utils", "ts");

    const result = await preview_folders({ project_path: temp_dir });

    expect(result.total_source_files).toEqual(8);
    expect(find_dir(result, "src")).toEqual({
      relative_path: "src",
      depth: 1,
      file_count_direct: 3,
      file_count_recursive: 8,
    });
    expect(find_dir(result, path.join("src", "utils"))).toEqual({
      relative_path: path.join("src", "utils"),
      depth: 2,
      file_count_direct: 5,
      file_count_recursive: 5,
    });
  });

  it("sorts directories by recursive file count descending", async () => {
    await write_files(2, "small", "ts");
    await write_files(10, "big", "ts");
    await write_files(5, "medium", "ts");

    const result = await preview_folders({ project_path: temp_dir });

    expect(result.directories.map((d) => d.relative_path)).toEqual([
      "big",
      "medium",
      "small",
    ]);
  });

  it("reports a 600-file directory with the full count and no special flagging", async () => {
    await write_files(600, "data_models", "py");

    const result = await preview_folders({ project_path: temp_dir });

    const data_models = find_dir(result, "data_models");
    expect(data_models).toEqual({
      relative_path: "data_models",
      depth: 1,
      file_count_direct: 600,
      file_count_recursive: 600,
    });
    // No suggestion / score / flag fields exist on the type — confirmed by toEqual above.
  });

  it("excludes directories in IGNORED_DIRECTORIES", async () => {
    await write_files(2, "src", "ts");
    await write_files(50, "node_modules/lodash", "js");
    await write_files(10, "dist", "js");
    await write_files(3, ".git/objects", "ts");

    const result = await preview_folders({ project_path: temp_dir });

    expect(result.total_source_files).toEqual(2);
    expect(find_dir(result, "node_modules")).toBeUndefined();
    expect(find_dir(result, "dist")).toBeUndefined();
    expect(find_dir(result, ".git")).toBeUndefined();
  });

  it("excludes directories matched by .gitignore", async () => {
    await write_file(".gitignore", "generated\n");
    await write_files(4, "src", "ts");
    await write_files(20, "generated", "ts");

    const result = await preview_folders({ project_path: temp_dir });

    expect(result.total_source_files).toEqual(4);
    expect(find_dir(result, "generated")).toBeUndefined();
    expect(find_dir(result, "src")).toEqual({
      relative_path: "src",
      depth: 1,
      file_count_direct: 4,
      file_count_recursive: 4,
    });
  });

  it("does not infinitely recurse on symlink cycles", async () => {
    await fs.mkdir(path.join(temp_dir, "a"));
    await write_file("a/file.ts");
    await fs.symlink(temp_dir, path.join(temp_dir, "a", "loop"));

    const result = await preview_folders({ project_path: temp_dir });

    expect(result.total_source_files).toEqual(1);
    expect(find_dir(result, "a")).toEqual({
      relative_path: "a",
      depth: 1,
      file_count_direct: 1,
      file_count_recursive: 1,
    });
  });

  it("respects max_depth: deeper dirs do not appear, but their files contribute to ancestor recursive counts", async () => {
    await write_files(1, "lvl1", "ts");
    await write_files(1, "lvl1/lvl2", "ts");
    await write_files(1, "lvl1/lvl2/lvl3", "ts");

    const result = await preview_folders({
      project_path: temp_dir,
      max_depth: 2,
    });

    expect(result.max_depth).toEqual(2);
    expect(result.total_source_files).toEqual(3);
    expect(find_dir(result, "lvl1")).toEqual({
      relative_path: "lvl1",
      depth: 1,
      file_count_direct: 1,
      file_count_recursive: 3,
    });
    expect(find_dir(result, path.join("lvl1", "lvl2"))).toEqual({
      relative_path: path.join("lvl1", "lvl2"),
      depth: 2,
      file_count_direct: 1,
      file_count_recursive: 2,
    });
    expect(find_dir(result, path.join("lvl1", "lvl2", "lvl3"))).toBeUndefined();
  });

  it("ignores .d.ts and unsupported file extensions", async () => {
    await write_file("src/a.ts");
    await write_file("src/b.d.ts");
    await write_file("src/c.md");
    await write_file("src/d.json");

    const result = await preview_folders({ project_path: temp_dir });

    expect(result.total_source_files).toEqual(1);
    expect(find_dir(result, "src")).toEqual({
      relative_path: "src",
      depth: 1,
      file_count_direct: 1,
      file_count_recursive: 1,
    });
  });

  it("counts root-level source files in total but emits no entry for the root", async () => {
    await write_file("root_a.ts");
    await write_file("root_b.ts");

    const result = await preview_folders({ project_path: temp_dir });

    expect(result.total_source_files).toEqual(2);
    expect(result.directories).toEqual([]);
  });

  it("breaks ties in deterministic order by relative_path", async () => {
    await write_files(5, "gamma", "ts");
    await write_files(5, "alpha", "ts");
    await write_files(5, "beta", "ts");

    const result = await preview_folders({ project_path: temp_dir });

    expect(result.directories.map((d) => d.relative_path)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  it("resolves relative project_path to an absolute path in output", async () => {
    await write_files(1, "src", "ts");
    const relative = path.relative(process.cwd(), temp_dir);

    const result = await preview_folders({ project_path: relative });

    expect(result.project_path).toEqual(path.resolve(relative));
  });
});

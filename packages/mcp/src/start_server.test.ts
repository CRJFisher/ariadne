/**
 * Tests for start_server and helper functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { load_file_if_needed, load_project_files } from "./start_server";
import type { Project } from "@ariadnejs/core";
import type { FilePath } from "@ariadnejs/types";

// Mock fs/promises
vi.mock("fs/promises");

describe("load_file_if_needed", () => {
  let mock_project: Project;

  beforeEach(() => {
    mock_project = {
      update_file: vi.fn(),
    } as unknown as Project;
    vi.clearAllMocks();
  });

  it("should load file content and update project", async () => {
    const file_content = "const x = 1;";
    vi.mocked(fs.readFile).mockResolvedValue(file_content);

    await load_file_if_needed(mock_project, "/path/to/file.ts");

    expect(fs.readFile).toHaveBeenCalledWith("/path/to/file.ts", "utf-8");
    expect(mock_project.update_file).toHaveBeenCalledWith(
      "/path/to/file.ts" as FilePath,
      file_content
    );
  });

  it("should throw error when file read fails", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));

    await expect(
      load_file_if_needed(mock_project, "/path/to/missing.ts")
    ).rejects.toThrow("Failed to read file /path/to/missing.ts: File not found");
  });
});

describe("load_project_files", () => {
  let mock_project: Project;
  let console_warn_spy: ReturnType<typeof vi.spyOn>;
  let console_log_spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mock_project = {
      update_file: vi.fn(),
    } as unknown as Project;
    console_warn_spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    console_log_spy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    console_warn_spy.mockRestore();
    console_log_spy.mockRestore();
  });

  it("should load supported source files", async () => {
    // Mock .gitignore as not found
    vi.mocked(fs.readFile).mockImplementation(async (file_path) => {
      if (String(file_path).endsWith(".gitignore")) {
        throw new Error("ENOENT");
      }
      return "const x = 1;";
    });

    // Mock directory structure
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: "file.ts", isFile: () => true, isDirectory: () => false },
      { name: "file.js", isFile: () => true, isDirectory: () => false },
      { name: "file.py", isFile: () => true, isDirectory: () => false },
    ] as any);

    await load_project_files(mock_project, "/project");

    expect(mock_project.update_file).toHaveBeenCalledTimes(3);
  });

  it("should ignore node_modules directory", async () => {
    vi.mocked(fs.readFile).mockImplementation(async (file_path) => {
      if (String(file_path).endsWith(".gitignore")) {
        throw new Error("ENOENT");
      }
      return "const x = 1;";
    });

    vi.mocked(fs.readdir).mockImplementation(async (dir_path) => {
      const dir = String(dir_path);
      if (dir === "/project") {
        return [
          { name: "node_modules", isFile: () => false, isDirectory: () => true },
          { name: "src", isFile: () => false, isDirectory: () => true },
        ] as any;
      }
      if (dir === "/project/src") {
        return [
          { name: "index.ts", isFile: () => true, isDirectory: () => false },
        ] as any;
      }
      return [];
    });

    await load_project_files(mock_project, "/project");

    // Should only load from src, not node_modules
    expect(mock_project.update_file).toHaveBeenCalledTimes(1);
    expect(mock_project.update_file).toHaveBeenCalledWith(
      expect.stringContaining("index.ts"),
      expect.any(String)
    );
  });

  it("should ignore .d.ts files", async () => {
    vi.mocked(fs.readFile).mockImplementation(async (file_path) => {
      if (String(file_path).endsWith(".gitignore")) {
        throw new Error("ENOENT");
      }
      return "const x = 1;";
    });

    vi.mocked(fs.readdir).mockResolvedValue([
      { name: "types.d.ts", isFile: () => true, isDirectory: () => false },
      { name: "index.ts", isFile: () => true, isDirectory: () => false },
    ] as any);

    await load_project_files(mock_project, "/project");

    // Should only load index.ts, not types.d.ts
    expect(mock_project.update_file).toHaveBeenCalledTimes(1);
  });

  it("should respect gitignore patterns", async () => {
    vi.mocked(fs.readFile).mockImplementation(async (file_path) => {
      if (String(file_path).endsWith(".gitignore")) {
        return "dist/*\nbuild\n# comment\n";
      }
      return "const x = 1;";
    });

    vi.mocked(fs.readdir).mockImplementation(async (dir_path) => {
      const dir = String(dir_path);
      if (dir === "/project") {
        return [
          { name: "dist", isFile: () => false, isDirectory: () => true },
          { name: "src", isFile: () => false, isDirectory: () => true },
        ] as any;
      }
      if (dir === "/project/src") {
        return [
          { name: "index.ts", isFile: () => true, isDirectory: () => false },
        ] as any;
      }
      return [];
    });

    await load_project_files(mock_project, "/project");

    // Should only load from src
    expect(mock_project.update_file).toHaveBeenCalledTimes(1);
  });

  it("should handle directory read errors gracefully", async () => {
    vi.mocked(fs.readFile).mockImplementation(async (file_path) => {
      if (String(file_path).endsWith(".gitignore")) {
        throw new Error("ENOENT");
      }
      return "const x = 1;";
    });

    vi.mocked(fs.readdir).mockRejectedValue(new Error("Permission denied"));

    await load_project_files(mock_project, "/project");

    expect(console_warn_spy).toHaveBeenCalledWith(
      expect.stringContaining("Cannot read directory")
    );
  });

  it("should skip files that fail to load", async () => {
    let call_count = 0;
    vi.mocked(fs.readFile).mockImplementation(async (file_path) => {
      if (String(file_path).endsWith(".gitignore")) {
        throw new Error("ENOENT");
      }
      call_count++;
      if (call_count === 1) {
        throw new Error("Read error");
      }
      return "const x = 1;";
    });

    vi.mocked(fs.readdir).mockResolvedValue([
      { name: "bad.ts", isFile: () => true, isDirectory: () => false },
      { name: "good.ts", isFile: () => true, isDirectory: () => false },
    ] as any);

    await load_project_files(mock_project, "/project");

    // Should skip bad.ts and load good.ts
    expect(mock_project.update_file).toHaveBeenCalledTimes(1);
    expect(console_warn_spy).toHaveBeenCalledWith(
      expect.stringContaining("Skipping file")
    );
  });

  it("should log loading progress", async () => {
    vi.mocked(fs.readFile).mockImplementation(async (file_path) => {
      if (String(file_path).endsWith(".gitignore")) {
        throw new Error("ENOENT");
      }
      return "const x = 1;";
    });

    vi.mocked(fs.readdir).mockResolvedValue([
      { name: "file.ts", isFile: () => true, isDirectory: () => false },
    ] as any);

    await load_project_files(mock_project, "/project");

    expect(console_log_spy).toHaveBeenCalledWith(
      expect.stringContaining("Loading project files from:")
    );
    expect(console_log_spy).toHaveBeenCalledWith(
      expect.stringMatching(/Loaded \d+ files in \d+ms/)
    );
  });
});

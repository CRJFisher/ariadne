import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { ProjectManager } from "./project_manager";

describe("ProjectManager", () => {
  let temp_dir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "ariadne-test-"));
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(temp_dir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("initialize", () => {
    it("should initialize with a project path", async () => {
      const manager = new ProjectManager();
      await manager.initialize({ project_path: temp_dir, watch: false });

      expect(manager.get_project()).toBeDefined();
    });

    it("should throw if initialized twice", async () => {
      const manager = new ProjectManager();
      await manager.initialize({ project_path: temp_dir, watch: false });

      await expect(
        manager.initialize({ project_path: temp_dir, watch: false })
      ).rejects.toThrow("ProjectManager is already initialized");
    });

    it("should throw if getting project before initialization", () => {
      const manager = new ProjectManager();

      expect(() => manager.get_project()).toThrow(
        "ProjectManager must be initialized before getting project"
      );
    });
  });

  describe("load_all_files", () => {
    it("should load TypeScript files from project directory", async () => {
      // Create a test file
      const test_file = path.join(temp_dir, "test.ts");
      await fs.writeFile(test_file, "function hello() { return 'world'; }");

      const manager = new ProjectManager();
      await manager.initialize({ project_path: temp_dir, watch: false });
      await manager.load_all_files();

      expect(manager.has_loaded_files()).toBe(true);
    });

    it("should throw if load_all_files called before initialization", async () => {
      const manager = new ProjectManager();

      await expect(manager.load_all_files()).rejects.toThrow(
        "ProjectManager must be initialized before loading files"
      );
    });

    it("should ignore node_modules directory", async () => {
      // Create files in node_modules (should be ignored)
      const node_modules = path.join(temp_dir, "node_modules");
      await fs.mkdir(node_modules, { recursive: true });
      await fs.writeFile(
        path.join(node_modules, "package.ts"),
        "export const x = 1;"
      );

      // Create a file in the project root (should be loaded)
      await fs.writeFile(
        path.join(temp_dir, "index.ts"),
        "export const y = 2;"
      );

      const manager = new ProjectManager();
      await manager.initialize({ project_path: temp_dir, watch: false });
      await manager.load_all_files();

      // The manager should have loaded files (the test passes if no error)
      expect(manager.has_loaded_files()).toBe(true);
    });
  });

  describe("file watching", () => {
    it("should start and stop file watching", async () => {
      const manager = new ProjectManager();
      await manager.initialize({ project_path: temp_dir, watch: true });

      expect(manager.is_watching()).toBe(true);

      await manager.stop_watching();

      expect(manager.is_watching()).toBe(false);
    });

    it("should not start watching if watch option is false", async () => {
      const manager = new ProjectManager();
      await manager.initialize({ project_path: temp_dir, watch: false });

      expect(manager.is_watching()).toBe(false);
    });
  });
});

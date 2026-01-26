import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { create_file_watcher, FileWatcherCallbacks } from "./file_watcher";

describe("file_watcher", () => {
  let temp_dir: string;

  beforeEach(async () => {
    temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "ariadne-watcher-test-"));
  });

  afterEach(async () => {
    try {
      await fs.rm(temp_dir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("create_file_watcher", () => {
    it("should create a watcher that can be closed", async () => {
      const callbacks: FileWatcherCallbacks = {
        on_change: vi.fn(),
        on_add: vi.fn(),
        on_delete: vi.fn(),
      };

      const watcher = create_file_watcher({ project_path: temp_dir }, callbacks);

      expect(watcher).toBeDefined();

      await watcher.close();
    });

    it("should call on_add when a supported file is created", async () => {
      const on_add = vi.fn();
      const callbacks: FileWatcherCallbacks = {
        on_change: vi.fn(),
        on_add,
        on_delete: vi.fn(),
      };

      const watcher = create_file_watcher(
        { project_path: temp_dir, debounce_ms: 50 },
        callbacks
      );

      // Wait for watcher to be ready
      await new Promise<void>((resolve) => watcher.on("ready", resolve));

      // Create a TypeScript file
      const test_file = path.join(temp_dir, "test.ts");
      await fs.writeFile(test_file, "const x = 1;");

      // Wait for debounce + buffer
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(on_add).toHaveBeenCalledWith(test_file, "const x = 1;");

      await watcher.close();
    });

    it("should call on_change when a supported file is modified", async () => {
      const on_change = vi.fn();
      const on_add = vi.fn();
      const callbacks: FileWatcherCallbacks = {
        on_change,
        on_add,
        on_delete: vi.fn(),
      };

      const watcher = create_file_watcher(
        { project_path: temp_dir, debounce_ms: 50 },
        callbacks
      );

      await new Promise<void>((resolve) => watcher.on("ready", resolve));

      // Create file after watcher is ready
      const test_file = path.join(temp_dir, "test.ts");
      await fs.writeFile(test_file, "const x = 1;");

      // Wait for the add event to complete
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(on_add).toHaveBeenCalledWith(test_file, "const x = 1;");

      // Now modify the file
      await fs.writeFile(test_file, "const x = 2;");

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(on_change).toHaveBeenCalledWith(test_file, "const x = 2;");

      await watcher.close();
    });

    it("should call on_delete when a supported file is removed", async () => {
      // Create file before starting watcher
      const test_file = path.join(temp_dir, "test.ts");
      await fs.writeFile(test_file, "const x = 1;");

      const on_delete = vi.fn();
      const callbacks: FileWatcherCallbacks = {
        on_change: vi.fn(),
        on_add: vi.fn(),
        on_delete,
      };

      const watcher = create_file_watcher(
        { project_path: temp_dir, debounce_ms: 50 },
        callbacks
      );

      await new Promise<void>((resolve) => watcher.on("ready", resolve));

      // Delete the file
      await fs.unlink(test_file);

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(on_delete).toHaveBeenCalledWith(test_file);

      await watcher.close();
    });

    it("should ignore unsupported file extensions", async () => {
      const on_add = vi.fn();
      const callbacks: FileWatcherCallbacks = {
        on_change: vi.fn(),
        on_add,
        on_delete: vi.fn(),
      };

      const watcher = create_file_watcher(
        { project_path: temp_dir, debounce_ms: 50 },
        callbacks
      );

      await new Promise<void>((resolve) => watcher.on("ready", resolve));

      // Create files with unsupported extensions
      await fs.writeFile(path.join(temp_dir, "readme.md"), "# Hello");
      await fs.writeFile(path.join(temp_dir, "data.json"), "{}");
      await fs.writeFile(path.join(temp_dir, "image.png"), "binary");

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(on_add).not.toHaveBeenCalled();

      await watcher.close();
    });

    it("should ignore .d.ts declaration files", async () => {
      const on_add = vi.fn();
      const callbacks: FileWatcherCallbacks = {
        on_change: vi.fn(),
        on_add,
        on_delete: vi.fn(),
      };

      const watcher = create_file_watcher(
        { project_path: temp_dir, debounce_ms: 50 },
        callbacks
      );

      await new Promise<void>((resolve) => watcher.on("ready", resolve));

      // Create a .d.ts file (should be ignored)
      await fs.writeFile(path.join(temp_dir, "types.d.ts"), "declare const x: number;");

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(on_add).not.toHaveBeenCalled();

      await watcher.close();
    });

    it("should watch supported file extensions", async () => {
      const on_add = vi.fn();
      const callbacks: FileWatcherCallbacks = {
        on_change: vi.fn(),
        on_add,
        on_delete: vi.fn(),
      };

      const watcher = create_file_watcher(
        { project_path: temp_dir, debounce_ms: 50 },
        callbacks
      );

      await new Promise<void>((resolve) => watcher.on("ready", resolve));

      // Create files with various supported extensions
      const extensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go"];
      for (const ext of extensions) {
        await fs.writeFile(path.join(temp_dir, `file${ext}`), "code");
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(on_add).toHaveBeenCalledTimes(extensions.length);

      await watcher.close();
    });

    it("should debounce rapid file changes", async () => {
      // Create file before starting watcher
      const test_file = path.join(temp_dir, "test.ts");
      await fs.writeFile(test_file, "const x = 0;");

      const on_change = vi.fn();
      const callbacks: FileWatcherCallbacks = {
        on_change,
        on_add: vi.fn(),
        on_delete: vi.fn(),
      };

      const watcher = create_file_watcher(
        { project_path: temp_dir, debounce_ms: 100 },
        callbacks
      );

      await new Promise<void>((resolve) => watcher.on("ready", resolve));

      // Make rapid changes
      await fs.writeFile(test_file, "const x = 1;");
      await fs.writeFile(test_file, "const x = 2;");
      await fs.writeFile(test_file, "const x = 3;");

      await new Promise((resolve) => setTimeout(resolve, 400));

      // Should only be called once with final content due to debouncing
      expect(on_change).toHaveBeenCalledTimes(1);
      expect(on_change).toHaveBeenCalledWith(test_file, "const x = 3;");

      await watcher.close();
    });
  });
});

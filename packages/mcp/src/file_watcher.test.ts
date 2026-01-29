import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { create_file_watcher, FileWatcherCallbacks } from "./file_watcher";

/**
 * Wait for a mock function to be called, with timeout
 */
async function wait_for_call(mock: Mock, timeout_ms: number = 2000): Promise<void> {
  const start = Date.now();
  while (mock.mock.calls.length === 0) {
    if (Date.now() - start > timeout_ms) {
      throw new Error(`Timed out waiting for mock to be called after ${timeout_ms}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * Wait for a mock function to be called N times, with timeout
 */
async function wait_for_calls(mock: Mock, count: number, timeout_ms: number = 2000): Promise<void> {
  const start = Date.now();
  while (mock.mock.calls.length < count) {
    if (Date.now() - start > timeout_ms) {
      throw new Error(`Timed out waiting for ${count} calls (got ${mock.mock.calls.length}) after ${timeout_ms}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

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

      // Wait for callback to be called (with timeout)
      await wait_for_call(on_add);

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
      await wait_for_call(on_add);
      expect(on_add).toHaveBeenCalledWith(test_file, "const x = 1;");

      // Now modify the file
      await fs.writeFile(test_file, "const x = 2;");

      await wait_for_call(on_change);

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

      await wait_for_call(on_delete);

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

      await wait_for_calls(on_add, extensions.length);

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

      // Wait for debounced callback
      await wait_for_call(on_change);

      // Give a bit more time to ensure no additional calls come through
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should only be called once with final content due to debouncing
      expect(on_change).toHaveBeenCalledTimes(1);
      expect(on_change).toHaveBeenCalledWith(test_file, "const x = 3;");

      await watcher.close();
    });

    it("should handle symlink cycles gracefully without crashing", async () => {
      // Create a subdirectory with a symlink back to the parent (cycle).
      // On macOS, FSEvents may still report events through symlink paths
      // even with followSymlinks: false. The watcher should handle this
      // gracefully — ENOENT from stale symlink paths is logged at debug
      // level, not warn level.
      const sub_dir = path.join(temp_dir, "subdir");
      await fs.mkdir(sub_dir);
      await fs.symlink(temp_dir, path.join(sub_dir, "parent_link"));

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

      // Create a file in the subdirectory
      const test_file = path.join(sub_dir, "test.ts");
      await fs.writeFile(test_file, "const x = 1;");

      await wait_for_call(on_add);

      // The file should be detected with the correct content.
      // On macOS, FSEvents may report through symlink paths, so we verify
      // content rather than exact path.
      expect(on_add).toHaveBeenCalled();
      const calls = on_add.mock.calls;
      const content_found = calls.some(
        ([_path, content]: [string, string]) => content === "const x = 1;"
      );
      expect(content_found).toBe(true);

      await watcher.close();
    });
  });
});

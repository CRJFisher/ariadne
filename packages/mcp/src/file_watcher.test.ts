import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "events";
import { create_file_watcher, FileWatcherCallbacks } from "./file_watcher";

// We import fs/promises *after* vi.mock so we get the mocked version
import * as fs from "fs/promises";

// --- Mocks ---

let fake_watcher: EventEmitter & { close: ReturnType<typeof vi.fn> };

vi.mock("chokidar", () => ({
  watch: vi.fn(() => fake_watcher),
}));

vi.mock("fs/promises", () => ({
  readFile: vi.fn((_path: string) => Promise.resolve("file content")),
  writeFile: vi.fn(() => Promise.resolve()),
  unlink: vi.fn(() => Promise.resolve()),
}));

vi.mock("./logger", () => ({
  log_debug: vi.fn(),
  log_warn: vi.fn(),
  log_error: vi.fn(),
}));

const PROJECT_PATH = "/fake/project";

function make_fake_watcher(): EventEmitter & { close: ReturnType<typeof vi.fn> } {
  const emitter = new EventEmitter();
  (emitter as EventEmitter & { close: ReturnType<typeof vi.fn> }).close = vi.fn(() => Promise.resolve());
  return emitter as EventEmitter & { close: ReturnType<typeof vi.fn> };
}

describe("file_watcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fake_watcher = make_fake_watcher();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("create_file_watcher", () => {
    it("should create a watcher that can be closed", async () => {
      const callbacks: FileWatcherCallbacks = {
        on_change: vi.fn(),
        on_add: vi.fn(),
        on_delete: vi.fn(),
      };

      const watcher = create_file_watcher({ project_path: PROJECT_PATH }, callbacks);

      expect(watcher).toBeDefined();

      await watcher.close();
      expect(fake_watcher.close).toHaveBeenCalled();
    });

    it("should call on_add when a supported file is created", async () => {
      const on_add = vi.fn();
      const callbacks: FileWatcherCallbacks = {
        on_change: vi.fn(),
        on_add,
        on_delete: vi.fn(),
      };

      vi.mocked(fs.readFile).mockResolvedValue("const x = 1;");

      create_file_watcher({ project_path: PROJECT_PATH, debounce_ms: 50 }, callbacks);
      fake_watcher.emit("ready");

      fake_watcher.emit("add", "/fake/project/test.ts");

      // Advance past the debounce window
      await vi.advanceTimersByTimeAsync(50);

      expect(on_add).toHaveBeenCalledWith("/fake/project/test.ts", "const x = 1;");
    });

    it("should call on_change when a supported file is modified", async () => {
      const on_change = vi.fn();
      const on_add = vi.fn();
      const callbacks: FileWatcherCallbacks = {
        on_change,
        on_add,
        on_delete: vi.fn(),
      };

      vi.mocked(fs.readFile).mockResolvedValue("const x = 1;");

      create_file_watcher({ project_path: PROJECT_PATH, debounce_ms: 50 }, callbacks);
      fake_watcher.emit("ready");

      // First, an add event
      fake_watcher.emit("add", "/fake/project/test.ts");
      await vi.advanceTimersByTimeAsync(50);
      expect(on_add).toHaveBeenCalledWith("/fake/project/test.ts", "const x = 1;");

      // Now a change event
      vi.mocked(fs.readFile).mockResolvedValue("const x = 2;");
      fake_watcher.emit("change", "/fake/project/test.ts");
      await vi.advanceTimersByTimeAsync(50);

      expect(on_change).toHaveBeenCalledWith("/fake/project/test.ts", "const x = 2;");
    });

    it("should call on_delete when a supported file is removed", async () => {
      const on_delete = vi.fn();
      const callbacks: FileWatcherCallbacks = {
        on_change: vi.fn(),
        on_add: vi.fn(),
        on_delete,
      };

      create_file_watcher({ project_path: PROJECT_PATH, debounce_ms: 50 }, callbacks);
      fake_watcher.emit("ready");

      fake_watcher.emit("unlink", "/fake/project/test.ts");
      await vi.advanceTimersByTimeAsync(50);

      expect(on_delete).toHaveBeenCalledWith("/fake/project/test.ts");
    });

    it("should ignore unsupported file extensions", async () => {
      const on_add = vi.fn();
      const callbacks: FileWatcherCallbacks = {
        on_change: vi.fn(),
        on_add,
        on_delete: vi.fn(),
      };

      create_file_watcher({ project_path: PROJECT_PATH, debounce_ms: 50 }, callbacks);
      fake_watcher.emit("ready");

      // Emit add events for unsupported file types
      fake_watcher.emit("add", "/fake/project/readme.md");
      fake_watcher.emit("add", "/fake/project/data.json");
      fake_watcher.emit("add", "/fake/project/image.png");

      await vi.advanceTimersByTimeAsync(100);

      expect(on_add).not.toHaveBeenCalled();
    });

    it("should ignore .d.ts declaration files", async () => {
      const on_add = vi.fn();
      const callbacks: FileWatcherCallbacks = {
        on_change: vi.fn(),
        on_add,
        on_delete: vi.fn(),
      };

      create_file_watcher({ project_path: PROJECT_PATH, debounce_ms: 50 }, callbacks);
      fake_watcher.emit("ready");

      fake_watcher.emit("add", "/fake/project/types.d.ts");

      await vi.advanceTimersByTimeAsync(100);

      expect(on_add).not.toHaveBeenCalled();
    });

    it("should watch supported file extensions", async () => {
      const on_add = vi.fn();
      const callbacks: FileWatcherCallbacks = {
        on_change: vi.fn(),
        on_add,
        on_delete: vi.fn(),
      };

      vi.mocked(fs.readFile).mockResolvedValue("code");

      create_file_watcher({ project_path: PROJECT_PATH, debounce_ms: 50 }, callbacks);
      fake_watcher.emit("ready");

      const extensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go"];
      for (const ext of extensions) {
        fake_watcher.emit("add", `/fake/project/file${ext}`);
      }

      await vi.advanceTimersByTimeAsync(50);

      expect(on_add).toHaveBeenCalledTimes(extensions.length);
    });

    it("should debounce rapid file changes", async () => {
      const on_change = vi.fn();
      const callbacks: FileWatcherCallbacks = {
        on_change,
        on_add: vi.fn(),
        on_delete: vi.fn(),
      };

      create_file_watcher({ project_path: PROJECT_PATH, debounce_ms: 100 }, callbacks);
      fake_watcher.emit("ready");

      // Rapid change events on the same file
      fake_watcher.emit("change", "/fake/project/test.ts");
      fake_watcher.emit("change", "/fake/project/test.ts");
      fake_watcher.emit("change", "/fake/project/test.ts");

      // Set up readFile to return the "final" content
      vi.mocked(fs.readFile).mockResolvedValue("const x = 3;");

      await vi.advanceTimersByTimeAsync(100);

      // Should only be called once due to debouncing
      expect(on_change).toHaveBeenCalledTimes(1);
      expect(on_change).toHaveBeenCalledWith("/fake/project/test.ts", "const x = 3;");
    });

    it("should resolve relative paths to absolute", async () => {
      const on_add = vi.fn();
      const callbacks: FileWatcherCallbacks = {
        on_change: vi.fn(),
        on_add,
        on_delete: vi.fn(),
      };

      vi.mocked(fs.readFile).mockResolvedValue("code");

      create_file_watcher({ project_path: PROJECT_PATH, debounce_ms: 50 }, callbacks);
      fake_watcher.emit("ready");

      // Emit a relative path (chokidar sometimes does this)
      fake_watcher.emit("add", "src/test.ts");
      await vi.advanceTimersByTimeAsync(50);

      // Should resolve to absolute path using project_path
      const expected_path = require("path").resolve(PROJECT_PATH, "src/test.ts");
      expect(on_add).toHaveBeenCalledWith(expected_path, "code");
    });
  });
});

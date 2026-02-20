import * as chokidar from "chokidar";
import * as fs from "fs/promises";
import * as path from "path";
import { IGNORED_GLOBS, is_supported_file } from "./file_loading";
import { log_debug, log_error, log_warn } from "./logger";

export interface FileWatcherOptions {
  project_path: string;
  debounce_ms?: number;
}

export interface FileWatcherCallbacks {
  on_change: (file_path: string, content: string) => void;
  on_add: (file_path: string, content: string) => void;
  on_delete: (file_path: string) => void;
}

/**
 * Create a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked for a given key.
 */
function create_debounced_handler<T extends (...args: string[]) => void | Promise<void>>(
  func: T,
  wait: number
): T {
  const timeouts = new Map<string, ReturnType<typeof globalThis.setTimeout>>();

  return ((...args: string[]) => {
    const key = args[0]; // Use file path as key
    const existing = timeouts.get(key);
    if (existing) {
      globalThis.clearTimeout(existing);
    }

    const timeout = globalThis.setTimeout(async () => {
      timeouts.delete(key);
      await func(...args);
    }, wait);

    timeouts.set(key, timeout);
  }) as T;
}

function is_enoent(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as { code: string }).code === "ENOENT";
}

/**
 * Log a file read error at the appropriate level.
 * ENOENT errors are logged at debug level since they commonly occur
 * when symlink-traversed paths or race conditions produce stale paths.
 */
function log_file_read_error(event_type: string, file_path: string, error: unknown): void {
  if (is_enoent(error)) {
    log_debug(`File not found for ${event_type} event (likely symlink or race condition): ${file_path}`);
  } else {
    log_warn(`Failed to read ${event_type} file ${file_path}: ${error}`);
  }
}

/**
 * Create a file watcher for source files in the project directory.
 * Watches for changes, additions, and deletions of supported source files.
 */
export function create_file_watcher(
  options: FileWatcherOptions,
  callbacks: FileWatcherCallbacks
): chokidar.FSWatcher {
  const { project_path, debounce_ms = 300 } = options;

  // Create debounced handlers
  const handle_change = create_debounced_handler(
    async (file_path: string) => {
      if (!is_supported_file(file_path)) return;

      try {
        const content = await fs.readFile(file_path, "utf-8");
        callbacks.on_change(file_path, content);
      } catch (error) {
        log_file_read_error("changed", file_path, error);
      }
    },
    debounce_ms
  );

  const handle_add = create_debounced_handler(
    async (file_path: string) => {
      if (!is_supported_file(file_path)) return;

      try {
        const content = await fs.readFile(file_path, "utf-8");
        callbacks.on_add(file_path, content);
      } catch (error) {
        log_file_read_error("added", file_path, error);
      }
    },
    debounce_ms
  );

  const handle_delete = create_debounced_handler(
    (file_path: string) => {
      if (!is_supported_file(file_path)) return;
      callbacks.on_delete(file_path);
    },
    debounce_ms
  );

  // Create watcher
  const watcher = chokidar.watch(project_path, {
    ignored: IGNORED_GLOBS,
    persistent: true,
    ignoreInitial: true, // Don't emit events for existing files on startup
    followSymlinks: false, // Prevent cyclic symlink traversal
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  // Set up event handlers
  watcher
    .on("change", (file_path: string) => {
      log_debug(`Watcher raw change event: ${file_path}`);
      const abs_path = path.isAbsolute(file_path)
        ? file_path
        : path.resolve(project_path, file_path);
      handle_change(abs_path);
    })
    .on("add", (file_path: string) => {
      log_debug(`Watcher raw add event: ${file_path}`);
      const abs_path = path.isAbsolute(file_path)
        ? file_path
        : path.resolve(project_path, file_path);
      handle_add(abs_path);
    })
    .on("unlink", (file_path: string) => {
      log_debug(`Watcher raw unlink event: ${file_path}`);
      const abs_path = path.isAbsolute(file_path)
        ? file_path
        : path.resolve(project_path, file_path);
      handle_delete(abs_path);
    })
    .on("error", (error: Error) => {
      log_error(`File watcher error: ${error}`);
    });

  return watcher;
}

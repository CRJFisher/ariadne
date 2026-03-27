import { Project, load_project } from "@ariadnejs/core";
import type { PersistenceStorage } from "@ariadnejs/core";
import { FilePath } from "@ariadnejs/types";
import * as chokidar from "chokidar";
import { create_file_watcher, FileWatcherOptions } from "./file_watcher";
import { log_info, log_warn } from "./logger";

export interface ProjectManagerOptions {
  project_path: string;
  watch?: boolean;
  debounce_ms?: number;
  /** Optional persistence storage for caching SemanticIndex data between invocations. */
  storage?: PersistenceStorage;
}

/**
 * Manages a persistent Project instance with optional file watching.
 * Provides incremental updates when files change in the watched directory.
 */
export class ProjectManager {
  private project: Project;
  private watcher: chokidar.FSWatcher | null = null;
  private project_path: string;
  private storage: PersistenceStorage | null = null;
  private initialized = false;
  private files_loaded = false;

  constructor() {
    this.project = new Project();
    this.project_path = "";
  }

  /**
   * Initialize the project manager with a project path.
   * This initializes a placeholder Project and optionally starts file watching.
   * Call load_all_files() afterwards to populate the project index.
   */
  async initialize(options: ProjectManagerOptions): Promise<void> {
    if (this.initialized) {
      throw new Error("ProjectManager is already initialized");
    }

    this.project_path = options.project_path;
    this.storage = options.storage ?? null;

    // Initialize placeholder project (for watcher callbacks before load_all_files completes)
    await this.project.initialize(this.project_path as FilePath);
    this.initialized = true;

    if (options.watch) {
      this.start_watching({
        project_path: this.project_path,
        debounce_ms: options.debounce_ms,
      });
    }
  }

  /**
   * Load all source files from the project directory.
   * Delegates to load_project() which handles persistence (cache read/write)
   * and git-accelerated change detection automatically.
   */
  async load_all_files(): Promise<void> {
    if (!this.initialized) {
      throw new Error("ProjectManager must be initialized before loading files");
    }

    log_info(`Loading project files from: ${this.project_path}`);
    const start_time = Date.now();

    this.project = await load_project({
      project_path: this.project_path,
      storage: this.storage ?? undefined,
    });

    const duration = Date.now() - start_time;
    const stats = this.project.get_stats();
    log_info(`Loaded ${stats.file_count} files in ${duration}ms`);

    this.files_loaded = true;
  }

  /**
   * Get the managed Project instance.
   * The project is always up-to-date with the latest file changes if watching is enabled.
   */
  get_project(): Project {
    if (!this.initialized) {
      throw new Error("ProjectManager must be initialized before getting project");
    }
    return this.project;
  }

  /**
   * Check if files have been loaded into the project.
   */
  has_loaded_files(): boolean {
    return this.files_loaded;
  }

  /**
   * Start watching for file changes.
   */
  start_watching(options?: FileWatcherOptions): void {
    if (this.watcher) {
      log_warn("File watcher is already running");
      return;
    }

    const watch_options: FileWatcherOptions = {
      project_path: options?.project_path ?? this.project_path,
      debounce_ms: options?.debounce_ms,
    };

    log_info(`Starting file watcher for: ${watch_options.project_path}`);

    this.watcher = create_file_watcher(watch_options, {
      on_change: (file_path: string, content: string) => {
        log_info(`File changed: ${file_path}`);
        this.project.update_file(file_path as FilePath, content);
      },
      on_add: (file_path: string, content: string) => {
        log_info(`File added: ${file_path}`);
        this.project.update_file(file_path as FilePath, content);
      },
      on_delete: (file_path: string) => {
        log_info(`File deleted: ${file_path}`);
        this.project.remove_file(file_path as FilePath);
      },
    });
  }

  /**
   * Stop watching for file changes.
   */
  async stop_watching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      log_info("File watcher stopped");
    }
  }

  /**
   * Check if file watching is active.
   */
  is_watching(): boolean {
    return this.watcher !== null;
  }
}

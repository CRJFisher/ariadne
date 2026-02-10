/**
 * Performance Profiler for Ariadne
 *
 * Provides hierarchical timing instrumentation to separate JavaScript
 * processing time from native tree-sitter execution time.
 *
 * Usage:
 *   ARIADNE_PROFILE=1 npx tsx your-script.ts
 *
 * Example:
 *   profiler.start('update_file');
 *   profiler.start('tree_sitter_parse');
 *   const tree = parser.parse(content);
 *   profiler.end('tree_sitter_parse');
 *   profiler.end('update_file');
 *   profiler.report();
 */

import { performance } from "perf_hooks";
import type { FilePath } from "@ariadnejs/types";

export interface TimingEntry {
  label: string;
  total_ms: number;
  call_count: number;
  min_ms: number;
  max_ms: number;
  children: Map<string, TimingEntry>;
}

export interface FileTimingEntry {
  file_path: FilePath;
  parse_ms: number;
  query_ms: number;
  scopes_ms: number;
  definitions_ms: number;
  references_ms: number;
  total_ms: number;
  capture_count: number;
  scope_count: number;
  definition_count: number;
}

export interface ProfileReport {
  enabled: boolean;
  total_ms: number;
  entries: TimingEntry[];
  file_timings: FileTimingEntry[];
  summary: {
    native_ms: number;
    native_pct: number;
    js_ms: number;
    js_pct: number;
    file_count: number;
    avg_file_ms: number;
    slowest_files: Array<{ file: FilePath; ms: number }>;
  };
}

interface ActiveTimer {
  label: string;
  start: number;
  parent: ActiveTimer | null;
}

class Profiler {
  private enabled: boolean;
  private root_entries: Map<string, TimingEntry> = new Map();
  private active_stack: ActiveTimer | null = null;
  private file_timings: Map<FilePath, FileTimingEntry> = new Map();
  private current_file: FilePath | null = null;
  private current_file_data: Partial<FileTimingEntry> = {};

  constructor() {
    this.enabled = process.env.ARIADNE_PROFILE === "1";
  }

  /**
   * Start timing a labeled section
   */
  start(label: string): void {
    if (!this.enabled) return;

    const timer: ActiveTimer = {
      label,
      start: performance.now(),
      parent: this.active_stack,
    };
    this.active_stack = timer;
  }

  /**
   * End timing for the current section
   */
  end(label: string): void {
    if (!this.enabled) return;

    const end_time = performance.now();
    const timer = this.active_stack;

    if (!timer) {
      console.error(`Profiler: end('${label}') called with no active timer`);
      return;
    }

    if (timer.label !== label) {
      console.error(
        `Profiler: end('${label}') called but active timer is '${timer.label}'`
      );
      return;
    }

    const elapsed = end_time - timer.start;
    this.active_stack = timer.parent;

    // Find or create the entry in the appropriate parent
    const entry = this.get_or_create_entry(label, timer.parent);
    entry.total_ms += elapsed;
    entry.call_count += 1;
    entry.min_ms = Math.min(entry.min_ms, elapsed);
    entry.max_ms = Math.max(entry.max_ms, elapsed);

    // Track file-specific timings
    if (this.current_file) {
      this.update_file_timing(label, elapsed);
    }
  }

  /**
   * Start tracking a new file
   */
  start_file(file_path: FilePath): void {
    if (!this.enabled) return;

    this.current_file = file_path;
    this.current_file_data = {
      file_path,
      parse_ms: 0,
      query_ms: 0,
      scopes_ms: 0,
      definitions_ms: 0,
      references_ms: 0,
      total_ms: 0,
      capture_count: 0,
      scope_count: 0,
      definition_count: 0,
    };
    this.start("file_total");
  }

  /**
   * End tracking current file
   */
  end_file(): void {
    if (!this.enabled || !this.current_file) return;

    this.end("file_total");

    // Calculate total from components
    const data = this.current_file_data as FileTimingEntry;
    data.total_ms =
      data.parse_ms +
      data.query_ms +
      data.scopes_ms +
      data.definitions_ms +
      data.references_ms;

    this.file_timings.set(this.current_file, data);
    this.current_file = null;
    this.current_file_data = {};
  }

  /**
   * Record counts for current file
   */
  record_counts(counts: {
    captures?: number;
    scopes?: number;
    definitions?: number;
  }): void {
    if (!this.enabled || !this.current_file) return;

    if (counts.captures !== undefined) {
      this.current_file_data.capture_count = counts.captures;
    }
    if (counts.scopes !== undefined) {
      this.current_file_data.scope_count = counts.scopes;
    }
    if (counts.definitions !== undefined) {
      this.current_file_data.definition_count = counts.definitions;
    }
  }

  /**
   * Get comprehensive report
   */
  get_report(): ProfileReport {
    if (!this.enabled) {
      return {
        enabled: false,
        total_ms: 0,
        entries: [],
        file_timings: [],
        summary: {
          native_ms: 0,
          native_pct: 0,
          js_ms: 0,
          js_pct: 0,
          file_count: 0,
          avg_file_ms: 0,
          slowest_files: [],
        },
      };
    }

    const entries = Array.from(this.root_entries.values());
    const file_timings = Array.from(this.file_timings.values());

    // Calculate totals
    let total_ms = 0;
    let native_ms = 0;

    for (const entry of entries) {
      total_ms += entry.total_ms;
      if (
        entry.label === "tree_sitter_parse" ||
        entry.label === "query_captures"
      ) {
        native_ms += entry.total_ms;
      }
    }

    // Also check nested entries for native timings
    const find_native_time = (entry: TimingEntry): number => {
      let time = 0;
      if (
        entry.label === "tree_sitter_parse" ||
        entry.label === "query_captures"
      ) {
        time += entry.total_ms;
      }
      for (const child of entry.children.values()) {
        time += find_native_time(child);
      }
      return time;
    };

    for (const entry of entries) {
      for (const child of entry.children.values()) {
        native_ms += find_native_time(child);
      }
    }

    const js_ms = total_ms - native_ms;

    // Find slowest files
    const sorted_files = [...file_timings].sort(
      (a, b) => b.total_ms - a.total_ms
    );
    const slowest_files = sorted_files.slice(0, 10).map((f) => ({
      file: f.file_path,
      ms: f.total_ms,
    }));

    return {
      enabled: true,
      total_ms,
      entries,
      file_timings,
      summary: {
        native_ms,
        native_pct: total_ms > 0 ? (native_ms / total_ms) * 100 : 0,
        js_ms,
        js_pct: total_ms > 0 ? (js_ms / total_ms) * 100 : 0,
        file_count: file_timings.length,
        avg_file_ms:
          file_timings.length > 0 ? total_ms / file_timings.length : 0,
        slowest_files,
      },
    };
  }

  /**
   * Print human-readable report to console
   */
  report(): void {
    if (!this.enabled) {
      console.log("Profiler: disabled (set ARIADNE_PROFILE=1 to enable)");
      return;
    }

    const report = this.get_report();

    console.log("\n" + "=".repeat(70));
    console.log("                    ARIADNE PERFORMANCE PROFILE");
    console.log("=".repeat(70));

    console.log(`\nTotal Time: ${report.total_ms.toFixed(2)}ms`);
    console.log(
      `  Native (tree-sitter): ${report.summary.native_ms.toFixed(2)}ms (${report.summary.native_pct.toFixed(1)}%)`
    );
    console.log(
      `  JavaScript:           ${report.summary.js_ms.toFixed(2)}ms (${report.summary.js_pct.toFixed(1)}%)`
    );

    console.log(`\nFiles Processed: ${report.summary.file_count}`);
    console.log(`Average per file: ${report.summary.avg_file_ms.toFixed(2)}ms`);

    console.log("\n" + "-".repeat(70));
    console.log("TIMING BREAKDOWN BY PHASE");
    console.log("-".repeat(70));

    const print_entry = (entry: TimingEntry, indent: number = 0): void => {
      const prefix = "  ".repeat(indent);
      const pct =
        report.total_ms > 0
          ? ((entry.total_ms / report.total_ms) * 100).toFixed(1)
          : "0.0";
      const avg =
        entry.call_count > 0
          ? (entry.total_ms / entry.call_count).toFixed(2)
          : "0.00";

      console.log(
        `${prefix}${entry.label}: ${entry.total_ms.toFixed(2)}ms (${pct}%) ` +
          `[${entry.call_count} calls, avg: ${avg}ms, min: ${entry.min_ms.toFixed(2)}ms, max: ${entry.max_ms.toFixed(2)}ms]`
      );

      for (const child of entry.children.values()) {
        print_entry(child, indent + 1);
      }
    };

    for (const entry of report.entries) {
      print_entry(entry);
    }

    if (report.summary.slowest_files.length > 0) {
      console.log("\n" + "-".repeat(70));
      console.log("SLOWEST FILES (Top 10)");
      console.log("-".repeat(70));

      for (let i = 0; i < report.summary.slowest_files.length; i++) {
        const { file, ms } = report.summary.slowest_files[i];
        const pct = report.total_ms > 0 ? ((ms / report.total_ms) * 100).toFixed(1) : "0.0";
        console.log(`  ${i + 1}. ${file}`);
        console.log(`     ${ms.toFixed(2)}ms (${pct}%)`);
      }
    }

    console.log("\n" + "=".repeat(70));
  }

  // Private helpers

  private get_or_create_entry(
    label: string,
    parent: ActiveTimer | null
  ): TimingEntry {
    if (parent === null) {
      // Root level entry
      let entry = this.root_entries.get(label);
      if (!entry) {
        entry = {
          label,
          total_ms: 0,
          call_count: 0,
          min_ms: Infinity,
          max_ms: 0,
          children: new Map(),
        };
        this.root_entries.set(label, entry);
      }
      return entry;
    }

    // Find parent's entry and add as child
    const parent_entry = this.find_entry_for_timer(parent);
    if (!parent_entry) {
      // Fallback to root if parent not found
      return this.get_or_create_entry(label, null);
    }

    let child = parent_entry.children.get(label);
    if (!child) {
      child = {
        label,
        total_ms: 0,
        call_count: 0,
        min_ms: Infinity,
        max_ms: 0,
        children: new Map(),
      };
      parent_entry.children.set(label, child);
    }
    return child;
  }

  private find_entry_for_timer(timer: ActiveTimer): TimingEntry | null {
    // Build path from root to timer
    const path: string[] = [];
    let current: ActiveTimer | null = timer;
    while (current !== null) {
      path.unshift(current.label);
      current = current.parent;
    }

    // Navigate to entry
    let entry: TimingEntry | undefined = this.root_entries.get(path[0]);
    for (let i = 1; i < path.length && entry; i++) {
      entry = entry.children.get(path[i]);
    }

    return entry ?? null;
  }

  private update_file_timing(label: string, elapsed: number): void {
    switch (label) {
      case "tree_sitter_parse":
        this.current_file_data.parse_ms =
          (this.current_file_data.parse_ms || 0) + elapsed;
        break;
      case "query_captures":
        this.current_file_data.query_ms =
          (this.current_file_data.query_ms || 0) + elapsed;
        break;
      case "process_scopes":
        this.current_file_data.scopes_ms =
          (this.current_file_data.scopes_ms || 0) + elapsed;
        break;
      case "process_definitions":
        this.current_file_data.definitions_ms =
          (this.current_file_data.definitions_ms || 0) + elapsed;
        break;
      case "process_references":
        this.current_file_data.references_ms =
          (this.current_file_data.references_ms || 0) + elapsed;
        break;
    }
  }
}

/**
 * Singleton profiler instance
 */
export const profiler = new Profiler();

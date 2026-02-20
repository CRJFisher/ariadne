#!/usr/bin/env npx tsx
/**
 * Profile Analysis Script
 *
 * Analyzes the JSON output from the profiler and produces summary reports.
 *
 * Usage:
 *   npx tsx scripts/analyze_profile.ts [profile.json]
 *
 * If no file is provided, reads from stdin.
 */

import { readFileSync } from "fs";

interface TimingEntry {
  label: string;
  total_ms: number;
  call_count: number;
  min_ms: number;
  max_ms: number;
  children: TimingEntry[];
}

interface FileTimingEntry {
  file_path: string;
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

interface ProfileReport {
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
    slowest_files: Array<{ file: string; ms: number }>;
  };
}

function format_ms(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${ms.toFixed(2)}ms`;
}

function format_pct(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

function print_bar(pct: number, width: number = 40): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function analyze_profile(report: ProfileReport): void {
  if (!report.enabled) {
    console.log("Profiling was not enabled. Set ARIADNE_PROFILE=1 to enable.");
    return;
  }

  console.log("\n" + "═".repeat(70));
  console.log("                    ARIADNE PROFILE ANALYSIS");
  console.log("═".repeat(70));

  // Overall summary
  console.log("\n┌─ OVERALL SUMMARY ─────────────────────────────────────────────────┐");
  console.log(`│ Total Time:     ${format_ms(report.total_ms).padEnd(52)}│`);
  console.log(`│ Files Analyzed: ${report.summary.file_count.toString().padEnd(52)}│`);
  console.log(`│ Avg per File:   ${format_ms(report.summary.avg_file_ms).padEnd(52)}│`);
  console.log("└───────────────────────────────────────────────────────────────────┘");

  // Native vs JS breakdown
  console.log("\n┌─ NATIVE vs JAVASCRIPT ────────────────────────────────────────────┐");
  console.log(`│ Native (tree-sitter): ${format_ms(report.summary.native_ms)} (${format_pct(report.summary.native_pct)})`.padEnd(69) + "│");
  console.log(`│ ${print_bar(report.summary.native_pct, 50)} │`);
  console.log("│" + " ".repeat(69) + "│");
  console.log(`│ JavaScript:           ${format_ms(report.summary.js_ms)} (${format_pct(report.summary.js_pct)})`.padEnd(69) + "│");
  console.log(`│ ${print_bar(report.summary.js_pct, 50)} │`);
  console.log("└───────────────────────────────────────────────────────────────────┘");

  // Phase breakdown
  console.log("\n┌─ PHASE BREAKDOWN ─────────────────────────────────────────────────┐");

  const flatten_entries = (entries: TimingEntry[], prefix = ""): Array<{ label: string; entry: TimingEntry; depth: number }> => {
    const result: Array<{ label: string; entry: TimingEntry; depth: number }> = [];
    for (const entry of entries) {
      const depth = prefix.split(".").filter(Boolean).length;
      result.push({ label: prefix + entry.label, entry, depth });
      if (entry.children && entry.children.length > 0) {
        result.push(...flatten_entries(entry.children, prefix + "  "));
      }
    }
    return result;
  };

  const flat = flatten_entries(report.entries);

  for (const { entry, depth } of flat) {
    const indent = "  ".repeat(depth);
    const pct = report.total_ms > 0 ? (entry.total_ms / report.total_ms) * 100 : 0;
    const avg = entry.call_count > 0 ? entry.total_ms / entry.call_count : 0;

    const line = `│ ${indent}${entry.label}: ${format_ms(entry.total_ms)} (${format_pct(pct)}) [${entry.call_count} calls, avg: ${format_ms(avg)}]`;
    console.log(line.padEnd(69) + "│");
  }
  console.log("└───────────────────────────────────────────────────────────────────┘");

  // Slowest files
  if (report.summary.slowest_files.length > 0) {
    console.log("\n┌─ SLOWEST FILES (Top 10) ──────────────────────────────────────────┐");
    for (let i = 0; i < report.summary.slowest_files.length; i++) {
      const { file, ms } = report.summary.slowest_files[i];
      const pct = report.total_ms > 0 ? (ms / report.total_ms) * 100 : 0;

      // Truncate file path if too long
      const max_len = 50;
      const display_file = file.length > max_len
        ? "..." + file.slice(-(max_len - 3))
        : file;

      console.log(`│ ${(i + 1).toString().padStart(2)}. ${display_file}`.padEnd(69) + "│");
      console.log(`│     ${format_ms(ms)} (${format_pct(pct)})`.padEnd(69) + "│");
    }
    console.log("└───────────────────────────────────────────────────────────────────┘");
  }

  // File timing analysis
  if (report.file_timings.length > 0) {
    console.log("\n┌─ FILE TIMING DISTRIBUTION ────────────────────────────────────────┐");

    const times = report.file_timings.map(f => f.total_ms).sort((a, b) => a - b);
    const min = times[0];
    const max = times[times.length - 1];
    const median = times[Math.floor(times.length / 2)];
    const p90 = times[Math.floor(times.length * 0.9)];
    const p99 = times[Math.floor(times.length * 0.99)];

    console.log(`│ Min:    ${format_ms(min).padEnd(60)}│`);
    console.log(`│ Median: ${format_ms(median).padEnd(60)}│`);
    console.log(`│ P90:    ${format_ms(p90).padEnd(60)}│`);
    console.log(`│ P99:    ${format_ms(p99).padEnd(60)}│`);
    console.log(`│ Max:    ${format_ms(max).padEnd(60)}│`);
    console.log("└───────────────────────────────────────────────────────────────────┘");

    // Capture count analysis
    const capture_counts = report.file_timings.map(f => f.capture_count).filter(c => c > 0);
    if (capture_counts.length > 0) {
      capture_counts.sort((a, b) => a - b);
      const cap_min = capture_counts[0];
      const cap_max = capture_counts[capture_counts.length - 1];
      const cap_avg = capture_counts.reduce((a, b) => a + b, 0) / capture_counts.length;

      console.log("\n┌─ CAPTURE COUNT DISTRIBUTION ──────────────────────────────────────┐");
      console.log(`│ Min:     ${cap_min.toString().padEnd(59)}│`);
      console.log(`│ Average: ${cap_avg.toFixed(0).padEnd(59)}│`);
      console.log(`│ Max:     ${cap_max.toString().padEnd(59)}│`);
      console.log("└───────────────────────────────────────────────────────────────────┘");
    }
  }

  // Optimization suggestions
  console.log("\n┌─ OPTIMIZATION SUGGESTIONS ────────────────────────────────────────┐");

  if (report.summary.native_pct > 60) {
    console.log("│ ⚠ Native code (tree-sitter) dominates execution time.           │");
    console.log("│   Consider:                                                      │");
    console.log("│   - Simplifying query patterns in .scm files                     │");
    console.log("│   - Investigating incremental parsing                            │");
    console.log("│   - Profiling native code with Instruments/perf                  │");
  } else if (report.summary.js_pct > 60) {
    console.log("│ ⚠ JavaScript processing dominates execution time.               │");
    console.log("│   Consider:                                                      │");
    console.log("│   - Profiling with V8 CPU profiler (--cpu-prof)                  │");
    console.log("│   - Optimizing hot paths in scope/definition processing         │");
    console.log("│   - Caching intermediate results                                 │");
  } else {
    console.log("│ ✓ Balanced between native and JavaScript processing.            │");
  }

  console.log("└───────────────────────────────────────────────────────────────────┘");
  console.log("");
}

// Main
function main(): void {
  const args = process.argv.slice(2);
  let json: string;

  if (args.length > 0 && args[0] !== "-") {
    json = readFileSync(args[0], "utf-8");
  } else {
    // Read from stdin
    json = readFileSync(0, "utf-8");
  }

  try {
    const report: ProfileReport = JSON.parse(json);
    analyze_profile(report);
  } catch (error) {
    console.error("Error parsing profile JSON:", error);
    process.exit(1);
  }
}

main();

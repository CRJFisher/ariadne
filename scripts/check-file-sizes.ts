#!/usr/bin/env tsx

/**
 * File size check script to prevent tree-sitter parsing failures
 * Warns at 28KB and errors at 32KB (tree-sitter's limit)
 */

import * as fs from "fs";
import * as path from "path";

// Configuration
const WARNING_THRESHOLD = 28 * 1024; // 28KB
const ERROR_THRESHOLD = 32 * 1024;   // 32KB (tree-sitter limit)

interface FileCheckResult {
  path: string;
  size: number;
  status: "ok" | "warning" | "error";
}

interface RefactoringHint {
  pattern: string;
  suggestion: string;
}

const REFACTORING_HINTS: RefactoringHint[] = [
  {
    pattern: "project_call_graph",
    suggestion: "Consider splitting call graph logic into separate modules (traversal, building, analysis)"
  },
  {
    pattern: "test",
    suggestion: "Consider splitting large test files into focused test suites"
  },
  {
    pattern: "index",
    suggestion: "Consider moving exports to separate barrel files by feature"
  },
  {
    pattern: "graph",
    suggestion: "Consider extracting graph algorithms into separate utility modules"
  }
];

function format_size(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function get_refactoring_hint(file_path: string): string | undefined {
  for (const hint of REFACTORING_HINTS) {
    if (file_path.includes(hint.pattern)) {
      return hint.suggestion;
    }
  }
  return "Consider splitting into smaller, focused modules";
}

function find_files(dir: string, extensions: string[], ignore: string[] = []): string[] {
  const results: string[] = [];
  
  function walk(current_path: string) {
    // Skip ignored directories
    for (const ignore_pattern of ignore) {
      if (current_path.includes(ignore_pattern)) {
        return;
      }
    }
    
    const entries = fs.readdirSync(current_path, { withFileTypes: true });
    
    for (const entry of entries) {
      const full_path = path.join(current_path, entry.name);
      
      if (entry.isDirectory()) {
        walk(full_path);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          results.push(full_path);
        }
      }
    }
  }
  
  walk(dir);
  return results;
}

async function check_file_sizes(root_dir: string = "."): Promise<{
  results: FileCheckResult[];
  has_warnings: boolean;
  has_errors: boolean;
}> {
  const results: FileCheckResult[] = [];
  let has_warnings = false;
  let has_errors = false;

  // Find all source files
  const extensions = [".ts", ".js", ".tsx", ".jsx"];
  const ignore = ["node_modules", "dist", "build", ".git", "coverage"];
  const files = find_files(root_dir, extensions, ignore);

  for (const file of files) {
    const stats = fs.statSync(file);
    const size = stats.size;
    
    let status: "ok" | "warning" | "error" = "ok";
    if (size >= ERROR_THRESHOLD) {
      status = "error";
      has_errors = true;
    } else if (size >= WARNING_THRESHOLD) {
      status = "warning";
      has_warnings = true;
    }

    results.push({
      path: file,
      size,
      status
    });
  }

  return { results, has_warnings, has_errors };
}

async function main() {
  console.log("🔍 Checking file sizes...\n");

  // Check files in the packages directory
  const packages_dir = path.join(__dirname, "..", "packages");
  const { results, has_warnings, has_errors } = await check_file_sizes(packages_dir);

  // Sort by size descending
  results.sort((a, b) => b.size - a.size);

  // Report warnings and errors
  const problem_files = results.filter(r => r.status !== "ok");
  
  if (problem_files.length === 0) {
    console.log("✅ All files are within size limits!");
    console.log(`   Checked ${results.length} files\n`);
  } else {
    console.log(`Found ${problemFiles.length} files approaching or exceeding limits:\n`);

    for (const result of problem_files) {
      const icon = result.status === "error" ? "❌" : "⚠️";
      const label = result.status === "error" ? "ERROR" : "WARNING";
      
      console.log(`${icon} ${label}: ${result.path}`);
      console.log(`   Size: ${formatSize(result.size)} (limit: ${formatSize(ERROR_THRESHOLD)})`);
      
      if (result.status === "error") {
        const hint = get_refactoring_hint(result.path);
        console.log(`   💡 Hint: ${hint}`);
      }
      console.log();
    }
  }

  // Show top 5 largest files
  console.log("📊 Top 5 largest files:");
  const top5 = results.slice(0, 5);
  for (const result of top5) {
    const percent = ((result.size / ERROR_THRESHOLD) * 100).toFixed(0);
    console.log(`   ${formatSize(result.size)} (${percent}%) - ${result.path}`);
  }

  console.log("\nSummary:");
  console.log(`   Total files checked: ${results.length}`);
  console.log(`   Files > 28KB (warning): ${results.filter(r => r.status === "warning").length}`);
  console.log(`   Files > 32KB (error): ${results.filter(r => r.status === "error").length}`);

  // Exit with error code if any files exceed the limit
  if (has_errors) {
    console.log("\n❌ File size check failed! Files exceed tree-sitter's 32KB limit.");
    console.log("   Please refactor large files before committing.\n");
    process.exit(1);
  } else if (has_warnings) {
    console.log("\n⚠️  Some files are approaching the size limit.");
    console.log("   Consider refactoring before they grow further.\n");
  } else {
    console.log("\n✅ All files are well within size limits.\n");
  }
}

// Support running as a module
export { check_file_sizes, WARNING_THRESHOLD, ERROR_THRESHOLD };

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error("Error checking file sizes:", err);
    process.exit(1);
  });
}
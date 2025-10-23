#!/usr/bin/env node
import { Project } from "./packages/core/src/project/project.js";
import { FilePath } from "@ariadnejs/types";
import * as fs from "fs/promises";
import * as path from "path";

async function check_if_called(func_name: string, expected_file: string, expected_caller: string) {
  const project = new Project();
  await project.initialize(path.resolve("packages/core") as FilePath, ["tests"]);

  // Load the file with the function
  const callee_file = path.resolve(expected_file);
  const callee_source = await fs.readFile(callee_file, "utf-8");
  project.update_file(callee_file as FilePath, callee_source);

  // Load the file that calls it
  const caller_file = path.resolve(expected_caller);
  const caller_source = await fs.readFile(caller_file, "utf-8");
  project.update_file(caller_file as FilePath, caller_source);

  // Check if the function is in the call graph
  const call_graph = project.get_call_graph();
  const callable_defs = project.definitions.get_callable_definitions();

  const target_def = callable_defs.find(
    (def) => def.name === func_name && def.location.file_path === callee_file
  );

  if (!target_def) {
    console.log(`Function '${func_name}' not found in ${expected_file}`);
    return;
  }

  const is_entry_point = call_graph.entry_points.includes(target_def.symbol_id);
  const file_short = expected_file.split("/").slice(-1)[0];
  const caller_short = expected_caller.split("/").slice(-1)[0];

  console.log(`\nFunction: ${func_name} (${file_short})`);
  console.log(`  Is entry point: ${is_entry_point ? "YES (BUG!)" : "NO (correct)"}`);

  // Check if it's actually called
  const all_calls = project.resolutions.get_file_calls(caller_file as FilePath);
  const calls_to_function = all_calls.filter(c => c.symbol_id === target_def.symbol_id);
  console.log(`  Called in ${caller_short}: ${calls_to_function.length} time(s)`);

  if (is_entry_point && calls_to_function.length > 0) {
    console.log("  ❌ FALSE POSITIVE - Function is called but marked as entry point!");
  } else if (!is_entry_point) {
    console.log("  ✅ Correctly identified as not an entry point");
  }
}

async function main() {
  console.log("=== CHECKING SUSPICIOUS ENTRY POINTS ===");

  await check_if_called(
    "query_tree",
    "packages/core/src/index_single_file/query_code_tree/query_code_tree.ts",
    "packages/core/src/index_single_file/semantic_index.ts"
  );

  await check_if_called(
    "detect_call_graph",
    "packages/core/src/trace_call_graph/detect_call_graph.ts",
    "packages/core/src/project/project.ts"
  );

  await check_if_called(
    "update_file",
    "packages/core/src/resolve_references/registries/export_registry.ts",
    "packages/core/src/project/project.ts"
  );
}

main().catch(console.error);

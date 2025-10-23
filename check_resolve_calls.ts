#!/usr/bin/env node
/**
 * Check if resolve_module_path calls are being detected in full analysis
 */

import { Project } from "./packages/core/src/project/project.js";
import { FilePath } from "@ariadnejs/types";
import * as path from "path";
import * as fs from "fs/promises";

async function should_load_file(file_path: string): Promise<boolean> {
  if (file_path.includes(".test.") || file_path.includes(".spec.")) {
    return false;
  }
  if (!file_path.endsWith(".ts") || file_path.endsWith(".d.ts")) {
    return false;
  }
  return true;
}

async function load_all_files(
  project: Project,
  project_path: string
): Promise<number> {
  let loaded_count = 0;

  async function load_directory(dir_path: string): Promise<void> {
    const entries = await fs.readdir(dir_path, { withFileTypes: true });

    for (const entry of entries) {
      const full_path = path.join(dir_path, entry.name);

      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === "dist" ||
          entry.name === ".git" ||
          entry.name === "coverage" ||
          entry.name === "tests"
        ) {
          continue;
        }
        await load_directory(full_path);
      } else if (entry.isFile()) {
        if (await should_load_file(full_path)) {
          try {
            const source_code = await fs.readFile(full_path, "utf-8");
            project.update_file(full_path as FilePath, source_code);
            loaded_count++;
          } catch (error) {
            console.error(`Warning: Failed to load ${full_path}: ${error}`);
          }
        }
      }
    }
  }

  await load_directory(project_path);
  return loaded_count;
}

async function check_calls() {
  const project_path = path.resolve("./packages/core");
  console.log(`Analyzing full project: ${project_path}\n`);

  // Initialize and load ALL files
  const project = new Project();
  await project.initialize(project_path as FilePath, ["tests"]);
  const files_loaded = await load_all_files(project, project_path);
  console.log(`Loaded ${files_loaded} files\n`);

  // Check calls from export_registry.ts
  const export_registry_file = path.join(
    project_path,
    "src/resolve_references/registries/export_registry.ts"
  ) as FilePath;

  const resolved_calls = (project.resolutions as any).get_file_calls(
    export_registry_file
  );
  const resolve_module_path_calls = resolved_calls.filter(
    (call: any) => call.name === "resolve_module_path"
  );

  console.log(`=== Resolved Calls to 'resolve_module_path' ===`);
  console.log(
    `From export_registry.ts: ${resolve_module_path_calls.length} calls resolved`
  );

  for (const call of resolve_module_path_calls) {
    console.log(`  Line ${call.location.start_line}:`);
    console.log(`    Symbol ID: ${call.symbol_id}`);
    console.log(`    Caller scope: ${call.caller_scope_id}`);
  }

  // Also check the call graph
  const call_graph = project.get_call_graph();
  const resolve_module_path_symbol_id =
    "function:/Users/chuck/workspace/ariadne/packages/core/src/resolve_references/import_resolution/import_resolver.ts:24:17:24:35:resolve_module_path";

  const node = call_graph.nodes.get(resolve_module_path_symbol_id);
  if (node) {
    const callers = call_graph.callers.get(resolve_module_path_symbol_id);
    console.log(`\n=== Call Graph Info ===`);
    console.log(`Entry point: ${call_graph.entry_points.includes(resolve_module_path_symbol_id)}`);
    console.log(`Callers: ${callers ? callers.size : 0}`);
    if (callers && callers.size > 0) {
      console.log(`Caller IDs:`);
      for (const caller_id of callers) {
        console.log(`  - ${caller_id}`);
      }
    }
  }
}

check_calls().catch(console.error);

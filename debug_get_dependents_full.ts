#!/usr/bin/env node
/**
 * Debug script - full analysis to find what's calling get_dependents
 */

import { Project } from "./packages/core/src/project/project.js";
import { FilePath } from "./packages/core/src/types/types.js";
import * as fs from "fs/promises";
import * as path from "path";

function should_load_file(file_path: string): boolean {
  if (file_path.includes(".test.") || file_path.includes(".spec.")) {
    return false;
  }
  if (!file_path.endsWith(".ts") || file_path.endsWith(".d.ts")) {
    return false;
  }
  return true;
}

async function load_project_files(project: Project, project_path: string): Promise<number> {
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
        if (should_load_file(full_path)) {
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

async function debug() {
  console.log("\n=== FULL ANALYSIS - INVESTIGATING get_dependents ===\n");

  const project_path = path.resolve("./packages/core");
  const project = new Project();
  await project.initialize(project_path as FilePath, ["tests"]);

  // Load all files
  const files_loaded = await load_project_files(project, project_path);
  console.log(`Loaded ${files_loaded} files\n`);

  // Find get_dependents method symbol - search all files
  let get_dependents_symbol_id: string | undefined;
  let project_file: FilePath | undefined;

  const all_files = project.get_all_files();
  console.log(`Searching ${all_files.length} files for get_dependents method...\n`);

  for (const file of all_files) {
    if (!file.includes("project.ts") || file.includes(".test.")) continue;

    const semantic_index = project.get_semantic_index(file);
    if (!semantic_index) continue;

    for (const class_def of semantic_index.classes.values()) {
      for (const method of class_def.methods) {
        if (method.name === "get_dependents") {
          get_dependents_symbol_id = method.symbol_id;
          project_file = file;
          console.log(`Found get_dependents method:`);
          console.log(`  file: ${file}`);
          console.log(`  symbol_id: ${get_dependents_symbol_id}`);
          console.log(`  location: line ${method.location.start_line}\n`);
          break;
        }
      }
      if (get_dependents_symbol_id) break;
    }
    if (get_dependents_symbol_id) break;
  }

  if (!get_dependents_symbol_id) {
    console.log("❌ Could not find get_dependents symbol!");
    return;
  }

  // Check if it's referenced
  const all_referenced = project.resolutions.get_all_referenced_symbols();
  const is_referenced = all_referenced.has(get_dependents_symbol_id);

  console.log(`Is get_dependents referenced (called)? ${is_referenced ? 'YES' : 'NO'}\n`);

  if (is_referenced) {
    console.log("Looking for WHERE it's called from:\n");

    // Search through all resolutions to find calls to this symbol
    const all_files = project.get_all_files();

    for (const file of all_files) {
      const semantic_idx = project.get_semantic_index(file);
      if (!semantic_idx) continue;

      // Check all references in this file
      for (const ref of semantic_idx.references) {
        const resolution = project.resolutions.get(ref.reference_id);
        if (resolution && resolution.symbol_id === get_dependents_symbol_id) {
          console.log(`  ✅ Called from: ${file}`);
          console.log(`     Line: ${ref.location.start_line}`);
          console.log(`     Reference: ${ref.name}`);
          console.log(`     Scope: ${ref.scope_id}`);

          // Try to find what function this is inside
          for (const func of semantic_idx.functions.values()) {
            if (func.body_scope_id && ref.scope_id.includes(func.body_scope_id)) {
              console.log(`     Inside function: ${func.name}`);
            }
          }

          // Check methods in classes
          for (const class_def of semantic_idx.classes.values()) {
            for (const method of class_def.methods) {
              if (method.body_scope_id && ref.scope_id.includes(method.body_scope_id)) {
                console.log(`     Inside method: ${class_def.name}.${method.name}`);
              }
            }
          }

          console.log();
        }
      }
    }
  }

  // Check call graph
  const call_graph = project.get_call_graph();
  const is_entry_point = call_graph.entry_points.some(id => id === get_dependents_symbol_id);

  console.log(`\nIs entry point in call graph? ${is_entry_point ? 'YES' : 'NO'}`);
  console.log(`Total entry points: ${call_graph.entry_points.length}`);

  console.log("\n=== INVESTIGATION COMPLETE ===\n");
}

debug().catch(console.error);

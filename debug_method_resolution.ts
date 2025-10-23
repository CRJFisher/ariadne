#!/usr/bin/env node
/**
 * Debug method resolution for this.definitions.update_file()
 */

import { Project } from "./packages/core/src/project/project.js";
import { FilePath } from "@ariadnejs/types";
import * as path from "path";
import * as fs from "fs/promises";

async function debug_method_resolution() {
  const project_path = path.resolve("./packages/core");
  console.log(`Analyzing: ${project_path}\n`);

  // Initialize project
  const project = new Project();
  await project.initialize(project_path as FilePath, ["tests"]);

  // Load project.ts
  const project_ts_file = path.join(project_path, "src/project/project.ts");
  const content = await fs.readFile(project_ts_file, "utf-8");
  project.update_file(project_ts_file as FilePath, content);

  // Also load definition_registry.ts so the method exists
  const def_reg_file = path.join(project_path, "src/resolve_references/registries/definition_registry.ts");
  const def_reg_content = await fs.readFile(def_reg_file, "utf-8");
  project.update_file(def_reg_file as FilePath, def_reg_content);

  console.log("=== Checking Call Resolution ===\n");

  // Get the resolved calls from project.ts
  const calls = (project.resolutions as any).get_file_calls(project_ts_file);

  // Find update_file calls
  const update_file_calls = calls.filter((call: any) => call.name === "update_file");

  console.log(`Total update_file calls: ${update_file_calls.length}\n`);

  // Look at the first few
  for (const call of update_file_calls.slice(0, 5)) {
    console.log(`Line ${call.location.start_line}: update_file`);
    console.log(`  Symbol ID: ${call.symbol_id}`);
    console.log(`  Resolved: ${call.symbol_id !== null}`);

    if (call.symbol_id) {
      // Check if it points to the right method
      const def = project.definitions.get(call.symbol_id);
      if (def) {
        console.log(`  Resolved to: ${def.kind} in ${def.location.file_path}:${def.location.start_line}`);
      }
    }
    console.log();
  }

  // Check if the definitions field is typed correctly
  console.log("=== Checking Class Structure ===\n");

  const all_defs = Array.from(project.definitions.get_all_definitions());
  const project_class = all_defs.find(def => def.name === "Project" && def.kind === "class");

  if (project_class) {
    console.log(`Found Project class: ${project_class.symbol_id}`);
    
    // Check if it has a definitions field
    const members = (project as any).types.get_type_members(project_class.symbol_id);
    console.log(`Type members: ${members ? Array.from(members.keys()).join(", ") : "none"}`);
  } else {
    console.log("Project class not found!");
  }
}

debug_method_resolution().catch(console.error);

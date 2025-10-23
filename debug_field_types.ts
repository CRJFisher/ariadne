#!/usr/bin/env node
/**
 * Debug field types in the Project class
 */

import { Project } from "./packages/core/src/project/project.js";
import { FilePath } from "@ariadnejs/types";
import * as path from "path";
import * as fs from "fs/promises";

async function debug_field_types() {
  const project_path = path.resolve("./packages/core");
  console.log(`Analyzing: ${project_path}\n`);

  // Initialize project
  const project = new Project();
  await project.initialize(project_path as FilePath, ["tests"]);

  // Load project.ts
  const project_ts_file = path.join(project_path, "src/project/project.ts");
  const content = await fs.readFile(project_ts_file, "utf-8");
  project.update_file(project_ts_file as FilePath, content);

  const all_defs = Array.from(project.definitions.get_all_definitions());
  const project_class = all_defs.find(def => def.name === "Project" && def.kind === "class");

  if (!project_class) {
    console.log("Project class not found!");
    return;
  }

  console.log(`Found Project class: ${project_class.symbol_id}\n`);

  // Get all members of the Project class
  const member_index = project.definitions.get_member_index();
  const class_members = member_index.get(project_class.symbol_id);

  if (!class_members) {
    console.log("No members found for Project class!");
    return;
  }

  console.log("=== Project Class Members ===\n");
  for (const [name, symbol_id] of class_members.entries()) {
    const def = project.definitions.get(symbol_id);
    if (def) {
      console.log(`${name}: ${def.kind}`);

      // Check if it has type information
      const type_id = project.types.get_symbol_type(symbol_id);
      if (type_id) {
        const type_def = project.definitions.get(type_id);
        console.log(`  Type: ${type_id}`);
        if (type_def) {
          console.log(`  Type def: ${type_def.kind} ${type_def.name}`);
        }
      } else {
        console.log(`  Type: none`);
      }
    }
  }

  // Specifically check the definitions field
  console.log("\n=== Definitions Field ===\n");
  const definitions_symbol = class_members.get("definitions");
  if (definitions_symbol) {
    console.log(`Symbol ID: ${definitions_symbol}`);
    const def = project.definitions.get(definitions_symbol);
    console.log(`Definition: ${def?.kind}`);

    const type_id = project.types.get_symbol_type(definitions_symbol);
    console.log(`Type ID: ${type_id}`);

    if (type_id) {
      const type_def = project.definitions.get(type_id);
      if (type_def) {
        console.log(`Type: ${type_def.kind} ${type_def.name}`);

        // Get members of DefinitionRegistry
        const type_members = member_index.get(type_id);
        if (type_members) {
          console.log(`\nDefinitionRegistry members:`);
          for (const [name, member_id] of type_members.entries()) {
            const member_def = project.definitions.get(member_id);
            console.log(`  - ${name}: ${member_def?.kind}`);
          }
        }
      }
    }
  } else {
    console.log("definitions field not found!");
  }
}

debug_field_types().catch(console.error);

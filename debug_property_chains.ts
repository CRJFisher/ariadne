#!/usr/bin/env node
/**
 * Debug property chains in method calls
 */

import { Project } from "./packages/core/src/project/project.js";
import { FilePath } from "@ariadnejs/types";
import * as path from "path";
import * as fs from "fs/promises";

async function debug_property_chains() {
  const project_path = path.resolve("./packages/core");
  console.log(`Analyzing: ${project_path}\n`);

  // Initialize project
  const project = new Project();
  await project.initialize(project_path as FilePath, ["tests"]);

  // Load project.ts
  const project_ts_file = path.join(project_path, "src/project/project.ts");
  const content = await fs.readFile(project_ts_file, "utf-8");
  project.update_file(project_ts_file as FilePath, content);

  // Get references from project.ts
  const references = (project as any).references.get_file_references(project_ts_file);

  console.log("=== Method Calls in project.ts ===\n");
  
  // Filter to only call references
  const calls = references.filter((ref: any) => ref.type === "call");
  
  console.log(`Total calls: ${calls.length}\n`);

  // Look for calls with property chains
  const calls_with_chains = calls.filter((ref: any) => 
    ref.context?.property_chain && ref.context.property_chain.length > 1
  );

  console.log(`Calls with property chains: ${calls_with_chains.length}\n`);

  // Show first 10 examples
  for (const call of calls_with_chains.slice(0, 15)) {
    console.log(`Line ${call.location.start_line}: ${call.name}`);
    console.log(`  Property chain: [${call.context.property_chain.join(", ")}]`);
    console.log(`  Chain length: ${call.context.property_chain.length}`);
    console.log(`  Call type: ${call.call_type}`);
    console.log();
  }

  // Look specifically for update_file calls
  const update_file_calls = calls.filter((ref: any) => ref.name === "update_file");
  console.log(`\n=== update_file Calls ===\n`);
  console.log(`Total update_file calls: ${update_file_calls.length}\n`);

  for (const call of update_file_calls) {
    console.log(`Line ${call.location.start_line}: ${call.name}`);
    console.log(`  Property chain: ${call.context?.property_chain ? `[${call.context.property_chain.join(", ")}]` : "none"}`);
    console.log(`  Has receiver_location: ${!!call.context?.receiver_location}`);
    console.log(`  Call type: ${call.call_type}`);
    console.log();
  }
}

debug_property_chains().catch(console.error);

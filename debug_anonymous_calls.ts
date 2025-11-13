#!/usr/bin/env npx tsx
/**
 * Debug script to understand why anonymous function calls aren't being attributed
 */

import { Project } from "@ariadnejs/core";
import { FilePath } from "@ariadnejs/types";
import * as path from "path";
import * as fs from "fs/promises";

async function debug_anonymous_functions() {
  const project = new Project();

  // Initialize the project first
  await project.initialize();

  const test_file = path.resolve(process.cwd(), "packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder_config.ts");

  console.log(`Loading file: ${test_file}`);
  const content = await fs.readFile(test_file, "utf-8");
  project.update_file(test_file as FilePath, content);

  const call_graph = project.get_call_graph();

  // Find anonymous functions
  const anon_functions = Array.from(call_graph.nodes.values()).filter(
    n => n.name === "<anonymous>"
  );

  console.log(`\nFound ${anon_functions.length} anonymous functions`);

  // Check one anonymous function
  if (anon_functions.length > 0) {
    const anon = anon_functions[0];
    console.log(`\nExample anonymous function at line ${anon.location.start_line}:`);
    console.log(`  Callers: ${anon.callers.size}`);
    console.log(`  Enclosed calls: ${anon.enclosed_calls.length}`);

    if (anon.enclosed_calls.length > 0) {
      console.log(`\n  Calls made by this anonymous function:`);
      for (const call of anon.enclosed_calls.slice(0, 5)) {
        console.log(`    - ${call.name} (${call.symbol_id ? 'resolved' : 'unresolved'})`);
      }
    }
  }

  // Check if add_class has callers now
  const add_class_node = Array.from(call_graph.nodes.values()).find(
    n => n.name === "add_class"
  );

  if (add_class_node) {
    console.log(`\nadd_class node:`);
    console.log(`  Callers: ${add_class_node.callers.size}`);
    console.log(`  Is entry point: ${call_graph.entry_points.includes(add_class_node.symbol_id)}`);

    if (add_class_node.callers.size > 0) {
      console.log(`  Called by:`);
      for (const caller_id of Array.from(add_class_node.callers).slice(0, 3)) {
        const caller = call_graph.nodes.get(caller_id);
        console.log(`    - ${caller?.name} at ${caller?.location.file_path}:${caller?.location.start_line}`);
      }
    }
  }
}

debug_anonymous_functions().catch(console.error);

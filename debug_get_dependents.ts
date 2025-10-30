#!/usr/bin/env node
/**
 * Debug script to investigate why get_dependents wasn't detected as an entry point
 */

import { Project } from "./packages/core/src/project/project.js";
import { FilePath } from "./packages/core/src/types/types.js";
import * as fs from "fs/promises";

async function debug() {
  console.log("\n=== INVESTIGATING get_dependents METHOD ===\n");

  const project = new Project();
  const project_file = "/Users/chuck/workspace/ariadne/packages/core/src/project/project.ts" as FilePath;

  // Load just the project.ts file
  const content = await fs.readFile(project_file, "utf-8");
  await project.initialize();
  project.update_file(project_file, content);

  // Get the semantic index for project.ts
  const semantic_index = project.get_semantic_index(project_file);

  console.log("1. SEMANTIC INDEX - Looking for get_dependents in classes:");
  if (semantic_index) {
    for (const [class_name, class_def] of semantic_index.classes) {
      console.log(`\n   Class: ${class_name}`);
      for (const method of class_def.methods) {
        if (method.name === "get_dependents") {
          console.log(`   ✅ Found method: ${method.name}`);
          console.log(`      - symbol_id: ${method.symbol_id}`);
          console.log(`      - body_scope_id: ${method.body_scope_id}`);
          console.log(`      - location: line ${method.location.start_line}`);
          console.log(`      - kind: ${method.kind}`);
        }
      }
    }
  }

  // Check if it's in the definitions registry
  console.log("\n2. DEFINITIONS REGISTRY - Checking callable definitions:");
  const callable_defs = project.definitions.get_callable_definitions();
  const get_dependents_defs = Array.from(callable_defs).filter(
    d => d.name === "get_dependents" && d.file_path === project_file
  );

  console.log(`   Found ${get_dependents_defs.length} get_dependents definitions:`);
  for (const def of get_dependents_defs) {
    console.log(`      - ${def.name} (${def.kind})`);
    console.log(`        symbol_id: ${def.symbol_id}`);
    console.log(`        body_scope_id: ${def.body_scope_id}`);
    console.log(`        location: line ${def.location.start_line}`);
  }

  // Check the call graph
  console.log("\n3. CALL GRAPH - Building and checking:");
  const call_graph = project.get_call_graph();

  console.log(`   Total nodes in call graph: ${call_graph.nodes.size}`);
  console.log(`   Total entry points: ${call_graph.entry_points.length}`);

  // Check if get_dependents is in the call graph nodes
  let found_in_nodes = false;
  for (const [symbol_id, node] of call_graph.nodes) {
    if (node.name === "get_dependents" && node.location.file_path === project_file) {
      found_in_nodes = true;
      console.log(`   ✅ Found in call graph nodes:`);
      console.log(`      - symbol_id: ${symbol_id}`);
      console.log(`      - name: ${node.name}`);
      console.log(`      - enclosed_calls: ${node.enclosed_calls.length}`);
    }
  }

  if (!found_in_nodes) {
    console.log(`   ❌ NOT FOUND in call graph nodes!`);
  }

  // Check if it's an entry point
  const is_entry_point = call_graph.entry_points.some(id => {
    const node = call_graph.nodes.get(id);
    return node?.name === "get_dependents" && node.location.file_path === project_file;
  });

  console.log(`\n   Is entry point? ${is_entry_point ? '✅ YES' : '❌ NO'}`);

  // Check if it's referenced
  console.log("\n4. RESOLUTIONS - Checking if it's called:");
  const all_referenced = project.resolutions.get_all_referenced_symbols();
  const get_dependents_symbol = get_dependents_defs[0]?.symbol_id;

  if (get_dependents_symbol) {
    const is_referenced = all_referenced.has(get_dependents_symbol);
    console.log(`   Symbol ID: ${get_dependents_symbol}`);
    console.log(`   Is referenced (called)? ${is_referenced ? 'YES (explains why not entry point)' : 'NO (should be entry point!)'}`);
  }

  console.log("\n=== INVESTIGATION COMPLETE ===\n");
}

debug().catch(console.error);

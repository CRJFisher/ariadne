#!/usr/bin/env npx tsx
/**
 * Verify entry point reduction from callback invocation detection
 */

import { Project } from "@ariadnejs/core";
import { FilePath } from "@ariadnejs/types";

async function main() {
  const project = new Project();
  await project.initialize("." as FilePath, ["packages/**/*.ts", "!**/*.test.ts", "!**/dist/**", "!**/node_modules/**"]);

  const call_graph = project.get_call_graph();

  console.log("=== ENTRY POINT ANALYSIS ===\n");
  console.log(`Total callable definitions: ${call_graph.nodes.size}`);
  console.log(`Total entry points: ${call_graph.entry_points.length}\n`);

  // Count anonymous functions
  const all_nodes = Array.from(call_graph.nodes.values());
  const anon_funcs = all_nodes.filter(n => n.name === "<anonymous>");
  console.log(`Anonymous functions: ${anon_funcs.length}`);

  // Count anonymous entry points
  const anon_entry_points = call_graph.entry_points.filter(ep_id => {
    const node = call_graph.nodes.get(ep_id);
    return node?.name === "<anonymous>";
  });
  console.log(`Anonymous function entry points: ${anon_entry_points.length}`);

  // Get callback invocation stats
  let total_callback_invocations = 0;
  const definitions = project.definitions;

  for (const callable of definitions.get_callable_definitions()) {
    if (callable.kind !== "function") {
      continue;
    }
    const callback_context = callable.callback_context;
    if (callback_context?.is_callback) {
      total_callback_invocations++;
    }
  }

  console.log(`\nFunctions marked as callbacks: ${total_callback_invocations}`);

  // Sample some anonymous entry points to see what they are
  console.log("\n=== SAMPLE ANONYMOUS ENTRY POINTS (first 10) ===");
  for (const ep_id of anon_entry_points.slice(0, 10)) {
    const node = call_graph.nodes.get(ep_id);
    if (node) {
      const callback_context = (node.definition as any).callback_context;
      console.log(`\n${node.location.file_path}:${node.location.start_line}`);
      console.log(`  is_callback: ${callback_context?.is_callback || false}`);
      console.log(`  receiver_is_external: ${callback_context?.receiver_is_external}`);
      if (callback_context?.receiver_location) {
        console.log(`  receiver: ${callback_context.receiver_location.file_path}:${callback_context.receiver_location.start_line}`);
      }
    }
  }
}

main().catch(console.error);

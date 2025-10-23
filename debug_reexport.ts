#!/usr/bin/env node
/**
 * Debug script to investigate why re-exported symbols aren't being detected
 * as called (resolve_module_path case)
 */

import { Project } from "./packages/core/src/project/project.js";
import { FilePath } from "@ariadnejs/types";
import * as path from "path";
import * as fs from "fs/promises";

async function debug_reexport() {
  const project_path = path.resolve("./packages/core");
  console.log(`Analyzing: ${project_path}\n`);

  // Initialize project
  const project = new Project();
  await project.initialize(project_path as FilePath, ["tests"]);

  // Load the relevant files
  const files_to_load = [
    "src/resolve_references/import_resolution/import_resolver.ts",
    "src/resolve_references/import_resolution/index.ts",
    "src/resolve_references/registries/export_registry.ts",
    "src/project/import_graph.ts",
  ];

  for (const rel_file of files_to_load) {
    const file_path = path.join(project_path, rel_file);
    const content = await fs.readFile(file_path, "utf-8");
    project.update_file(file_path as FilePath, content);
  }

  // Check definitions for resolve_module_path
  console.log("=== Definitions for 'resolve_module_path' ===");
  const all_defs = Array.from(project.definitions.get_all_definitions());
  const resolve_module_path_defs = all_defs.filter((d) =>
    d.name.includes("resolve_module_path")
  );

  for (const def of resolve_module_path_defs) {
    console.log(`\n${def.kind}: ${def.name}`);
    console.log(`  Location: ${def.location.file_path}:${def.location.start_line}`);
    console.log(`  Symbol ID: ${def.symbol_id}`);
    console.log(`  Exported: ${def.is_exported}`);
  }

  // Check exports for resolve_module_path
  console.log("\n\n=== Exports for 'resolve_module_path' ===");
  const index_file = path.join(
    project_path,
    "src/resolve_references/import_resolution/index.ts"
  ) as FilePath;
  const index_exports = project.exports.get_exports(index_file);

  console.log(`\nExports from index.ts (${index_file}):`);
  if (index_exports) {
    for (const [name, export_info] of index_exports.entries()) {
      if (name.includes("resolve_module_path")) {
        console.log(`  ${name}:`, JSON.stringify(export_info, null, 2));
      }
    }
  }

  // Check the actual export metadata (not just symbol IDs)
  const resolve_module_path_export = project.exports.get_export(index_file, "resolve_module_path" as any);
  console.log(`\nDetailed export metadata for 'resolve_module_path' from index.ts:`);
  console.log(JSON.stringify(resolve_module_path_export, null, 2));

  // Test export chain resolution
  console.log("\n\n=== Testing export chain resolution ===");

  // Try to resolve "resolve_module_path" from index.ts
  const export_registry_file = path.join(
    project_path,
    "src/resolve_references/registries/export_registry.ts"
  ) as FilePath;
  const import_graph_file = path.join(
    project_path,
    "src/project/import_graph.ts"
  ) as FilePath;

  // Load these files too
  for (const file of [export_registry_file, import_graph_file]) {
    const content = await fs.readFile(file, "utf-8");
    project.update_file(file, content);
  }

  // Now test the export chain resolution
  const languages = new Map<FilePath, any>();
  languages.set(index_file, "typescript");
  languages.set(export_registry_file, "typescript");
  languages.set(import_graph_file, "typescript");

  const chain_result = (project.exports as any).resolve_export_chain(
    index_file,
    "resolve_module_path" as any,
    "named",
    languages,
    project["root_folder"]
  );

  console.log(`\nResolving 'resolve_module_path' from index.ts:`);
  console.log(`  Result: ${chain_result}`);
  console.log(`  Expected: function:/Users/chuck/workspace/ariadne/packages/core/src/resolve_references/import_resolution/import_resolver.ts:24:17:24:35:resolve_module_path`);
  console.log(`  Match: ${chain_result === "function:/Users/chuck/workspace/ariadne/packages/core/src/resolve_references/import_resolution/import_resolver.ts:24:17:24:35:resolve_module_path"}`)

  // Check raw references from export_registry.ts
  console.log("\n\n=== Raw References from export_registry.ts ===");
  const export_registry_refs = project.references.get_file_references(export_registry_file);
  const resolve_module_path_refs = export_registry_refs.filter((ref: any) =>
    ref.name === "resolve_module_path"
  );
  console.log(`Total references to 'resolve_module_path': ${resolve_module_path_refs.length}`);
  for (const ref of resolve_module_path_refs) {
    console.log(`  Line ${ref.location.start_line}: ${ref.name}`);
    console.log(`    type: ${ref.type}`);
    console.log(`    call_type: ${ref.call_type}`);
    console.log(`    scope_id: ${ref.scope_id}`);

    // Check what this reference resolves to
    if (ref.type === "call") {
      const resolved_symbol = project.resolutions.resolve(ref.scope_id, ref.name as any);
      console.log(`    resolved to: ${resolved_symbol}`);
    }
  }

  // Check resolved calls from export_registry.ts and import_graph.ts
  console.log("\n\n=== Resolved Calls ===");

  const export_registry_calls = (project.resolutions as any).get_file_calls(export_registry_file);
  console.log(`\nAll calls from export_registry.ts (total: ${export_registry_calls.length}):`);

  // Show ALL calls to understand what's being detected
  console.log(`  All detected calls:`);
  for (const call of export_registry_calls) {
    console.log(`    Line ${call.location.start_line}: ${call.name}`);
  }

  // Show all calls around line 366 where resolve_module_path should be called
  const calls_around_366 = export_registry_calls.filter((call: any) =>
    call.location.start_line >= 360 && call.location.start_line <= 370
  );
  console.log(`  Calls around line 366 (where resolve_module_path is called): ${calls_around_366.length}`);

  const import_graph_calls = (project.resolutions as any).get_file_calls(import_graph_file);
  console.log(`\nAll calls from import_graph.ts (total: ${import_graph_calls.length}):`);

  // Show all calls around line 117 where resolve_module_path should be called
  const calls_around_117 = import_graph_calls.filter((call: any) =>
    call.location.start_line >= 110 && call.location.start_line <= 125
  );
  console.log(`  Calls around line 117 (where resolve_module_path is called):`);
  for (const call of calls_around_117) {
    console.log(`    Line ${call.location.start_line}: ${call.name} => ${call.symbol_id || 'UNRESOLVED'}`);
  }

  const import_graph_resolve_calls = import_graph_calls.filter((call: any) =>
    call.name === "resolve_module_path"
  );
  console.log(`  Calls to 'resolve_module_path': ${import_graph_resolve_calls.length}`);

  // Get call graph and check entry points
  console.log("\n\n=== Call Graph Entry Points ===");
  const call_graph = project.get_call_graph();

  for (const entry_point_id of call_graph.entry_points) {
    const node = call_graph.nodes.get(entry_point_id);
    if (node && node.name.includes("resolve_module_path")) {
      console.log(`\nEntry Point: ${node.name}`);
      console.log(`  Symbol ID: ${entry_point_id}`);
      console.log(`  Location: ${node.location.file_path}:${node.location.start_line}`);
      const callers = call_graph.callers.get(entry_point_id);
      if (callers) {
        console.log(`  Callers (${callers.size}):`);
        for (const caller_id of callers) {
          const caller = call_graph.nodes.get(caller_id);
          if (caller) {
            console.log(`    - ${caller.name} in ${caller.location.file_path}:${caller.location.start_line}`);
          }
        }
      } else {
        console.log(`  Callers: 0`);
      }
    }
  }
}

debug_reexport().catch(console.error);

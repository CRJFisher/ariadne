#!/usr/bin/env node
/**
 * Debug why rust_builder_helpers functions aren't resolved
 */
import { Project } from "./packages/core/src/project/project.js";
import { FilePath } from "@ariadnejs/types";
import * as fs from "fs/promises";
import * as path from "path";

async function main() {
  const project_path = path.resolve("packages/core");
  const project = new Project();
  await project.initialize(project_path as FilePath, ["tests"]);

  // Load rust_builder.ts (the caller)
  const caller_file = path.resolve(
    "packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts"
  );
  const caller_source = await fs.readFile(caller_file, "utf-8");
  project.update_file(caller_file as FilePath, caller_source);

  // Load rust_builder_helpers.ts (the callee)
  const callee_file = path.resolve(
    "packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_helpers.ts"
  );
  const callee_source = await fs.readFile(callee_file, "utf-8");
  project.update_file(callee_file as FilePath, callee_source);

  console.log("=== CHECKING RUST_BUILDER_HELPERS ===\n");

  // Check imports in caller
  const imports = project.imports.get_file_imports(caller_file as FilePath);
  console.log(`Total imports in rust_builder.ts: ${imports.length}`);

  const helper_imports = imports.filter(imp =>
    imp.import_path.includes("rust_builder_helpers")
  );
  console.log(`Imports from rust_builder_helpers: ${helper_imports.length}\n`);

  if (helper_imports.length > 0) {
    console.log("Sample import:");
    console.log(JSON.stringify(helper_imports[0], null, 2));

    // Check if import path resolves
    const resolved_path = project.imports.get_resolved_import_path(
      helper_imports[0].symbol_id
    );
    console.log(`\nImport resolves to: ${resolved_path}`);
    console.log(`Expected: ${callee_file}`);
    console.log(`Match: ${resolved_path === callee_file}`);
  }

  // Check exports in callee
  const exports = project.exports.get_exports(callee_file as FilePath);
  console.log(`\nExports in rust_builder_helpers.ts: ${exports.size}`);

  // Check specific function
  const callable_defs = project.definitions.get_callable_definitions();
  const create_struct_id = callable_defs.find(
    def => def.name === "create_struct_id" && def.location.file_path === callee_file
  );

  if (create_struct_id) {
    console.log(`\nFunction 'create_struct_id' found:`);
    console.log(`  symbol_id: ${create_struct_id.symbol_id}`);
    console.log(`  is exported: ${exports.has(create_struct_id.symbol_id)}`);

    // Check if it's called
    const calls = project.resolutions.get_file_calls(caller_file as FilePath);
    const calls_to_it = calls.filter(c => c.symbol_id === create_struct_id.symbol_id);
    console.log(`  called in rust_builder.ts: ${calls_to_it.length} time(s)`);

    // Check call graph
    const call_graph = project.get_call_graph();
    const is_entry_point = call_graph.entry_points.includes(create_struct_id.symbol_id);
    console.log(`  is entry point: ${is_entry_point ? "YES (BUG!)" : "NO (correct)"}`);
  }

  // Check all references in caller
  const refs = project.references.get_file_references(caller_file as FilePath);
  const call_refs = refs.filter(r => r.type === "call");
  console.log(`\nTotal call references in rust_builder.ts: ${call_refs.length}`);

  const helper_calls = call_refs.filter(r =>
    r.name.startsWith("create_") ||
    r.name.startsWith("extract_") ||
    r.name.startsWith("handle_")
  );
  console.log(`Calls to helper functions: ${helper_calls.length}`);

  if (helper_calls.length > 0) {
    console.log("\nSample helper call reference:");
    console.log(JSON.stringify(helper_calls[0], null, 2));
  }
}

main().catch(console.error);

#!/usr/bin/env node
/**
 * Debug script to understand why function calls aren't being detected
 */

import { Project } from "./packages/core/src/project/project.js";
import { FilePath } from "@ariadnejs/types";
import * as fs from "fs/promises";
import * as path from "path";

async function debug_call_detection() {
  const project_path = path.resolve("packages/core");

  // Initialize project
  const project = new Project();
  await project.initialize(project_path as FilePath, ["tests"]);

  // Load the file that contains the call
  const caller_file = path.resolve(
    "packages/core/src/resolve_references/import_resolution/import_resolver.ts"
  );
  const caller_source = await fs.readFile(caller_file, "utf-8");
  project.update_file(caller_file as FilePath, caller_source);

  // Load the file with the function being called
  const callee_file = path.resolve(
    "packages/core/src/resolve_references/import_resolution/import_resolver.rust.ts"
  );
  const callee_source = await fs.readFile(callee_file, "utf-8");
  project.update_file(callee_file as FilePath, callee_source);

  // Verify file was loaded
  console.log(`\n=== FILE LOADING CHECK ===`);
  console.log(`Caller file to load: ${caller_file}`);
  console.log(`Callee file to load: ${callee_file}`);
  const all_files = project.get_all_files();
  console.log(`\nTotal files loaded in project: ${all_files.length}`);
  console.log(`Caller file loaded: ${all_files.includes(caller_file as FilePath)}`);
  console.log(`Callee file loaded: ${all_files.includes(callee_file as FilePath)}`);
  console.log("\nAll loaded files:");
  for (const f of all_files) {
    console.log(`  - ${f}`);
  }

  // Get resolutions for the caller file
  const calls = project.resolutions.get_file_calls(caller_file as FilePath);

  console.log(`\n=== CALL DETECTION DEBUG ===`);
  console.log(`Caller file: ${caller_file}`);
  console.log(`Callee file: ${callee_file}`);
  console.log(`\nTotal calls in caller file: ${calls.length}`);

  // Look for the specific call to resolve_module_path_rust
  const target_calls = calls.filter(c =>
    c.name === "resolve_module_path_rust" ||
    (c.symbol_id && c.symbol_id.includes("resolve_module_path_rust"))
  );

  console.log(`\nCalls to resolve_module_path_rust: ${target_calls.length}`);

  if (target_calls.length > 0) {
    console.log("\nFound calls:");
    for (const call of target_calls) {
      console.log(JSON.stringify(call, null, 2));
    }
  } else {
    console.log("\nNo calls found! Let's check what calls ARE detected:");
    console.log("\nFirst 10 calls:");
    for (const call of calls.slice(0, 10)) {
      console.log(`  - ${call.name} (type: ${call.call_type}, line: ${call.location.start_line})`);
    }
  }

  // Check definitions in callee file
  const callable_defs = project.definitions.get_callable_definitions();
  const rust_defs = callable_defs.filter(d =>
    d.location.file_path === callee_file
  );

  console.log(`\n=== DEFINITIONS IN CALLEE FILE ===`);
  console.log(`Total callable definitions: ${rust_defs.length}`);
  for (const def of rust_defs) {
    console.log(`  - ${def.name} (${def.kind})`);
    console.log(`    symbol_id: ${def.symbol_id}`);
  }

  // Check references in caller file
  const refs = project.references.get_file_references(caller_file as FilePath);

  console.log(`\n=== REFERENCES IN CALLER FILE ===`);
  console.log(`Total references: ${refs.length}`);

  const call_refs = refs.filter(r => r.type === "call");
  console.log(`Total call references: ${call_refs.length}`);

  const target_refs = call_refs.filter(r =>
    r.name === "resolve_module_path_rust"
  );
  console.log(`Call references to resolve_module_path_rust: ${target_refs.length}`);

  if (target_refs.length > 0) {
    console.log("\nReference details:");
    for (const ref of target_refs) {
      console.log(JSON.stringify(ref, null, 2));
    }

    // Now check if this reference can be resolved
    console.log(`\n=== RESOLUTION CHECK ===`);
    for (const ref of target_refs) {
      const resolved_symbol = project.resolutions.resolve(
        ref.scope_id,
        ref.name as any
      );
      console.log(`Scope: ${ref.scope_id}`);
      console.log(`Name: ${ref.name}`);
      console.log(`Resolved to: ${resolved_symbol || "NULL - NOT RESOLVED"}`);
    }
  } else {
    console.log("\nNo references found! First 10 call references:");
    for (const ref of call_refs.slice(0, 10)) {
      console.log(`  - ${ref.name} (line: ${ref.location.start_line})`);
    }
  }

  // Check imports
  console.log(`\n=== IMPORTS IN CALLER FILE ===`);
  const imports = project.imports.get_file_imports(caller_file as FilePath);
  console.log(`Total imports: ${imports.length}`);

  const target_import = imports.find(
    (imp) => imp.name === "resolve_module_path_rust"
  );
  if (target_import) {
    console.log("\nFound import for resolve_module_path_rust:");
    console.log(JSON.stringify(target_import, null, 2));

    // Check if import path is resolved
    const resolved_import_path = project.imports.get_resolved_import_path(
      target_import.symbol_id
    );
    console.log(`\nImport resolves to file: ${resolved_import_path || "NULL"}`);
  } else {
    console.log("\nNo import found for resolve_module_path_rust!");
    console.log("First 5 imports:");
    for (const imp of imports.slice(0, 5)) {
      console.log(`  - ${imp.name} from ${imp.import_path}`);
    }
  }

  // Check scope structure and trace to root
  console.log(`\n=== SCOPE CHAIN ANALYSIS ===`);
  const scope_id = target_refs[0]?.scope_id;
  if (scope_id) {
    let current_scope_id: string | null | undefined = scope_id;
    let depth = 0;

    while (current_scope_id && depth < 10) {
      const scope = project.scopes.get_scope(current_scope_id);
      console.log(`\n[${depth}] Scope: ${current_scope_id}`);
      console.log(`    Exists: ${scope ? "YES" : "NO"}`);

      if (scope) {
        console.log(`    Parent: ${scope.parent_id || "NONE"}`);

        // Try to resolve the symbol at this level
        const resolved = project.resolutions.resolve(
          current_scope_id,
          "resolve_module_path_rust" as any
        );
        console.log(`    Can resolve 'resolve_module_path_rust': ${resolved ? "YES - " + resolved : "NO"}`);

        current_scope_id = scope.parent_id;
      } else {
        break;
      }
      depth++;
    }

    // Check if imports are indexed for the module scope
    console.log(`\n=== IMPORT INDEXING CHECK ===`);
    const module_scope_id =
      "module:/Users/chuck/workspace/ariadne/packages/core/src/resolve_references/import_resolution/import_resolver.ts:1:1:55:0";
    const scope_imports = project.imports.get_scope_imports(
      module_scope_id as any
    );
    console.log(`\nImports indexed for module scope: ${scope_imports.length}`);
    const target_scope_import = scope_imports.find(
      (imp) => imp.name === "resolve_module_path_rust"
    );
    console.log(`Import 'resolve_module_path_rust' in scope imports: ${target_scope_import ? "YES" : "NO"}`);

    if (target_scope_import) {
      console.log("Details:");
      console.log(JSON.stringify(target_scope_import, null, 2));

      // Now check if the export exists
      console.log(`\n=== EXPORT RESOLUTION CHECK ===`);
      const resolved_path = project.imports.get_resolved_import_path(
        target_scope_import.symbol_id
      );
      console.log(`Import path resolves to: ${resolved_path}`);

      if (resolved_path) {
        // Check exports in the resolved file
        const file_exports = project.exports.get_exports(resolved_path);
        console.log(`\nExports in target file: ${file_exports.size}`);

        // Get the symbol_id for the function we're looking for
        const all_defs = project.definitions.get_callable_definitions();
        const target_def = all_defs.find(
          (def) =>
            def.location.file_path === resolved_path &&
            def.name === "resolve_module_path_rust"
        );

        if (target_def) {
          console.log(`\nFunction definition found: ${target_def.symbol_id}`);
          const is_exported = file_exports.has(target_def.symbol_id);
          console.log(`Function is exported: ${is_exported ? "YES" : "NO"}`);
        } else {
          console.log("\nFunction definition NOT FOUND in target file!");
        }

        // Try to manually call resolve_export_chain
        console.log(`\n=== MANUAL EXPORT CHAIN RESOLUTION ===`);
        const languages = new Map();
        languages.set(resolved_path, "typescript" as any);
        languages.set(caller_file, "typescript" as any);

        const resolved_symbol = project.exports.resolve_export_chain(
          resolved_path,
          "resolve_module_path_rust" as any,
          "named",
          languages as any,
          project["root_folder"] as any
        );
        console.log(`resolve_export_chain result: ${resolved_symbol || "NULL"}`);
      }
    }
  }
}

debug_call_detection().catch(console.error);

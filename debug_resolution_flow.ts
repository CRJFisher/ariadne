#!/usr/bin/env node
/**
 * Debug the exact flow of import resolution for resolve_module_path
 * to understand why it returns null in scope resolution
 */

import { Project } from "./packages/core/src/project/project.js";
import { FilePath } from "@ariadnejs/types";
import * as path from "path";
import * as fs from "fs/promises";

async function debug_resolution_flow() {
  const project_path = path.resolve("./packages/core");
  console.log(`Analyzing: ${project_path}\n`);

  // Initialize project
  const project = new Project();
  await project.initialize(project_path as FilePath, ["tests"]);

  // Load just the three relevant files
  const files = [
    "src/resolve_references/import_resolution/import_resolver.ts",
    "src/resolve_references/import_resolution/index.ts",
    "src/resolve_references/registries/export_registry.ts",
  ];

  for (const rel_file of files) {
    const file_path = path.join(project_path, rel_file);
    const content = await fs.readFile(file_path, "utf-8");
    project.update_file(file_path as FilePath, content);
  }

  const export_registry_file = path.join(
    project_path,
    "src/resolve_references/registries/export_registry.ts"
  ) as FilePath;
  const index_file = path.join(
    project_path,
    "src/resolve_references/import_resolution/index.ts"
  ) as FilePath;
  const import_resolver_file = path.join(
    project_path,
    "src/resolve_references/import_resolution/import_resolver.ts"
  ) as FilePath;

  console.log("=== Step 1: Check Import Definition ===");
  const module_scope = project.scopes.get_file_root_scope(export_registry_file);
  const imports = project.imports.get_scope_imports(module_scope!.id);
  const resolve_module_path_import = imports.find(
    (imp) => imp.name === "resolve_module_path"
  );

  if (!resolve_module_path_import) {
    console.log("❌ No import found for resolve_module_path");
    return;
  }

  console.log("✅ Import found:");
  console.log(`  Name: ${resolve_module_path_import.name}`);
  console.log(`  Import path: ${resolve_module_path_import.import_path}`);
  console.log(`  Import kind: ${resolve_module_path_import.import_kind}`);
  console.log(`  Original name: ${resolve_module_path_import.original_name}`);
  console.log(`  Symbol ID: ${resolve_module_path_import.symbol_id}`);

  console.log("\n=== Step 2: Check Import Path Resolution ===");
  const resolved_import_path = project.imports.get_resolved_import_path(
    resolve_module_path_import.symbol_id
  );
  console.log(`Resolved import path: ${resolved_import_path}`);
  console.log(`Expected: ${index_file}`);
  console.log(`Match: ${resolved_import_path === index_file}`);

  if (resolved_import_path !== index_file) {
    console.log("\n❌ PROBLEM: Import path resolved to wrong file!");
    console.log(
      "This means the import resolver is not finding the index.ts file"
    );
  }

  console.log("\n=== Step 3: Check Exports from index.ts ===");
  const index_exports = project.exports.get_exports(index_file);
  if (!index_exports) {
    console.log("❌ No exports found from index.ts");
    return;
  }

  console.log(`✅ Found ${index_exports.size} exports from index.ts:`);
  for (const [name, symbol_id] of index_exports.entries()) {
    console.log(`  - ${name}: ${symbol_id}`);
  }

  const resolve_module_path_export = project.exports.get_export(
    index_file,
    "resolve_module_path" as any
  );
  if (!resolve_module_path_export) {
    console.log("\n❌ No export found for resolve_module_path");
    return;
  }

  console.log("\n✅ Export metadata for resolve_module_path:");
  console.log(`  Symbol ID: ${resolve_module_path_export.symbol_id}`);
  console.log(`  Is re-export: ${resolve_module_path_export.is_reexport}`);
  console.log(`  Export name: ${resolve_module_path_export.export_name}`);
  if (resolve_module_path_export.import_def) {
    console.log(`  Import def:`);
    console.log(
      `    Import path: ${resolve_module_path_export.import_def.import_path}`
    );
    console.log(
      `    Import kind: ${resolve_module_path_export.import_def.import_kind}`
    );
  }

  console.log("\n=== Step 4: Test Export Chain Resolution ===");
  const languages = new Map<FilePath, any>();
  languages.set(index_file, "typescript");
  languages.set(import_resolver_file, "typescript");
  languages.set(export_registry_file, "typescript");

  const chain_result = (project.exports as any).resolve_export_chain(
    index_file,
    "resolve_module_path" as any,
    "named",
    languages,
    project["root_folder"]
  );

  console.log(`Export chain resolution result: ${chain_result}`);
  console.log(`Expected to contain: import_resolver.ts`);
  console.log(`Success: ${chain_result?.includes("import_resolver.ts")}`);

  if (!chain_result) {
    console.log("\n❌ PROBLEM: Export chain resolution returned null!");
    console.log("This means resolve_export_chain is failing");
  }

  console.log("\n=== Step 5: Check Scope Resolution ===");
  const scope_resolved = project.resolutions.resolve(
    module_scope!.id,
    "resolve_module_path" as any
  );

  console.log(`Scope resolution result: ${scope_resolved}`);
  console.log(`Expected: ${chain_result}`);
  console.log(`Match: ${scope_resolved === chain_result}`);

  if (!scope_resolved) {
    console.log("\n❌ PROBLEM: Scope resolution returned null!");
    console.log(
      "This means the import wasn't added to the scope's symbol table"
    );
    console.log("\nPossible causes:");
    console.log("1. Import path resolution returned wrong file");
    console.log("2. Export chain resolution failed for that file");
    console.log("3. Languages map missing required files");
    console.log("4. Root folder incorrect");
  }

  console.log("\n=== Step 6: Check Call Resolution ===");
  const calls = (project.resolutions as any).get_file_calls(
    export_registry_file
  );
  const resolve_calls = calls.filter(
    (call: any) => call.name === "resolve_module_path"
  );

  console.log(`\nCalls to resolve_module_path: ${resolve_calls.length}`);
  if (resolve_calls.length > 0) {
    for (const call of resolve_calls) {
      console.log(`  Line ${call.location.start_line}:`);
      console.log(`    Symbol ID: ${call.symbol_id}`);
      console.log(`    Resolved: ${call.symbol_id !== null}`);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Import found: ${!!resolve_module_path_import}`);
  console.log(
    `Import path correct: ${resolved_import_path === index_file}`
  );
  console.log(`Export found: ${!!resolve_module_path_export}`);
  console.log(`Export chain works: ${!!chain_result}`);
  console.log(`Scope resolution works: ${!!scope_resolved}`);
  console.log(`Call resolution works: ${resolve_calls.length > 0 && resolve_calls[0].symbol_id}`);

  if (!scope_resolved && chain_result) {
    console.log("\n🔍 KEY INSIGHT:");
    console.log(
      "Export chain resolution WORKS when called manually with languages map,"
    );
    console.log(
      "but scope resolution FAILS. This suggests the languages map passed"
    );
    console.log(
      "to resolve_scope_recursive might be incomplete or the source_file"
    );
    console.log("parameter is different.");
  }
}

debug_resolution_flow().catch(console.error);

#!/usr/bin/env node
/**
 * Debug what's in the FileSystemFolder tree
 */

import { Project } from "./packages/core/src/project/project.js";
import { FilePath } from "@ariadnejs/types";
import * as path from "path";
import { has_file_in_tree } from "./packages/core/src/resolve_references/file_folders.js";

async function debug_file_tree() {
  const project_path = path.resolve("./packages/core");
  console.log(`Analyzing: ${project_path}\n`);

  // Initialize project
  const project = new Project();
  await project.initialize(project_path as FilePath, ["tests"]);

  const root_folder = (project as any).root_folder;

  console.log("=== FileSystemFolder Tree ===");
  console.log(`Root: ${root_folder.path}`);
  console.log(`Files in root: ${root_folder.files.size}`);
  console.log(`Folders in root: ${root_folder.folders.size}`);

  // Check for src folder
  const src_folder = root_folder.folders.get("src");
  if (!src_folder) {
    console.log("❌ src folder not found!");
    return;
  }

  console.log(`\n✅ src folder found: ${src_folder.path}`);
  console.log(`Files in src: ${src_folder.files.size}`);
  console.log(`Folders in src: ${src_folder.folders.size}`);
  console.log("Folders:", Array.from(src_folder.folders.keys()));

  // Check for resolve_references folder
  const resolve_refs_folder = src_folder.folders.get("resolve_references");
  if (!resolve_refs_folder) {
    console.log("\n❌ resolve_references folder not found!");
    return;
  }

  console.log(`\n✅ resolve_references folder found: ${resolve_refs_folder.path}`);
  console.log(`Files: ${resolve_refs_folder.files.size}`);
  console.log(`Folders: ${resolve_refs_folder.folders.size}`);
  console.log("Folders:", Array.from(resolve_refs_folder.folders.keys()));

  // Check for import_resolution folder
  const import_res_folder = resolve_refs_folder.folders.get("import_resolution");
  if (!import_res_folder) {
    console.log("\n❌ import_resolution folder not found!");
    return;
  }

  console.log(`\n✅ import_resolution folder found: ${import_res_folder.path}`);
  console.log(`Files in import_resolution: ${import_res_folder.files.size}`);
  console.log("Files:", Array.from(import_res_folder.files));

  // Check if index.ts is in the files
  const has_index = import_res_folder.files.has("index.ts");
  console.log(`\nHas index.ts: ${has_index}`);

  // Test has_file_in_tree for various paths
  console.log("\n=== Testing has_file_in_tree ===");

  const test_paths = [
    path.join(project_path, "src/resolve_references/import_resolution"),
    path.join(project_path, "src/resolve_references/import_resolution.ts"),
    path.join(project_path, "src/resolve_references/import_resolution/index.ts"),
    path.join(project_path, "src/resolve_references/import_resolution/import_resolver.ts"),
  ];

  for (const test_path of test_paths) {
    const result = has_file_in_tree(test_path as FilePath, root_folder);
    console.log(`${result ? "✅" : "❌"} ${test_path}`);
  }
}

debug_file_tree().catch(console.error);

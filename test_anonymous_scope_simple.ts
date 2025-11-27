#!/usr/bin/env npx tsx
/**
 * Simple test to check if calls inside anonymous functions get correct scope_id
 */

import { Project } from "@ariadnejs/core";
import { FilePath } from "@ariadnejs/types";

async function test() {
  const project = new Project();
  await project.initialize();

  // Simple test case
  const code = `
const CONFIG = [
  (capture) => {
    store_documentation(capture.text);
    process_something();
  }
];

function store_documentation(text) {}
function process_something() {}
  `;

  const file_path = "/tmp/test.js" as FilePath;
  project.update_file(file_path, code);

  // Get registries
  const definitions = project.definitions;
  const scopes = project.scopes;
  const resolutions = project.resolutions;
  const references = project.references;

  console.log("=== ANONYMOUS FUNCTIONS ===");
  const anon_funcs = Array.from(definitions.get_callable_definitions()).filter(
    (d: any) => d.name === "<anonymous>"
  );

  for (const anon of anon_funcs) {
    console.log(`\nAnonymous function at line ${anon.location.start_line}:`);
    console.log(`  symbol_id: ${anon.symbol_id}`);
    console.log(`  body_scope_id: ${anon.body_scope_id || "MISSING"}`);

    if (anon.body_scope_id) {
      const calls = resolutions.get_calls_by_caller_scope(anon.body_scope_id);
      console.log(`  Calls in body scope: ${calls.length}`);
      if (calls.length > 0) {
        for (const call of calls) {
          console.log(`    - ${call.name}`);
        }
      } else {
        console.log("    ❌ NO CALLS FOUND");
      }
    }
  }

  console.log("\n=== ALL CALLS ===");
  const all_refs = references.get_file_references(file_path);
  const call_refs = all_refs.filter((r: any) =>
    r.kind === "function_call" || r.kind === "method_call"
  );

  console.log(`Total calls captured: ${call_refs.length}`);
  for (const call of call_refs) {
    console.log(`\nCall to ${call.name} at line ${call.location.start_line}:`);
    console.log(`  scope_id: ${call.scope_id}`);

    // Try to find which function owns this scope
    const owner = Array.from(definitions.get_callable_definitions()).find(
      (d: any) => d.body_scope_id === call.scope_id
    );
    if (owner) {
      console.log(`  Owner: ${owner.name}`);
    } else {
      console.log("  Owner: NOT FOUND ❌");
    }
  }

  console.log("\n=== ALL SCOPES ===");
  const all_scopes = Array.from(scopes.get_all_scopes());
  console.log(`Total scopes: ${all_scopes.length}`);
  for (const scope of all_scopes) {
    console.log(`\n${scope.type} scope at line ${scope.location.start_line}:`);
    console.log(`  id: ${scope.id}`);
    console.log(`  name: ${scope.name || "(unnamed)"}`);
  }
}

test().catch(console.error);

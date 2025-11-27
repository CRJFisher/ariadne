#!/usr/bin/env npx tsx
/**
 * Comprehensive diagnostic script for anonymous function scope attribution.
 *
 * Tests three hypotheses:
 * 1. Anonymous functions missing body_scope_id
 * 2. Scope tree not creating scopes for arrow function bodies
 * 3. Call resolution not finding enclosing anonymous function scope
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Project } from "@ariadnejs/core";
import { FilePath } from "@ariadnejs/types";
import * as path from "path";
import * as fs from "fs/promises";
import { find_enclosing_function_scope } from "./packages/core/src/index_single_file/scopes/scope_utils";

async function diagnose_anonymous_scope_attribution() {
  console.log("=".repeat(80));
  console.log("DIAGNOSTIC: Anonymous Function Scope Attribution");
  console.log("=".repeat(80));

  const project = new Project();
  await project.initialize();

  // Test file with known anonymous functions
  const test_file = path.resolve(
    process.cwd(),
    "packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder_config.ts"
  );

  console.log(`\nLoading: ${test_file}`);
  const content = await fs.readFile(test_file, "utf-8");
  project.update_file(test_file as FilePath, content);

  // Get registries (public properties)
  const definitions = project.definitions;
  const scopes = project.scopes;
  const resolutions = project.resolutions;
  const references = project.references;

  console.log("\n" + "=".repeat(80));
  console.log("HYPOTHESIS 1: Anonymous Functions Missing body_scope_id");
  console.log("=".repeat(80));

  // Find all callable definitions
  const all_callables = definitions.get_callable_definitions();
  const anonymous_functions = Array.from(all_callables).filter(
    (def: any) => def.name === "<anonymous>"
  );

  console.log(`\nFound ${anonymous_functions.length} anonymous functions`);

  // Check first 5 anonymous functions
  let missing_body_scope = 0;
  let has_body_scope = 0;

  for (const anon of anonymous_functions.slice(0, 5)) {
    const location = anon.location;
    console.log(`\n--- Anonymous function at line ${location.start_line} ---`);
    console.log(`  symbol_id: ${anon.symbol_id}`);
    console.log(`  scope_id (defining scope): ${anon.scope_id}`);
    console.log(`  body_scope_id: ${anon.body_scope_id || "MISSING ❌"}`);

    if (anon.body_scope_id) {
      has_body_scope++;

      // Get calls from this function's body scope
      const calls = resolutions.get_calls_by_caller_scope(anon.body_scope_id);
      console.log(`  Calls from body: ${calls.length}`);

      if (calls.length > 0) {
        console.log("  First 3 calls:");
        for (const call of calls.slice(0, 3)) {
          console.log(`    - ${call.name} at line ${call.location.start_line} (${call.symbol_id ? "resolved ✓" : "unresolved ❌"})`);
        }
      }
    } else {
      missing_body_scope++;
    }
  }

  console.log("\nSummary:");
  console.log(`  ✓ With body_scope_id: ${has_body_scope}`);
  console.log(`  ❌ Missing body_scope_id: ${missing_body_scope}`);

  if (missing_body_scope > 0) {
    console.log("\n⚠️  HYPOTHESIS 1 CONFIRMED: Anonymous functions missing body_scope_id");
  }

  console.log("\n" + "=".repeat(80));
  console.log("HYPOTHESIS 2: Scope Tree Not Creating Scopes for Arrow Functions");
  console.log("=".repeat(80));

  // Get all scopes in the file
  const all_scopes = Array.from(scopes.get_all_scopes());
  const file_scopes = all_scopes.filter(
    (scope: any) => scope.location.file_path === test_file
  );

  console.log(`\nTotal scopes in file: ${file_scopes.length}`);

  // Count scopes by type
  const scope_types = new Map<string, number>();
  for (const scope of file_scopes) {
    const count = scope_types.get(scope.type) || 0;
    scope_types.set(scope.type, count + 1);
  }

  console.log("\nScope types breakdown:");
  for (const [type, count] of scope_types.entries()) {
    console.log(`  ${type}: ${count}`);
  }

  // Look for scopes near first few anonymous functions
  console.log("\nChecking scope proximity to anonymous functions:");

  for (const anon of anonymous_functions.slice(0, 3)) {
    const line = anon.location.start_line;
    console.log(`\n--- Anonymous function at line ${line} ---`);

    // Find scopes within ±2 lines
    const nearby_scopes = file_scopes.filter(
      (scope: any) =>
        Math.abs(scope.location.start_line - line) <= 2
    ).sort((a: any, b: any) => a.location.start_line - b.location.start_line);

    if (nearby_scopes.length === 0) {
      console.log("  ❌ No scopes found within ±2 lines");
    } else {
      console.log(`  Found ${nearby_scopes.length} nearby scopes:`);
      for (const scope of nearby_scopes) {
        console.log(`    ${scope.type} scope at line ${scope.location.start_line} (id: ${scope.id})`);
        console.log(`      name: ${scope.name || "(unnamed)"}`);
        console.log(`      parent: ${scope.parent_id || "(none)"}`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("HYPOTHESIS 3: Call Resolution Not Finding Enclosing Function");
  console.log("=".repeat(80));

  // Find calls that should be inside anonymous functions
  const file_refs = references.get_file_references(test_file);
  const function_calls = file_refs.filter(
    (ref: any) => ref.kind === "function_call" || ref.kind === "method_call"
  );

  console.log(`\nTotal function/method calls in file: ${function_calls.length}`);
  console.log("\nTracing call attribution for calls inside anonymous functions:");

  // Check specific known cases
  const test_cases = [
    { method: "build_class", expected_line_range: [200, 220] },
    { method: "add_class", expected_line_range: [200, 300] },
    { method: "add_function", expected_line_range: [200, 300] }
  ];

  for (const test_case of test_cases) {
    const matching_calls = function_calls.filter(
      (ref: any) =>
        ref.name === test_case.method &&
        ref.location.start_line >= test_case.expected_line_range[0] &&
        ref.location.start_line <= test_case.expected_line_range[1]
    );

    if (matching_calls.length === 0) {
      console.log(`\n--- No calls to ${test_case.method} in expected range ---`);
      continue;
    }

    for (const call of matching_calls.slice(0, 2)) {
      console.log(`\n--- Call to ${test_case.method} at line ${call.location.start_line} ---`);
      console.log(`  call.scope_id: ${call.scope_id}`);

      // Try to find enclosing function scope
      try {
        const enclosing_scope_id = find_enclosing_function_scope(
          call.scope_id,
          scopes.get_all_scopes()
        );
        console.log(`  enclosing function scope: ${enclosing_scope_id}`);

        // Look up what definition owns this scope
        const enclosing_def = Array.from(all_callables).find(
          (def: any) => def.body_scope_id === enclosing_scope_id
        );

        if (enclosing_def) {
          console.log(`  enclosing definition: ${enclosing_def.name} (${enclosing_def.symbol_id})`);
          if (enclosing_def.name === "<anonymous>") {
            console.log("  ✓ Correctly attributed to anonymous function");
          } else {
            console.log("  ⚠️  Attributed to named function (might be incorrect)");
          }
        } else {
          console.log(`  ❌ No definition found for enclosing scope ${enclosing_scope_id}`);
        }
      } catch (error) {
        console.log(`  ❌ Error finding enclosing scope: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("DETAILED SCOPE TREE ANALYSIS");
  console.log("=".repeat(80));

  // Pick one anonymous function and trace its scope tree
  if (anonymous_functions.length > 0) {
    const example = anonymous_functions[0];
    console.log(`\nAnalyzing scope tree for anonymous function at line ${example.location.start_line}`);
    console.log(`  symbol_id: ${example.symbol_id}`);
    console.log(`  defining_scope_id: ${example.scope_id}`);
    console.log(`  body_scope_id: ${example.body_scope_id || "MISSING"}`);

    // Trace up from defining scope
    console.log("\nScope tree from defining scope:");
    let current_scope = scopes.get_scope(example.scope_id);
    let depth = 0;
    const visited = new Set();

    while (current_scope && depth < 10) {
      if (visited.has(current_scope.id)) {
        console.log(`  ${"  ".repeat(depth)}⚠️  Cycle detected!`);
        break;
      }
      visited.add(current_scope.id);

      console.log(`  ${"  ".repeat(depth)}${current_scope.type} scope (${current_scope.id})`);
      console.log(`  ${"  ".repeat(depth)}  name: ${current_scope.name || "(unnamed)"}`);
      console.log(`  ${"  ".repeat(depth)}  line: ${current_scope.location.start_line}`);

      if (!current_scope.parent_id) {
        console.log(`  ${"  ".repeat(depth)}  (root)`);
        break;
      }

      current_scope = scopes.get_scope(current_scope.parent_id);
      depth++;
    }

    // Check if body_scope_id exists and trace its tree
    if (example.body_scope_id) {
      console.log("\nScope tree from body scope:");
      current_scope = scopes.get_scope(example.body_scope_id);
      depth = 0;
      visited.clear();

      while (current_scope && depth < 10) {
        if (visited.has(current_scope.id)) {
          console.log(`  ${"  ".repeat(depth)}⚠️  Cycle detected!`);
          break;
        }
        visited.add(current_scope.id);

        console.log(`  ${"  ".repeat(depth)}${current_scope.type} scope (${current_scope.id})`);
        console.log(`  ${"  ".repeat(depth)}  name: ${current_scope.name || "(unnamed)"}`);
        console.log(`  ${"  ".repeat(depth)}  line: ${current_scope.location.start_line}`);

        if (!current_scope.parent_id) {
          console.log(`  ${"  ".repeat(depth)}  (root)`);
          break;
        }

        current_scope = scopes.get_scope(current_scope.parent_id);
        depth++;
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("FINAL DIAGNOSIS");
  console.log("=".repeat(80));

  console.log(`\nAnonymous functions captured: ${anonymous_functions.length} ✓`);
  console.log(`Anonymous functions with body_scope_id: ${has_body_scope}/${anonymous_functions.slice(0, 5).length} (sampled)`);
  console.log(`Anonymous functions missing body_scope_id: ${missing_body_scope}/${anonymous_functions.slice(0, 5).length} (sampled)`);

  if (missing_body_scope > has_body_scope) {
    console.log("\n🔴 PRIMARY ISSUE: Anonymous functions are missing body_scope_id");
    console.log("   → This prevents calls from being attributed to them");
    console.log("   → Action: Fix scope matching in find_body_scope_for_definition()");
  } else if (missing_body_scope > 0) {
    console.log("\n🟡 PARTIAL ISSUE: Some anonymous functions missing body_scope_id");
    console.log("   → Action: Investigate why some work and others don't");
  } else {
    console.log("\n🟢 Anonymous functions have body_scope_id set correctly");
    console.log("   → Issue must be elsewhere (scope tree or call resolution)");
  }

  console.log("\n" + "=".repeat(80));
}

diagnose_anonymous_scope_attribution().catch((error) => {
  console.error("Diagnostic failed:", error);
  process.exit(1);
});

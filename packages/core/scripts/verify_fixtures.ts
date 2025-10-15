#!/usr/bin/env npx tsx

/**
 * Fixture Verification Script
 *
 * Verifies that all generated JSON fixtures are valid and can be deserialized.
 * Runs basic sanity checks on each fixture.
 */

import { glob } from "glob";
import path from "path";
import fs from "fs";
import { json_to_semantic_index } from "../tests/fixtures/semantic_index_json";

let errors = 0;
let warnings = 0;

// Find all generated JSON fixtures
const pattern = path.join(__dirname, "../tests/fixtures/**/semantic_index/**/*.json");
const fixtures = glob.sync(pattern);

console.log(`\n🔍 Verifying ${fixtures.length} fixtures...\n`);

for (const fixture_path of fixtures) {
  const relative_path = path.relative(
    path.join(__dirname, "../tests/fixtures"),
    fixture_path
  );

  try {
    // Try to load and parse JSON
    const json_string = fs.readFileSync(fixture_path, "utf-8");
    const json = JSON.parse(json_string);

    // Try to deserialize
    const index = json_to_semantic_index(json);

    // Basic sanity checks
    const issues: string[] = [];

    if (!index.file_path) {
      issues.push("Missing file_path");
    }

    if (!index.root_scope_id) {
      issues.push("Missing root_scope_id");
    }

    if (!index.language) {
      issues.push("Missing language");
    }

    if (index.scopes.size === 0) {
      issues.push("No scopes found");
    }

    // Check that root scope exists
    if (index.root_scope_id && !index.scopes.has(index.root_scope_id)) {
      issues.push(`Root scope ${index.root_scope_id} not found in scopes map`);
    }

    // Check for at least some definitions or references
    const total_definitions =
      index.functions.size +
      index.classes.size +
      index.variables.size +
      index.interfaces.size +
      index.enums.size +
      index.namespaces.size +
      index.types.size +
      index.imported_symbols.size;

    if (total_definitions === 0 && index.references.length === 0) {
      issues.push("No definitions or references found (possibly empty file)");
      warnings++;
    }

    if (issues.length > 0) {
      console.log(`⚠️  ${relative_path}`);
      issues.forEach((issue) => console.log(`    - ${issue}`));
      warnings++;
    } else {
      console.log(`✓  ${relative_path}`);
    }
  } catch (error) {
    console.error(`✗  ${relative_path}`);
    console.error(`    Error: ${error instanceof Error ? error.message : String(error)}`);
    errors++;
  }
}

console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${fixtures.length} fixtures checked`);
console.log(`  ✓ ${fixtures.length - errors - warnings} passed`);
if (warnings > 0) {
  console.log(`  ⚠️  ${warnings} warnings`);
}
if (errors > 0) {
  console.log(`  ✗ ${errors} failed`);
}
console.log(`${"=".repeat(60)}\n`);

process.exit(errors > 0 ? 1 : 0);

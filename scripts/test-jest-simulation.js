#!/usr/bin/env node

console.log("=== Simulating Jest Module Loading ===\n");

// Clear module cache to simulate fresh Jest run
delete require.cache[require.resolve('../dist/languages/typescript')];
delete require.cache[require.resolve('../dist/languages/python')];
delete require.cache[require.resolve('../dist/index')];

console.log("1. Testing immediate parse after import...");
const startLoad = Date.now();
const { Project } = require('../dist/index');
const loadTime = Date.now() - startLoad;
console.log(`Module load time: ${loadTime}ms`);

// Test immediately after loading
const project = new Project();

console.log("\n2. Testing TypeScript parse...");
try {
  const startParse = Date.now();
  project.add_or_update_file('test.ts', 'const x = 1');
  const parseTime = Date.now() - startParse;
  console.log(`✓ Success! Parse time: ${parseTime}ms`);
} catch (e) {
  console.error(`✗ Failed: ${e.message}`);
}

console.log("\n3. Testing Python parse...");
try {
  const startParse = Date.now();
  project.add_or_update_file('test.py', 'x = 1');
  const parseTime = Date.now() - startParse;
  console.log(`✓ Success! Parse time: ${parseTime}ms`);
} catch (e) {
  console.error(`✗ Failed: ${e.message}`);
}

// Test with multiple rapid imports/deletes like Jest might do
console.log("\n4. Testing rapid module cache clearing...");
for (let i = 0; i < 3; i++) {
  console.log(`\nIteration ${i + 1}:`);
  
  // Clear cache
  delete require.cache[require.resolve('../dist/languages/typescript')];
  delete require.cache[require.resolve('../dist/languages/python')];
  delete require.cache[require.resolve('../dist/index')];
  
  // Re-import
  const { Project: FreshProject } = require('../dist/index');
  const freshProject = new FreshProject();
  
  try {
    freshProject.add_or_update_file('test.ts', 'const x = 1');
    console.log("  ✓ TypeScript parse successful");
  } catch (e) {
    console.error(`  ✗ TypeScript failed: ${e.message}`);
  }
}

// Test parser state
console.log("\n5. Checking parser state persistence...");
const { typescript_config } = require('../dist/languages/typescript');
const { python_config } = require('../dist/languages/python');

console.log("TypeScript parser:", typeof typescript_config.parser);
console.log("TypeScript parser timeout:", typescript_config.parser.getTimeoutMicros());
console.log("Python parser:", typeof python_config.parser);
console.log("Python parser timeout:", python_config.parser.getTimeoutMicros());

// Test with setTimeout to simulate async test environment
console.log("\n6. Testing in async context (like Jest tests)...");
setTimeout(() => {
  const asyncProject = new Project();
  try {
    asyncProject.add_or_update_file('async-test.ts', 'const x = 1');
    console.log("✓ Async TypeScript parse successful");
  } catch (e) {
    console.error(`✗ Async TypeScript failed: ${e.message}`);
  }
  
  console.log("\n=== Test Complete ===");
}, 100);
#!/usr/bin/env node

// Test parsers directly without Jest
console.log("=== Direct Parser Test (No Jest) ===\n");

const path = require('path');

// Change to project root
process.chdir(path.join(__dirname, '..'));

console.log("Loading TypeScript modules...");
const { typescript_config } = require('../dist/languages/typescript');
const { python_config } = require('../dist/languages/python');
const { javascript_config } = require('../dist/languages/javascript');

console.log("\nTesting parsers:");

// Test JavaScript
try {
  console.log("\n--- JavaScript ---");
  const jsTree = javascript_config.parser.parse('var x = 1');
  console.log("✓ Parse successful:", jsTree.rootNode.type);
} catch (e) {
  console.error("✗ Failed:", e.message);
}

// Test TypeScript
try {
  console.log("\n--- TypeScript ---");
  console.log("Parser object:", typeof typescript_config.parser);
  console.log("Parser timeout:", typescript_config.parser.getTimeoutMicros());
  
  console.time("TypeScript parse");
  const tsTree = typescript_config.parser.parse('const x: number = 1');
  console.timeEnd("TypeScript parse");
  
  console.log("✓ Parse successful:", tsTree.rootNode.type);
} catch (e) {
  console.error("✗ Failed:", e.message);
  console.error("Stack:", e.stack);
}

// Test Python
try {
  console.log("\n--- Python ---");
  console.log("Parser object:", typeof python_config.parser);
  console.log("Parser timeout:", python_config.parser.getTimeoutMicros());
  
  console.time("Python parse");
  const pyTree = python_config.parser.parse('x = 1');
  console.timeEnd("Python parse");
  
  console.log("✓ Parse successful:", pyTree.rootNode.type);
} catch (e) {
  console.error("✗ Failed:", e.message);
  console.error("Stack:", e.stack);
}

// Test with the Project class
console.log("\n\n=== Testing with Project class ===");
const { Project } = require('../dist/index');

const project = new Project();

try {
  console.log("\nAdding TypeScript file...");
  project.add_or_update_file('test.ts', 'const x: number = 1');
  console.log("✓ TypeScript file added successfully");
} catch (e) {
  console.error("✗ Failed to add TypeScript file:", e.message);
}

try {
  console.log("\nAdding Python file...");
  project.add_or_update_file('test.py', 'x = 1');
  console.log("✓ Python file added successfully");
} catch (e) {
  console.error("✗ Failed to add Python file:", e.message);
}

console.log("\n=== Test Complete ===");
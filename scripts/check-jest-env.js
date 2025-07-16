#!/usr/bin/env node

console.log("=== Jest Environment Check ===\n");

console.log("Environment variables:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("JEST_WORKER_ID:", process.env.JEST_WORKER_ID);
console.log("CI:", process.env.CI);

console.log("\nProcess info:");
console.log("PID:", process.pid);
console.log("Platform:", process.platform);
console.log("Architecture:", process.arch);
console.log("Node version:", process.version);
console.log("Memory usage:", process.memoryUsage());

console.log("\nChecking Jest configuration...");
const fs = require('fs');
const path = require('path');

// Check jest.config.js
const jestConfigPath = path.join(process.cwd(), 'jest.config.js');
if (fs.existsSync(jestConfigPath)) {
  console.log("\njest.config.js found:");
  const config = require(jestConfigPath);
  console.log("testEnvironment:", config.testEnvironment);
  console.log("testTimeout:", config.testTimeout);
  console.log("maxWorkers:", config.maxWorkers);
  if (config.testEnvironmentOptions) {
    console.log("testEnvironmentOptions:", JSON.stringify(config.testEnvironmentOptions, null, 2));
  }
} else {
  console.log("No jest.config.js found");
}

// Check if we're in a Jest environment
if (typeof jest !== 'undefined') {
  console.log("\nRunning inside Jest");
  console.log("Jest version:", jest.version);
} else {
  console.log("\nNot running inside Jest");
}
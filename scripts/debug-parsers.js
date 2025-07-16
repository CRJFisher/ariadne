#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

console.log("=== Parser Debug Script ===");
console.log("Node version:", process.version);
console.log("Platform:", process.platform);
console.log("Architecture:", process.arch);
console.log("Current directory:", process.cwd());

// Check native module files
console.log("\n=== Checking Native Module Files ===");
const modules = ['tree-sitter', 'tree-sitter-javascript', 'tree-sitter-typescript', 'tree-sitter-python'];

for (const module of modules) {
  console.log(`\n--- ${module} ---`);
  const modulePath = path.join(process.cwd(), 'node_modules', module);
  
  if (!fs.existsSync(modulePath)) {
    console.log(`Module path does not exist: ${modulePath}`);
    continue;
  }
  
  // Look for .node files
  const buildPath = path.join(modulePath, 'build', 'Release');
  if (fs.existsSync(buildPath)) {
    const files = fs.readdirSync(buildPath);
    console.log(`Build files in ${buildPath}:`, files);
    
    // Check .node file details
    const nodeFiles = files.filter(f => f.endsWith('.node'));
    for (const nodeFile of nodeFiles) {
      const filePath = path.join(buildPath, nodeFile);
      const stats = fs.statSync(filePath);
      console.log(`  ${nodeFile}: ${stats.size} bytes`);
      
      // Try to check if it's a valid ELF/Mach-O file
      try {
        const buffer = Buffer.alloc(4);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);
        console.log(`  Magic bytes: ${buffer.toString('hex')}`);
      } catch (e) {
        console.log(`  Could not read magic bytes: ${e.message}`);
      }
    }
  } else {
    console.log(`No build directory found at: ${buildPath}`);
  }
  
  // Check package.json
  const packagePath = path.join(modulePath, 'package.json');
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    console.log(`Package version: ${pkg.version}`);
    console.log(`Main entry: ${pkg.main}`);
  }
}

// Try to load modules directly
console.log("\n=== Testing Module Loading ===");

try {
  console.log("\n--- tree-sitter ---");
  const Parser = require('tree-sitter');
  console.log("Successfully loaded tree-sitter");
  console.log("Parser constructor:", typeof Parser);
  const parser = new Parser();
  console.log("Created parser instance");
} catch (e) {
  console.error("Failed to load tree-sitter:", e.message);
  console.error("Stack:", e.stack);
}

try {
  console.log("\n--- tree-sitter-javascript ---");
  const JavaScript = require('tree-sitter-javascript');
  console.log("Successfully loaded tree-sitter-javascript");
  console.log("Type:", typeof JavaScript);
  console.log("Keys:", Object.keys(JavaScript));
  
  // Try to use it
  const Parser = require('tree-sitter');
  const parser = new Parser();
  parser.setLanguage(JavaScript);
  const tree = parser.parse('var x = 1');
  console.log("Parse test successful:", tree.rootNode.type);
} catch (e) {
  console.error("Failed to test tree-sitter-javascript:", e.message);
  console.error("Stack:", e.stack);
}

try {
  console.log("\n--- tree-sitter-typescript ---");
  const TypeScript = require('tree-sitter-typescript');
  console.log("Successfully loaded tree-sitter-typescript");
  console.log("Type:", typeof TypeScript);
  console.log("Keys:", Object.keys(TypeScript));
  console.log("Has tsx property:", 'tsx' in TypeScript);
  
  // Try to use it
  const Parser = require('tree-sitter');
  const parser = new Parser();
  parser.setLanguage(TypeScript.tsx);
  const tree = parser.parse('const x = 1');
  console.log("Parse test successful:", tree.rootNode.type);
} catch (e) {
  console.error("Failed to test tree-sitter-typescript:", e.message);
  console.error("Stack:", e.stack);
}

try {
  console.log("\n--- tree-sitter-python ---");
  const Python = require('tree-sitter-python');
  console.log("Successfully loaded tree-sitter-python");
  console.log("Type:", typeof Python);
  console.log("Keys:", Object.keys(Python || {}));
  
  // Try to use it
  const Parser = require('tree-sitter');
  const parser = new Parser();
  parser.setLanguage(Python);
  const tree = parser.parse('x = 1');
  console.log("Parse test successful:", tree.rootNode.type);
} catch (e) {
  console.error("Failed to test tree-sitter-python:", e.message);
  console.error("Stack:", e.stack);
}

// Check library dependencies
console.log("\n=== Checking System Libraries ===");
if (process.platform === 'linux') {
  try {
    // Check ldd for native modules
    const nodeFiles = [
      'node_modules/tree-sitter/build/Release/tree_sitter_runtime_binding.node',
      'node_modules/tree-sitter-typescript/build/Release/tree_sitter_typescript_binding.node',
      'node_modules/tree-sitter-python/build/Release/tree_sitter_python_binding.node'
    ];
    
    for (const file of nodeFiles) {
      if (fs.existsSync(file)) {
        console.log(`\nLibrary dependencies for ${path.basename(file)}:`);
        try {
          const output = execSync(`ldd ${file}`, { encoding: 'utf8' });
          console.log(output);
        } catch (e) {
          console.log(`ldd failed: ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.log("Could not check library dependencies:", e.message);
  }
}

console.log("\n=== Debug Complete ===");
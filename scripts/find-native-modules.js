#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("=== Finding Native Module Binaries ===\n");

const modules = ['tree-sitter', 'tree-sitter-javascript', 'tree-sitter-typescript', 'tree-sitter-python'];

for (const moduleName of modules) {
  console.log(`\n--- ${moduleName} ---`);
  const modulePath = path.join(process.cwd(), 'node_modules', moduleName);
  
  if (!fs.existsSync(modulePath)) {
    console.log(`Module not found at: ${modulePath}`);
    continue;
  }
  
  // Find all .node files recursively
  try {
    const findCommand = process.platform === 'win32' 
      ? `dir /s /b "${modulePath}\\*.node" 2>nul`
      : `find "${modulePath}" -name "*.node" 2>/dev/null || true`;
    
    const nodeFiles = execSync(findCommand, { encoding: 'utf8' })
      .split('\n')
      .filter(f => f.trim());
    
    if (nodeFiles.length === 0) {
      console.log("No .node files found");
    } else {
      console.log("Found .node files:");
      for (const file of nodeFiles) {
        if (file) {
          const stats = fs.statSync(file);
          const relativePath = path.relative(modulePath, file);
          console.log(`  ${relativePath} (${stats.size} bytes)`);
        }
      }
    }
    
    // Check the main entry point
    const packageJsonPath = path.join(modulePath, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log(`Main entry: ${packageJson.main}`);
    
    // Check if it's using node-gyp-build
    if (packageJson.scripts && packageJson.scripts.install) {
      console.log(`Install script: ${packageJson.scripts.install}`);
    }
    
    // Look for prebuilds directory
    const prebuildsPath = path.join(modulePath, 'prebuilds');
    if (fs.existsSync(prebuildsPath)) {
      console.log("Has prebuilds directory:");
      const platforms = fs.readdirSync(prebuildsPath);
      for (const platform of platforms) {
        console.log(`  - ${platform}`);
      }
    }
    
  } catch (e) {
    console.error(`Error searching for .node files: ${e.message}`);
  }
}

// Also check what node-gyp-build would find
console.log("\n=== node-gyp-build resolution ===");
try {
  const nodeGypBuild = require('node-gyp-build');
  console.log("node-gyp-build is available");
  
  for (const moduleName of modules) {
    const modulePath = path.join(process.cwd(), 'node_modules', moduleName);
    if (fs.existsSync(modulePath)) {
      try {
        console.log(`\n${moduleName}:`);
        // This is what the module would actually load
        const binding = nodeGypBuild(modulePath);
        console.log("  Successfully resolved binding");
      } catch (e) {
        console.log(`  Failed to resolve: ${e.message}`);
      }
    }
  }
} catch (e) {
  console.log("node-gyp-build not available");
}
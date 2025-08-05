import { Project } from './packages/core/src/index';
import fs from 'fs';
import path from 'path';

const project = new Project();

// Helper to get all files
function getAllFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  
  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.includes('node_modules')) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  }
  
  walk(dir);
  return results;
}

console.log('=== Loading files in same order as validation ===');

const dirsToAnalyze = [
  path.join(__dirname, "packages/core/src"),
  path.join(__dirname, "packages/types/src")
];

let fileCount = 0;
for (const dir of dirsToAnalyze) {
  if (!fs.existsSync(dir)) continue;
  
  const files = getAllFiles(dir, ['.ts', '.tsx', '.js', '.jsx']);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(path.dirname(dir), file);
    
    // Skip files that are too large
    if (content.length > 32 * 1024) {
      continue;
    }
    
    project.add_or_update_file(relativePath, content);
    fileCount++;
    
    // Check generateLargeFile after each file
    if (relativePath.includes('benchmark-incremental')) {
      console.log(`\nAdded benchmark-incremental.ts as file #${fileCount}`);
      const graph = project.get_call_graph({ include_external: false });
      const genNode = Array.from(graph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
      console.log('generateLargeFile built-in calls:', genNode?.calls.filter(c => c.symbol.startsWith('<builtin>#')).length || 0);
    }
  }
}

console.log(`\n=== Final check after loading ${fileCount} files ===`);
const graph = project.get_call_graph({ include_external: false });
const genNode = Array.from(graph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
console.log('generateLargeFile built-in calls:', genNode?.calls.filter(c => c.symbol.startsWith('<builtin>#')).length || 0);

// Check all nodes
let nodesWithBuiltins = 0;
for (const node of graph.nodes.values()) {
  if (node.calls.some(c => c.symbol.startsWith('<builtin>#'))) {
    nodesWithBuiltins++;
  }
}
console.log(`Total nodes with built-in calls: ${nodesWithBuiltins}`);
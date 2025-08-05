import { Project } from './packages/core/src/index';
import fs from 'fs';

const project = new Project();

// Load all files from core/src
const srcFiles = [
  'benchmark-incremental.ts',
  'graph.ts', 
  'index.ts',
  'call_graph/call_analysis.ts'
];

console.log('=== Loading files one by one ===');
for (const file of srcFiles) {
  try {
    const content = fs.readFileSync(`./packages/core/src/${file}`, 'utf-8');
    project.add_or_update_file(`src/${file}`, content);
    
    // Check after each file
    const graph = project.get_call_graph({ include_external: false });
    const genNode = Array.from(graph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
    console.log(`After loading ${file}: generateLargeFile calls = ${genNode?.calls.filter(c => c.symbol.startsWith('<builtin>#')).length || 0}`);
  } catch (e) {
    console.log(`Skipping ${file}: ${e.message}`);
  }
}
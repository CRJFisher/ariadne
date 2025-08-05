import { Project } from './packages/core/src/index';
import fs from 'fs';

// Monkey patch console.log to capture debug output
const originalLog = console.log;
let debugCount = 0;
console.log = (...args) => {
  if (args[0]?.toString().includes('DEBUG:')) {
    debugCount++;
  }
  originalLog(...args);
};

const project = new Project();

console.log('=== Test 1: Load benchmark-incremental.ts ===');
debugCount = 0;
const benchmarkCode = fs.readFileSync('./packages/core/src/benchmark-incremental.ts', 'utf-8');
project.add_or_update_file('src/benchmark-incremental.ts', benchmarkCode);
let graph = project.get_call_graph({ include_external: false });
console.log(`Debug lines printed: ${debugCount}`);
let genNode = Array.from(graph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
console.log(`generateLargeFile calls: ${genNode?.calls.length || 0}`);

console.log('\n=== Test 2: Add graph.ts ===');
debugCount = 0;
const graphCode = fs.readFileSync('./packages/core/src/graph.ts', 'utf-8');
project.add_or_update_file('src/graph.ts', graphCode);
graph = project.get_call_graph({ include_external: false });
console.log(`Debug lines printed: ${debugCount}`);
genNode = Array.from(graph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
console.log(`generateLargeFile calls: ${genNode?.calls.length || 0}`);

console.log('\n=== Test 3: Re-add benchmark-incremental.ts (no changes) ===');
debugCount = 0;
project.add_or_update_file('src/benchmark-incremental.ts', benchmarkCode);
graph = project.get_call_graph({ include_external: false });
console.log(`Debug lines printed: ${debugCount}`);
genNode = Array.from(graph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
console.log(`generateLargeFile calls: ${genNode?.calls.length || 0}`);
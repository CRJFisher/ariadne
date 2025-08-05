import { Project } from './packages/core/src/index';
import fs from 'fs';

const project = new Project();

// Test with incremental file loading
const benchmarkCode = fs.readFileSync('./packages/core/src/benchmark-incremental.ts', 'utf-8');
const graphCode = fs.readFileSync('./packages/core/src/graph.ts', 'utf-8');

console.log('=== Step 1: Load benchmark-incremental.ts ===');
project.add_or_update_file('src/benchmark-incremental.ts', benchmarkCode);

let graph = project.get_call_graph({ include_external: false });
let genNode = Array.from(graph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
console.log('generateLargeFile built-in calls:', genNode?.calls.filter(c => c.symbol.startsWith('<builtin>#')).length || 0);

console.log('\n=== Step 2: Get references before adding new file ===');
const allDefs = project.get_all_definitions();
const genDef = allDefs.find(d => d.name === 'generateLargeFile');
if (genDef) {
  const refs = project.get_references_in_file(genDef.file_path);
  const pushRefs = refs.filter(r => r.name === 'push');
  console.log('Push references in generateLargeFile:', pushRefs.length);
}

console.log('\n=== Step 3: Add graph.ts ===');
project.add_or_update_file('src/graph.ts', graphCode);

console.log('\n=== Step 4: Check references after adding new file ===');
const refsAfter = project.get_references_in_file('src/benchmark-incremental.ts');
const pushRefsAfter = refsAfter.filter(r => r.name === 'push');
console.log('Push references after adding graph.ts:', pushRefsAfter.length);

console.log('\n=== Step 5: Get call graph after adding new file ===');
graph = project.get_call_graph({ include_external: false });
genNode = Array.from(graph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
console.log('generateLargeFile built-in calls:', genNode?.calls.filter(c => c.symbol.startsWith('<builtin>#')).length || 0);

// Let's check the actual function
const funcSource = project.get_function_by_name('generateLargeFile', 'src/benchmark-incremental.ts');
if (funcSource) {
  console.log('\nFunction still exists:', funcSource.name);
}
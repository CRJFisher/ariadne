import { Project } from './src/index';
import * as fs from 'fs';

// Test the fix
const project = new Project();

console.log('=== Testing built-in call tracking fix ===\n');

// Step 1: Just benchmark
console.log('Step 1: Just benchmark file');
project.add_or_update_file('src/benchmark-incremental.ts', fs.readFileSync('./src/benchmark-incremental.ts', 'utf8'));
let graph = project.get_call_graph({ include_external: false });
let glf = Array.from(graph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
console.log(`generateLargeFile calls: ${glf?.calls.length}`);

// Step 2: Add graph.ts
console.log('\nStep 2: Add graph.ts');  
project.add_or_update_file('src/graph.ts', fs.readFileSync('./src/graph.ts', 'utf8'));
graph = project.get_call_graph({ include_external: false });
glf = Array.from(graph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
console.log(`generateLargeFile calls: ${glf?.calls.length}`);

// Step 3: Add more files
console.log('\nStep 3: Add index.ts');
project.add_or_update_file('src/index.ts', fs.readFileSync('./src/index.ts', 'utf8'));
graph = project.get_call_graph({ include_external: false });
glf = Array.from(graph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
console.log(`generateLargeFile calls: ${glf?.calls.length}`);

// Check overall statistics
const nodesWithCalls = Array.from(graph.nodes.values()).filter(n => n.calls.length > 0);
const percentage = (nodesWithCalls.length / graph.nodes.size * 100).toFixed(1);
console.log(`\nOverall: ${nodesWithCalls.length}/${graph.nodes.size} nodes have calls (${percentage}%)`);

// Test a simple case too
console.log('\n=== Simple test case ===');
const project2 = new Project();
project2.add_or_update_file('test1.ts', 'function f1() { console.log("test"); }');
project2.add_or_update_file('test2.ts', 'function f2() { console.log("test"); }');
const graph2 = project2.get_call_graph({ include_external: false });
const f1 = Array.from(graph2.nodes.values()).find(n => n.definition.name === 'f1');
const f2 = Array.from(graph2.nodes.values()).find(n => n.definition.name === 'f2');
console.log(`f1 calls: ${f1?.calls.length}`);
console.log(`f2 calls: ${f2?.calls.length}`);
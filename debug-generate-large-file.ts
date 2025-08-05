import { Project } from './packages/core/src/index';
import fs from 'fs';

const project = new Project();

// Load the actual benchmark-incremental.ts file
const benchmarkCode = fs.readFileSync('./packages/core/src/benchmark-incremental.ts', 'utf-8');
project.add_or_update_file('src/benchmark-incremental.ts', benchmarkCode);

const graph = project.get_call_graph({ include_external: false });

// Check the generateLargeFile function
const genNode = Array.from(graph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
if (genNode) {
  console.log('generateLargeFile found!');
  console.log('Calls:', genNode.calls.length);
  console.log('Call details:', genNode.calls.map(c => ({
    symbol: c.symbol,
    line: c.range.start.row,
    isBuiltin: c.symbol.startsWith('<builtin>#')
  })));
  
  // Get the function source to check
  const source = project.get_function_source(genNode.definition);
  console.log('\nFunction source snippet:');
  console.log(source.source.split('\n').slice(0, 10).join('\n'));
} else {
  console.log('generateLargeFile node not found!');
}

// Check all functions for built-in calls
let builtinFunctionCount = 0;
for (const [id, node] of graph.nodes) {
  const builtinCalls = node.calls.filter(c => c.symbol.startsWith('<builtin>#'));
  if (builtinCalls.length > 0) {
    builtinFunctionCount++;
    console.log(`\nFunction ${node.definition.name} has ${builtinCalls.length} built-in calls`);
  }
}

console.log(`\nTotal functions with built-in calls: ${builtinFunctionCount}`);
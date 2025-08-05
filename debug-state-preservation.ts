import { Project } from './packages/core/src/index';

// Create a simple test to understand state preservation
const project = new Project();

console.log('=== Test state preservation ===');

// Add first file with built-in call
project.add_or_update_file('test1.ts', `
function test1() {
  console.log('Hello');
}
`);

let graph = project.get_call_graph({ include_external: false });
console.log('After file 1:');
console.log('- Total nodes:', graph.nodes.size);
console.log('- Total calls:', Array.from(graph.nodes.values()).reduce((sum, n) => sum + n.calls.length, 0));

// Add second file
project.add_or_update_file('test2.ts', `
function test2() {
  test1(); // This might not resolve since it's in another file
  console.log('World');
}
`);

graph = project.get_call_graph({ include_external: false });
console.log('\nAfter file 2:');
console.log('- Total nodes:', graph.nodes.size);
console.log('- Total calls:', Array.from(graph.nodes.values()).reduce((sum, n) => sum + n.calls.length, 0));

// Check individual functions
for (const [id, node] of graph.nodes) {
  console.log(`\nNode: ${node.definition.name}`);
  console.log(`- Calls: ${node.calls.length}`);
  for (const call of node.calls) {
    console.log(`  - ${call.symbol}`);
  }
}
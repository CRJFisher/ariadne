import { Project } from './packages/core/src/index';

const project = new Project();

// Add a simple test file
project.add_or_update_file('test.ts', `
function testBuiltins() {
  console.log('Hello');
  const arr = [1, 2, 3];
  arr.push(4);
  return arr.join(',');
}
`);

const graph = project.get_call_graph({ include_external: false });

// Check the testBuiltins function
const testNode = Array.from(graph.nodes.values()).find(n => n.definition.name === 'testBuiltins');
if (testNode) {
  console.log('testBuiltins calls:', testNode.calls.length);
  console.log('Calls:', testNode.calls.map(c => ({
    symbol: c.symbol,
    isBuiltin: c.symbol.startsWith('<builtin>#')
  })));
} else {
  console.log('testBuiltins node not found!');
}

// Overall stats
let builtinCallCount = 0;
let totalCallCount = 0;
for (const node of graph.nodes.values()) {
  totalCallCount += node.calls.length;
  builtinCallCount += node.calls.filter(c => c.symbol.startsWith('<builtin>#')).length;
}

console.log('\nOverall stats:');
console.log('Total calls:', totalCallCount);
console.log('Built-in calls:', builtinCallCount);
console.log('Nodes with calls:', Array.from(graph.nodes.values()).filter(n => n.calls.length > 0).length);
console.log('Total nodes:', graph.nodes.size);
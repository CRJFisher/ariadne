import { Project } from './packages/core/src/index';
import fs from 'fs';

const project = new Project();

console.log('=== Test 1: Single file ===');
// Load just benchmark-incremental.ts
const benchmarkCode = fs.readFileSync('./packages/core/src/benchmark-incremental.ts', 'utf-8');
project.add_or_update_file('src/benchmark-incremental.ts', benchmarkCode);

let graph = project.get_call_graph({ include_external: false });
let genNode = Array.from(graph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
console.log('generateLargeFile calls:', genNode?.calls.length || 0);
console.log('Built-in calls:', genNode?.calls.filter(c => c.symbol.startsWith('<builtin>#')).length || 0);

console.log('\n=== Test 2: Add another file ===');
// Now add another file
const indexCode = fs.readFileSync('./packages/core/src/index.ts', 'utf-8');
project.add_or_update_file('src/index.ts', indexCode);

graph = project.get_call_graph({ include_external: false });
genNode = Array.from(graph.nodes.values()).find(n => n.definition.name === 'generateLargeFile');
console.log('generateLargeFile calls after adding index.ts:', genNode?.calls.length || 0);
console.log('Built-in calls:', genNode?.calls.filter(c => c.symbol.startsWith('<builtin>#')).length || 0);

// Debug: Check the actual references
const refs = project.get_all_references_of_symbol({
  symbol_id: 'src/benchmark-incremental.ts#generateLargeFile',
  include_child_scopes: true
});

console.log('\n=== References in generateLargeFile ===');
const methodRefs = refs.filter(r => r.symbol_kind === 'method' && (r.name === 'push' || r.name === 'join'));
console.log('Method references (push/join):', methodRefs.length);
for (const ref of methodRefs.slice(0, 3)) {
  console.log(`- ${ref.name} at line ${ref.range.start.row + 1}`);
}
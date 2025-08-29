/**
 * Example usage of the Ariadne API
 * 
 * This demonstrates the clean, simple API for analyzing codebases.
 */

import { 
  generate_code_graph, 
  get_call_graphs
} from './index';

async function example() {
  // 1. Generate a code graph for your project
  const graph = await generate_code_graph({
    root_path: '/path/to/your/project',
    include_patterns: ['src/**/*.ts'],  // Optional: only TypeScript files in src
    exclude_patterns: ['**/*.test.ts']  // Optional: exclude test files
  });
  
  console.log(`Analyzed ${graph.metadata.file_count} files`);
  console.log(`Analysis time: ${graph.metadata.analysis_time}ms`);
  console.log(`Languages: ${Array.from(graph.metadata.language_stats.keys()).join(', ')}`);
  
  // 2. Get call graphs for all functions and classes
  const callGraphs = get_call_graphs(graph);
  
  for (const info of callGraphs) {
    console.log(`\n${info.node.name}:`);
    console.log(`  Calls: ${info.calls.map(n => n.name).join(', ')}`);
    console.log(`  Called by: ${info.called_by.map(n => n.name).join(', ')}`);
  }
  
  // 3. Find entry points using the call graph info
  const entryPoints = callGraphs.filter(cg => cg.called_by.length === 0);
  console.log('\nEntry points (functions not called by any other code):');
  for (const info of entryPoints) {
    console.log(`  - ${info.node.name} (${info.node.file_path})`);
  }
  
  // 4. Find leaf functions (functions that don't call anything)
  const leafFunctions = callGraphs.filter(cg => cg.calls.length === 0);
  console.log('\nLeaf functions (functions that don\'t call other functions):');
  for (const info of leafFunctions) {
    console.log(`  - ${info.node.name} (${info.node.file_path})`);
  }
  
}

// Run the example
if (require.main === module) {
  example().catch(console.error);
}
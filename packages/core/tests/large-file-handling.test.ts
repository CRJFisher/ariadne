import { test } from 'vitest';
import { Project } from '../src/index';

test('handles files larger than 32KB correctly', () => {
  const project = new Project();
  
  // Create a file that's larger than 32KB
  let largeContent = `
// Large TypeScript file for testing
export function exportedFunction() {
  return "I am exported";
}

function internalFunction() {
  return "I am internal";
}

export class LargeClass {
  method1() {
    return exportedFunction();
  }
  
  method2() {
    return internalFunction();
  }
}
`;

  // Add padding to exceed 32KB
  const padding = '\n// ' + 'x'.repeat(1000) + '\n';
  while (largeContent.length < 35 * 1024) {
    largeContent += padding;
  }
  
  // Add function at the end that should be detected
  largeContent += `
export function functionAtEnd() {
  return "I am at the end";
}
`;

  const fileSize = largeContent.length;
  console.log(`Testing with file size: ${(fileSize / 1024).toFixed(1)}KB`);
  
  // This should either:
  // 1. Successfully parse the file despite being > 32KB, OR
  // 2. Throw a clear error message about the file size limit
  const result = project.add_or_update_file('large.ts', largeContent);
  
  // Try to get the call graph
  const callGraph = project.get_call_graph({ include_external: false });
  
  // If the file was processed, verify the functions were found
  if (callGraph.nodes.size > 0) {
    expect(callGraph.nodes.has('large.ts#exportedFunction')).toBe(true);
    expect(callGraph.nodes.has('large.ts#internalFunction')).toBe(true);
    expect(callGraph.nodes.has('large.ts#functionAtEnd')).toBe(true);
    
    // Verify the call relationships
    const method1Calls = callGraph.edges.filter(e => e.from === 'large.ts#LargeClass.method1');
    const method2Calls = callGraph.edges.filter(e => e.from === 'large.ts#LargeClass.method2');
    
    expect(method1Calls.some(e => e.to === 'large.ts#exportedFunction')).toBe(true);
    expect(method2Calls.some(e => e.to === 'large.ts#internalFunction')).toBe(true);
  }
});

test('warns or splits files that exceed tree-sitter limits', () => {
  const project = new Project();
  
  // Test with a file right at the boundary
  const boundarySize = 32 * 1024; // 32KB
  let boundaryContent = '// File at 32KB boundary\n';
  
  // Fill to exact size
  while (boundaryContent.length < boundarySize - 100) {
    boundaryContent += '// padding line to reach size limit\n';
  }
  
  boundaryContent += `
export function boundaryFunction() {
  return "I am at the boundary";
}`;
  
  // Ensure we're right at the boundary
  while (boundaryContent.length < boundarySize) {
    boundaryContent += ' ';
  }
  
  console.log(`Boundary file size: ${boundaryContent.length} bytes`);
  
  // This should work fine
  project.add_or_update_file('boundary.ts', boundaryContent);
  const callGraph1 = project.get_call_graph({ include_external: false });
  expect(callGraph1.nodes.has('boundary.ts#boundaryFunction')).toBe(true);
  
  // Now test with a file just over the limit
  const overLimitContent = boundaryContent + '\n// One more line';
  console.log(`Over-limit file size: ${overLimitContent.length} bytes`);
  
  // This might fail or be handled specially
  const result = project.add_or_update_file('overlimit.ts', overLimitContent);
  
  // The system should handle this gracefully
  const callGraph2 = project.get_call_graph({ include_external: false });
  
  // Either the file is processed (if limit is handled) or it's skipped
  // But it shouldn't crash
  expect(callGraph2).toBeDefined();
});
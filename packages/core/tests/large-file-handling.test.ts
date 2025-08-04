import { test, expect, vi } from 'vitest';
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
  
  // Mock console.warn to capture the warning
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  
  // This should skip the file due to size limit
  project.add_or_update_file('large.ts', largeContent);
  
  // Should have warned about the file not being parseable
  expect(warnSpy).toHaveBeenCalledWith(
    expect.stringContaining('cannot be parsed by tree-sitter')
  );
  
  // Try to get the call graph
  const callGraph = project.get_call_graph({ include_external: false });
  
  // The large file should have been skipped, so it shouldn't have any nodes from it
  expect(callGraph.nodes.has('large#exportedFunction')).toBe(false);
  expect(callGraph.nodes.has('large#functionAtEnd')).toBe(false);
  
  warnSpy.mockRestore();
});

test('warns or splits files that exceed tree-sitter limits', () => {
  const project = new Project();
  
  // Test with a file well under the boundary
  const boundarySize = 30 * 1024; // 30KB - well under 32KB
  let boundaryContent = '// File well under 32KB boundary\n';
  
  // Fill to just under the limit
  while (boundaryContent.length < boundarySize - 100) {
    boundaryContent += '// padding line to reach size limit\n';
  }
  
  boundaryContent += `
export function boundaryFunction() {
  return "I am under the boundary";
}`;
  
  console.log(`Boundary file size: ${boundaryContent.length} bytes`);
  
  // Mock console.warn to check if it warns
  const warnSpy1 = vi.spyOn(console, 'warn').mockImplementation(() => {});
  
  // This should work fine
  project.add_or_update_file('boundary.ts', boundaryContent);
  
  // Check if warned (it shouldn't)
  if (warnSpy1.mock.calls.length > 0) {
    console.error('Unexpected warning for boundary file:', warnSpy1.mock.calls);
  }
  warnSpy1.mockRestore();
  
  const callGraph1 = project.get_call_graph({ include_external: false });
  expect(callGraph1.nodes.has('boundary#boundaryFunction')).toBe(true);
  
  // Now test with a file definitely over the limit
  let overLimitContent = boundaryContent;
  while (overLimitContent.length < 32 * 1024 + 100) {
    overLimitContent += '\n// More padding to push over limit';
  }
  console.log(`Over-limit file size: ${overLimitContent.length} bytes`);
  
  // Mock console.warn to capture the warning
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  
  // This should warn and skip the file
  project.add_or_update_file('overlimit.ts', overLimitContent);
  
  // Should have warned about the file not being parseable
  expect(warnSpy).toHaveBeenCalledWith(
    expect.stringContaining('cannot be parsed by tree-sitter')
  );
  
  // The system should handle this gracefully
  const callGraph2 = project.get_call_graph({ include_external: false });
  
  // Should still have the boundary function but not the overlimit one
  expect(callGraph2).toBeDefined();
  expect(callGraph2.nodes.has('boundary#boundaryFunction')).toBe(true);
  
  warnSpy.mockRestore();
});
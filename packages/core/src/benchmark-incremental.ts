#!/usr/bin/env node

import { Project } from './index';

console.log('Ariadne Incremental Parsing Benchmark\n');

// Create a large TypeScript file for benchmarking
function generateLargeFile(functionCount: number): string {
  const lines: string[] = [];
  
  // Add imports
  lines.push(`import { Something } from './module';`);
  lines.push('');
  
  // Add interfaces
  for (let i = 0; i < 10; i++) {
    lines.push(`interface Interface${i} {`);
    lines.push(`  prop${i}: string;`);
    lines.push(`  method${i}(): void;`);
    lines.push(`}`);
    lines.push('');
  }
  
  // Add functions
  for (let i = 0; i < functionCount; i++) {
    lines.push(`function function_${i}(param${i}: number): number {`);
    lines.push(`  const result = param${i} * 2;`);
    lines.push(`  return result + ${i};`);
    lines.push(`}`);
    lines.push('');
  }
  
  // Add a class
  lines.push('class LargeClass {');
  for (let i = 0; i < 20; i++) {
    lines.push(`  method${i}() {`);
    lines.push(`    return function_${i % functionCount}(${i});`);
    lines.push(`  }`);
    lines.push('');
  }
  lines.push('}');
  
  return lines.join('\n');
}

// Benchmark function
function benchmark(name: string, fn: () => void): number {
  const start = process.hrtime.bigint();
  fn();
  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
  console.log(`${name}: ${duration.toFixed(2)}ms`);
  return duration;
}

// Run benchmarks
const project = new Project();
const functionCounts = [100, 500, 1000];

functionCounts.forEach(count => {
  console.log(`\n--- Testing with ${count} functions ---`);
  
  const code = generateLargeFile(count);
  console.log(`File size: ${(code.length / 1024).toFixed(2)} KB`);
  
  // Initial parse
  const initialTime = benchmark('Initial parse', () => {
    project.add_or_update_file('large.ts', code);
  });
  
  // Small edit in the middle
  const editPosition = { row: Math.floor(count / 2) * 5 + 2, column: 20 };
  const incrementalTime = benchmark('Incremental update (small edit)', () => {
    project.update_file_range(
      'large.ts',
      editPosition,
      'param',
      'parameter'
    );
  });
  
  // Calculate speedup
  const speedup = initialTime / incrementalTime;
  console.log(`Speedup: ${speedup.toFixed(2)}x`);
  
  // Large edit (replace entire function)
  const largeFunctionReplacement = `function new_function(x: number, y: number): number {
  const sum = x + y;
  const product = x * y;
  return sum * product;
}`;
  
  const largeEditTime = benchmark('Incremental update (large edit)', () => {
    project.update_file_range(
      'large.ts',
      { row: 20, column: 0 },
      `function function_5(param5: number): number {
  const result = param5 * 2;
  return result + 5;
}`,
      largeFunctionReplacement
    );
  });
  
  const largeEditSpeedup = initialTime / largeEditTime;
  console.log(`Large edit speedup: ${largeEditSpeedup.toFixed(2)}x`);
  
  // Multiple small edits
  const multiEditTime = benchmark('Multiple incremental updates', () => {
    for (let i = 0; i < 10; i++) {
      const row = 15 + (i * 10);
      project.update_file_range(
        'large.ts',
        { row, column: 10 },
        'const',
        'let'
      );
    }
  });
  
  const avgEditTime = multiEditTime / 10;
  console.log(`Average time per edit: ${avgEditTime.toFixed(2)}ms`);
  console.log(`Average speedup per edit: ${(initialTime / avgEditTime).toFixed(2)}x`);
});

console.log('\n--- Summary ---');
console.log('Incremental parsing provides significant performance improvements,');
console.log('especially for small, localized edits in large files.');
console.log('\nNote: Actual performance depends on:');
console.log('- Edit size and location');
console.log('- File structure complexity');
console.log('- Hardware capabilities');
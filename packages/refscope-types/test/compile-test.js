#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Testing refscope-types compilation...\n');

const testDir = __dirname;
const testsPath = path.join(testDir, 'type-tests.ts');

// Ensure test file exists
if (!fs.existsSync(testsPath)) {
  console.error('Error: type-tests.ts not found!');
  process.exit(1);
}

try {
  // Run TypeScript compiler on test file
  console.log('Compiling type tests...');
  execSync(`npx tsc --noEmit --strict ${testsPath}`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  
  console.log('\n✅ All type tests passed!');
} catch (error) {
  console.error('\n❌ Type compilation failed!');
  process.exit(1);
}
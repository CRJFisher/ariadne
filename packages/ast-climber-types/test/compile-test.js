#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Testing ast-climber-types compilation...\n');

const testDir = __dirname;
const testsPath = path.join(testDir, 'type-tests.ts');

// Ensure test file exists
if (!fs.existsSync(testsPath)) {
  console.error('Error: type-tests.ts not found!');
  process.exit(1);
}

try {
  // Run TypeScript compiler on test file with project config
  console.log('Compiling type tests...');
  const projectRoot = path.join(__dirname, '..');
  
  // Create a temporary tsconfig that includes the test file
  const testTsConfig = {
    extends: './tsconfig.json',
    include: [
      'index.d.ts',
      'types/**/*.d.ts',
      'test/type-tests.ts'
    ]
  };
  
  const testConfigPath = path.join(projectRoot, 'tsconfig.test.json');
  fs.writeFileSync(testConfigPath, JSON.stringify(testTsConfig, null, 2));
  
  try {
    execSync(`npx tsc --noEmit --project ${testConfigPath}`, {
      stdio: 'inherit',
      cwd: projectRoot
    });
    
    console.log('\n✅ All type tests passed!');
  } finally {
    // Clean up temporary config
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  }
} catch (error) {
  console.error('\n❌ Type compilation failed!');
  process.exit(1);
}
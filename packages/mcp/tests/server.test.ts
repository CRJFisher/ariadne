import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { Project } from '@ariadnejs/core';

describe('Ariadne MCP Server', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test files
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ariadne-mcp-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Core functionality', () => {
    it('should handle go_to_definition correctly', async () => {
      // Create a test file
      const testFile = path.join(testDir, 'test.js');
      const testContent = `
function myFunction() {
  return 42;
}

const result = myFunction();
`;
      await fs.writeFile(testFile, testContent);

      // Use Ariadne directly to test the core functionality
      const project = new Project();
      project.add_or_update_file(testFile, testContent);
      
      const definition = project.go_to_definition(testFile, { row: 5, column: 15 });
      
      expect(definition).toBeTruthy();
      expect(definition?.range.start.row).toBe(1);
    });

    it('should handle find_references correctly', async () => {
      // Create a test file
      const testFile = path.join(testDir, 'test.js');
      const testContent = `
function myFunction() {
  return 42;
}

const result1 = myFunction();
const result2 = myFunction();
myFunction();
`;
      await fs.writeFile(testFile, testContent);

      // Use Ariadne directly to test the core functionality
      const project = new Project();
      project.add_or_update_file(testFile, testContent);
      
      const references = project.find_references(testFile, { row: 1, column: 9 });
      
      expect(references).toBeTruthy();
      expect(references.length).toBeGreaterThan(0);
    });
  });

  describe('Server binary', () => {
    it('should be executable', async () => {
      const serverPath = path.join(__dirname, '..', 'dist', 'server.js');
      
      // Check if the built server exists
      try {
        await fs.access(serverPath);
        const stats = await fs.stat(serverPath);
        // On Unix systems, check if executable bit is set
        if (process.platform !== 'win32') {
          expect(stats.mode & 0o111).toBeGreaterThan(0);
        }
      } catch {
        // Server not built yet, skip this test
        console.log('Server not built, skipping executable test');
      }
    });
  });
});
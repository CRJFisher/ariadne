/**
 * Namespace Imports Test Factory
 * 
 * Ensures all language implementations have the same test coverage
 * by using a factory pattern instead of class inheritance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../../index';

/**
 * Language adapter interface - what each language must provide
 */
export interface LanguageAdapter {
  fileExtension: string;
  
  /**
   * Create test files for basic namespace import
   */
  createBasicImportFiles(): Record<string, string>;
  
  /**
   * Create test files for nested namespace access
   */
  createNestedAccessFiles(): Record<string, string>;
  
  /**
   * Create test files for re-exported namespaces
   */
  createReExportFiles(): Record<string, string>;
  
  /**
   * Get the expected function calls for verification
   */
  getExpectedCalls(testCase: 'basic' | 'nested' | 'reexport'): {
    caller: string;
    expectedCalls: string[];
  };
}

/**
 * Create a complete test suite for a language
 * This ensures all languages test the same scenarios
 */
export function createNamespaceImportTestSuite(
  language: string,
  adapter: LanguageAdapter
) {
  describe(`${language} Namespace Imports`, () => {
    let project: Project;
    
    beforeEach(() => {
      project = new Project();
    });
    
    // REQUIRED TEST 1: Basic namespace import
    it('handles basic namespace imports', () => {
      const files = adapter.createBasicImportFiles();
      
      for (const [path, content] of Object.entries(files)) {
        project.add_or_update_file(path, content);
      }
      
      const { caller, expectedCalls } = adapter.getExpectedCalls('basic');
      verifyCallsResolved(project, caller, expectedCalls, files);
    });
    
    // REQUIRED TEST 2: Nested namespace access
    it('handles nested namespace access', () => {
      const files = adapter.createNestedAccessFiles();
      
      for (const [path, content] of Object.entries(files)) {
        project.add_or_update_file(path, content);
      }
      
      const { caller, expectedCalls } = adapter.getExpectedCalls('nested');
      verifyCallsResolved(project, caller, expectedCalls, files);
    });
    
    // REQUIRED TEST 3: Re-exported namespaces
    it('handles re-exported namespaces', () => {
      const files = adapter.createReExportFiles();
      
      for (const [path, content] of Object.entries(files)) {
        project.add_or_update_file(path, content);
      }
      
      const { caller, expectedCalls } = adapter.getExpectedCalls('reexport');
      verifyCallsResolved(project, caller, expectedCalls, files);
    });
    
    // OPTIONAL: Language-specific edge cases can be added in the language file
  });
}

/**
 * Shared verification logic
 */
function verifyCallsResolved(
  project: Project,
  callerName: string,
  expectedCalls: string[],
  files: Record<string, string>
) {
  // Find the caller definition
  let callerDef;
  for (const filePath of Object.keys(files)) {
    const defs = project.get_definitions(filePath);
    callerDef = defs.find(d => d.name === callerName);
    if (callerDef) break;
  }
  
  expect(callerDef).toBeDefined();
  
  // Get calls and verify
  const calls = project.get_calls_from_definition(callerDef!);
  const calledNames = calls.map(c => c.called_def.name);
  
  for (const expectedCall of expectedCalls) {
    expect(calledNames).toContain(expectedCall);
  }
}

/**
 * Validation that all required tests exist
 * Can be run as part of CI to ensure compliance
 */
export const REQUIRED_TEST_NAMES = [
  'handles basic namespace imports',
  'handles nested namespace access',
  'handles re-exported namespaces'
];

export function validateTestCoverage(testFileContent: string): string[] {
  const missing: string[] = [];
  
  for (const testName of REQUIRED_TEST_NAMES) {
    if (!testFileContent.includes(`it('${testName}'`)) {
      missing.push(testName);
    }
  }
  
  return missing;
}
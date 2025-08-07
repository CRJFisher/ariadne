/**
 * Namespace Imports Test Interface
 * 
 * Defines the test cases that all language implementations must satisfy
 * for namespace import support.
 */

import { describe, it } from 'vitest';
import { Project, Def } from '../../index';

export interface NamespaceImportTests {
  testBasicNamespaceImport(): void;
  testNestedNamespaceAccess(): void;
  testReExportedNamespace(): void;
  testNamespaceWithRenamedExports(): void;
  testCircularNamespaceImports(): void;
}

/**
 * Base test data that language-specific tests will adapt
 */
export const NAMESPACE_TEST_CASES = {
  basic: {
    description: "Import entire module as namespace and call its members",
    setup: {
      'math': {
        exports: ['add', 'subtract', 'multiply', 'divide']
      },
      'app': {
        imports: '* as math from "./math"',
        calls: ['math.add()', 'math.multiply()']
      }
    },
    expected: {
      resolvedCalls: ['add', 'multiply']
    }
  },

  nested: {
    description: "Access deeply nested namespace members",
    setup: {
      'utils/string': {
        exports: ['capitalize', 'lowercase']
      },
      'utils/index': {
        imports: '* as string from "./string"',
        exports: ['string']
      },
      'app': {
        imports: '* as utils from "./utils"',
        calls: ['utils.string.capitalize()']
      }
    },
    expected: {
      resolvedCalls: ['capitalize']
    }
  },

  reExported: {
    description: "Handle namespaces that are re-exported",
    setup: {
      'operations': {
        exports: ['multiply']
      },
      'math': {
        imports: '* as operations from "./operations"',
        exports: ['operations']
      },
      'app': {
        imports: '* as math from "./math"',
        calls: ['math.operations.multiply()']
      }
    },
    expected: {
      resolvedCalls: ['multiply']
    }
  }
};

/**
 * Shared test utilities
 */
export abstract class NamespaceImportTestBase {
  protected project: Project;

  constructor() {
    this.project = new Project();
  }

  /**
   * Language-specific file extension (.js, .py, .rs, etc.)
   */
  abstract get fileExtension(): string;

  /**
   * Convert generic test case to language-specific syntax
   */
  abstract adaptTestCase(testCase: any): Record<string, string>;

  /**
   * Run a test case
   */
  protected runTestCase(testCase: any): void {
    const files = this.adaptTestCase(testCase);
    
    // Add files to project
    for (const [path, content] of Object.entries(files)) {
      this.project.add_or_update_file(path, content);
    }

    // Verify expected calls are resolved
    this.verifyCallsResolved(testCase.expected.resolvedCalls);
  }

  /**
   * Verify that expected function calls are resolved
   */
  protected verifyCallsResolved(expectedCalls: string[]): void {
    // Implementation would check that the expected calls are found
    // This is a template for language-specific tests to implement
  }

  /**
   * Get all definitions from project
   */
  protected getAllDefinitions(): Def[] {
    // Would need to iterate through all files
    // Placeholder for now
    return [];
  }
}

// Placeholder test suite to satisfy vitest
describe('Namespace Import Test Contract', () => {
  it('test contract is defined', () => {
    // This is just the test contract definition file
    // Actual tests are in language-specific files
  });
});
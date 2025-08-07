/**
 * JavaScript Namespace Imports Tests
 * Using the test factory to ensure complete coverage
 */

import { createNamespaceImportTestSuite, LanguageAdapter } from './namespace_imports_test_factory';

const javascriptAdapter: LanguageAdapter = {
  fileExtension: '.js',
  
  createBasicImportFiles() {
    return {
      'math.js': `
        export function add(a, b) { return a + b; }
        export function multiply(a, b) { return a * b; }
        export const PI = 3.14159;
      `,
      'app.js': `
        import * as math from './math';
        
        export function calculate() {
          const sum = math.add(1, 2);
          const product = math.multiply(3, 4);
          return sum + product;
        }
      `
    };
  },
  
  createNestedAccessFiles() {
    return {
      'utils/string.js': `
        export function capitalize(str) {
          return str.charAt(0).toUpperCase() + str.slice(1);
        }
        export function lowercase(str) {
          return str.toLowerCase();
        }
      `,
      'utils/index.js': `
        import * as string from './string';
        export { string };
      `,
      'app.js': `
        import * as utils from './utils';
        
        export function formatText(text) {
          return utils.string.capitalize(text);
        }
      `
    };
  },
  
  createReExportFiles() {
    return {
      'core/operations.js': `
        export function multiply(a, b) {
          return a * b;
        }
        export function divide(a, b) {
          return a / b;
        }
      `,
      'math/index.js': `
        import * as operations from '../core/operations';
        export { operations };
        export const VERSION = '1.0.0';
      `,
      'app.js': `
        import * as math from './math';
        
        export function compute(x, y) {
          return math.operations.multiply(x, y);
        }
      `
    };
  },
  
  getExpectedCalls(testCase) {
    switch (testCase) {
      case 'basic':
        return {
          caller: 'calculate',
          expectedCalls: ['add', 'multiply']
        };
      case 'nested':
        return {
          caller: 'formatText',
          expectedCalls: ['capitalize']
        };
      case 'reexport':
        return {
          caller: 'compute',
          expectedCalls: ['multiply']
        };
    }
  }
};

// Create the test suite with all required tests
createNamespaceImportTestSuite('JavaScript', javascriptAdapter);

// Language-specific edge cases can be added here
import { describe, it, expect } from 'vitest';
import { Project } from '../../index';

describe('JavaScript Namespace Imports - Edge Cases', () => {
  it('handles CommonJS interop with namespace imports', () => {
    // JavaScript-specific test
  });
  
  it('handles dynamic property access on namespaces', () => {
    // JavaScript-specific test
  });
});
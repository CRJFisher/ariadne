/**
 * JavaScript/TypeScript Namespace Import Tests
 * 
 * Implementation of namespace import tests for JavaScript and TypeScript
 */

import { describe, it, expect } from 'vitest';
import { Project } from '../../index';
import { NamespaceImportTestBase, NAMESPACE_TEST_CASES } from './namespace_imports.test';

class JavaScriptNamespaceTests extends NamespaceImportTestBase {
  get fileExtension(): string {
    return '.js';
  }

  adaptTestCase(testCase: any): Record<string, string> {
    const files: Record<string, string> = {};

    // This would convert the generic test case structure
    // to actual JavaScript code
    // For now, using the existing test patterns we just fixed
    
    if (testCase === NAMESPACE_TEST_CASES.basic) {
      files['math.js'] = `
        export function add(a, b) { return a + b; }
        export function multiply(a, b) { return a * b; }
      `;
      files['app.js'] = `
        import * as math from './math';
        function calculate() {
          math.add(1, 2);
          math.multiply(3, 4);
        }
      `;
    }
    // ... adapt other test cases

    return files;
  }
}

describe('JavaScript Namespace Imports', () => {
  it('handles basic namespace imports', () => {
    const files = {
      'math.js': `
        export function add(a, b) { return a + b; }
        export function multiply(a, b) { return a * b; }
      `,
      'app.js': `
        import * as math from './math';
        function calculate() {
          const sum = math.add(1, 2);
          const product = math.multiply(3, 4);
          return sum + product;
        }
      `
    };

    const project = new Project();
    for (const [path, content] of Object.entries(files)) {
      project.add_or_update_file(path, content);
    }

    const appDefs = project.get_definitions('app.js');
    const calculateDef = appDefs.find(d => d.name === 'calculate');
    expect(calculateDef).toBeDefined();

    const calls = project.get_calls_from_definition(calculateDef!);
    expect(calls.some(c => c.called_def.name === 'add')).toBe(true);
    expect(calls.some(c => c.called_def.name === 'multiply')).toBe(true);
  });

  it('handles nested namespace access', () => {
    const files = {
      'utils/string.js': `
        export function capitalize(str) {
          return str.charAt(0).toUpperCase() + str.slice(1);
        }
      `,
      'utils/index.js': `
        import * as string from './string';
        export { string };
      `,
      'app.js': `
        import * as utils from './utils';
        function format(text) {
          return utils.string.capitalize(text);
        }
      `
    };

    const project = new Project();
    for (const [path, content] of Object.entries(files)) {
      project.add_or_update_file(path, content);
    }

    const appDefs = project.get_definitions('app.js');
    const formatDef = appDefs.find(d => d.name === 'format');
    expect(formatDef).toBeDefined();

    const calls = project.get_calls_from_definition(formatDef!);
    expect(calls.some(c => c.called_def.name === 'capitalize')).toBe(true);
  });

  it('handles re-exported namespaces', () => {
    const files = {
      'math/operations.js': `
        export function multiply(a, b) { return a * b; }
      `,
      'math/index.js': `
        import * as operations from './operations';
        export { operations };
      `,
      'app.js': `
        import * as math from './math';
        function calculate() {
          return math.operations.multiply(5, 6);
        }
      `
    };

    const project = new Project();
    for (const [path, content] of Object.entries(files)) {
      project.add_or_update_file(path, content);
    }

    const appDefs = project.get_definitions('app.js');
    const calculateDef = appDefs.find(d => d.name === 'calculate');
    expect(calculateDef).toBeDefined();

    const calls = project.get_calls_from_definition(calculateDef!);
    expect(calls.some(c => c.called_def.name === 'multiply')).toBe(true);
  });
});
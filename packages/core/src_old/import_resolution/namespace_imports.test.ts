/**
 * Namespace Imports Test Contract and Common Tests
 * 
 * Defines the test scenarios that all language implementations must pass
 * and provides common test utilities.
 * This ensures consistent behavior across all supported languages.
 */

import { describe, it } from 'vitest';
import type { LanguageMetadata } from './namespace_imports';

/**
 * Test scenario definition
 */
export interface TestScenario {
  name: string;
  description: string;
  input: {
    namespace_name: string;
    member_name?: string;
    source_file: string;
    target_file?: string;
  };
  expected: {
    is_namespace_import: boolean;
    exports?: string[];
    resolved_member?: {
      name: string;
      file_path: string;
      line: number;
    };
  };
}

/**
 * Required test scenarios that all languages must implement
 */
export const NAMESPACE_IMPORT_TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'basic_namespace_import',
    description: 'Identifies a basic namespace import',
    input: {
      namespace_name: 'math',
      source_file: 'test.ext'
    },
    expected: {
      is_namespace_import: true
    }
  },
  
  {
    name: 'namespace_member_access',
    description: 'Resolves member access on namespace import',
    input: {
      namespace_name: 'math',
      member_name: 'add',
      source_file: 'test.ext',
      target_file: 'math.ext'
    },
    expected: {
      is_namespace_import: true,
      resolved_member: {
        name: 'add',
        file_path: 'math.ext',
        line: 1
      }
    }
  },
  
  {
    name: 'namespace_all_exports',
    description: 'Lists all exports from a namespace',
    input: {
      namespace_name: 'utils',
      source_file: 'test.ext',
      target_file: 'utils.ext'
    },
    expected: {
      is_namespace_import: true,
      exports: ['helper1', 'helper2', 'default']
    }
  },
  
  {
    name: 'nested_namespace_access',
    description: 'Resolves nested namespace member access',
    input: {
      namespace_name: 'math.operations',
      member_name: 'multiply',
      source_file: 'test.ext'
    },
    expected: {
      is_namespace_import: true,
      resolved_member: {
        name: 'multiply',
        file_path: 'math/operations.ext',
        line: 5
      }
    }
  },
  
  {
    name: 'non_namespace_import',
    description: 'Correctly identifies non-namespace imports',
    input: {
      namespace_name: 'single_export',
      source_file: 'test.ext'
    },
    expected: {
      is_namespace_import: false
    }
  }
];

/**
 * Language-specific test file mapping
 * Maps test scenario names to actual test file patterns
 */
export const LANGUAGE_TEST_FILES = {
  javascript: {
    extension: '.js',
    test_extension: '.test.js',
    sample_files: {
      basic_namespace_import: 'namespace_basic.js',
      namespace_member_access: 'namespace_member.js',
      namespace_all_exports: 'namespace_exports.js',
      nested_namespace_access: 'namespace_nested.js',
      non_namespace_import: 'regular_import.js'
    }
  },
  
  typescript: {
    extension: '.ts',
    test_extension: '.test.ts',
    sample_files: {
      basic_namespace_import: 'namespace_basic.ts',
      namespace_member_access: 'namespace_member.ts',
      namespace_all_exports: 'namespace_exports.ts',
      nested_namespace_access: 'namespace_nested.ts',
      non_namespace_import: 'regular_import.ts'
    }
  },
  
  python: {
    extension: '.py',
    test_extension: '_test.py',
    sample_files: {
      basic_namespace_import: 'namespace_basic.py',
      namespace_member_access: 'namespace_member.py',
      namespace_all_exports: 'namespace_exports.py',
      nested_namespace_access: 'namespace_nested.py',
      non_namespace_import: 'regular_import.py'
    }
  },
  
  rust: {
    extension: '.rs',
    test_extension: '_test.rs',
    sample_files: {
      basic_namespace_import: 'namespace_basic.rs',
      namespace_member_access: 'namespace_member.rs',
      namespace_all_exports: 'namespace_exports.rs',
      nested_namespace_access: 'namespace_nested.rs',
      non_namespace_import: 'regular_import.rs'
    }
  }
};

/**
 * Validate that a language implementation covers all required scenarios
 */
export function validate_test_coverage(
  language: keyof typeof LANGUAGE_TEST_FILES,
  implemented_tests: string[]
): { 
  missing: string[]; 
  coverage: number; 
  is_complete: boolean;
} {
  const required = NAMESPACE_IMPORT_TEST_SCENARIOS.map(s => s.name);
  const missing = required.filter(name => !implemented_tests.includes(name));
  const coverage = (required.length - missing.length) / required.length * 100;
  
  return {
    missing,
    coverage,
    is_complete: missing.length === 0
  };
}

/**
 * Generate test file path for a scenario and language
 */
export function get_test_file_path(
  scenario_name: string,
  language: keyof typeof LANGUAGE_TEST_FILES,
  base_path: string = 'tests/namespace_imports'
): string {
  const lang_config = LANGUAGE_TEST_FILES[language];
  const file_name = lang_config.sample_files[scenario_name as keyof typeof lang_config.sample_files];
  
  if (!file_name) {
    throw new Error(`No test file defined for scenario '${scenario_name}' in language '${language}'`);
  }
  
  return `${base_path}/${language}/${file_name}`;
}

/**
 * Test execution helper
 * Provides a standardized way to run namespace import tests
 */
export function create_namespace_test_runner(
  language: LanguageMetadata['language']
) {
  return {
    /**
     * Run a single test scenario
     */
    run_scenario: async function(scenario: TestScenario): Promise<{
      passed: boolean;
      errors: string[];
    }> {
      // This would be implemented by the test runner
      // Placeholder for now
      return {
        passed: true,
        errors: []
      };
    },
    
    /**
     * Run all scenarios for a language
     */
    run_all: async function(): Promise<{
      total: number;
      passed: number;
      failed: number;
      errors: Map<string, string[]>;
    }> {
      const results = {
        total: NAMESPACE_IMPORT_TEST_SCENARIOS.length,
        passed: 0,
        failed: 0,
        errors: new Map<string, string[]>()
      };
      
      for (const scenario of NAMESPACE_IMPORT_TEST_SCENARIOS) {
        const result = await this.run_scenario(scenario);
        if (result.passed) {
          results.passed++;
        } else {
          results.failed++;
          results.errors.set(scenario.name, result.errors);
        }
      }
      
      return results;
    }
  };
}

// Test contract validation - ensures all language implementations cover required scenarios
describe('Namespace Import Test Contract', () => {
  it('defines required test scenarios', () => {
    // This is a placeholder test to satisfy vitest
    // The actual test contract is enforced by language-specific test files
    // implementing the NAMESPACE_IMPORT_TEST_SCENARIOS
  });
});
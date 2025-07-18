import { describe, test, expect, beforeEach } from 'vitest';
import { Project } from '../index';
import { LanguageConfig } from '../types';

/**
 * Test case for a specific language feature
 */
export interface LanguageTestCase {
  name: string;
  code: string;
  skip?: boolean;
  only?: boolean;
}

/**
 * Expected results for a test case - can be language-specific
 */
export interface TestExpectations {
  typescript?: LanguageExpectations;
  javascript?: LanguageExpectations;
  python?: LanguageExpectations;
  rust?: LanguageExpectations;
  // Common expectations for all languages
  common?: LanguageExpectations;
}

export interface LanguageExpectations {
  definitions: {
    name: string;
    kind?: string;  // Optional since kinds can vary
    count?: number;
  }[];
  references?: {
    name: string;
    count: number;
  }[];
  goToDefinition?: {
    position: { row: number; column: number };
    expectedName: string;
    expectedKind?: string;
  }[];
}

/**
 * Language test fixture with code examples
 */
export interface LanguageTestFixture {
  name: string;
  languages: {
    typescript?: LanguageTestCase;
    javascript?: LanguageTestCase;
    python?: LanguageTestCase;
    rust?: LanguageTestCase;
  };
  expectations: TestExpectations;
}

/**
 * Shared test fixtures for features common across languages
 */
export const SHARED_TEST_FIXTURES: LanguageTestFixture[] = [
  {
    name: 'Variable Declaration',
    languages: {
      typescript: {
        name: 'const variable',
        code: `const myVariable = 42;
console.log(myVariable);`
      },
      javascript: {
        name: 'const variable',
        code: `const myVariable = 42;
console.log(myVariable);`
      },
      python: {
        name: 'variable assignment',
        code: `my_variable = 42
print(my_variable)`
      },
      rust: {
        name: 'let binding',
        code: `fn main() {
    let my_variable = 42;
    println!("{}", my_variable);
}`
      }
    },
    expectations: {
      typescript: {
        definitions: [{ name: 'myVariable', kind: 'constant' }],
        references: [{ name: 'myVariable', count: 1 }]
      },
      javascript: {
        definitions: [{ name: 'myVariable', kind: 'constant' }],
        references: [{ name: 'myVariable', count: 1 }]
      },
      python: {
        definitions: [{ name: 'my_variable', kind: 'variable' }],
        references: [{ name: 'my_variable', count: 1 }]
      },
      rust: {
        definitions: [
          { name: 'main', kind: 'function' },
          { name: 'my_variable', kind: 'variable' }
        ],
        references: [{ name: 'my_variable', count: 1 }]
      }
    }
  },
  
  {
    name: 'Function Definition',
    languages: {
      typescript: {
        name: 'function declaration',
        code: `function myFunction(x: number): number {
  return x * 2;
}
const result = myFunction(21);`
      },
      javascript: {
        name: 'function declaration',
        code: `function myFunction(x) {
  return x * 2;
}
const result = myFunction(21);`
      },
      python: {
        name: 'def statement',
        code: `def my_function(x):
    return x * 2

result = my_function(21)`
      },
      rust: {
        name: 'fn declaration',
        code: `fn my_function(x: i32) -> i32 {
    x * 2
}
fn main() {
    let result = my_function(21);
}`
      }
    },
    expectations: {
      typescript: {
        definitions: [
          { name: 'myFunction', kind: 'function' },
          { name: 'x', kind: 'parameter' },
          { name: 'result', kind: 'constant' }
        ]
      },
      javascript: {
        definitions: [
          { name: 'myFunction', kind: 'function' },
          { name: 'x', kind: 'variable' },  // JavaScript params parsed as variable
          { name: 'result', kind: 'constant' }
        ]
      },
      python: {
        definitions: [
          { name: 'my_function', kind: 'function' },
          { name: 'x', kind: 'parameter' },
          { name: 'result', kind: 'variable' }
        ]
      },
      rust: {
        definitions: [
          { name: 'my_function', kind: 'function' },
          { name: 'x', kind: 'variable' },  // Rust params parsed as variable
          { name: 'main', kind: 'function' },
          { name: 'result', kind: 'variable' }
        ]
      }
    }
  },
  
  {
    name: 'Class Definition with Methods',
    languages: {
      typescript: {
        name: 'class with methods',
        code: `class MyClass {
  getValue(): number {
    return 42;
  }
}`
      },
      javascript: {
        name: 'class with methods',
        code: `class MyClass {
  getValue() {
    return 42;
  }
}`
      },
      python: {
        name: 'class with methods',
        code: `class MyClass:
    def get_value(self):
        return 42`
      },
      rust: {
        name: 'struct with impl',
        code: `struct MyClass {}

impl MyClass {
    fn get_value(&self) -> i32 {
        42
    }
}`
      }
    },
    expectations: {
      typescript: {
        definitions: [
          { name: 'MyClass', kind: 'class' },
          { name: 'getValue', kind: 'method' }
        ]
      },
      javascript: {
        definitions: [
          { name: 'MyClass', kind: 'class' },
          { name: 'getValue', kind: 'method' }
        ]
      },
      python: {
        definitions: [
          { name: 'MyClass', kind: 'class' },
          { name: 'get_value', kind: 'function' }
        ]
      },
      rust: {
        definitions: [
          { name: 'MyClass', kind: 'struct' },
          { name: 'get_value', kind: 'function' }
        ]
      }
    }
  },
  
  {
    name: 'Import Statements',
    languages: {
      typescript: {
        name: 'ES6 imports',
        code: `import { readFile } from 'fs';
const x = readFile;`
      },
      javascript: {
        name: 'ES6 imports',
        code: `import { readFile } from 'fs';
const x = readFile;`
      },
      python: {
        name: 'import statements',
        code: `from os import path
x = path`
      },
      rust: {
        name: 'use statements',
        code: `use std::path::Path;

fn main() {
    let p = Path::new("test");
}`
      }
    },
    expectations: {
      typescript: {
        definitions: [
          { name: 'readFile' },  // Import nodes don't have symbol_kind
          { name: 'x', kind: 'constant' }
        ]
      },
      javascript: {
        definitions: [
          { name: 'readFile' },  // Import nodes don't have symbol_kind
          { name: 'x', kind: 'constant' }
        ]
      },
      python: {
        definitions: [
          { name: 'path' },  // Import nodes don't have symbol_kind
          { name: 'x', kind: 'variable' }
        ]
      },
      rust: {
        definitions: [
          { name: 'Path' },  // Import nodes don't have symbol_kind
          { name: 'main', kind: 'function' },
          { name: 'p', kind: 'variable' }
        ]
      }
    }
  }
];

/**
 * Generate tests for a specific language
 */
export function generateLanguageTests(
  languageName: 'typescript' | 'javascript' | 'python' | 'rust',
  getFileExtension: () => string
) {
  describe(`${languageName} - Shared Feature Tests`, () => {
    let project: Project;
    
    beforeEach(() => {
      project = new Project();
    });
    
    SHARED_TEST_FIXTURES.forEach(fixture => {
      const testCase = fixture.languages[languageName];
      if (!testCase) return;
      
      if (testCase.skip) {
        test.skip(fixture.name, () => {});
        return;
      }
      
      const testFn = testCase.only ? test.only : test;
      
      testFn(`${fixture.name} - ${testCase.name}`, () => {
        const fileName = `test.${getFileExtension()}`;
        project.add_or_update_file(fileName, testCase.code);
        
        const graph = project.get_scope_graph(fileName);
        expect(graph).not.toBeNull();
        
        // Get language-specific or common expectations
        const expectations = fixture.expectations[languageName] || fixture.expectations.common;
        if (!expectations) {
          throw new Error(`No expectations defined for ${languageName} in fixture ${fixture.name}`);
        }
        
        // Debug output for failing tests
        if (fixture.name === 'Function Definition' || fixture.name === 'Variable Declaration') {
          const allDefs = graph!.getNodes('definition');
          const allImports = graph!.getNodes('import');
          const allRefs = graph!.getNodes('reference');
          console.log(`\n${fixture.name} Test Debug for ${languageName}:`);
          console.log('Test code:', testCase.code);
          console.log('Definitions found:', allDefs.map(d => `${d.name} (${d.symbol_kind})`));
          console.log('References found:', allRefs.map(r => `${r.name} at ${r.range.start.row}:${r.range.start.column}`));
          console.log('Expected defs:', expectations.definitions);
          console.log('Expected refs:', expectations.references);
        }
        
        // Test definitions
        if (expectations.definitions) {
          const allDefs = graph!.getNodes('definition');
          const allImports = graph!.getNodes('import');
          
          // Combine definitions and imports for testing
          const allNodes = [...allDefs, ...allImports];
          
          expectations.definitions.forEach(expectedDef => {
            const foundNodes = allNodes.filter(d => 
              d.name === expectedDef.name && 
              (!expectedDef.kind || d.symbol_kind === expectedDef.kind)
            );
            
            if (expectedDef.count !== undefined) {
              expect(foundNodes.length).toBe(expectedDef.count);
            } else {
              expect(foundNodes.length).toBeGreaterThan(0);
            }
          });
        }
        
        // Test references
        if (expectations.references) {
          expectations.references.forEach(expectedRef => {
            // Find the definition first to get its position
            const allDefs = graph!.getNodes('definition');
            const def = allDefs.find(d => d.name === expectedRef.name);
            if (!def) {
              throw new Error(`Definition not found for ${expectedRef.name}`);
            }
            
            // Find references from the definition position
            const refs = project.find_references(fileName, { 
              row: def.range.start.row, 
              column: def.range.start.column 
            });
            
            const matchingRefs = refs.filter(r => r.name === expectedRef.name);
            expect(matchingRefs.length).toBe(expectedRef.count);
          });
        }
        
        // Test go-to-definition
        if (expectations.goToDefinition) {
          expectations.goToDefinition.forEach(gtd => {
            const def = project.go_to_definition(fileName, gtd.position);
            expect(def).not.toBeNull();
            expect(def!.name).toBe(gtd.expectedName);
            if (gtd.expectedKind) {
              expect(def!.symbol_kind).toBe(gtd.expectedKind);
            }
          });
        }
      });
    });
  });
}

/**
 * Test runner for language-specific features
 */
export interface LanguageSpecificTest {
  name: string;
  code: string;
  test: (project: Project, fileName: string) => void;
}

/**
 * Run language-specific tests
 */
export function runLanguageSpecificTests(
  languageName: string,
  tests: LanguageSpecificTest[],
  getFileExtension: () => string
) {
  describe(`${languageName} - Language-Specific Features`, () => {
    let project: Project;
    
    beforeEach(() => {
      project = new Project();
    });
    
    tests.forEach(testCase => {
      test(testCase.name, () => {
        const fileName = `test.${getFileExtension()}`;
        project.add_or_update_file(fileName, testCase.code);
        testCase.test(project, fileName);
      });
    });
  });
}
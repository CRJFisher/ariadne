import { Project } from './index';
import { Point } from './graph';

describe('Incremental Parsing', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  test('incremental update preserves tree structure', () => {
    const initial_code = `
      function greet(name) {
        console.log("Hello, " + name);
      }
      
      greet("World");
    `;

    // Initial parse
    project.add_or_update_file('test.js', initial_code);
    
    // Get initial references
    const initial_refs = project.find_references('test.js', { row: 5, column: 6 }); // greet call
    expect(initial_refs).toHaveLength(2); // definition + call

    // Update the greeting text
    project.update_file_range(
      'test.js',
      { row: 2, column: 16 }, // start of "Hello, "
      '"Hello, "',
      '"Hi, "'
    );

    // Check references are still found correctly
    const updated_refs = project.find_references('test.js', { row: 5, column: 6 });
    expect(updated_refs).toHaveLength(2);
  });

  test('incremental update handles variable rename', () => {
    const initial_code = `
      let count = 0;
      count = count + 1;
      console.log(count);
    `;

    project.add_or_update_file('test.js', initial_code);
    
    // Rename 'count' to 'counter' in declaration
    project.update_file_range(
      'test.js',
      { row: 1, column: 10 },
      'count',
      'counter'
    );

    // After this change, references to 'count' should be broken
    const refs = project.find_references('test.js', { row: 1, column: 10 });
    expect(refs).toHaveLength(1); // Only the definition
  });

  test('incremental update handles adding new function', () => {
    const initial_code = `
      function foo() {
        return 1;
      }
    `;

    project.add_or_update_file('test.js', initial_code);

    // Add a new function
    const new_function = `
      
      function bar() {
        return foo() + 1;
      }`;

    project.update_file_range(
      'test.js',
      { row: 3, column: 7 }, // end of first function
      '',
      new_function
    );

    // Check that foo is referenced in bar
    const foo_refs = project.find_references('test.js', { row: 1, column: 15 }); // foo definition
    expect(foo_refs).toHaveLength(2); // definition + call in bar
  });

  test('incremental update handles multi-line changes', () => {
    const initial_code = `
      class Animal {
        constructor(name) {
          this.name = name;
        }
        
        speak() {
          console.log(this.name);
        }
      }
    `;

    project.add_or_update_file('test.js', initial_code);

    // Replace the speak method with a more complex one
    const new_method = `speak() {
          const prefix = "The animal says: ";
          console.log(prefix + this.name);
        }`;

    project.update_file_range(
      'test.js',
      { row: 6, column: 8 }, // start of speak method
      `speak() {
          console.log(this.name);
        }`,
      new_method
    );

    // Verify the class is still parsed correctly
    const class_def = project.go_to_definition('test.js', { row: 1, column: 12 }); // Animal
    expect(class_def).toBeTruthy();
    expect(class_def?.name).toBe('Animal');
  });

  test('incremental update performance benefit', () => {
    // Create a large file
    const lines = [];
    for (let i = 0; i < 1000; i++) {
      lines.push(`function func_${i}() { return ${i}; }`);
    }
    const large_code = lines.join('\n');

    // Time initial parse
    const start_initial = Date.now();
    project.add_or_update_file('large.js', large_code);
    const time_initial = Date.now() - start_initial;

    // Make a small change
    const start_incremental = Date.now();
    project.update_file_range(
      'large.js',
      { row: 500, column: 30 }, // middle of file
      '500',
      '999'
    );
    const time_incremental = Date.now() - start_incremental;

    // Incremental should be significantly faster
    // Note: This is a rough test, actual performance depends on many factors
    console.log(`Initial parse: ${time_initial}ms, Incremental: ${time_incremental}ms`);
    expect(time_incremental).toBeLessThan(time_initial * 0.5); // At least 2x faster
  });

  test('handles edits at file boundaries', () => {
    const initial_code = `const a = 1;`;

    project.add_or_update_file('test.js', initial_code);

    // Add at beginning
    project.update_file_range(
      'test.js',
      { row: 0, column: 0 },
      '',
      '// Comment\n'
    );

    // Add at end
    project.update_file_range(
      'test.js',
      { row: 1, column: 12 }, // end of file
      '',
      '\nconst b = 2;'
    );

    // Verify both variables are found
    const a_def = project.go_to_definition('test.js', { row: 1, column: 6 });
    const b_def = project.go_to_definition('test.js', { row: 2, column: 6 });
    
    expect(a_def?.name).toBe('a');
    expect(b_def?.name).toBe('b');
  });

  test('preserves cross-file references after incremental update', () => {
    const file1 = `
      export function helper() {
        return 42;
      }
    `;

    const file2 = `
      import { helper } from './file1';
      
      console.log(helper());
    `;

    project.add_or_update_file('file1.js', file1);
    project.add_or_update_file('file2.js', file2);

    // Update helper function
    project.update_file_range(
      'file1.js',
      { row: 2, column: 15 },
      '42',
      '100'
    );

    // Cross-file references should still work
    const helper_refs = project.find_references('file1.js', { row: 1, column: 21 });
    expect(helper_refs.length).toBeGreaterThan(1); // At least definition + import/call
  });
});
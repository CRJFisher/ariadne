import { create_incremental_updater } from "../../src/index";
import { describe, test, expect } from "vitest";

describe("Incremental Parsing", () => {
  test("simple single edit", () => {
    const updater = create_incremental_updater();
    
    const code = `const msg = "hello";`;
    updater.update_file("test.js", code);
    
    // Change "hello" to "world" - positions are 0-based
    const updated = updater.update_file_range(
      "test.js",
      { row: 0, column: 13 }, // start of "hello"
      { row: 0, column: 18 }, // end of "hello"
      "world"
    );
    expect(updated.source_code).toBe(`const msg = "world";`);
  });

  test("insert at position", () => {
    const updater = create_incremental_updater();
    
    const code = `function test() {}`;
    updater.update_file("test.js", code);
    
    // Insert text inside function (after the opening brace at position 17)
    const updated = updater.update_file_range(
      "test.js",
      { row: 0, column: 17 }, // after opening brace "{"
      { row: 0, column: 17 }, // same position (insert)
      " return 42; "
    );
    expect(updated.source_code).toBe(`function test() { return 42; }`);
  });

  test("delete text", () => {
    const updater = create_incremental_updater();
    
    const code = `const unnecessary = true;`;
    updater.update_file("test.js", code);
    
    // Delete everything by replacing with empty string
    const updated = updater.update_file_range(
      "test.js",
      { row: 0, column: 0 },
      { row: 0, column: 25 },
      ""
    );
    expect(updated.source_code).toBe("");
  });

  test("multiline edit", () => {
    const updater = create_incremental_updater();
    
    const code = `line1
line2
line3`;
    updater.update_file("test.js", code);
    
    // Replace line2 with something else
    const updated = updater.update_file_range(
      "test.js",
      { row: 1, column: 0 }, // start of line2
      { row: 1, column: 5 }, // end of line2
      "modified"
    );
    expect(updated.source_code).toBe(`line1
modified
line3`);
  });
});



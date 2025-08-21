import { Project } from "../../src/index";
import { describe, test, expect } from "vitest";

describe("Incremental Parsing", () => {
  test("simple single edit", () => {
    const project = new Project();
    
    const code = `const msg = "hello";`;
    project.add_or_update_file("test.js", code);
    
    // Change "hello" to "world" - positions are 0-based
    const updated = project.update_file_range(
      "test.js",
      { row: 0, column: 13 }, // start of "hello"
      { row: 0, column: 18 }, // end of "hello"
      "world"
    );
    
    const state = (updated as any).storage.getState();
    const fileCache = state.file_cache.get("test.js");
    expect(fileCache.source_code).toBe(`const msg = "world";`);
  });

  test("insert at position", () => {
    const project = new Project();
    
    const code = `function test() {}`;
    project.add_or_update_file("test.js", code);
    
    // Insert text inside function (after the opening brace at position 17)
    const updated = project.update_file_range(
      "test.js",
      { row: 0, column: 17 }, // after opening brace "{"
      { row: 0, column: 17 }, // same position (insert)
      " return 42; "
    );
    
    const state = (updated as any).storage.getState();
    const fileCache = state.file_cache.get("test.js");
    expect(fileCache.source_code).toBe(`function test() { return 42; }`);
  });

  test("delete text", () => {
    const project = new Project();
    
    const code = `const unnecessary = true;`;
    project.add_or_update_file("test.js", code);
    
    // Delete everything by replacing with empty string
    const updated = project.update_file_range(
      "test.js",
      { row: 0, column: 0 },
      { row: 0, column: 25 },
      ""
    );
    
    const state = (updated as any).storage.getState();
    const fileCache = state.file_cache.get("test.js");
    expect(fileCache.source_code).toBe("");
  });

  test("multiline edit", () => {
    const project = new Project();
    
    const code = `line1
line2
line3`;
    project.add_or_update_file("test.js", code);
    
    // Replace line2 with something else
    const updated = project.update_file_range(
      "test.js",
      { row: 1, column: 0 }, // start of line2
      { row: 1, column: 5 }, // end of line2
      "modified"
    );
    
    const state = (updated as any).storage.getState();
    const fileCache = state.file_cache.get("test.js");
    expect(fileCache.source_code).toBe(`line1
modified
line3`);
  });
});



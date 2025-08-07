import { describe, test, expect } from "vitest";
import { Project } from "../src/index";

describe("Large file handling", () => {
  test("handles files larger than 32KB gracefully", () => {
    const project = new Project();
    
    // Create a file larger than 32KB
    const largeContent = `
// Large test file
function func0() { return 0; }
${Array.from({ length: 1000 }, (_, i) => 
  `function func${i + 1}() { 
    // Some comment to make it larger
    const result = ${i + 1} * 2;
    console.log("Processing function ${i + 1}");
    return result;
  }`
).join('\n')}
`;
    
    console.log(`File size: ${(largeContent.length / 1024).toFixed(1)}KB`);
    
    // Should not throw - should handle gracefully
    expect(() => {
      project.add_or_update_file("large.ts", largeContent);
    }).not.toThrow();
    
    // File should be in cache even if not parsed
    const state = (project as any).storage.getState();
    const fileCache = state.file_cache.get("large.ts");
    expect(fileCache).toBeDefined();
    expect(fileCache.source_code).toBe(largeContent);
    
    // Functions won't be parsed for large files
    const funcs = project.get_functions_in_file("large.ts");
    expect(funcs).toEqual([]);
  });
  
  test("files under 32KB parse normally", () => {
    const project = new Project();
    
    // Create a file under 32KB
    const normalContent = `
function test1() { return 1; }
function test2() { return 2; }
function test3() { return 3; }
`;
    
    console.log(`File size: ${(normalContent.length / 1024).toFixed(1)}KB`);
    
    project.add_or_update_file("normal.ts", normalContent);
    
    // Should parse normally
    const funcs = project.get_functions_in_file("normal.ts");
    expect(funcs.length).toBe(3);
    expect(funcs.map(f => f.name).sort()).toEqual(["test1", "test2", "test3"]);
  });
  
  test("provides helpful warning for large files", () => {
    const project = new Project();
    const warnings: string[] = [];
    
    // Capture console.warn
    const originalWarn = console.warn;
    console.warn = (msg: string) => {
      warnings.push(msg);
      originalWarn(msg);
    };
    
    try {
      // Create a file that's definitely over 32KB
      const hugeContent = "x".repeat(40000);
      project.add_or_update_file("huge.js", hugeContent);
      
      // Should have warned about the file
      expect(warnings.some(w => 
        w.includes("huge.js") && 
        (w.includes("cannot be parsed") || w.includes("not parsed"))
      )).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });
});
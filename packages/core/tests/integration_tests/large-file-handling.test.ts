import { describe, test, expect } from "vitest";
import { Project } from "../../src/index";

describe("Large file handling", () => {
  test(
    "handles files larger than 32KB with bufferSize option",
    { timeout: 30000 },
    () => {
      const project = new Project();

      // Create a file larger than 32KB but not too large (to avoid timeout)
      const largeContent = `
// Large test file
function func0() { return 0; }
${Array.from(
  { length: 200 },
  (_, i) =>
    `function func${i + 1}() { 
    // Some comment to make it larger
    const padding = "${"x".repeat(100)}";
    const result = ${i + 1} * 2;
    console.log("Processing function ${i + 1}");
    return result;
  }`
).join("\n")}
`;

      console.log(
        `File size: ${(Buffer.byteLength(largeContent, "utf8") / 1024).toFixed(
          1
        )}KB`
      );

      // Should not throw - should handle gracefully
      expect(() => {
        project.add_or_update_file("large.ts", largeContent);
      }).not.toThrow();

      // File should be in cache even if not parsed
      const state = (project as any).storage.getState();
      const fileCache = state.file_cache.get("large.ts");
      expect(fileCache).toBeDefined();
      expect(fileCache.source_code).toBe(largeContent);

      // With bufferSize option, large files are now parsed successfully
      const funcs = project.get_functions_in_file("large.ts");
      expect(funcs.length).toBe(201); // func0 through func200
      expect(funcs[0].name).toBe("func0");
      expect(funcs[funcs.length - 1].name).toBe("func200");
    }
  );

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
    expect(funcs.map((f) => f.name).sort()).toEqual([
      "test1",
      "test2",
      "test3",
    ]);
  });

  test("calculates byte size correctly for Unicode", () => {
    const project = new Project();

    // Create content with Unicode that has different char vs byte length
    // Emojis are stored as 2 chars (surrogate pairs) but 4 bytes in UTF-8
    // Chinese chars are 1 char but 3 bytes in UTF-8
    const mixedContent = `
function test() {
  // Emoji: 2 chars in JS string, 4 bytes in UTF-8
  const emoji = "${"🚀".repeat(5000)}";
  // Chinese: 1 char in JS string, 3 bytes in UTF-8  
  const chinese = "${"中".repeat(5000)}";
  return emoji + chinese;
}`;

    // String length vs byte length will be different
    const stringLength = mixedContent.length;
    const byteLength = Buffer.byteLength(mixedContent, "utf8");
    console.log(
      `String length: ${stringLength} chars, Byte length: ${byteLength} bytes`
    );

    // Byte length should be significantly larger than string length
    expect(byteLength).toBeGreaterThan(35000); // Well over 32KB

    // Should handle Unicode content with proper byte calculation
    // This would fail with "Invalid argument" if using string.length for buffer size
    expect(() => {
      project.add_or_update_file("unicode.ts", mixedContent);
    }).not.toThrow();

    // Verify parsing succeeded
    const funcs = project.get_functions_in_file("unicode.ts");
    expect(funcs.length).toBe(1);
    expect(funcs[0].name).toBe("test");
  });

  test("dynamic buffer adjusts to file size", () => {
    const project = new Project();

    // Test that various file sizes work with dynamic buffer
    const testSizes = [
      { kb: 50, expectedFuncs: 50 },
      { kb: 100, expectedFuncs: 100 },
      { kb: 200, expectedFuncs: 200 },
    ];

    for (const { kb, expectedFuncs } of testSizes) {
      const content = Array.from(
        { length: expectedFuncs },
        (_, i) =>
          `function size${kb}_func${i}() { 
          return "x".repeat(${Math.floor((kb * 1024) / expectedFuncs / 2)});
        }`
      ).join("\n");

      const filePath = `size${kb}.ts`;
      console.log(
        `Testing ${filePath}: ${(content.length / 1024).toFixed(1)}KB`
      );

      // Should handle any size with dynamic buffer
      expect(() => {
        project.add_or_update_file(filePath, content);
      }).not.toThrow();

      // Verify file was parsed
      const funcs = project.get_functions_in_file(filePath);
      expect(funcs.length).toBe(expectedFuncs);
    }
  });
});

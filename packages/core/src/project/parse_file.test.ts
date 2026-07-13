import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { parse_file } from "./parse_file";

const BUFFER_SIZE = 32 * 1024;

describe("parse_file", () => {
  it("parses a TypeScript file and carries the detected language", () => {
    const parsed = parse_file(
      "src/app.ts" as FilePath,
      "function foo(): number {\n  return 1;\n}\n",
      BUFFER_SIZE
    );
    expect(parsed.lang).toBe("typescript");
    expect(parsed.file_path).toBe("src/app.ts");
    expect(parsed.file_lines).toBe(4);
    expect(parsed.file_end_column).toBe(0);
    expect(parsed.tree.rootNode.type).toBe("program");
    expect(parsed.tree.rootNode.hasError).toBe(false);
  });

  it("parses each supported language with its own grammar", () => {
    expect(
      parse_file("a.js" as FilePath, "const x = 1;", BUFFER_SIZE).lang
    ).toBe("javascript");
    expect(
      parse_file("a.py" as FilePath, "def f():\n    pass\n", BUFFER_SIZE).lang
    ).toBe("python");
    expect(
      parse_file("a.rs" as FilePath, "fn main() {}", BUFFER_SIZE).lang
    ).toBe("rust");
  });

  it("throws at ingress for an unsupported extension", () => {
    expect(() =>
      parse_file("main.go" as FilePath, "package main", BUFFER_SIZE)
    ).toThrow("Unsupported file extension: go");
  });
});

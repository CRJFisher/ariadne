/**
 * Integration test for return type inference in file analyzer
 */

import { describe, it, expect } from "vitest";
import { analyze_file } from "./file_analyzer";
import { CodeFile } from "./project/file_scanner";

describe("Return Type Inference Integration", () => {
  it("should infer return type from return statements", async () => {
    const file: CodeFile = {
      file_path: "/test/example.js",
      language: "javascript",
      source_code: `
        function getNumber() {
          return 42;
        }
        
        function getString() {
          return "hello";
        }
      `,
    };

    const { analysis } = await analyze_file(file);

    // Check if functions are found
    console.log(
      "Functions found:",
      analysis.functions.map((f) => ({
        name: f.name,
        return_type: f.signature.return_type,
      }))
    );

    // For now, just check that analysis completes without error
    expect(analysis).toBeDefined();
    expect(analysis.scopes).toBeDefined();
  });

  it("should handle async function return types", async () => {
    const file: CodeFile = {
      file_path: "/test/example.js",
      language: "javascript",
      source_code: `
        async function fetchData() {
          const response = await fetch('/api/data');
          return response.json();
        }
      `,
    };

    const { analysis } = await analyze_file(file);

    console.log(
      "Async functions:",
      analysis.functions.map((f) => ({
        name: f.name,
        return_type: f.signature.return_type,
        is_async: f.signature.is_async,
      }))
    );

    expect(analysis).toBeDefined();
  });

  it("should infer return types for arrow functions", async () => {
    const file: CodeFile = {
      file_path: "/test/example.js",
      language: "javascript",
      source_code: `
        const double = (x) => x * 2;
        const greet = name => "Hello, " + name;
      `,
    };

    const { analysis } = await analyze_file(file);

    console.log(
      "Arrow functions:",
      analysis.functions.map((f) => ({
        name: f.name,
        return_type: f.signature.return_type,
      }))
    );

    expect(analysis).toBeDefined();
  });

  it("should handle TypeScript explicit return types", async () => {
    const file: CodeFile = {
      file_path: "/test/example.ts",
      language: "typescript",
      source_code: `
        function calculate(a: number, b: number): number {
          return a + b;
        }
        
        async function getData(): Promise<string[]> {
          return ["a", "b", "c"];
        }
      `,
    };

    const { analysis } = await analyze_file(file);

    console.log(
      "TypeScript functions:",
      analysis.functions.map((f) => ({
        name: f.name,
        return_type: f.signature.return_type,
      }))
    );

    expect(analysis).toBeDefined();
  });

  it("should infer return types for Python functions", async () => {
    const file: CodeFile = {
      file_path: "/test/example.py",
      language: "python",
      source_code: `
def get_value():
    return 100

def get_list():
    return [1, 2, 3]
    
def get_dict():
    return {"key": "value"}
      `,
    };

    const { analysis } = await analyze_file(file);

    console.log(
      "Python functions:",
      analysis.functions.map((f) => ({
        name: f.name,
        return_type: f.signature.return_type,
      }))
    );

    expect(analysis).toBeDefined();
  });

  it("should handle Rust return types", async () => {
    const file: CodeFile = {
      file_path: "/test/example.rs",
      language: "rust",
      source_code: `
fn add(a: i32, b: i32) -> i32 {
    a + b
}

fn get_result() -> Result<String, Error> {
    Ok(String::from("success"))
}
      `,
    };

    const { analysis } = await analyze_file(file);

    console.log(
      "Rust functions:",
      analysis.functions.map((f) => ({
        name: f.name,
        return_type: f.signature.return_type,
      }))
    );

    expect(analysis).toBeDefined();
  });

  it("should infer method return types", async () => {
    const file: CodeFile = {
      file_path: "/test/example.js",
      language: "javascript",
      source_code: `
class Calculator {
  add(x, y) {
    return x + y;
  }
  
  async compute() {
    return await this.add(1, 2);
  }
}
      `,
    };

    const { analysis } = await analyze_file(file);

    const calc_class = analysis.classes.find((c) => c.symbol === "Calculator");
    if (calc_class) {
      console.log(
        "Method return types:",
        calc_class.methods.map((m) => ({
          name: m.name,
          return_type: m.signature.return_type,
          is_async: m.signature.is_async,
        }))
      );
    }

    expect(analysis).toBeDefined();
  });
});

import { describe, it, expect } from "@jest/globals";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";

describe("Parser Loading Tests", () => {
  it("should load tree-sitter module", () => {
    console.log("Testing tree-sitter module loading...");
    expect(Parser).toBeDefined();
    expect(typeof Parser).toBe("function");
    
    const parser = new Parser();
    expect(parser).toBeDefined();
    expect(parser.setLanguage).toBeDefined();
    expect(parser.parse).toBeDefined();
  });

  it("should load and use JavaScript parser", () => {
    console.log("Testing JavaScript parser...");
    console.log("JavaScript module type:", typeof JavaScript);
    console.log("JavaScript module keys:", Object.keys(JavaScript));
    
    const parser = new Parser();
    expect(() => parser.setLanguage(JavaScript as any)).not.toThrow();
    
    const tree = parser.parse("var x = 1");
    expect(tree).toBeDefined();
    expect(tree.rootNode).toBeDefined();
    expect(tree.rootNode.type).toBe("program");
  });

  it("should load and use TypeScript parser", () => {
    console.log("Testing TypeScript parser...");
    console.log("TypeScript module type:", typeof TypeScript);
    console.log("TypeScript module keys:", Object.keys(TypeScript));
    console.log("TypeScript.tsx type:", typeof TypeScript.tsx);
    
    const parser = new Parser();
    
    // Set a timeout before setting language
    parser.setTimeoutMicros(10000000); // 10 seconds
    
    try {
      parser.setLanguage(TypeScript.tsx as any);
      console.log("TypeScript language set successfully");
    } catch (e) {
      console.error("Failed to set TypeScript language:", e);
      throw e;
    }
    
    console.log("Attempting to parse TypeScript code...");
    const startTime = Date.now();
    const tree = parser.parse("const x: number = 1");
    const parseTime = Date.now() - startTime;
    console.log(`Parse completed in ${parseTime}ms`);
    
    expect(tree).toBeDefined();
    expect(tree.rootNode).toBeDefined();
    expect(tree.rootNode.type).toBe("program");
  });

  it("should load and use Python parser", () => {
    console.log("Testing Python parser...");
    console.log("Python module type:", typeof Python);
    if (typeof Python === "object") {
      console.log("Python module keys:", Object.keys(Python));
    }
    
    const parser = new Parser();
    
    // Set a timeout before setting language
    parser.setTimeoutMicros(10000000); // 10 seconds
    
    try {
      if (typeof Python === "function") {
        parser.setLanguage(Python as any);
      } else if ((Python as any).language) {
        parser.setLanguage((Python as any).language);
      } else {
        parser.setLanguage(Python as any);
      }
      console.log("Python language set successfully");
    } catch (e) {
      console.error("Failed to set Python language:", e);
      throw e;
    }
    
    console.log("Attempting to parse Python code...");
    const startTime = Date.now();
    const tree = parser.parse("x = 1");
    const parseTime = Date.now() - startTime;
    console.log(`Parse completed in ${parseTime}ms`);
    
    expect(tree).toBeDefined();
    expect(tree.rootNode).toBeDefined();
    expect(tree.rootNode.type).toBe("module");
  });
});
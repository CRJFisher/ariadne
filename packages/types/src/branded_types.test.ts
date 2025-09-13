/**
 * Tests for branded types to ensure type safety
 */

import {
  MODULE_CONTEXT,
  CallerContext,
  to_symbol_name,
  to_symbol_id,
  to_caller_name,
  is_symbol_name,
  is_symbol_id,
  is_module_context,
  build_symbol_id,
  parse_symbol_id,
  build_scope_path,
  parse_scope_path,
  build_qualified_name,
  parse_qualified_name,
} from "./branded_types";
import { FilePath, ClassName, MethodName, FunctionName } from "./aliases";
import { describe, expect, it } from "vitest";

describe("Branded Types", () => {
  describe("Type Creation", () => {
    it("should create branded types with validation", () => {
      const symbol_name = to_symbol_name("myFunction");
      expect(symbol_name).toBe("myFunction");
      
      const symbol_id = to_symbol_id("file.ts:10:5:myFunction");
      expect(symbol_id).toBe("file.ts:10:5:myFunction");
      
      const caller_name = to_caller_name("callingFunction");
      expect(caller_name).toBe("callingFunction");
    });
    
    it("should throw errors for invalid values", () => {
      expect(() => to_symbol_name("")).toThrow("Invalid SymbolName");
      expect(() => to_symbol_id("invalid")).toThrow("Invalid SymbolId format");
    });
  });
  
  describe("Type Guards", () => {
    it("should correctly identify symbol names", () => {
      expect(is_symbol_name("validName")).toBe(true);
      expect(is_symbol_name("")).toBe(false);
      expect(is_symbol_name(null)).toBe(false);
      expect(is_symbol_name(undefined)).toBe(false);
    });
    
    it("should correctly identify symbol IDs", () => {
      expect(is_symbol_id("file:1:2:name")).toBe(true);
      expect(is_symbol_id("invalid")).toBe(false);
    });
    
    it("should correctly identify module context", () => {
      expect(is_module_context(MODULE_CONTEXT)).toBe(true);
      expect(is_module_context("<module>")).toBe(true);
      expect(is_module_context("notModule")).toBe(false);
    });
  });
  
  describe("Compound Type Builders", () => {
    it("should build and parse SymbolId correctly", () => {
      const file_path = "/path/to/file.ts" as FilePath;
      const name = to_symbol_name("myFunction");
      
      const symbol_id = build_symbol_id(file_path, 10, 5, name);
      expect(symbol_id).toBe("/path/to/file.ts:10:5:myFunction");
      
      const parsed = parse_symbol_id(symbol_id);
      expect(parsed.filePath).toBe(file_path);
      expect(parsed.line).toBe(10);
      expect(parsed.column).toBe(5);
      expect(parsed.name).toBe(name);
    });
    
    it("should handle Windows paths with colons", () => {
      const file_path = "C:\\Users\\test\\file.ts" as FilePath;
      const name = to_symbol_name("myFunction");
        
      const symbol_id = build_symbol_id(file_path, 10, 5, name);
      const parsed = parse_symbol_id(symbol_id);
      expect(parsed.filePath).toBe(file_path);
    });
    
    it("should build and parse ScopePath correctly", () => {
      const scopes = ["global", "module", "class", "method"];
      const scope_path = build_scope_path(scopes);
      expect(scope_path).toBe("global.module.class.method");
      
      const parsed = parse_scope_path(scope_path);
      expect(parsed).toEqual(scopes);
    });
    
    it("should build and parse QualifiedName correctly", () => {
      const className = "MyClass" as ClassName;
      const methodName = "myMethod" as MethodName;
      
        const qualifiedName = build_qualified_name(className, methodName);
      expect(qualifiedName).toBe("MyClass.myMethod");
      
      const parsed = parse_qualified_name(qualifiedName);
      expect(parsed.className).toBe(className);
      expect(parsed.memberName).toBe(methodName);
    });
  });
  
  describe("Type Safety", () => {
    it("should prevent mixing different branded types", () => {
      const symbolName = to_symbol_name("test");
      const callerName = to_caller_name("test");
      
      // These should be different types at compile time
      // even though they have the same runtime value
      expect(symbolName).toBe("test");
      expect(callerName).toBe("test");
      
      // TypeScript should prevent this at compile time:
      // const wrong: SymbolName = callerName; // ❌ Type error
      // const alsoWrong: CallerName = symbolName; // ❌ Type error
    });
    
    it("should allow MODULE_CONTEXT as CallerContext", () => {
      const moduleContext: CallerContext = MODULE_CONTEXT;
      expect(moduleContext).toBe("<module>");
      
      const callerName = to_caller_name("function") as CallerContext;
      expect(callerName).toBe("function");
    });
  });
});
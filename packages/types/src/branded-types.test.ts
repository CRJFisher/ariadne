/**
 * Tests for branded types to ensure type safety
 */

import {
  SymbolName,
  SymbolId,
  CallerName,
  CalleeName,
  ReceiverName,
  MODULE_CONTEXT,
  CallerContext,
  toSymbolName,
  toSymbolId,
  toCallerName,
  isSymbolName,
  isSymbolId,
  isModuleContext,
  buildSymbolId,
  parseSymbolId,
  buildScopePath,
  parseScopePath,
  buildQualifiedName,
  parseQualifiedName,
} from "./branded-types";
import { FilePath, ClassName, MethodName, FunctionName } from "./aliases";

describe("Branded Types", () => {
  describe("Type Creation", () => {
    it("should create branded types with validation", () => {
      const symbolName = toSymbolName("myFunction");
      expect(symbolName).toBe("myFunction");
      
      const symbolId = toSymbolId("file.ts:10:5:myFunction");
      expect(symbolId).toBe("file.ts:10:5:myFunction");
      
      const callerName = toCallerName("callingFunction");
      expect(callerName).toBe("callingFunction");
    });
    
    it("should throw errors for invalid values", () => {
      expect(() => toSymbolName("")).toThrow("Invalid SymbolName");
      expect(() => toSymbolId("invalid")).toThrow("Invalid SymbolId format");
    });
  });
  
  describe("Type Guards", () => {
    it("should correctly identify symbol names", () => {
      expect(isSymbolName("validName")).toBe(true);
      expect(isSymbolName("")).toBe(false);
      expect(isSymbolName(null)).toBe(false);
      expect(isSymbolName(undefined)).toBe(false);
    });
    
    it("should correctly identify symbol IDs", () => {
      expect(isSymbolId("file:1:2:name")).toBe(true);
      expect(isSymbolId("invalid")).toBe(false);
    });
    
    it("should correctly identify module context", () => {
      expect(isModuleContext(MODULE_CONTEXT)).toBe(true);
      expect(isModuleContext("<module>")).toBe(true);
      expect(isModuleContext("notModule")).toBe(false);
    });
  });
  
  describe("Compound Type Builders", () => {
    it("should build and parse SymbolId correctly", () => {
      const filePath = "/path/to/file.ts" as FilePath;
      const name = toSymbolName("myFunction");
      
      const symbolId = buildSymbolId(filePath, 10, 5, name);
      expect(symbolId).toBe("/path/to/file.ts:10:5:myFunction");
      
      const parsed = parseSymbolId(symbolId);
      expect(parsed.filePath).toBe(filePath);
      expect(parsed.line).toBe(10);
      expect(parsed.column).toBe(5);
      expect(parsed.name).toBe(name);
    });
    
    it("should handle Windows paths with colons", () => {
      const filePath = "C:\\Users\\test\\file.ts" as FilePath;
      const name = toSymbolName("myFunction");
      
      const symbolId = buildSymbolId(filePath, 10, 5, name);
      const parsed = parseSymbolId(symbolId);
      expect(parsed.filePath).toBe(filePath);
    });
    
    it("should build and parse ScopePath correctly", () => {
      const scopes = ["global", "module", "class", "method"];
      const scopePath = buildScopePath(scopes);
      expect(scopePath).toBe("global.module.class.method");
      
      const parsed = parseScopePath(scopePath);
      expect(parsed).toEqual(scopes);
    });
    
    it("should build and parse QualifiedName correctly", () => {
      const className = "MyClass" as ClassName;
      const methodName = "myMethod" as MethodName;
      
      const qualifiedName = buildQualifiedName(className, methodName);
      expect(qualifiedName).toBe("MyClass.myMethod");
      
      const parsed = parseQualifiedName(qualifiedName);
      expect(parsed.className).toBe(className);
      expect(parsed.memberName).toBe(methodName);
    });
  });
  
  describe("Type Safety", () => {
    it("should prevent mixing different branded types", () => {
      const symbolName = toSymbolName("test");
      const callerName = toCallerName("test");
      
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
      
      const callerName = toCallerName("function") as CallerContext;
      expect(callerName).toBe("function");
    });
  });
});
/**
 * Tests for compound type builders and parsers
 */

import {
  buildModulePath,
  parseModulePath,
  buildTypeExpression,
  parseTypeExpression,
  buildResolutionPath,
  parseResolutionPath,
  buildCompoundIdentifier,
  parseCompoundIdentifier,
  buildSymbolId,
  parseSymbolId,
  buildScopePath,
  parseScopePath,
  buildQualifiedName,
  parseQualifiedName,
  toSymbolName,
  toTypeExpression,
} from "./branded-types";
import { FilePath } from "./aliases";

// Note: These tests would normally use a test framework like Jest or Vitest
// For now, we'll use simple assertions

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function testModulePathBuilders() {
  // Test relative path
  const relativePath = buildModulePath("utils/helpers", true);
  assert(relativePath === "./utils/helpers", "Should add relative prefix");
  
  // Test absolute path
  const absolutePath = buildModulePath("lodash", false);
  assert(absolutePath === "lodash", "Should keep absolute path as-is");
  
  // Test extension removal
  const withExt = buildModulePath("./utils/helpers.ts", true);
  assert(withExt === "./utils/helpers", "Should remove .ts extension");
  
  // Test parsing
  const parsed = parseModulePath(buildModulePath("@types/node/fs", false));
  assert(parsed.isScoped === true, "Should detect scoped package");
  assert(parsed.packageName === "@types/node", "Should extract scoped package name");
  assert(parsed.subpath === "fs", "Should extract subpath");
}

function testTypeExpressionBuilders() {
  // Test simple type
  const simple = buildTypeExpression("string");
  assert(simple === "string", "Should handle simple types");
  
  // Test generic type
  const generic = buildTypeExpression("Array", ["string"]);
  assert(generic === "Array<string>", "Should handle generic types");
  
  // Test with modifiers
  const withModifiers = buildTypeExpression("string", undefined, ["array", "nullable"]);
  assert(withModifiers === "string[] | null", "Should apply modifiers");
  
  // Test Promise wrapper
  const promise = buildTypeExpression("User", undefined, ["promise"]);
  assert(promise === "Promise<User>", "Should wrap in Promise");
  
  // Test parsing
  const parsed = parseTypeExpression(toTypeExpression("Promise<string[]>"));
  assert(parsed.isPromise === true, "Should detect Promise");
  assert(parsed.base === "Promise", "Should extract base type");
  assert(parsed.generics?.[0] === "string[]", "Should extract generic parameter");
}

function testResolutionPathBuilders() {
  const paths: FilePath[] = [
    "/src/index.ts" as FilePath,
    "/src/utils.ts" as FilePath,
    "/src/helpers.ts" as FilePath
  ];
  
  const resolutionPath = buildResolutionPath(paths);
  assert(
    resolutionPath === "/src/index.ts -> /src/utils.ts -> /src/helpers.ts",
    "Should join paths with arrow"
  );
  
  const parsed = parseResolutionPath(resolutionPath);
  assert(parsed.length === 3, "Should parse back to 3 paths");
  assert(parsed[0] === "/src/index.ts", "Should preserve first path");
}

function testCompoundIdentifierBuilders() {
  const id = buildCompoundIdentifier("module", "class", "method");
  assert(id === "module:class:method", "Should join with colons");
  
  const parsed = parseCompoundIdentifier(id);
  assert(parsed.length === 3, "Should parse to 3 parts");
  assert(parsed[1] === "class", "Should preserve middle part");
  
  // Test with empty parts
  const withEmpty = buildCompoundIdentifier("module", "", "method");
  assert(withEmpty === "module:method", "Should filter empty parts");
}

function testSymbolIdRoundTrip() {
  const filePath = "/src/test.ts" as FilePath;
  const name = toSymbolName("myFunction");
  
  const symbolId = buildSymbolId(filePath, 10, 5, name);
  assert(
    symbolId === "/src/test.ts:10:5:myFunction",
    "Should build correct symbol ID"
  );
  
  const parsed = parseSymbolId(symbolId);
  assert(parsed.filePath === filePath, "Should preserve file path");
  assert(parsed.line === 10, "Should preserve line");
  assert(parsed.column === 5, "Should preserve column");
  assert(parsed.name === name, "Should preserve name");
}

function testScopePathRoundTrip() {
  const scopes = ["global", "module", "class", "method"];
  const scopePath = buildScopePath(scopes);
  assert(
    scopePath === "global.module.class.method",
    "Should join with dots"
  );
  
  const parsed = parseScopePath(scopePath);
  assert(parsed.length === 4, "Should parse to 4 scopes");
  assert(parsed[2] === "class", "Should preserve class scope");
}

function testQualifiedNameRoundTrip() {
  const className = "MyClass" as any;  // Would be ClassName in real code
  const methodName = "myMethod" as any;  // Would be MethodName in real code
  
  const qualified = buildQualifiedName(className, methodName);
  assert(qualified === "MyClass.myMethod", "Should build qualified name");
  
  const parsed = parseQualifiedName(qualified);
  assert(parsed.className === className, "Should preserve class name");
  assert(parsed.memberName === "myMethod", "Should preserve member name");
}

// Run all tests
export function runCompoundBuilderTests() {
  try {
    testModulePathBuilders();
    console.log("✓ ModulePath builders work correctly");
    
    testTypeExpressionBuilders();
    console.log("✓ TypeExpression builders work correctly");
    
    testResolutionPathBuilders();
    console.log("✓ ResolutionPath builders work correctly");
    
    testCompoundIdentifierBuilders();
    console.log("✓ Compound identifier builders work correctly");
    
    testSymbolIdRoundTrip();
    console.log("✓ SymbolId round-trip works correctly");
    
    testScopePathRoundTrip();
    console.log("✓ ScopePath round-trip works correctly");
    
    testQualifiedNameRoundTrip();
    console.log("✓ QualifiedName round-trip works correctly");
    
    console.log("\n✅ All compound builder tests passed!");
    return true;
  } catch (error) {
    console.error("❌ Test failed:", error);
    return false;
  }
}

// Export for use in test runners
export default {
  testModulePathBuilders,
  testTypeExpressionBuilders,
  testResolutionPathBuilders,
  testCompoundIdentifierBuilders,
  testSymbolIdRoundTrip,
  testScopePathRoundTrip,
  testQualifiedNameRoundTrip,
};
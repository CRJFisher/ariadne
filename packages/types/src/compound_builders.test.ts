/**
 * Tests for compound type builders and parsers
 */

import {
  build_module_path,
  parse_module_path,
  build_type_expression,
  parse_type_expression,
  build_resolution_path,
  parse_resolution_path,
  build_compound_identifier,
  parse_compound_identifier,
  build_symbol_id,
  parse_symbol_id,
  build_scope_path,
  parse_scope_path,
  build_qualified_name,
  parse_qualified_name,
  to_symbol_name,
  to_type_expression,
} from "./branded_types";
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
  const relativePath = build_module_path("utils/helpers", true);
  assert(relativePath === "./utils/helpers", "Should add relative prefix");
  
  // Test absolute path
  const absolutePath = build_module_path("lodash", false);
  assert(absolutePath === "lodash", "Should keep absolute path as-is");
  
  // Test extension removal
  const withExt = build_module_path("./utils/helpers.ts", true);
  assert(withExt === "./utils/helpers", "Should remove .ts extension");
  
  // Test parsing
  const parsed = parse_module_path(build_module_path("@types/node/fs", false));
  assert(parsed.isScoped === true, "Should detect scoped package");
  assert(parsed.packageName === "@types/node", "Should extract scoped package name");
  assert(parsed.subpath === "fs", "Should extract subpath");
}

function testTypeExpressionBuilders() {
  // Test simple type
  const simple = build_type_expression("string");
  assert(simple === "string", "Should handle simple types");
  
  // Test generic type
  const generic = build_type_expression("Array", ["string"]);
  assert(generic === "Array<string>", "Should handle generic types");
  
  // Test with modifiers
  const withModifiers = build_type_expression("string", undefined, ["array", "nullable"]);
  assert(withModifiers === "string[] | null", "Should apply modifiers");
  
  // Test Promise wrapper
  const promise = build_type_expression("User", undefined, ["promise"]);
  assert(promise === "Promise<User>", "Should wrap in Promise");
  
  // Test parsing
  const parsed = parse_type_expression(to_type_expression("Promise<string[]>"));
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
  
  const resolutionPath = build_resolution_path(paths);
  assert(
    resolutionPath === "/src/index.ts -> /src/utils.ts -> /src/helpers.ts",
    "Should join paths with arrow"
  );
  
  const parsed = parse_resolution_path(resolutionPath);
  assert(parsed.length === 3, "Should parse back to 3 paths");
  assert(parsed[0] === "/src/index.ts", "Should preserve first path");
}

function testCompoundIdentifierBuilders() {
  const id = build_compound_identifier("module", "class", "method");
  assert(id === "module:class:method", "Should join with colons");
  
  const parsed = parse_compound_identifier(id);
  assert(parsed.length === 3, "Should parse to 3 parts");
  assert(parsed[1] === "class", "Should preserve middle part");
  
  // Test with empty parts
  const withEmpty = build_compound_identifier("module", "", "method");
  assert(withEmpty === "module:method", "Should filter empty parts");
}

function testSymbolIdRoundTrip() {
  const filePath = "/src/test.ts" as FilePath;
  const name = to_symbol_name("myFunction");
  
  const symbolId = build_symbol_id(filePath, 10, 5, name);
  assert(
    symbolId === "/src/test.ts:10:5:myFunction",
    "Should build correct symbol ID"
  );
  
  const parsed = parse_symbol_id(symbolId);
  assert(parsed.filePath === filePath, "Should preserve file path");
  assert(parsed.line === 10, "Should preserve line");
  assert(parsed.column === 5, "Should preserve column");
  assert(parsed.name === name, "Should preserve name");
}

function testScopePathRoundTrip() {
  const scopes = ["global", "module", "class", "method"];
  const scopePath = build_scope_path(scopes);
  assert(
    scopePath === "global.module.class.method",
    "Should join with dots"
  );
  
  const parsed = parse_scope_path(scopePath);
  assert(parsed.length === 4, "Should parse to 4 scopes");
  assert(parsed[2] === "class", "Should preserve class scope");
}

function testQualifiedNameRoundTrip() {
  const className = "MyClass" as any;  // Would be ClassName in real code
  const methodName = "myMethod" as any;  // Would be MethodName in real code
  
  const qualified = build_qualified_name(className, methodName);
  assert(qualified === "MyClass.myMethod", "Should build qualified name");
  
  const parsed = parse_qualified_name(qualified);
  assert(parsed.className === className, "Should preserve class name");
  assert(parsed.memberName === "myMethod", "Should preserve member name");
}

// Run all tests
export function run_compound_builder_tests() {
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
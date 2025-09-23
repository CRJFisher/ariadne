# Symbol Resolution Test Factories

This directory contains comprehensive mock data factories for symbol resolution tests. These factories solve common testing issues and provide a consistent way to create test data that matches the actual semantic index structure.

## The Problem

Previously, symbol resolution tests had several issues:

1. **ReadonlyMap Mutation Errors**: Tests tried to mutate ReadonlyMap objects, causing TypeScript compilation errors
2. **Inconsistent Mock Data**: Each test file created its own mock SemanticIndex data that didn't match the actual structure
3. **Duplicated Mock Creation**: Similar mock creation code was repeated across multiple test files
4. **Type Mismatches**: Mock data interfaces didn't align with actual implementation interfaces

## The Solution

The `test_factories.ts` module provides:

1. **Comprehensive Mock Factories**: Functions to create properly structured mock data for all symbol resolution types
2. **ReadonlyMap Utilities**: Helper functions to work with ReadonlyMap/ReadonlySet without mutation errors
3. **Pre-built Scenarios**: Common test scenarios ready to use
4. **Type Safety**: All factories create data that matches actual implementation interfaces

## Usage Examples

### Basic Mock Creation

```typescript
import {
  mock_semantic_index,
  mock_symbol_definition,
  mock_call_reference,
  mock_location,
} from "./test_factories";

// Create a test location
const location = mock_location("test.ts" as FilePath, 1, 0);

// Create a function symbol
const func_symbol = mock_symbol_definition(
  "testFunction" as SymbolName,
  "function",
  location
);

// Create a call reference
const call_ref = mock_call_reference(
  "testFunction" as SymbolName,
  location,
  "scope:global" as ScopeId
);

// Create a semantic index with the mock data
const index = mock_semantic_index("test.ts" as FilePath, {
  symbols: new Map([[func_symbol.id, func_symbol]]),
  calls: [call_ref],
});
```

### Using Pre-built Scenarios

```typescript
import { create_function_scenario } from "./test_factories";

// Get a complete function definition + call scenario
const scenario = create_function_scenario("test.ts" as FilePath);

// Use the pre-built data
expect(scenario.index.symbols.size).toBe(1);
expect(scenario.index.references.calls).toHaveLength(1);
expect(scenario.function_symbol.kind).toBe("function");
```

### ReadonlyMap Utilities

```typescript
import { readonly_map_from_entries, readonly_set_from_items } from "./test_factories";

// Create ReadonlyMap from entries (no mutation errors)
const symbol_map = readonly_map_from_entries([
  ["func1" as SymbolName, "symbol:func1" as SymbolId],
  ["func2" as SymbolName, "symbol:func2" as SymbolId],
]);

// Create ReadonlySet from items
const type_set = readonly_set_from_items([
  "TypeId:String" as TypeId,
  "TypeId:Number" as TypeId,
]);
```

### Class and Method Scenarios

```typescript
import { create_class_method_scenario } from "./test_factories";

const scenario = create_class_method_scenario("test.ts" as FilePath);

// Get class, method, and member access data
expect(scenario.class_symbol.kind).toBe("class");
expect(scenario.method_symbol.kind).toBe("method");
expect(scenario.member_access.access_type).toBe("property");
```

### Import/Export Scenarios

```typescript
import { create_import_export_scenario } from "./test_factories";

const scenario = create_import_export_scenario();

// Get exporter file, importer file, and import/export refs
expect(scenario.exporter_index.exports).toHaveLength(1);
expect(scenario.importer_index.imports).toHaveLength(1);
expect(scenario.exported_symbol.is_exported).toBe(true);
```

## Available Factories

### Core Factories

- `mock_location()` - Create Location objects
- `mock_symbol_definition()` - Create SymbolDefinition objects
- `mock_lexical_scope()` - Create LexicalScope objects

### Reference Factories

- `mock_call_reference()` - Create CallReference objects
- `mock_member_access_reference()` - Create MemberAccessReference objects
- `mock_return_reference()` - Create ReturnReference objects
- `mock_type_annotation_reference()` - Create TypeAnnotationReference objects

### Import/Export Factories

- `mock_import()` - Create Import objects (named, default, namespace, side-effect)
- `mock_export()` - Create Export objects (named, default, namespace, re-export)

### Type System Factories

- `mock_local_type_info()` - Create LocalTypeInfo objects
- `mock_local_type_annotation()` - Create LocalTypeAnnotation objects
- `mock_local_type_tracking()` - Create LocalTypeTracking objects
- `mock_local_type_flow()` - Create LocalTypeFlowData objects

### High-Level Factories

- `mock_semantic_index()` - Create complete SemanticIndex objects
- `mock_project_semantic_index()` - Create ProjectSemanticIndex objects
- `mock_resolution_input()` - Create ResolutionInput objects

### Resolution Map Factories

- `mock_import_resolution_map()` - Create ImportResolutionMap objects
- `mock_function_resolution_map()` - Create FunctionResolutionMap objects
- `mock_type_resolution_map()` - Create TypeResolutionMap objects
- `mock_method_resolution_map()` - Create MethodResolutionMap objects

### Utility Functions

- `readonly_map_from_entries()` - Create ReadonlyMap from entries
- `readonly_set_from_items()` - Create ReadonlySet from items
- `to_readonly_map()` - Convert Map to ReadonlyMap
- `to_readonly_set()` - Convert Set to ReadonlySet

### Pre-built Scenarios

- `create_function_scenario()` - Function definition + call scenario
- `create_class_method_scenario()` - Class + method + member access scenario
- `create_import_export_scenario()` - Import/export between two files scenario

## Benefits

### Before (Manual Mock Creation)

```typescript
// Verbose, error-prone manual creation
function create_mock_index(file_path: FilePath, calls: CallReference[]): SemanticIndex {
  const testFuncDef = {
    id: "sym:testFunc" as SymbolId,
    name: "testFunc" as SymbolName,
    kind: "function" as const,
    location: { file_path, line: 1, column: 10, end_line: 1, end_column: 18 },
    scope_id: "scope:module" as ScopeId,
    is_hoisted: true,
    is_exported: false,
    is_imported: false,
  };

  const root_scope: LexicalScope = {
    id: "scope:module" as ScopeId,
    parent_id: null,
    name: null,
    type: "module",
    location: { file_path, line: 1, column: 1, end_line: 100, end_column: 1 },
    child_ids: [],
    symbols: new Map([["testFunc" as SymbolName, testFuncDef]]),
  };

  return {
    file_path,
    language: "javascript",
    root_scope_id: "scope:module" as ScopeId,
    scopes: new Map([["scope:module" as ScopeId, root_scope]]),
    symbols: new Map([["sym:testFunc" as SymbolId, testFuncDef]]),
    references: { calls, member_accesses: [], returns: [], type_annotations: [] },
    imports: [],
    exports: [],
    file_symbols_by_name: new Map(),
    local_types: [],
    local_type_annotations: [],
    local_type_tracking: { annotations: [], declarations: [], assignments: [] },
    local_type_flow: { constructor_calls: [], assignments: [], returns: [], call_assignments: [] },
  };
}

// ReadonlyMap mutation errors:
const registry: GlobalTypeRegistry = { /* ... */ };
registry.types.set(type_id, type_info); // ERROR: 'set' does not exist on ReadonlyMap
```

### After (Using Factories)

```typescript
// Clean, declarative, type-safe
const scenario = create_function_scenario("test.js" as FilePath);
const index = { ...scenario.index, language: "javascript" as const };

// No ReadonlyMap errors:
const symbol_map = readonly_map_from_entries([
  ["func1" as SymbolName, "symbol:func1" as SymbolId]
]);
```

## Migration Guide

### Step 1: Replace Manual Mock Creation

Replace custom `create_mock_index` functions with `mock_semantic_index()`:

```typescript
// Old
function create_mock_index(file_path: FilePath): SemanticIndex {
  // 50+ lines of manual object creation
}

// New
const index = mock_semantic_index(file_path, {
  // Only specify what you need
  symbols: my_symbols,
  calls: my_calls,
});
```

### Step 2: Fix ReadonlyMap Mutations

Replace direct Map mutations with factory utilities:

```typescript
// Old (compilation error)
const registry: FileTypeRegistry = create_empty_registry(file_path);
registry.symbol_to_type.set(symbol_id, type_id); // ERROR

// New (works correctly)
const symbol_to_type = new Map([[symbol_id, type_id]]);
const registry: FileTypeRegistry = {
  ...create_empty_registry(file_path),
  symbol_to_type: to_readonly_map(symbol_to_type),
};
```

### Step 3: Use Pre-built Scenarios

Replace repetitive test setup with scenarios:

```typescript
// Old (repetitive across tests)
const func_symbol = /* manual creation */;
const call_ref = /* manual creation */;
const index = /* manual creation */;

// New (consistent, reusable)
const scenario = create_function_scenario(file_path);
```

## Best Practices

1. **Use Scenarios First**: Check if a pre-built scenario matches your needs before creating custom mock data
2. **Minimal Customization**: Only specify the properties you need to test, let factories handle defaults
3. **Type Safety**: Use type assertions (`as Type`) sparingly - factories should provide correct types
4. **ReadonlyMap Handling**: Always use factory utilities for ReadonlyMap/ReadonlySet creation
5. **Consistent Naming**: Use descriptive names that match the domain (e.g., `function_symbol`, not `func_def`)

## Troubleshooting

### Compilation Errors

If you get TypeScript errors when using factories:

1. **Interface Mismatch**: Check that you're using the correct factory for the interface
2. **Missing Properties**: Use the `options` parameter to provide required properties
3. **ReadonlyMap Issues**: Use `readonly_map_from_entries()` instead of direct Map creation

### Test Failures

If tests fail with factory-created data:

1. **Check Relationships**: Ensure symbol IDs match between symbols and references
2. **Verify Structure**: Use `expect(object).toMatchObject()` to debug data structure
3. **Language Consistency**: Make sure language settings match across related objects

## Contributing

When adding new factories:

1. **Match Real Interfaces**: Ensure factories create data that matches actual implementation interfaces
2. **Provide Defaults**: Give sensible defaults for all optional properties
3. **Add Tests**: Include tests in `test_factories.test.ts`
4. **Update Documentation**: Add usage examples to this README
5. **Type Assertions**: Use type assertions sparingly and only when necessary for complex union types
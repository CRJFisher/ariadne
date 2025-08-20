# Namespace Imports Migration Guide

## Current State Analysis

The `import_resolution/namespace_imports` module exists but doesn't follow the Architecture pattern.

### Current Structure (WRONG)
```
namespace_imports/
├── index.ts                                    # Class-based API with registry
├── namespace_imports.ts                        # Base classes and interfaces
├── namespace_imports.javascript.ts             # Missing (implementation embedded in tests)
├── namespace_imports.javascript.test.ts        # Tests with embedded implementation
├── namespace_imports.javascript.factory.test.ts # Factory pattern (unnecessary complexity)
├── namespace_imports_test_factory.ts           # Test factory (wrong pattern)
└── README.md
```

### Problems
1. **Class-based API** - Uses `NamespaceImportAPI` class with static methods
2. **Registry pattern** - Uses `NamespaceResolverRegistry` instead of dispatcher
3. **Base classes** - Uses inheritance (`BaseNamespaceResolver`)
4. **Language detection** - Detects language from file extension internally
5. **Test factory pattern** - Overly complex test structure
6. **Missing language implementations** - No Python or Rust support

## Target Structure (Per Architecture)

```
namespace_imports/
├── index.ts                               # Dispatcher/marshaler
├── common.ts                              # Shared processing logic
├── namespace_imports.javascript.ts       # JS-specific implementation
├── namespace_imports.typescript.ts       # TS-specific implementation  
├── namespace_imports.python.ts           # Python-specific implementation
├── namespace_imports.rust.ts             # Rust-specific implementation
├── test.contract.ts                      # Test interface (mandatory cases)
├── namespace_imports.test.ts             # Common test utilities
├── namespace_imports.javascript.test.ts  # JS test implementation
├── namespace_imports.python.test.ts      # Python test implementation
└── namespace_imports.rust.test.ts        # Rust test implementation
```

## Migration Steps

### Step 1: Create New Dispatcher (index.ts)

Replace the class-based API with functional dispatcher:

```typescript
// index.ts - Feature dispatcher
import { resolve_javascript_namespace } from './namespace_imports.javascript';
import { resolve_python_namespace } from './namespace_imports.python';
import { resolve_common_namespace } from './common';

const namespace_resolvers = {
  javascript: resolve_javascript_namespace,
  typescript: resolve_javascript_namespace, // Shares with JS
  python: resolve_python_namespace,
  rust: resolve_rust_namespace
};

export function resolve_namespace_import(
  import_node: ASTNode,
  metadata: { language: Language, file_path: string }
): NamespaceImport | null {
  // Common pre-processing
  const common_result = resolve_common_namespace(import_node, metadata);
  
  // Dispatch to language-specific processor
  const resolver = namespace_resolvers[metadata.language];
  if (!resolver) {
    return common_result; // Fallback to common-only processing
  }
  
  // Language-specific enhancement
  return resolver(import_node, metadata, common_result);
}
```

### Step 2: Extract Common Logic (common.ts)

Move genuinely common logic out of base classes:

```typescript
// common.ts
export function resolve_common_namespace(
  import_node: ASTNode,
  metadata: { language: Language, file_path: string }
): NamespaceImport | null {
  // Logic that works for all languages
  if (import_node.type !== 'import_statement') {
    return null;
  }
  
  // Check for namespace pattern (import * as name)
  const is_namespace = import_node.source_name === '*';
  if (!is_namespace) {
    return null;
  }
  
  return {
    type: 'namespace',
    local_name: import_node.local_name,
    source_module: import_node.source_module
  };
}
```

### Step 3: Create Language Implementations

Each language gets its own file:

```typescript
// namespace_imports.javascript.ts
export function resolve_javascript_namespace(
  import_node: ASTNode,
  metadata: { language: Language, file_path: string },
  common_result: NamespaceImport | null
): NamespaceImport | null {
  if (!common_result) {
    // Check for CommonJS patterns
    if (is_commonjs_namespace(import_node)) {
      return resolve_commonjs_namespace(import_node, metadata);
    }
    return null;
  }
  
  // Enhance common result with JS-specific details
  return {
    ...common_result,
    supports_default_access: true,
    allows_reexport: true
  };
}
```

### Step 4: Create Test Contract

Define what all languages must test:

```typescript
// test.contract.ts
export interface NamespaceImportTestContract {
  test_basic_namespace_import(): void;
  test_nested_namespace_access(): void;
  test_namespace_reexport(): void;
  test_circular_namespace(): void;
  test_namespace_with_renamed_exports(): void;
}
```

### Step 5: Update Imports Throughout Codebase

Find all uses of the old API and update:

```typescript
// OLD (wrong)
import { NamespaceImportAPI } from './namespace_imports';
const result = NamespaceImportAPI.resolveNamespaceMember(...);

// NEW (correct)
import { resolve_namespace_import } from './namespace_imports';
const result = resolve_namespace_import(node, { 
  language: 'javascript', 
  file_path: 'app.js' 
});
```

## Key Changes

### From Classes to Functions
- ❌ `class NamespaceImportAPI` 
- ✅ `export function resolve_namespace_import()`

### From Registry to Dispatcher
- ❌ `NamespaceResolverRegistry.get(language)`
- ✅ `const resolver = namespace_resolvers[metadata.language]`

### From Inheritance to Composition
- ❌ `class JavaScriptResolver extends BaseResolver`
- ✅ `function resolve_javascript_namespace(..., common_result)`

### From Detection to Metadata
- ❌ `detectLanguage(filePath)` inside feature
- ✅ Language passed in metadata parameter

### From Complex to Simple Tests
- ❌ Test factories and abstract base classes
- ✅ Simple test contract with concrete implementations

## Benefits After Migration

1. **Simpler** - No classes, registries, or factories
2. **Explicit** - Clear data flow through dispatcher
3. **Testable** - Pure functions are easy to test
4. **Scalable** - Adding a language is just adding a file
5. **Maintainable** - Each piece has one clear responsibility

## Validation

After migration, ensure:
- [ ] No classes remain
- [ ] No registry pattern
- [ ] Language is never detected, always passed
- [ ] All functions use snake_case
- [ ] Each language has its own implementation file
- [ ] Test contract is implemented by all languages
- [ ] Common logic is truly common (not forced abstraction)
# Namespace Imports

Sub-feature of Import Resolution that handles importing entire modules as namespaces.

## Overview
Namespace imports allow importing all exports from a module under a single namespace identifier, then accessing members through that namespace.

## Architecture (2025-08-08)

This module follows the new feature-based information architecture pattern:

```
namespace_imports/
├── namespace_imports.ts           # Universal interface/contract
├── namespace_imports.javascript.ts # JS/TS implementation  
├── index.ts                       # Main API exports
├── namespace_imports_test_factory.ts # Test contract factory
├── namespace_imports.test.ts      # Universal tests
└── namespace_imports.javascript.test.ts # JS-specific tests
```

## Language Support

| Language | Syntax | Support Level |
|----------|--------|--------------|
| JavaScript/TypeScript | `import * as name from 'module'` | ✅ Full |
| Python | `import module` or `import module as name` | ⚠️ Planned |
| Rust | `use module::*` or `use module` | ⚠️ Planned |

## Patterns Supported

### Basic Namespace Import
```javascript
import * as math from './math';
math.add(1, 2);
```

### Nested Namespace Access
```javascript
import * as utils from './utils';
utils.string.capitalize('hello');
```

### Re-exported Namespaces
```javascript
// math/index.js
import * as operations from './operations';
export { operations };

// app.js
import * as math from './math';
math.operations.multiply(2, 3);
```

## Implementation

### Core Components

1. **`NamespaceImportResolver`** - Universal interface that all languages must implement
2. **`BaseNamespaceResolver`** - Base implementation with common logic
3. **`JavaScriptNamespaceResolver`** - JS/TS specific implementation
4. **`NamespaceImportAPI`** - Main API for the rest of the codebase

### How It Works

1. Parser detects `import * as X` and marks with `source_name = '*'`
2. When resolving `namespace.member`:
   - `NamespaceImportAPI` detects the language from file extension
   - Gets the appropriate language resolver from the registry
   - Resolver finds the namespace import in current file
   - Resolves all exports from the target module
   - Returns the specific member definition
3. For nested access (`namespace.sub.member`):
   - Extracts the full namespace path
   - Follows re-export chains recursively
   - Resolves through each level until finding the member

### Integration Points

The namespace import resolution integrates with:
- `reference_resolution.ts` - Delegates namespace member resolution to this module
- `import_export_detector.ts` - Detects namespace imports and re-exports
- `scope_resolution.ts` - Provides the import statements with `source_name = '*'`

### Adding Language Support

To add namespace import support for a new language:

1. Create `namespace_imports.{language}.ts` implementing `NamespaceImportResolver`
2. Register the resolver in the `NamespaceResolverRegistry`
3. Create language-specific tests using the test factory
4. Update this README with the language's syntax and support level
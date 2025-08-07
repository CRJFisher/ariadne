# Namespace Imports

Sub-feature of Import Resolution that handles importing entire modules as namespaces.

## Overview
Namespace imports allow importing all exports from a module under a single namespace identifier, then accessing members through that namespace.

## Language Support

| Language | Syntax | Support Level |
|----------|--------|--------------|
| JavaScript/TypeScript | `import * as name from 'module'` | ✅ Full |
| Python | `import module` or `import module as name` | ⚠️ Different model |
| Rust | `use module::*` or `use module` | ⚠️ Different model |

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

## Implementation (2025-08-06)

### Core Changes
- `scope_resolution.ts`: Detect namespace imports via `source_name = '*'`
- `import_resolver.ts`: Create synthetic module definitions for namespaces
- `reference_resolution.ts`: Resolve namespace.member and namespace.sub.member patterns
- Language scope queries: Capture nested member expressions in calls

### How It Works
1. Parser detects `import * as X` and marks with `source_name = '*'`
2. Import resolver creates a synthetic module definition
3. When resolving `namespace.member`, we:
   - Find the namespace import
   - Get all exports from target module
   - Resolve the specific member
   - Handle re-export chains recursively
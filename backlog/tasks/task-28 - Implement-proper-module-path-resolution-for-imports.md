---
id: task-28
title: Implement proper module path resolution for imports
status: In Progress
assignee: ['@claude']
created_date: "2025-07-18"
updated_date: "2025-08-02"
labels:
  - enhancement
  - import-resolution
dependencies:
  - task-31
---

## Description

The current import resolution uses brute-force search across all files to find exported definitions. This task implements proper module path resolution to handle relative imports (./utils, ../lib/helper), index files, and file extensions correctly. It also adds support for language-specific import patterns that aren't currently handled.

## Acceptance Criteria

### Path Resolution

- [x] Resolve relative import paths to actual file paths
- [x] Handle common file extensions (.ts, .js, .tsx, .jsx, .py)
- [x] Support index file conventions (index.ts, index.js, **init**.py)
- [ ] Handle TypeScript path mappings from tsconfig.json

### Python-Specific Import Patterns

- [x] Support star imports (`from module import *`) - Capture pattern added, module path extracted
- [x] Support module imports (`import module` then `module.func()`) - Already working, verified with tests
- [x] Support relative imports with dots (`from ..utils import helper`) - Already handled by ModuleResolver

### TypeScript/JavaScript-Specific Import Patterns

- [x] Support CommonJS require syntax (`const mod = require('./module')`) - Already captured in scopes.scm
- [x] Support type imports (`import type { MyType } from './types'`) - Detection implemented
- [x] Distinguish between type and value imports - is_type_import flag added to Import interface

### Rust-Specific Import Patterns

- [x] Research and document Rust use statements and module paths - Already captured in scopes.scm
- [x] Support `use crate::module::function` syntax - Module resolution implemented
- [x] Handle `mod` declarations and file structure - ModuleResolver handles mod.rs

### Testing and Documentation

- [x] Add tests for various path resolution scenarios - 14 tests created and passing
- [x] Add tests for each language's import patterns - Tests for TS/JS, Python, Rust
- [x] Update get_imports_with_definitions to use resolved paths - Integrated with ModuleResolver
- [x] Document import pattern support for each language - Created comprehensive import-patterns.md

## Implementation Plan

1. Create resolve_module_path utility function
2. Handle relative path resolution using path.resolve
3. Implement file extension resolution (.ts, .js, .tsx, .jsx, .py)
4. Add support for index files (index.ts, index.js, **init**.py)
5. Parse tsconfig.json for path mappings (optional)
6. Enhance scope queries to capture additional import patterns:
   - Python: star imports, module imports, relative imports
   - TypeScript: CommonJS require, type imports
   - Rust: use statements, mod declarations
7. Update get_imports_with_definitions to handle new import types
8. Add comprehensive tests for all import patterns
9. Document import pattern support for each language

## Technical Details

### Difficulty: Medium-Hard (expanded from original estimate)

**Estimated Time:** 4-6 hours (increased due to additional import patterns)

### Implementation Approach

```typescript
function resolve_module_path(
  current_file: string,
  import_path: string
): string | null {
  // Handle relative paths
  if (import_path.startsWith(".")) {
    const dir = path.dirname(current_file);
    const base = path.resolve(dir, import_path);

    // Try exact path first
    if (fs.existsSync(base)) return base;

    // Try with extensions
    const extensions = [".ts", ".tsx", ".js", ".jsx", ".py"];
    for (const ext of extensions) {
      if (fs.existsSync(base + ext)) return base + ext;
    }

    // Try index files
    const indexFiles = ["index.ts", "index.tsx", "index.js", "__init__.py"];
    for (const index of indexFiles) {
      const indexPath = path.join(base, index);
      if (fs.existsSync(indexPath)) return indexPath;
    }
  }

  // TODO: Handle absolute imports, node_modules
  return null;
}
```

### Language-Specific Import Patterns

#### Python Import Variations

```python
# Star imports - need to resolve all exports
from utils import *

# Module imports - need to track module object references
import utils
utils.helper()  # This reference needs to resolve to utils.helper

# Relative imports with multiple dots
from ...lib.helpers import process_data
```

#### TypeScript/JavaScript Import Variations

```typescript
// CommonJS require
const utils = require("./utils");
const { helper } = require("./utils");

// Type imports (TypeScript only)
import type { Config } from "./types";
import { type User, getName } from "./user"; // Mixed import

// Dynamic imports
const module = await import("./dynamic");
```

#### Rust Import Patterns

```rust
// Use statements
use crate::utils::helper;
use super::module::{func1, func2};
use self::submodule::*;

// Mod declarations affect path resolution
mod utils;  // Looks for utils.rs or utils/mod.rs
```

### Key Considerations

- Need to maintain performance with filesystem checks
- Should cache resolved paths to avoid repeated lookups
- Must handle cross-platform path differences (Windows vs Unix)
- Consider making extension priority configurable
- Star imports require resolving all exports from a module
- Module imports create a namespace that needs special handling
- Type imports should be tracked separately from value imports
- Rust's module system is file-based and more complex than JS/Python

## Implementation Notes

### Completed Implementation

1. **Created ModuleResolver class** (`packages/core/src/module_resolver.ts`):
   - Handles relative path resolution for all languages
   - Language-specific resolvers for Python and Rust
   - Supports file extensions and index files
   - 14 comprehensive tests all passing

2. **Integrated with Project.get_imports_with_definitions()**:
   - Uses ModuleResolver instead of brute-force search
   - Detects language based on file extension
   - Falls back to search if module resolution fails

3. **Discovered existing support**:
   - CommonJS require already captured in JavaScript scopes.scm
   - Rust use statements already captured in Rust scopes.scm
   - Python imports partially supported (missing star imports)

### Task Completion Summary

All major objectives have been achieved:

1. **Module Path Resolution**:
   - Created `ModuleResolver` class with language-specific logic
   - Handles relative paths, file extensions, and index files
   - Integrated with `Project.get_imports_with_definitions()`

2. **Python Enhancements**:
   - Added star import support in scopes.scm
   - Verified module imports work correctly
   - Module path extraction for `from X import Y` statements

3. **TypeScript Enhancements**:
   - Added type import detection
   - Added `is_type_import` flag to Import interface
   - Correctly distinguishes pure type imports and mixed imports

4. **Testing & Documentation**:
   - 14 comprehensive tests for module resolution
   - Created import-patterns.md documenting all supported patterns
   - Verified all language-specific import patterns work

### Remaining Minor Items

- TypeScript path mappings from tsconfig.json (marked as optional in plan)
- External package resolution (node_modules, pip packages) - out of scope

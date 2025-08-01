---
id: task-28
title: Implement proper module path resolution for imports
status: To Do
assignee: []
created_date: "2025-07-18"
updated_date: "2025-07-18"
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

- [ ] Resolve relative import paths to actual file paths
- [ ] Handle common file extensions (.ts, .js, .tsx, .jsx, .py)
- [ ] Support index file conventions (index.ts, index.js, **init**.py)
- [ ] Handle TypeScript path mappings from tsconfig.json

### Python-Specific Import Patterns

- [ ] Support star imports (`from module import *`)
- [ ] Support module imports (`import module` then `module.func()`)
- [ ] Support relative imports with dots (`from ..utils import helper`)

### TypeScript/JavaScript-Specific Import Patterns

- [ ] Support CommonJS require syntax (`const mod = require('./module')`)
- [ ] Support type imports (`import type { MyType } from './types'`)
- [ ] Distinguish between type and value imports

### Rust-Specific Import Patterns

- [ ] Research and document Rust use statements and module paths
- [ ] Support `use crate::module::function` syntax
- [ ] Handle `mod` declarations and file structure

### Testing and Documentation

- [ ] Add tests for various path resolution scenarios
- [ ] Add tests for each language's import patterns
- [ ] Update get_imports_with_definitions to use resolved paths
- [ ] Document import pattern support for each language

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

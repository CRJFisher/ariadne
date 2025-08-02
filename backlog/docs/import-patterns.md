# Import Pattern Support in Ariadne

This document describes the import patterns supported by Ariadne for each language, including how imports are resolved and tracked in the call graph.

## TypeScript/JavaScript

### Supported Import Patterns

#### ES6 Module Imports
```typescript
// Default imports
import DefaultExport from './module';

// Named imports
import { namedExport } from './module';
import { exportA, exportB } from './module';

// Renamed imports
import { originalName as alias } from './module';

// Namespace imports
import * as namespace from './module';

// Type-only imports (TypeScript)
import type { TypeName } from './types';
import { type TypeA, valueB } from './mixed';

// Side-effect imports
import './side-effects';
```

#### CommonJS Imports
```javascript
// Basic require
const module = require('./module');

// Destructured require
const { function1, function2 } = require('./module');

// Renamed destructuring
const { original: renamed } = require('./module');
```

### Module Resolution

1. **Relative Paths**: `./utils`, `../lib/helper`
   - Resolved relative to the importing file
   - Tries exact path, then with extensions (.ts, .tsx, .js, .jsx)
   - Checks for index files if path is a directory

2. **File Extensions**: Automatically resolved in order:
   - TypeScript: `.ts`, `.tsx`, `.d.ts`
   - JavaScript: `.js`, `.jsx`, `.mjs`

3. **Index Files**: When importing a directory:
   - Looks for: `index.ts`, `index.tsx`, `index.js`, `index.jsx`

4. **Type Import Detection**: 
   - Pure type imports are marked with `is_type_import: true`
   - Mixed imports have individual specifiers marked

### Limitations

- TypeScript path mappings from tsconfig.json are not yet supported
- Dynamic imports are not tracked
- External packages (node_modules) are not resolved

## Python

### Supported Import Patterns

```python
# Module imports
import os
import sys

# From imports
from collections import defaultdict
from typing import List, Dict

# Renamed imports
from numpy import array as np_array

# Relative imports
from . import sibling_module
from ..parent import helper
from ...grandparent.utils import utility

# Star imports
from module import *
```

### Module Resolution

1. **Relative Imports**: Dots indicate parent directory levels
   - `.` - Current package
   - `..` - Parent package
   - `...` - Grandparent package

2. **Absolute Imports**: Searched from project root upwards

3. **Package Detection**: 
   - Directories with `__init__.py` are treated as packages
   - Both `module.py` and `module/__init__.py` patterns supported

### Import Tracking

- Module imports (`import os`) create import nodes
- References like `os.path.join()` create reference nodes for both `os` and `path`
- Star imports are captured with name "*" and the source module

### Limitations

- Python path (PYTHONPATH) is not considered
- Virtual environment packages are not resolved
- Conditional imports are always tracked

## Rust

### Supported Import Patterns

```rust
// Use statements
use std::collections::HashMap;
use crate::utils::helper;
use super::parent_module::function;
use self::submodule::Type;

// Renamed imports
use std::io::Result as IoResult;

// Multiple imports
use std::{io, fs, path::Path};

// Glob imports
use module::*;

// Module declarations
mod utils;  // Looks for utils.rs or utils/mod.rs
```

### Module Resolution

1. **Crate Root**: `crate::` paths resolved from src/ directory
2. **Super**: `super::` goes up one module level
3. **Self**: `self::` refers to current module
4. **Module Files**:
   - `mod name;` looks for `name.rs` or `name/mod.rs`

### Limitations

- External crate dependencies are not resolved
- Macro-generated imports are not tracked
- Path attributes on modules are not supported

## Cross-File Import Resolution

Ariadne resolves imports across files to build a complete call graph:

1. **Import Detection**: Captures all import statements during parsing
2. **Module Resolution**: Uses `ModuleResolver` to find the actual file
3. **Export Matching**: Searches for exported definitions in resolved files
4. **Type Tracking**: Maintains type information for imported classes/types

### Import Info Structure

Each import is tracked with:
- `name`: Local name used in the importing file
- `source_name`: Original name in the source module (for renamed imports)
- `source_module`: The module path being imported from
- `is_type_import`: Whether this is a type-only import (TypeScript)

### Usage in Call Graph

Imports enable:
- Cross-file function call resolution
- Method calls on imported classes
- Type information for parameters and returns
- Dependency analysis between modules

## Best Practices

1. Use explicit imports rather than star imports for better tracking
2. Prefer relative imports for internal modules
3. Use type imports in TypeScript to clarify intent
4. Organize code to minimize circular dependencies
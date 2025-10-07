# Task: Fix Python Import Reference Creation

**Status**: To Do
**Epic**: epic-11 - Codebase Restructuring
**Created**: 2025-10-07

## Problem

The [semantic_index.python.test.ts](packages/core/src/index_single_file/semantic_index.python.test.ts) file has 14 test failures related to import handling:

### Failure Pattern

Import statements are not creating proper references:

1. **Imported module references not being created**: When code has `import module` or `from module import symbol`, the reference to `module` or `symbol` is not appearing in the semantic index
2. **Import statement reference extraction failing**: The tree-sitter captures for import nodes may not be triggering reference creation
3. **Module-level imports not tracked**: Top-level import references are missing from the reference list

### Expected Behavior

For code like:
```python
from os.path import join
import sys
```

The semantic index should contain references:
- Reference to `os.path` module
- Reference to `join` symbol
- Reference to `sys` module

### Current Behavior

These references are not being created, causing test failures when tests assert on import reference presence.

## Root Cause

Likely issues in:
- `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder_config.ts`
- Python tree-sitter query patterns in `.scm` files
- Python reference builders not handling import nodes

## Solution

1. **Audit Python import handling**:
   - Review Python `.scm` query files for import patterns
   - Check if import nodes are captured properly
   - Verify Python builder config handles import captures

2. **Fix import reference creation**:
   - Ensure `import_statement` nodes create references
   - Ensure `import_from_statement` nodes create references
   - Handle dotted imports correctly (e.g., `os.path`)
   - Handle aliased imports (e.g., `import numpy as np`)

3. **Test import scenarios**:
   - Simple imports: `import module`
   - From imports: `from module import symbol`
   - Dotted imports: `from a.b.c import symbol`
   - Aliased imports: `import module as alias`
   - Multiple imports: `from module import a, b, c`

## Testing

```bash
cd packages/core
npm test -- semantic_index.python.test.ts -t "import"
```

All import-related tests should pass.

## Related

- Python import resolution: task-epic-11.117
- Python module path resolution: task-epic-11.117.1

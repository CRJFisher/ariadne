# Task 11.170: Include Test Files in Call Graph Analysis

## Status: Completed

## Parent: epic-11-codebase-restructuring

## Overview

Enable test files to be optionally included in call graph analysis. This allows detecting which tests call a given function, making the tool useful for test discovery and coverage analysis.

## Motivation

Currently, test files are excluded at file discovery time. This means:
- Functions called only from tests appear as "entry points" (false positives)
- Cannot query "which tests exercise this function?"
- Cannot trace test coverage through the call graph

Including tests in the analysis enables:
- Accurate entry point detection (tests are callers too)
- Test-to-function mapping for coverage visualization
- Dead code detection that accounts for test usage

## Current State

Test files are excluded at the file discovery stage in `should_load_file()`:

```typescript
// top-level-nodes-analysis/detect_entrypoints_using_ariadne.ts:266-278
function should_load_file(file_path: string): boolean {
  if (file_path.includes(".test.") || file_path.includes(".spec.")) {
    return false;
  }
  // ...
}
```

The core library (`Project`, symbol resolution, call graph) is test-agnostic and processes whatever files are loaded.

## Approach

Add a runtime flag `include_test_files` to control test file inclusion. Use language-specific test file detection with a marshalling pattern.

## Implementation Steps

### 11.170.1: Create Language-Specific Test File Detectors

Create a new module for test file detection:

**Files to create:**
- `packages/core/src/project/detect_test_file.ts` - Marshalling file
- `packages/core/src/project/detect_test_file.typescript.ts` - TypeScript patterns
- `packages/core/src/project/detect_test_file.javascript.ts` - JavaScript patterns
- `packages/core/src/project/detect_test_file.python.ts` - Python patterns
- `packages/core/src/project/detect_test_file.rust.ts` - Rust patterns

**Language-specific patterns:**

| Language | Test File Patterns |
|----------|-------------------|
| TypeScript | `*.test.ts`, `*.spec.ts`, `__tests__/*.ts` |
| JavaScript | `*.test.js`, `*.spec.js`, `__tests__/*.js` |
| Python | `test_*.py`, `*_test.py`, `tests/*.py`, `conftest.py` |
| Rust | `tests/*.rs`, `*_test.rs` |

### 11.170.2: Add Configuration to Project

Modify `packages/core/src/project/project.ts`:

```typescript
export interface ProjectOptions {
  excluded_folders?: string[];
  include_test_files?: boolean;  // Default: false
}
```

- Add `private include_test_files: boolean = false` field
- Modify `initialize()` to accept `ProjectOptions`

### 11.170.3: Update Analysis Script

Modify `top-level-nodes-analysis/detect_entrypoints_using_ariadne.ts`:

```typescript
import { is_test_file } from '@ariadnejs/core';

function should_load_file(
  file_path: string,
  include_tests: boolean,
  language: Language
): boolean {
  if (!include_tests && is_test_file(file_path, language)) {
    return false;
  }
  // ...
}
```

### 11.170.4: Export from Package

Add to `packages/core/src/index.ts`:

```typescript
export { is_test_file } from './project/detect_test_file';
```

## Files to Create

1. `packages/core/src/project/detect_test_file.ts`
2. `packages/core/src/project/detect_test_file.typescript.ts`
3. `packages/core/src/project/detect_test_file.javascript.ts`
4. `packages/core/src/project/detect_test_file.python.ts`
5. `packages/core/src/project/detect_test_file.rust.ts`

## Files to Modify

1. `packages/core/src/project/project.ts` - Add options type, store setting
2. `packages/core/src/index.ts` - Export `is_test_file`
3. `top-level-nodes-analysis/detect_entrypoints_using_ariadne.ts` - Use configurable test inclusion

## Success Criteria

1. `is_test_file(path, language)` correctly identifies test files per language conventions
2. With `include_test_files: false` (default), behavior is unchanged
3. With `include_test_files: true`, test files are loaded and appear in call graph
4. Functions called from tests show tests as callers in the graph
5. All existing tests pass

## Dependencies

- None - extends existing file loading infrastructure

## Related Tasks

- Task 11.168: Handle External Callers and Test-Only Methods (this feature addresses the "test-only methods" false positives)

## Priority

Medium - Enables important use case (test discovery) and addresses known false positives

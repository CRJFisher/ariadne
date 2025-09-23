# task-epic-11.94 - Fix Advanced TypeScript Semantic Index Features

## Status
- **Status**: `Open`
- **Assignee**: Unassigned
- **Priority**: `Medium`
- **Size**: `L`

## Description
Fix remaining TypeScript semantic index test failures related to advanced TypeScript features that require enhanced tree-sitter query patterns.

## Current Issues
Three TypeScript semantic index test failures remain:

### 1. Parameter Properties Not Detected
- **Test**: `should handle parameter properties`
- **File**: `src/semantic_index/semantic_index.typescript.test.ts:385`
- **Issue**: Constructor parameter properties (e.g., `public name: string`) are not being captured as variable symbols
- **Expected**: Parameter properties should create field symbols categorized as variables
- **Current**: 0 field symbols found, expected > 0

### 2. Missing Module Exports
- **Test**: `should parse all import/export patterns`
- **File**: `src/semantic_index/semantic_index.typescript.test.ts:585`
- **Issue**: "ModuleConfig" export not being captured in export names
- **Expected**: Export names should include "ModuleConfig", "ModuleManager", "BaseModule"

### 3. Type-only Imports/Exports Not Captured
- **Test**: `should handle type-only imports and exports`
- **File**: `src/semantic_index/semantic_index.typescript.test.ts:641`
- **Issue**: "UserConfig" type-only export not being captured
- **Expected**: Type-only exports should be captured with proper metadata

## Root Cause Analysis
These failures are likely due to missing or incomplete tree-sitter query patterns for advanced TypeScript constructs:

1. **Parameter Properties**: Need queries to capture constructor parameters with visibility modifiers as field definitions
2. **Complex Exports**: Need enhanced export patterns for re-exports and complex module patterns
3. **Type-only Syntax**: Need specific patterns for `export type` and `import type` statements

## Acceptance Criteria
- [ ] All 3 TypeScript semantic index tests pass
- [ ] Parameter properties are captured as variable symbols with correct metadata
- [ ] All export patterns including re-exports are captured
- [ ] Type-only imports/exports are distinguished and captured properly
- [ ] No regression in existing TypeScript parsing functionality

## Technical Approach
1. **Analyze Tree-sitter AST**: Examine the AST structure for failing test cases
2. **Update TypeScript Queries**: Enhance `src/semantic_index/queries/typescript.scm` with missing patterns
3. **Add Modifier Support**: Ensure parameter property modifiers are captured
4. **Fix Export Detection**: Update export queries to handle complex module patterns
5. **Add Type-only Support**: Add specific patterns for type-only syntax

## Files to Modify
- `src/semantic_index/queries/typescript.scm` - Add missing query patterns
- `src/semantic_index/capture_types.ts` - May need new entity types or modifiers
- Test files - Update expectations if needed

## Dependencies
- Understanding of tree-sitter query syntax
- Knowledge of TypeScript AST structure
- Familiarity with semantic index capture system

## Notes
- These are advanced TypeScript features, not core functionality blockers
- Changes should be additive to avoid breaking existing functionality
- Consider adding debug logging to understand current capture behavior
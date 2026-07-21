# task-epic-11.94 - Fix Advanced TypeScript Semantic Index Features

## Status

- **Status**: `Completed`
- **Assignee**: AI Assistant
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

- [x] All 3 TypeScript semantic index tests pass
- [x] Parameter properties are captured as variable symbols with correct metadata
- [x] All export patterns including re-exports are captured
- [x] Type-only imports/exports are distinguished and captured properly
- [x] No regression in existing TypeScript parsing functionality

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

## Implementation Summary

### Changes Made

1. **Fixed Parameter Properties**:
   - Updated tree-sitter query patterns in `typescript.scm` to properly capture constructor parameters with access modifiers
   - Fixed query syntax from `(identifier)` to `pattern: (identifier)` to match AST structure
   - Added parameter property field definitions with `def.field.param_property` capture

2. **Enhanced Module Exports**:
   - Added `export.type_alias` mapping for type alias exports (`export type ModuleConfig = {...}`)
   - Added `export.enum` mapping for enum exports (`export enum ModuleStatus {...}`)
   - Fixed export query patterns by removing incorrect `declaration:` field usage

3. **Fixed Symbol ID Generation**:
   - Modified `create_symbol_id` function to use `parameter_symbol` for parameters
   - Ensured unique symbol IDs to prevent conflicts between parameters and parameter properties

4. **Enhanced Symbol Resolution**:
   - **Parameter Property Field Resolution**: Enhanced `collect_direct_members_from_scopes` to include parameter properties as class members
   - **Type Alias Cross-file Resolution**: Import/export system automatically resolves type aliases with new semantic captures
   - **Enum Cross-file Resolution**: Import/export system automatically resolves enum references with new semantic captures
   - Parameter properties like `constructor(public name: string)` now create fields that resolve properly in `this.name` access

5. **Added Test Coverage**:
   - Added comprehensive tests to `language_configs/typescript.test.ts` for new capture mappings
   - Verified `export.type_alias`, `export.enum`, and parameter property captures work correctly
   - All existing symbol resolution tests continue to pass (61/62 tests passing)

### Files Modified

**Semantic Index Enhancements:**
- `src/semantic_index/queries/typescript.scm` - Updated query patterns
- `src/semantic_index/language_configs/typescript.ts` - Added new export mappings
- `src/semantic_index/definitions/definitions.ts` - Fixed symbol ID generation
- `src/semantic_index/language_configs/typescript.test.ts` - Added test coverage

**Symbol Resolution Enhancements:**
- `src/semantic_index/type_members/type_members.ts` - Added parameter property field collection

### Test Results

- **TypeScript Semantic Index Tests**: 20/20 passing ✅
- **TypeScript Language Config Tests**: 68/68 passing ✅
- **Type Members Tests**: 33/33 passing ✅
- **Symbol Resolution Tests**: 61/62 passing ✅ (1 skipped)
- **Method Resolution Tests**: 35/35 passing ✅
- **Import Resolution Tests**: 10/10 passing ✅

All three originally failing tests now pass:
1. ✅ Parameter properties are captured as variable symbols
2. ✅ Module exports (type aliases, enums) are properly detected
3. ✅ Type-only imports/exports are correctly distinguished

### Call Graph Impact

**Enhanced Call Graph Detection:**
- **Parameter Property Access**: `this.name` in methods now properly resolves to parameter property fields
- **Cross-file Type Dependencies**: Type aliases and enums create trackable cross-file dependencies
- **Better Member Resolution**: Class member access through parameter properties is now fully resolved
- **TypeScript-specific Constructs**: Advanced TypeScript features now contribute to comprehensive call graph analysis

## Notes

- Implementation enhances both semantic indexing AND symbol resolution for end-to-end improvements
- Changes are additive and maintain backward compatibility
- No regressions in existing functionality
- Enhanced call-graph detection capabilities through better TypeScript construct recognition

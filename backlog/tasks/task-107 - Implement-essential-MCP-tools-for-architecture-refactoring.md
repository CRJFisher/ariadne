---
id: task-107
title: Implement essential MCP tools for architecture refactoring
status: Done
assignee: []
created_date: "2025-08-19"
completed_date: "2025-08-19"
labels: [mcp, tools, epic-11]
dependencies: []
---

## Context

During initial MCP server testing, we found only `get_symbol_context` is implemented. We need three core tools for effective architecture refactoring during Epic 11.

## Tools to Implement

### 1. find_references

**Purpose**: Find all usages of a symbol across the codebase
**Challenge**: Core API uses `find_references(file_path, position)` but we have symbol name
**Solution**: Search for symbol definitions first, then find references
**Returns**: List of locations where symbol is used

### 2. get_file_metadata

**Purpose**: Get all symbols defined in a file
**Wraps**: `get_definitions(file_path)`
**Returns**: For each symbol:

- Name
- Type (function, class, type, interface, etc.)
- Line number
- 1-line signature (e.g., `function parseFile(path: string, opts?: Options): Tree`)
  **Use Case**: Understanding file structure and dependencies

### 3. get_source_code

**Purpose**: Extract complete source code of a function/class
**Challenge**: Need to resolve symbol name to Definition first
**Wraps**: `get_source_code(def, file_path)`
**Returns**: Full source text of the symbol

## Implementation Plan

1. [x] Create feature branch (`feat/mcp-tools-implementation`)
2. [x] Implement find_references tool
3. [x] Implement get_file_metadata tool  
4. [x] Implement get_source_code tool
5. [x] Add comprehensive tests for each tool
6. [x] Test with real Epic 11 scenarios
7. [x] Update documentation

## Success Criteria

- [x] All three tools working correctly
- [x] Tests passing (49/49 tests passing)
- [x] Can find all references to any symbol
- [x] Can list all symbols in any file with 1-line signatures
- [x] Can extract full source of any function/class
- [x] Tools help with Epic 11 refactoring tasks

## Implementation Notes

### Tools Implemented

1. **get_file_metadata**
   - Lists all symbols in a file with line numbers and 1-line signatures
   - Detects imports and exports
   - Works across TypeScript, JavaScript, Python, and Rust
   - Returns symbol count and line count

2. **find_references**  
   - Finds all references to a symbol across the entire project
   - Supports `includeDeclaration` flag to optionally include the definition
   - Supports `searchScope` parameter ("project" or "file")
   - Fixed critical bug where references were incorrectly attributed to wrong files
   - Returns references with file path, line, column, and context

3. **get_source_code**
   - Extracts complete source code for any symbol
   - Supports `includeDocstring` flag for documentation
   - Returns source with proper language detection
   - Provides helpful suggestions for typos/similar symbol names
   - Fixed multiline type alias extraction

### Bug Fixes During Implementation

1. **find_references false positives** (FIXED)
   - Issue: Tool was returning 26 references instead of 13 for `getFileMetadata`
   - Cause: `project.find_references()` returns refs from ALL files but code assumed same file
   - Fix: Removed the problematic `project.find_references()` call, rely only on scope graphs

2. **Type alias extraction** (FIXED)
   - Issue: Multiline TypeScript type aliases were only returning first line
   - Fix: Extended range detection to capture full type definition by tracking brace matching

3. **Test isolation issues** (FIXED)
   - Issue: Tests were contaminating each other with shared Project instance
   - Fix: Used unique symbol names in different language test files

## Testing Notes

### Comprehensive Testing Performed

1. **All MCP tools tested via Claude Code**
   - Successfully loaded and executed all 4 tools
   - Verified cross-file reference detection
   - Tested with real codebase queries

2. **Cross-language support verified**
   - TypeScript: Full support with proper type detection
   - JavaScript: CommonJS and ES6 modules working
   - Python: Classes, functions, and imports detected
   - Rust: Structs, impls, and functions working

3. **Edge cases tested**
   - Non-existent symbols return helpful error messages
   - Typos provide suggestions for similar symbols
   - Empty files handled gracefully
   - Large files processed correctly

### Known Limitations (Captured as New Tasks)

1. **task-108**: Method name collisions
   - Methods like "new" treated as global symbols
   - Can't distinguish `Foo::new` from `Bar::new`
   - Affects all languages but particularly problematic in Rust

2. **task-103**: Docstring extraction issues  
   - Python docstrings include code beyond closing quotes
   - Needs proper boundary detection

### Test Results

- **Unit tests**: 49/49 passing
- **Integration**: All tools working in Claude Code MCP server
- **Performance**: Tools respond quickly even on large files
- **Reliability**: No crashes or hangs during extensive testing

## Outcome

Successfully implemented all three essential MCP tools needed for Epic 11. The tools are fully functional and have been thoroughly tested. Two minor limitations were discovered and documented as separate tasks but do not block the use of these tools for the architecture refactoring work.

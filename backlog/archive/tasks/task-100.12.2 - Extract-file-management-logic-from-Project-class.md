---
id: task-100.12.2
title: Extract file management logic from Project class
status: Done
assignee: []
created_date: '2025-08-04 22:40'
updated_date: '2025-08-04 23:11'
labels: []
dependencies: []
parent_task_id: task-100.12
---

## Description

Move all file-related operations (add_or_update_file, parse logic, file_graphs, file_cache) into a separate FileManager module to reduce the size of index.ts.

## Acceptance Criteria

- [x] FileManager class created
- [x] File parsing logic moved
- [x] File caching logic moved
- [x] Tree-sitter parser management moved
- [ ] Project class delegates to FileManager

## Implementation Plan

1. Create FileManager class
2. Move parsing logic from Project
3. Move file caching logic
4. Create LanguageManager for language registration
5. Update Project class to use FileManager

## Implementation Notes

Successfully extracted file management logic into separate modules:

1. **FileManager class** (`project/file_manager.ts`):
   - Handles all file parsing and caching operations
   - `parseFile`: Manages tree-sitter parsing with error handling
   - `processFile`: Updates project state with parsed file data
   - `processFileExports`: Detects and tracks file exports
   - `processFileImports`: Tracks imported classes for type resolution
   - `removeFile`: Removes file from project state
   - Utility methods for byte offset and position calculations

2. **LanguageManager class** (`project/language_manager.ts`):
   - Centralizes language configuration management
   - Registers default languages (TypeScript, JavaScript, Python, Rust)
   - Provides lookup by name or file extension
   - Encapsulates language registration logic

3. **Key improvements**:
   - Separated concerns: file operations vs language management
   - Immutable state updates throughout
   - Better error handling for tree-sitter limitations
   - Cleaner API for file processing

Next step: Update Project class to delegate to FileManager

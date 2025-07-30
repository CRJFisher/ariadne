---
id: task-53
title: Implement file scanning for MCP server initialization
status: To Do
assignee: []
created_date: '2025-07-30'
labels: []
dependencies: []
---

## Description

Add file scanning and watching functionality to the MCP server to load all project files on startup using the PROJECT_PATH environment variable and keep the symbol graph up-to-date as files change, enabling proper cross-file symbol resolution

## Acceptance Criteria

- [ ] PROJECT_PATH environment variable is read and used
- [ ] All source files in the project directory are scanned on startup
- [ ] Files are loaded into the Project using add_or_update_file
- [ ] File system watcher monitors for changes (create, update, delete)
- [ ] Project is automatically updated when files change
- [ ] Symbol definitions and references stay fresh as code changes
- [ ] Cross-file go_to_definition and find_references work correctly
- [ ] Existing core package utilities are reused if available

## Implementation Plan

1. Check @ariadnejs/core package for existing file scanning utilities
2. Read PROJECT_PATH environment variable (fallback to process.cwd())
3. Implement recursive directory scanner for source files
4. Filter files by supported language extensions
5. Load all discovered files into Project on server startup
6. Implement file watching using Node.js libraries (e.g., chokidar, node-watch, or fs.watch)
7. Handle file events:
   - File created: add to Project
   - File modified: update in Project
   - File deleted: remove from Project
8. Ensure thread-safe updates to the Project during file changes
9. Add debouncing for rapid file changes (e.g., during saves)
10. Update server.ts and start_server.ts to use the scanner and watcher
11. Test cross-file navigation functionality with live updates
12. Update SETUP.md if needed to reflect actual behavior

## Technical Notes

### Node.js File Watching Libraries

- **chokidar**: Most popular, cross-platform, handles many edge cases
- **node-watch**: Lightweight alternative
- **fs.watch**: Built-in but has platform-specific limitations
- **@parcel/watcher**: High-performance C++ based watcher

Recommendation: Use chokidar for reliability and cross-platform support

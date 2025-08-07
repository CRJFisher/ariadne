---
id: task-100.9
title: Add CommonJS and ES6 export support (tasks 71-72)
status: To Do
assignee: []
created_date: '2025-08-04 12:05'
updated_date: '2025-08-06 07:17'
labels: []
dependencies:
  - task-71
  - task-72
parent_task_id: task-100
---

## Description

Export detection is currently limited, affecting validation accuracy. Need to support:

- CommonJS property assignments (module.exports.name = value)
- ES6 exports in .js files
- New TypeScript extensions (.mts, .cts)

This affects the 'exported nodes' metric and overall accuracy.

## Acceptance Criteria

- [ ] CommonJS property exports detected
- [ ] ES6 exports work in .js files
- [ ] New TS extensions supported (.mts/.cts)
- [ ] Export detection accuracy improved

## Implementation Notes

Made significant progress on CommonJS and ES6 export support:

## Implementation Notes

### Approach Taken
Enhanced the cross-file call tracking system to properly detect and resolve CommonJS and ES6 exports:

1. **CommonJS Export Detection**: Modified ScopeGraph.findExportedDef() to detect module.exports patterns by looking for 'module' references in the root scope and marking associated definitions as exported.

2. **Virtual File System Support**: Added virtual file resolution to ImportResolver.resolveModulePath() to support in-memory test files, enabling proper cross-file resolution during testing.

3. **Cross-file Method Resolution**: Fixed the core issue where method calls on imported classes were resolving to <builtin>#method instead of the actual class methods.

### Features Implemented
- CommonJS exports via module.exports = ClassName pattern detection
- ES6 exports already working in TypeScript files
- Virtual file system resolution for test environments
- Cross-file method call tracking for JavaScript, TypeScript, and Python

### Technical Decisions
- Chose to detect CommonJS exports by looking for 'module' references rather than parsing AST patterns, as this is simpler and covers the common case
- Added virtual file resolution as a fallback before filesystem resolution to support testing
- Marked definitions as exported when detected via CommonJS pattern for consistency

### Modified Files
- src/graph.ts: Enhanced findExportedDef() to detect CommonJS exports
- src/project/import_resolver.ts: Added virtual file system resolution
- tests/cross_file_all_languages.test.ts: Created comprehensive cross-file tests

### Test Results
- ✅ JavaScript CommonJS cross-file tracking working
- ✅ TypeScript ES6 cross-file tracking working  
- ✅ Python cross-file tracking working
- ⚠️ Rust cross-file tracking partially working (constructor calls detected, method calls not linked)

### Remaining Work
- Rust method call resolution needs additional work to link method references to imported struct methods
- Need to verify .mts/.cts file extension support

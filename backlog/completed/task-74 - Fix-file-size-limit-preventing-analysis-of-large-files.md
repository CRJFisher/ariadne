---
id: TASK-74
title: Fix file size limit preventing analysis of large files
status: Done
assignee: []
created_date: "2025-08-03"
updated_date: "2026-04-01 21:46"
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The 32KB file size limit in validate-ariadne.ts prevents analysis of critical files like project_call_graph.ts (57KB), causing false top-level node identification. Need to increase limit or implement file chunking.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 File size limit increased or chunking implemented
- [x] #2 Large files like project_call_graph.ts are analyzed
- [x] #3 Top-level node identification accuracy improved
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

**COMPLETED**: Resolved using the `bufferSize` option in tree-sitter's parser.parse() method.

### Solution

The 32KB limit was completely eliminated by implementing dynamic buffer sizing:

```javascript
// Dynamic buffer size based on actual file size (with 10% padding)
const bufferSize = Math.max(32 * 1024, Math.ceil(sourceCode.length * 1.1));
const options = { bufferSize };
const tree = parser.parse(sourceCode, oldTree, options);
```

### Key Changes

1. **file_manager.ts**: Added dynamic bufferSize option to both full and incremental parsing
2. **constants.ts**: Updated MAX_FILE_SIZE to 10MB (soft limit for performance guidance)
3. **large-file-handling.test.ts**: Updated tests to verify dynamic buffer works for various file sizes
4. **tree-sitter-32kb-limit.md**: Documented complete resolution

### Impact

- Files of any size can now be parsed (no hard limit)
- Buffer automatically scales with file size
- No performance penalty for small files (minimum 32KB buffer)
- No tree-sitter version upgrade required (works with 0.21.1)

### Discovery

The solution was discovered through a GitHub issue comment suggesting the undocumented `bufferSize` option. Testing confirmed it works perfectly with tree-sitter 0.21.1, allowing us to avoid complex workarounds or version upgrades.

<!-- SECTION:NOTES:END -->

---
id: task-29
title: Add circular import detection to prevent infinite loops
status: To Do
assignee: []
created_date: "2025-07-18"
updated_date: "2025-07-18"
labels:
  - enhancement
  - import-resolution
  - stability
dependencies: []
---

## Description

The current import resolution could potentially enter infinite loops when circular imports exist. This task adds detection and graceful handling of circular import chains to ensure the API remains stable even with complex dependency graphs. This might already be implemented, but so the first step is to review the codebase and see if it's already implemented.

## Acceptance Criteria

- [ ] Detect circular imports during resolution
- [ ] Track visited files to prevent infinite recursion
- [ ] Log warnings when circular imports are detected
- [ ] Continue resolution without crashing
- [ ] Add chain tracking for better error messages
- [ ] Test with intentionally circular imports

## Implementation Plan

1. Add visited parameter to get_imports_with_definitions
2. Track visited files in a Set during resolution
3. Check for cycles before processing each file
4. Log warning messages when cycles detected
5. Return empty result for circular imports
6. Add import chain tracking for debugging
7. Write tests with intentional circular imports
8. Document behavior and limitations

## Technical Details

### Difficulty: Easy

**Estimated Time:** 1-2 hours

### Implementation Approach

```typescript
class Project {
  get_imports_with_definitions(
    file_path: string,
    visited: Set<string> = new Set(),
    chain: string[] = []
  ): ImportInfo[] {
    // Check for circular import
    if (visited.has(file_path)) {
      const cycle = [...chain, file_path].join(" -> ");
      console.warn(`Circular import detected: ${cycle}`);
      return [];
    }

    visited.add(file_path);
    chain.push(file_path);

    // Existing implementation...
    const imports = graph.getAllImports();

    // When resolving imports recursively
    for (const imp of imports) {
      // Pass visited set to recursive calls
      const resolved = this.resolve_import(imp, visited, [...chain]);
    }

    return importInfos;
  }
}
```

### Key Considerations

- Circular imports are sometimes intentional and valid in JavaScript/TypeScript
- Should warn but not error to maintain compatibility
- Chain tracking helps developers understand the cycle
- May need different strategies for different languages (Python vs JS)
- Consider making this behavior configurable

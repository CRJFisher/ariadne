---
id: task-66
title: Connect import resolution with constructor type tracking
status: Done
assignee:
  - '@claude'
created_date: '2025-08-02'
updated_date: '2025-08-02'
labels:
  - enhancement
  - call-graph
  - import-resolution
dependencies:
  - task-65
---

## Description

Integrate the import resolution system with variable type tracking so that when a variable is assigned new ImportedClass(), the system knows it's an instance of the imported class. Currently, import information and type tracking are completely separate systems.

## Acceptance Criteria

- [x] Constructor calls on imported classes are tracked with correct type
- [x] Type information includes source file of the class definition
- [x] Imported class types are resolved across file boundaries
- [x] Works with renamed imports (import { Foo as Bar })
- [x] Tests verify import-aware type tracking
- [x] Documentation updated with new capability

## Implementation Plan

1. Analyze current import resolution flow in get_calls_from_definition
2. Create a method to get import information for a given file
3. Extend FileTypeTracker to store import mappings (local name -> imported class info)
4. Update constructor tracking to check if class is imported and store full type info
5. Modify type resolution to use imported class information
6. Handle renamed imports by tracking local names
7. Add tests for import-aware type tracking
8. Test cross-file method resolution with imported classes

## Implementation Notes

Implemented import-aware type tracking for constructor calls. Key changes:

1. Extended FileTypeTracker to store imported class information (local name -> class info mapping)
2. Added initializeFileImports() method to populate import information when analyzing a file
3. Modified constructor tracking to first check if a class is imported before falling back to resolution
4. Successfully handles renamed imports (import { Foo as Bar })
5. Added comprehensive tests for both regular and renamed imports

The implementation now correctly tracks method calls on imported class instances, achieving cross-file method resolution for constructor-based instantiation. Tests verify that imported class methods are correctly linked and not marked as top-level nodes.

However, the Python tests reveal that 'self' parameter type tracking is not yet implemented, which is needed for method-to-method calls within Python classes.

---
id: task-1
title: >-
  Enable return_type_inference integration tests when code_graph module is
  implemented
status: To Do
assignee: []
created_date: '2025-09-08 22:45'
labels: []
dependencies: []
---

## Description

The return_type_inference module has 6 integration tests that are currently skipped because they depend on the `code_graph` module which hasn't been implemented yet. These tests validate the integration of return type inference within the larger code analysis system.

### Context

During the refactoring of return_type_inference module (task 11.92), integration tests were found in `src/type_analysis/return_type_inference/integration.test.ts` that import and use `analyze_file` from `../../code_graph`. Since the code_graph module doesn't exist yet, these tests have been:

1. Marked with `describe.skip()` to prevent test failures
2. Added a placeholder `analyze_file` function that throws an error
3. Documented with TODO comments explaining the dependency

### Test Coverage

The 6 skipped integration tests cover:
1. Inferring explicit return type annotations (TypeScript)
2. Inferring return types from return statements (JavaScript)  
3. Handling async functions
4. Handling generator functions
5. Handling void functions
6. Handling multiple return paths

These tests are important for validating that return type inference works correctly when integrated with the broader codebase analysis pipeline.

## Acceptance Criteria

1. [ ] The `code_graph` module has been implemented with an `analyze_file` function
2. [ ] Remove the `describe.skip()` from the test suite in `integration.test.ts`
3. [ ] Remove the placeholder `analyze_file` function
4. [ ] Uncomment the proper import: `import { analyze_file } from '../../code_graph';`
5. [ ] Ensure all 6 integration tests pass
6. [ ] Verify the `analyze_file` function returns the expected structure with:
   - `functions` array containing function analysis results
   - Each function having `name` and `signature.return_type` properties
7. [ ] Update any test expectations if the actual code_graph API differs from assumptions

## Implementation Notes

### Current Test File Location
`packages/core/src/type_analysis/return_type_inference/integration.test.ts`

### Expected analyze_file Interface
```typescript
interface CodeFile {
  file_path: string;
  source_code: string;
  language: Language;
}

interface FunctionAnalysis {
  name: string;
  signature: {
    return_type: string;
    // other signature properties...
  };
  // other analysis properties...
}

interface FileAnalysis {
  functions: FunctionAnalysis[];
  // other file analysis results...
}

async function analyze_file(file: CodeFile): Promise<FileAnalysis>
```

### Dependencies
- Depends on the implementation of the `code_graph` module
- The code_graph module should integrate with return_type_inference module's exported functions

## Related Tasks
- Parent: task-epic-11.92 (Refactor return_type_inference module)
- Blocks: Full integration testing of type analysis features

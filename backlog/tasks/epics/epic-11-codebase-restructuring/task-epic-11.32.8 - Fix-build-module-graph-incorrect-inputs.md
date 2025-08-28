---
id: task-epic-11.32.8
title: Fix build_module_graph incorrect inputs
status: To Do
assignee: []
created_date: '2025-08-26'
labels: [bug, graph-builder, module-graph, epic-11]
dependencies: [task-epic-11.32]
parent_task_id: task-epic-11.32
---

## Description

Fix the incorrect arguments being passed to build_module_graph in graph_builder. The function signature expects file paths and context, but graph_builder is passing imports, exports, and metadata.

## Context

The actual build_module_graph signature:
```typescript
export function build_module_graph(
  file_paths: string[],
  context: ModuleGraphContext
): ModuleGraph
```

But graph_builder is calling it incorrectly:
```typescript
context.module_graph = build_module_graph(
  all_imports,    // Wrong: ImportInfo[] not string[]
  all_exports,    // Wrong: ExportInfo[] not context
  module_metadata // Wrong: third argument doesn't exist
);
```

This is a critical bug that would cause runtime errors. The function expects:
1. An array of file paths to analyze
2. A ModuleGraphContext with callbacks for getting imports/exports

But it's receiving:
1. Import information arrays
2. Export information arrays  
3. Metadata object

## Root Cause

This appears to be confusion between two different approaches:
1. **Current module_graph design**: Takes file paths and discovers imports/exports via context callbacks
2. **What graph_builder expects**: Takes already-computed imports/exports and builds graph from them

## Tasks

### Phase 1: Understand Requirements
- [ ] Analyze what module_graph.ts actually does
- [ ] Determine what graph_builder needs from module graph
- [ ] Check if module_graph can work with pre-computed data

### Phase 2: Design Solution

#### Option A: Fix the call to match current signature
```typescript
// Pass file paths and proper context
const module_context: ModuleGraphContext = {
  get_imports: (file) => /* return imports for file */,
  get_exports: (file) => /* return exports for file */,
  resolve_module: (from, to) => /* resolve module path */,
  language: config.language
};

context.module_graph = build_module_graph(
  files.map(f => f.file_path),
  module_context
);
```

#### Option B: Refactor build_module_graph to accept imports/exports
```typescript
// Change signature to accept pre-computed data
export function build_module_graph(
  imports: Map<string, ImportInfo[]>,
  exports: Map<string, ExportInfo[]>,
  config: ModuleGraphConfig
): ModuleGraph
```

#### Option C: Create adapter function
```typescript
// Create new function that adapts between the two
export function build_module_graph_from_analysis(
  file_analyses: Map<string, FileAnalysisResult>
): ModuleGraph
```

### Phase 3: Implementation
- [ ] Choose approach based on analysis
- [ ] Update build_module_graph or create adapter
- [ ] Fix the call in graph_builder
- [ ] Ensure module graph is built correctly

### Phase 4: Testing
- [ ] Test module graph construction
- [ ] Verify import/export relationships
- [ ] Test with multi-file projects
- [ ] Ensure no runtime errors

## Acceptance Criteria

- [ ] build_module_graph is called with correct arguments
- [ ] Module graph is successfully built
- [ ] No TypeScript compilation errors
- [ ] No runtime errors
- [ ] Module relationships are correctly represented

## Technical Analysis

### Current module_graph.ts approach:
```typescript
interface ModuleGraphContext {
  get_imports: (file: string) => ImportInfo[];
  get_exports: (file: string) => ExportInfo[];
  resolve_module: (from: string, to: string) => string | undefined;
  language: Language;
}
```

### What graph_builder has available:
```typescript
// After analyzing all files:
const all_imports: ImportInfo[] = [];
const all_exports: ExportInfo[] = [];

for (const analysis of analyses) {
  all_imports.push(...analysis.imports);
  all_exports.push(...analysis.exports);
}
```

### Recommended Solution:

**Option A** is recommended because:
1. Maintains existing module_graph design
2. Graph_builder already has all needed data
3. Clean separation of concerns

Implementation:
```typescript
// Create context from analyzed data
const module_context: ModuleGraphContext = {
  get_imports: (file_path) => {
    const analysis = context.file_analyses.get(file_path);
    return analysis ? analysis.imports : [];
  },
  get_exports: (file_path) => {
    const analysis = context.file_analyses.get(file_path);
    return analysis ? analysis.exports : [];
  },
  resolve_module: (from, to) => {
    // Use existing module resolution logic
    return resolve_module_path(from, to);
  },
  language: config.default_language // or determine from files
};

// Build module graph with correct arguments
context.module_graph = build_module_graph(
  Array.from(context.file_analyses.keys()),
  module_context
);
```

## Benefits of Fixing

1. **Correctness**: Module graph will actually work
2. **Type Safety**: TypeScript will catch similar issues
3. **Maintainability**: Clear contract between components
4. **Performance**: Avoid redundant computation

## Notes

- This is a critical bug that must be fixed before graph_builder can work
- Consider adding integration tests to catch such issues
- May need to add module resolution utilities
- Consider how this integrates with incremental updates
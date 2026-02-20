---
id: task-epic-11.32.6
title: Fix module-level call handling in FunctionCallInfo
status: To Do
assignee: []
created_date: '2025-08-26'
labels: [types, call-graph, graph-builder, epic-11]
dependencies: [task-epic-11.32]
parent_task_id: task-epic-11.32
---

## Description

Fix the handling of module-level function calls where there is no enclosing function, as FunctionCallInfo.caller_name is currently non-nullable but module-level calls have no caller function.

## Context

In function_calls.ts, FunctionCallInfo is defined as:
```typescript
export interface FunctionCallInfo {
  caller_name: string;  // <-- Not nullable
  callee_name: string;
  location: Point;
  file_path: string;
  is_method_call: boolean;
  is_constructor_call: boolean;
  arguments_count: number;
}
```

But in graph_builder.ts, module-level calls are handled with:
```typescript
const source_id = `${file.file_path}#${
  call.caller_name || "<module>"  // <-- Fallback to "<module>"
}`;
```

This mismatch creates problems:
1. Type safety issue: caller_name can't be null but might not exist
2. Inconsistent representation: Sometimes "<module>", sometimes undefined
3. Graph building relies on fallback logic rather than explicit handling

## Current Workarounds

The code currently uses various workarounds:
- `call.enclosing_function || "<module>"` (old code)
- `call.caller_name || "<module>"` (graph_builder)
- Module-level calls might be getting incorrect caller_name

## Tasks

### Phase 1: Analysis
- [ ] Identify all places module-level calls are created
- [ ] Check how each language handles top-level code
- [ ] Determine best representation for module-level context

### Phase 2: Design Decision

#### Option A: Make caller_name nullable
```typescript
interface FunctionCallInfo {
  caller_name: string | null;  // null for module-level
  // ...
}
```

#### Option B: Use special constant
```typescript
interface FunctionCallInfo {
  caller_name: string;  // Use MODULE_CONTEXT = "<module>"
  // ...
}
const MODULE_CONTEXT = "<module>";
```

#### Option C: Add explicit field
```typescript
interface FunctionCallInfo {
  caller_name?: string;      // Only for function context
  caller_context: 'function' | 'module' | 'class';
  // ...
}
```

### Phase 3: Implementation
- [ ] Update FunctionCallInfo type definition
- [ ] Update all call detection functions to handle module-level
- [ ] Update graph_builder to use consistent approach
- [ ] Ensure all languages properly detect module-level calls

### Phase 4: Language-Specific Handling
- [ ] JavaScript/TypeScript: Top-level function calls
- [ ] Python: Module-level code execution
- [ ] Rust: Main function and module initialization

### Phase 5: Testing
- [ ] Test module-level calls in all languages
- [ ] Verify graph correctly represents module-level calls
- [ ] Ensure no type errors or runtime issues

## Acceptance Criteria

- [ ] Module-level calls are consistently represented
- [ ] No type safety issues with caller_name
- [ ] Graph builder handles module context properly
- [ ] All languages correctly identify module-level calls
- [ ] Tests verify module-level call detection

## Technical Examples

### Module-Level Calls

**JavaScript/TypeScript:**
```javascript
// Module level
console.log("Starting");  // caller_name = ?
initApp();                // caller_name = ?

function initApp() {
  setupDatabase();        // caller_name = "initApp"
}
```

**Python:**
```python
# Module level
print("Starting")         # caller_name = ?
init_app()               # caller_name = ?

def init_app():
    setup_database()     # caller_name = "init_app"

if __name__ == "__main__":
    main()               # caller_name = ?
```

**Rust:**
```rust
// Module level (less common)
static INIT: () = init(); // caller_name = ?

fn main() {
    run_app();           // caller_name = "main"
}
```

## Recommendation

Recommend **Option B** (special constant) because:
1. Maintains type safety (no nullable fields)
2. Explicit and searchable constant
3. Consistent representation across codebase
4. Clear semantic meaning

Implementation:
```typescript
// In types package
export const MODULE_CONTEXT = "<module>";

// In function_calls
interface FunctionCallInfo {
  caller_name: string;  // Use MODULE_CONTEXT for module-level
  // ...
}
```

## Notes

- Consider how this affects call graph visualization
- Module-level calls are important for understanding entry points
- Some languages (Python) execute significant code at module level
- Consider IIFE and other patterns that blur the line
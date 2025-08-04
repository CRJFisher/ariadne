# Revised Refactoring Plan

## Keep ProjectCallGraph as Data Object

Instead of completely eliminating ProjectCallGraph, we'll:

1. **Keep ProjectCallGraph as a data holder** with:
   ```typescript
   export interface ProjectCallGraphData {
     file_graphs: Map<string, ScopeGraph>;
     file_cache: Map<string, FileCache>;
     languages: Map<string, LanguageConfig>;
     file_type_trackers: Map<string, FileTypeTrackerData>;
     project_type_registry: ProjectTypeRegistryData;
   }
   ```

2. **Extract all methods as pure functions** that take `ProjectCallGraphData` as first parameter

3. **Minimize state mutation** by:
   - Returning new data where possible
   - Clearly documenting any mutations
   - Keeping mutations isolated to specific functions

## Benefits:
- Easy to pass around the state
- Clear what data each function needs
- Can gradually migrate to immutable approach
- Maintains compatibility with existing code

## Example transformation:

### Before (method):
```typescript
class ProjectCallGraph {
  private getFileTypeTracker(file_path: string): FileTypeTracker {
    let tracker = this.file_type_trackers.get(file_path);
    if (!tracker) {
      tracker = new FileTypeTracker();
      this.file_type_trackers.set(file_path, tracker);
    }
    return tracker;
  }
}
```

### After (function):
```typescript
function get_or_create_file_type_tracker(
  data: ProjectCallGraphData,
  file_path: string
): FileTypeTrackerData {
  let tracker = data.file_type_trackers.get(file_path);
  if (!tracker) {
    tracker = create_file_type_tracker();
    data.file_type_trackers.set(file_path, tracker); // Mutation documented
  }
  return tracker;
}
```

## State Mutation Analysis:

### Functions that mutate state:
1. `clearFileTypeTracker` - clears tracker data
2. `initializeFileImports` - sets imported classes
3. `detectFileExports` - marks exports
4. Type tracking functions - update type maps

### Functions that are read-only:
1. `get_module_level_calls`
2. `get_calls_from_definition` (mostly - does initialize imports)
3. `extract_call_graph`
4. `get_call_graph` (mostly - does detect exports)

We'll need to carefully handle the mutations, possibly by:
- Making initialization explicit
- Returning updated data structures
- Using a "prepare" phase before analysis
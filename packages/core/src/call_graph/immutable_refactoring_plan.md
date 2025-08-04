# Immutable Refactoring Plan for Call Graph

## Overview

Transform the call graph system from a mutable, class-based approach to a fully immutable, functional approach. This will improve code quality, testability, and eliminate subtle bugs from shared mutable state.

## Core Principles

1. **No Mutations**: All data structures are immutable
2. **Pure Functions**: Functions have no side effects
3. **Explicit State Flow**: State changes flow through return values
4. **Efficient Updates**: Use structural sharing to avoid unnecessary copying

## Implementation Strategy

### Phase 1: Immutable Type Tracking (task-100.11.1)

Transform type tracking from mutable Maps/Sets to immutable structures:

```typescript
// Before (mutable)
tracker.setVariableType(varName, typeInfo);

// After (immutable)
const newTracker = setVariableType(tracker, varName, typeInfo);
```

**Key Changes**:
- Use immutable Map/Set libraries or custom implementations
- Return new instances from all operations
- Chain operations functionally

### Phase 2: Import/Export Detection (task-100.11.2)

Separate detection from mutation:

```typescript
// Before (mutates tracker)
function detectFileExports(file_path, tracker, registry, ...) {
  tracker.markAsExported(name);
  registry.registerExport(...);
}

// After (returns results)
function detectFileExports(file_path, graph, fileCache): ExportDetectionResult {
  return {
    exportedDefinitions: Set<string>,
    classExports: Array<ClassExportInfo>
  };
}
```

### Phase 3: Call Analysis (task-100.11.3)

Return analysis results instead of mutating:

```typescript
// Before (mutates during analysis)
function get_calls_from_definition(def) {
  localTypeTracker.setVariableType(...);
  // analyze and mutate
  return calls;
}

// After (returns complete results)
function get_calls_from_definition(def): CallAnalysisResult {
  return {
    calls: FunctionCall[],
    discoveredTypes: VariableTypeInfo[],
    importedClasses: ImportedClassInfo[]
  };
}
```

### Phase 4: Immutable Data Structure (task-100.11.4)

Create update utilities:

```typescript
interface ProjectCallGraphData {
  readonly file_graphs: ReadonlyMap<string, ScopeGraph>;
  readonly file_cache: ReadonlyMap<string, FileCache>;
  readonly languages: ReadonlyMap<string, LanguageConfig>;
  readonly file_type_trackers: ReadonlyMap<string, FileTypeTrackerData>;
  readonly project_type_registry: ProjectTypeRegistryData;
}

// Update functions
function updateFileTypeTracker(
  data: ProjectCallGraphData,
  file_path: string,
  updater: (tracker: FileTypeTrackerData) => FileTypeTrackerData
): ProjectCallGraphData {
  const currentTracker = data.file_type_trackers.get(file_path) || createFileTypeTracker();
  const newTracker = updater(currentTracker);
  
  return {
    ...data,
    file_type_trackers: new Map(data.file_type_trackers).set(file_path, newTracker)
  };
}
```

### Phase 5: Two-Phase Building (task-100.11.5)

Separate analysis from construction:

```typescript
// Phase 1: Collect all data
interface CollectedData {
  functions: Map<string, Def[]>;
  exports: Map<string, ExportInfo[]>;
  imports: Map<string, ImportInfo[]>;
  calls: FunctionCall[];
}

function collectCallGraphData(data: ProjectCallGraphData): CollectedData {
  // Pure collection, no mutations
}

// Phase 2: Build final graph
function buildCallGraph(collected: CollectedData): CallGraph {
  // Construct final immutable graph
}
```

### Phase 6: Testing & Performance (task-100.11.6)

Ensure quality and performance:

```typescript
// Immutability test
test('setVariableType returns new instance', () => {
  const original = createFileTypeTracker();
  const updated = setVariableType(original, 'x', typeInfo);
  
  expect(updated).not.toBe(original);
  expect(getVariableType(original, 'x')).toBeUndefined();
  expect(getVariableType(updated, 'x')).toEqual(typeInfo);
});

// Performance benchmark
benchmark('immutable vs mutable type tracking', () => {
  // Compare performance
});
```

## Benefits

1. **Predictability**: No hidden mutations
2. **Testability**: Pure functions are easy to test
3. **Debugging**: State changes are explicit
4. **Concurrency**: Safe for parallel processing
5. **Time Travel**: Can keep history of states

## Migration Path

1. Start with leaf modules (type tracking)
2. Work up to higher-level functions
3. Maintain compatibility during transition
4. Replace old implementation once complete

## Libraries to Consider

- **Immer**: For easy immutable updates
- **Immutable.js**: Efficient immutable collections
- **Native**: Use Object.freeze and careful copying

## Success Criteria

- All functions are pure (no side effects)
- All data structures are deeply immutable
- Performance is within 10% of mutable version
- Memory usage is acceptable
- Code is more maintainable and testable